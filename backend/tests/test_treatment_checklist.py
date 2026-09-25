import io

import cv2
import numpy as np


def _create_patient(client, headers, name="Checklist Patient"):
    res = client.post(
        "/api/patients/", json={"name": name, "age": 28, "skin_type": "oily"}, headers=headers
    )
    return res.json()["id"]


def _fake_jpeg_bytes(color=(130, 150, 200)):
    rng = np.random.default_rng(0)
    image = np.full((480, 480, 3), color, dtype=np.int16)
    image += rng.integers(-18, 19, size=image.shape, dtype=np.int16)
    image = np.clip(image, 0, 255).astype(np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok
    return encoded.tobytes()


def _analyze(client, headers, patient_id):
    files = {"file": ("front.jpg", io.BytesIO(_fake_jpeg_bytes()), "image/jpeg")}
    res = client.post(
        "/api/analysis/analyze", files=files, data={"patient_id": patient_id}, headers=headers
    )
    assert res.status_code == 200
    return res.json()


def _register_patient_user(client, patient_id, doctor_headers, unique_phone, unique_email):
    """Links a real patient-role login to an existing staff-created patient
    record, mirroring create_patient_account -- needed since the
    checklist-toggle endpoint is patient-self-report-only. Prefixes the
    unique_phone/unique_email fixtures (same trick test_sessions.py uses)
    rather than using them raw -- auth_headers's own dermatologist_token
    fixture already consumed that exact cached value for the doctor account
    within this same test call, so reusing it verbatim collides."""
    phone = f"1{unique_phone}"
    email = f"checklist.{unique_email}"
    res = client.post(
        f"/api/patients/{patient_id}/account",
        json={"phone": phone, "email": email, "password": "testpassword123"},
        headers=doctor_headers,
    )
    assert res.status_code == 200
    login = client.post("/api/auth/login", data={"username": phone, "password": "testpassword123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _first_active_plan(client, headers, patient_id):
    plans = client.get(f"/api/patients/{patient_id}/treatment-plans", headers=headers).json()
    return next(p for p in plans if p["status"] == "active")


def test_get_checklist_returns_items_and_empty_completions_for_new_plan(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    _analyze(client, auth_headers, patient_id)
    plan = _first_active_plan(client, auth_headers, patient_id)

    res = client.get(
        f"/api/patients/{patient_id}/treatment-plans/{plan['id']}/checklist", headers=auth_headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["completed_indices"] == []
    # Referral-tier plans (severe) have no checklist; everything else has at least one item.
    if plan["remedy_type"] == "Referral":
        assert body["items"] == []
    else:
        assert len(body["items"]) >= 1


def test_toggle_checklist_item_persists_for_the_day(client, auth_headers, unique_phone, unique_email):
    patient_id = _create_patient(client, auth_headers)
    result = _analyze(client, auth_headers, patient_id)
    plan = _first_active_plan(client, auth_headers, patient_id)
    if plan["remedy_type"] == "Referral":
        return  # no checklist to toggle for a severe/referral plan

    patient_headers = _register_patient_user(client, patient_id, auth_headers, unique_phone, unique_email)

    res = client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan['id']}/checklist",
        json={"index": 0, "completed": True, "date": "2027-01-10"},
        headers=patient_headers,
    )
    assert res.status_code == 200
    assert res.json()["completed_indices"] == [0]

    # Re-fetching the same date reflects the toggle.
    res = client.get(
        f"/api/patients/{patient_id}/treatment-plans/{plan['id']}/checklist",
        params={"date": "2027-01-10"},
        headers=patient_headers,
    )
    assert res.json()["completed_indices"] == [0]

    # A different date is unaffected.
    res = client.get(
        f"/api/patients/{patient_id}/treatment-plans/{plan['id']}/checklist",
        params={"date": "2027-01-11"},
        headers=patient_headers,
    )
    assert res.json()["completed_indices"] == []


def test_toggle_checklist_item_can_be_unchecked(client, auth_headers, unique_phone, unique_email):
    patient_id = _create_patient(client, auth_headers)
    _analyze(client, auth_headers, patient_id)
    plan = _first_active_plan(client, auth_headers, patient_id)
    if plan["remedy_type"] == "Referral":
        return

    patient_headers = _register_patient_user(client, patient_id, auth_headers, unique_phone, unique_email)
    client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan['id']}/checklist",
        json={"index": 0, "completed": True, "date": "2027-02-01"},
        headers=patient_headers,
    )
    res = client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan['id']}/checklist",
        json={"index": 0, "completed": False, "date": "2027-02-01"},
        headers=patient_headers,
    )
    assert res.status_code == 200
    assert res.json()["completed_indices"] == []


def test_toggle_checklist_rejects_out_of_range_index(client, auth_headers, unique_phone, unique_email):
    patient_id = _create_patient(client, auth_headers)
    _analyze(client, auth_headers, patient_id)
    plan = _first_active_plan(client, auth_headers, patient_id)
    if plan["remedy_type"] == "Referral":
        return

    patient_headers = _register_patient_user(client, patient_id, auth_headers, unique_phone, unique_email)
    res = client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan['id']}/checklist",
        json={"index": 999, "completed": True},
        headers=patient_headers,
    )
    assert res.status_code == 400


def test_toggle_checklist_rejected_for_staff(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    _analyze(client, auth_headers, patient_id)
    plan = _first_active_plan(client, auth_headers, patient_id)

    res = client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan['id']}/checklist",
        json={"index": 0, "completed": True},
        headers=auth_headers,
    )
    assert res.status_code == 403


def test_checklist_requires_auth(client):
    res = client.get("/api/patients/1/treatment-plans/1/checklist")
    assert res.status_code == 401
