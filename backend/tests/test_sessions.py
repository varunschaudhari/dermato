import io

import cv2
import numpy as np


def _create_patient(client, headers, name="Session Patient"):
    res = client.post(
        "/api/patients/", json={"name": name, "age": 25, "skin_type": "oily"}, headers=headers
    )
    return res.json()["id"]


def _create_patient_login(client, staff_headers, patient_id, phone, email, password="patientpass123"):
    client.post(
        f"/api/patients/{patient_id}/account",
        json={"phone": phone, "email": email, "password": password},
        headers=staff_headers,
    )
    res = client.post("/api/auth/login", data={"username": phone, "password": password})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _fake_jpeg_bytes(color=(130, 150, 200)):
    rng = np.random.default_rng(0)
    image = np.full((480, 480, 3), color, dtype=np.int16)
    image += rng.integers(-18, 19, size=image.shape, dtype=np.int16)
    image = np.clip(image, 0, 255).astype(np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok
    return encoded.tobytes()


def _create_session(client, headers, patient_id):
    files = {"file": ("front.jpg", io.BytesIO(_fake_jpeg_bytes()), "image/jpeg")}
    res = client.post(
        "/api/analysis/analyze", files=files, data={"patient_id": patient_id}, headers=headers
    )
    assert res.status_code == 200
    return res.json()["session_id"]


def test_patient_can_note_own_session(client, auth_headers, unique_email, unique_phone):
    patient_id = _create_patient(client, auth_headers)
    # auth_headers already claimed the raw unique_phone value for the
    # dermatologist (fixtures are cached per-test) -- derive a distinct one.
    patient_headers = _create_patient_login(client, auth_headers, patient_id, f"1{unique_phone}", f"patient.{unique_email}")
    session_id = _create_session(client, patient_headers, patient_id)

    res = client.patch(
        f"/api/sessions/{session_id}/patient-note",
        json={"note": "Started a new moisturizer today"},
        headers=patient_headers,
    )
    assert res.status_code == 200
    assert res.json()["patient_note"] == "Started a new moisturizer today"


def test_patient_cannot_note_another_patients_session(client, auth_headers, unique_email, unique_phone):
    patient_id = _create_patient(client, auth_headers, "Owner")
    other_patient_id = _create_patient(client, auth_headers, "Intruder")
    session_id = _create_session(client, auth_headers, patient_id)
    other_headers = _create_patient_login(client, auth_headers, other_patient_id, f"1{unique_phone}", f"intruder.{unique_email}")

    res = client.patch(
        f"/api/sessions/{session_id}/patient-note", json={"note": "not mine"}, headers=other_headers
    )
    assert res.status_code == 403


def test_staff_cannot_use_patient_note_endpoint(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    session_id = _create_session(client, auth_headers, patient_id)

    res = client.patch(
        f"/api/sessions/{session_id}/patient-note", json={"note": "staff writing"}, headers=auth_headers
    )
    assert res.status_code == 403
