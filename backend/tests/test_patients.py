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
