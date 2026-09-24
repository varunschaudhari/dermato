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


def test_busy_times_reflects_booked_appointment(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    patient_id = _create_patient(client, auth_headers)
    client.post(
        "/api/appointments/",
        json={"patient_id": patient_id, "doctor_id": doctor_id, "scheduled_at": "2027-06-10T13:30:00"},
        headers=auth_headers,
    )

    res = client.get(
        f"/api/appointments/doctors/{doctor_id}/busy-times",
        params={"date": "2027-06-10"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    times = res.json()
    assert len(times) == 1
    assert times[0].startswith("2027-06-10T13:30:00")


def test_busy_times_empty_for_a_day_with_no_appointments(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    res = client.get(
        f"/api/appointments/doctors/{doctor_id}/busy-times",
        params={"date": "2027-06-11"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json() == []


def test_busy_times_rejects_malformed_date(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    res = client.get(
        f"/api/appointments/doctors/{doctor_id}/busy-times",
        params={"date": "not-a-date"},
        headers=auth_headers,
    )
    assert res.status_code == 400


def _weekday_key(date_str):
    from datetime import datetime

    return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][datetime.strptime(date_str, "%Y-%m-%d").weekday()]


def test_available_slots_unconfigured_when_no_working_hours_set(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    res = client.get(
        f"/api/appointments/doctors/{doctor_id}/available-slots",
        params={"date": "2027-07-05"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json() == {"configured": False, "slots": []}


def test_available_slots_respects_working_hours_and_excludes_booked_time(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    patient_id = _create_patient(client, auth_headers)
    date_str = "2027-07-06"

    res = client.patch(
        "/api/auth/me/working-hours",
        json={"working_hours": {_weekday_key(date_str): {"start": "09:00", "end": "10:00"}}},
        headers=auth_headers,
    )
    assert res.status_code == 200

    client.post(
        "/api/appointments/",
        json={"patient_id": patient_id, "doctor_id": doctor_id, "scheduled_at": f"{date_str}T09:00:00"},
        headers=auth_headers,
    )

    res = client.get(
        f"/api/appointments/doctors/{doctor_id}/available-slots",
        params={"date": date_str},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is True
    times = [t[11:16] for t in body["slots"]]
    assert "09:00" not in times
    assert "09:30" in times


def test_available_slots_rejects_malformed_date(client, auth_headers):
    doctor_id = _get_own_id(client, auth_headers)
    res = client.get(
        f"/api/appointments/doctors/{doctor_id}/available-slots",
        params={"date": "not-a-date"},
        headers=auth_headers,
    )
    assert res.status_code == 400
