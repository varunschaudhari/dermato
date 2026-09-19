def _create_patient(client, headers, name="Msg Patient"):
    res = client.post(
        "/api/patients/", json={"name": name, "age": 22, "skin_type": "dry"}, headers=headers
    )
    return res.json()["id"]


def _create_patient_login(client, staff_headers, patient_id, email, password="patientpass123"):
    client.post(
        f"/api/patients/{patient_id}/account",
        json={"email": email, "password": password},
        headers=staff_headers,
    )
    res = client.post("/api/auth/login", data={"username": email, "password": password})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_send_and_list_messages(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)

    res = client.post(
        f"/api/patients/{patient_id}/messages", json={"body": "Hello patient"}, headers=auth_headers
    )
    assert res.status_code == 200
    msg = res.json()
    assert msg["body"] == "Hello patient"
    assert msg["sender_role"] == "dermatologist"

    res = client.get(f"/api/patients/{patient_id}/messages", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_empty_message_rejected(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    res = client.post(f"/api/patients/{patient_id}/messages", json={"body": "   "}, headers=auth_headers)
    assert res.status_code == 400


def test_messages_require_auth(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    res = client.get(f"/api/patients/{patient_id}/messages")
    assert res.status_code == 401


def test_patient_can_message_own_thread_but_not_others(client, auth_headers, unique_email):
    patient_id = _create_patient(client, auth_headers, "Own Patient")
    other_patient_id = _create_patient(client, auth_headers, "Other Patient")
    # auth_headers and this test both resolve the same cached `unique_email` fixture
    # instance, so the dermatologist is already registered under that address —
    # derive a distinct one for the patient's login.
    patient_headers = _create_patient_login(client, auth_headers, patient_id, f"patient.{unique_email}")

    res = client.post(
        f"/api/patients/{patient_id}/messages", json={"body": "hi doc"}, headers=patient_headers
    )
    assert res.status_code == 200
    assert res.json()["sender_role"] == "patient"

    res = client.get(f"/api/patients/{other_patient_id}/messages", headers=patient_headers)
    assert res.status_code == 403


def test_message_from_patient_notifies_assigned_doctor(client, auth_headers, unique_email):
    doctor_id = client.get("/api/auth/me", headers=auth_headers).json()["id"]
    patient_id = _create_patient(client, auth_headers, "Notified Patient")
    patient_headers = _create_patient_login(client, auth_headers, patient_id, f"patient.{unique_email}")

    client.post(f"/api/patients/{patient_id}/messages", json={"body": "hi doc"}, headers=patient_headers)

    res = client.get("/api/notifications/", headers=auth_headers)
    assert res.status_code == 200
    assert any(n["type"] == "new_message" for n in res.json())
