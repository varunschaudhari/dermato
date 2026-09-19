def _create_patient(client, headers, name="Export Patient"):
    res = client.post(
        "/api/patients/", json={"name": name, "age": 35, "skin_type": "combo"}, headers=headers
    )
    return res.json()["id"]


def test_export_patient_data_bundle(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    client.post(f"/api/patients/{patient_id}/messages", json={"body": "note"}, headers=auth_headers)

    res = client.get(f"/api/patients/{patient_id}/export", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["patient"]["id"] == patient_id
    assert len(body["messages"]) == 1
    assert "sessions" in body
    assert "treatment_plans" in body
    assert "appointments" in body
    assert "exported_at" in body


def test_export_requires_auth(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    res = client.get(f"/api/patients/{patient_id}/export")
    assert res.status_code == 401


def test_export_nonexistent_patient_404s(client, auth_headers):
    res = client.get("/api/patients/999999/export", headers=auth_headers)
    assert res.status_code == 404


def test_delete_patient_requires_admin(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    res = client.delete(f"/api/patients/{patient_id}", headers=auth_headers)
    assert res.status_code == 403


def test_admin_can_delete_patient_and_cascade(client, auth_headers, admin_headers):
    patient_id = _create_patient(client, auth_headers)
    client.post(f"/api/patients/{patient_id}/messages", json={"body": "note"}, headers=auth_headers)

    res = client.delete(f"/api/patients/{patient_id}", headers=admin_headers)
    assert res.status_code == 200

    res = client.get(f"/api/patients/{patient_id}", headers=auth_headers)
    assert res.status_code == 404

    # get_messages doesn't validate patient existence — deleting cascades the
    # messages themselves, so the thread for a gone patient just reads empty.
    res = client.get(f"/api/patients/{patient_id}/messages", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_delete_nonexistent_patient_404s(client, admin_headers):
    res = client.delete("/api/patients/999999", headers=admin_headers)
    assert res.status_code == 404
