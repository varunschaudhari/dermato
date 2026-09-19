import io


def test_import_csv_creates_patients(client, auth_headers):
    csv_content = "name,age,skin_type\nAlice,29,oily\nBob,41,dry\n"
    files = {"file": ("patients.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    res = client.post("/api/patients/import", files=files, headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert len(body["created"]) == 2
    assert body["errors"] == []
    assert {p["name"] for p in body["created"]} == {"Alice", "Bob"}


def test_import_csv_reports_row_errors(client, auth_headers):
    csv_content = "name,age,skin_type\n,30,oily\nCarl,notanumber,dry\nDana,33,combo\n"
    files = {"file": ("patients.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    res = client.post("/api/patients/import", files=files, headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert len(body["created"]) == 1
    assert body["created"][0]["name"] == "Dana"
    assert len(body["errors"]) == 2
    assert body["errors"][0]["row"] == 2
    assert body["errors"][1]["row"] == 3


def test_import_rejects_non_csv_file(client, auth_headers):
    files = {"file": ("patients.txt", io.BytesIO(b"not a csv"), "text/plain")}
    res = client.post("/api/patients/import", files=files, headers=auth_headers)
    assert res.status_code == 400


def test_import_requires_required_columns(client, auth_headers):
    csv_content = "full_name,years\nAlice,29\n"
    files = {"file": ("patients.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    res = client.post("/api/patients/import", files=files, headers=auth_headers)
    assert res.status_code == 400


def test_import_requires_auth(client):
    files = {"file": ("patients.csv", io.BytesIO(b"name,age,skin_type\n"), "text/csv")}
    res = client.post("/api/patients/import", files=files)
    assert res.status_code == 401


def test_imported_patient_appears_in_list(client, auth_headers):
    csv_content = "name,age,skin_type\nImported One,50,normal\n"
    files = {"file": ("patients.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    client.post("/api/patients/import", files=files, headers=auth_headers)

    res = client.get("/api/patients/", headers=auth_headers)
    assert any(p["name"] == "Imported One" for p in res.json())
