def test_list_patients_requires_auth(client):
    res = client.get("/api/patients/")
    assert res.status_code == 401


def test_create_and_list_patient(client, auth_headers):
    res = client.post(
        "/api/patients/",
        json={"name": "Jane Doe", "age": 30, "skin_type": "oily"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    patient = res.json()
    assert patient["name"] == "Jane Doe"
    assert patient["age"] == 30

    res = client.get("/api/patients/", headers=auth_headers)
    assert res.status_code == 200
    names = [p["name"] for p in res.json()]
    assert "Jane Doe" in names


def test_get_single_patient(client, auth_headers):
    created = client.post(
        "/api/patients/",
        json={"name": "Solo Patient", "age": 40, "skin_type": "dry"},
        headers=auth_headers,
    ).json()

    res = client.get(f"/api/patients/{created['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Solo Patient"


def test_get_nonexistent_patient_404s(client, auth_headers):
    res = client.get("/api/patients/999999", headers=auth_headers)
    assert res.status_code == 404


def _register_patient(client, unique_phone, unique_email):
    res = client.post(
        "/api/auth/register-patient",
        json={
            "phone": unique_phone,
            "email": unique_email,
            "password": "testpassword123",
            "full_name": "Test Patient",
            "age": 25,
            "skin_type": "combination",
        },
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    patient_id = client.get("/api/auth/me", headers=headers).json()["patient_id"]
    return headers, patient_id


def _insert_active_plan(patient_id):
    from datetime import datetime

    from app.db.database import db, next_id

    plan_id = next_id("treatment_plans")
    db.treatment_plans.insert_one(
        {
            "_id": plan_id,
            "patient_id": patient_id,
            "condition": "acne",
            "started_session_id": 1,
            "started_at": datetime.utcnow(),
            "status": "active",
            "severity_at_start": "mild",
            "remedy_type": "Home remedy",
            "remedy_text": "Tea tree oil",
            "adherence": None,
        }
    )
    return plan_id


def test_patient_can_set_adherence_on_own_active_plan(client, unique_phone, unique_email):
    headers, patient_id = _register_patient(client, unique_phone, unique_email)
    plan_id = _insert_active_plan(patient_id)

    res = client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan_id}/adherence",
        json={"adherence": "not_followed"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["adherence"] == "not_followed"

    res = client.get(f"/api/patients/{patient_id}/treatment-plans", headers=headers)
    assert res.json()[0]["adherence"] == "not_followed"


def test_other_patient_cannot_set_adherence(client, unique_phone, unique_email):
    headers, patient_id = _register_patient(client, unique_phone, unique_email)
    plan_id = _insert_active_plan(patient_id)

    other_phone = f"8{unique_phone}"
    other_email = f"other.{unique_email}"
    other_headers, _ = _register_patient(client, other_phone, other_email)

    res = client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan_id}/adherence",
        json={"adherence": "followed"},
        headers=other_headers,
    )
    assert res.status_code == 403


def test_invalid_adherence_value_rejected(client, unique_phone, unique_email):
    headers, patient_id = _register_patient(client, unique_phone, unique_email)
    plan_id = _insert_active_plan(patient_id)

    res = client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan_id}/adherence",
        json={"adherence": "sort-of"},
        headers=headers,
    )
    assert res.status_code == 400


def test_adherence_on_resolved_plan_404s(client, unique_phone, unique_email):
    from app.db.database import db, next_id

    headers, patient_id = _register_patient(client, unique_phone, unique_email)
    plan_id = next_id("treatment_plans")
    db.treatment_plans.insert_one(
        {
            "_id": plan_id,
            "patient_id": patient_id,
            "condition": "acne",
            "status": "resolved",
            "adherence": None,
        }
    )

    res = client.patch(
        f"/api/patients/{patient_id}/treatment-plans/{plan_id}/adherence",
        json={"adherence": "followed"},
        headers=headers,
    )
    assert res.status_code == 404
