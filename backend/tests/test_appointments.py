def _get_own_id(client, headers):
    return client.get("/api/auth/me", headers=headers).json()["id"]


def _create_patient(client, headers, name="Test Patient"):
    res = client.post(
        "/api/patients/", json={"name": name, "age": 25, "skin_type": "normal"}, headers=headers
    )
    return res.json()["id"]


def test_list_available_doctors_includes_registered_dermatologist(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    res = client.get("/api/appointments/doctors", headers=auth_headers)
    assert res.status_code == 200
    assert any(d["id"] == doctor_id for d in res.json())


def test_book_and_list_appointment_as_staff(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    patient_id = _create_patient(client, auth_headers)

    res = client.post(
        "/api/appointments/",
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "scheduled_at": "2027-01-15T10:00:00",
            "reason": "Follow-up",
        },
        headers=auth_headers,
    )
    assert res.status_code == 200
    appt = res.json()
    assert appt["status"] == "scheduled"
    assert appt["patient_id"] == patient_id
    assert appt["doctor_id"] == doctor_id
    assert appt["patient_name"] == "Test Patient"

    res = client.get("/api/appointments/", headers=auth_headers)
    assert res.status_code == 200
    assert any(a["id"] == appt["id"] for a in res.json())


def test_double_booking_same_slot_conflicts(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    patient_a = _create_patient(client, auth_headers, "Patient A")
    patient_b = _create_patient(client, auth_headers, "Patient B")

    res1 = client.post(
        "/api/appointments/",
        json={"patient_id": patient_a, "doctor_id": doctor_id, "scheduled_at": "2027-02-01T09:00:00"},
        headers=auth_headers,
    )
    assert res1.status_code == 200

    res2 = client.post(
        "/api/appointments/",
        json={"patient_id": patient_b, "doctor_id": doctor_id, "scheduled_at": "2027-02-01T09:05:00"},
        headers=auth_headers,
    )
    assert res2.status_code == 409


def test_appointment_requires_valid_doctor(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    res = client.post(
        "/api/appointments/",
        json={"patient_id": patient_id, "doctor_id": 999999, "scheduled_at": "2027-04-01T11:00:00"},
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_staff_can_cancel_and_complete_appointment(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    patient_id = _create_patient(client, auth_headers)
    appt = client.post(
        "/api/appointments/",
        json={"patient_id": patient_id, "doctor_id": doctor_id, "scheduled_at": "2027-03-01T11:00:00"},
        headers=auth_headers,
    ).json()

    res = client.patch(
        f"/api/appointments/{appt['id']}/status", json={"status": "completed"}, headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["status"] == "completed"


def test_appointment_rejects_invalid_status(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    patient_id = _create_patient(client, auth_headers)
    appt = client.post(
        "/api/appointments/",
        json={"patient_id": patient_id, "doctor_id": doctor_id, "scheduled_at": "2027-05-01T11:00:00"},
        headers=auth_headers,
    ).json()

    res = client.patch(
        f"/api/appointments/{appt['id']}/status", json={"status": "bogus"}, headers=auth_headers
    )
    assert res.status_code == 400


def test_appointments_require_auth(client):
    res = client.get("/api/appointments/")
    assert res.status_code == 401
