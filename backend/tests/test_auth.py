def test_register_and_login(client, unique_email, unique_phone):
    res = client.post(
        "/api/auth/register",
        json={"phone": unique_phone, "email": unique_email, "password": "testpassword123", "full_name": "New Doctor"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["phone"] == unique_phone
    assert body["email"] == unique_email
    assert body["role"] == "dermatologist"  # self-registration is always dermatologist

    res = client.post(
        "/api/auth/login",
        data={"username": unique_phone, "password": "testpassword123"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_by_email_also_works(client, unique_email, unique_phone):
    client.post(
        "/api/auth/register",
        json={"phone": unique_phone, "email": unique_email, "password": "testpassword123", "full_name": "New Doctor"},
    )
    res = client.post(
        "/api/auth/login",
        data={"username": unique_email, "password": "testpassword123"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_register_duplicate_phone_rejected(client, unique_email, unique_phone):
    payload = {"phone": unique_phone, "email": unique_email, "password": "testpassword123", "full_name": "Dup"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    # Same phone, different email -- still rejected on the phone collision.
    res = client.post(
        "/api/auth/register",
        json={**payload, "email": f"other.{unique_email}"},
    )
    assert res.status_code == 400


def test_register_duplicate_email_rejected(client, unique_email, unique_phone):
    payload = {"phone": unique_phone, "email": unique_email, "password": "testpassword123", "full_name": "Dup"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    # Same email, different phone -- still rejected on the email collision.
    res = client.post(
        "/api/auth/register",
        json={**payload, "phone": f"9{unique_phone}"},
    )
    assert res.status_code == 400


def test_login_wrong_password_rejected(client, unique_email, unique_phone):
    client.post(
        "/api/auth/register",
        json={"phone": unique_phone, "email": unique_email, "password": "testpassword123", "full_name": "X"},
    )
    res = client.post("/api/auth/login", data={"username": unique_phone, "password": "wrongpass"})
    assert res.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["role"] == "dermatologist"


def test_forgot_password_does_not_leak_whether_email_exists(client, unique_email, unique_phone):
    res_unknown = client.post("/api/auth/forgot-password", json={"email": "nobody@nowhere.example"})
    client.post(
        "/api/auth/register",
        json={"phone": unique_phone, "email": unique_email, "password": "testpassword123", "full_name": "X"},
    )
    res_known = client.post("/api/auth/forgot-password", json={"email": unique_email})

    assert res_unknown.status_code == 200
    assert res_known.status_code == 200
    assert res_unknown.json() == res_known.json()


def test_reset_password_rejects_invalid_token(client):
    res = client.post(
        "/api/auth/reset-password", json={"token": "not-a-real-token", "new_password": "newpassword123"}
    )
    assert res.status_code == 400


def test_list_users_requires_admin(client, auth_headers):
    # auth_headers belongs to a dermatologist, not an admin
    res = client.get("/api/auth/users", headers=auth_headers)
    assert res.status_code == 403


def test_update_me_persists_doctor_profile_fields(client, auth_headers):
    res = client.patch(
        "/api/auth/me",
        json={"bio": "15 years treating acne and pigmentation.", "specialization": "Cosmetic Dermatology", "credentials": "MBBS, MD"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["bio"] == "15 years treating acne and pigmentation."
    assert body["specialization"] == "Cosmetic Dermatology"
    assert body["credentials"] == "MBBS, MD"


def test_upload_avatar_sets_avatar_url(client, auth_headers):
    import io

    import cv2
    import numpy as np

    image = np.full((20, 20, 3), (100, 120, 140), dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok

    res = client.post(
        "/api/auth/me/avatar",
        files={"file": ("avatar.jpg", io.BytesIO(encoded.tobytes()), "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["avatar_url"]
    assert body["avatar_url"].startswith("/uploads/")


def test_upload_avatar_rejects_non_image(client, auth_headers):
    import io

    res = client.post(
        "/api/auth/me/avatar",
        files={"file": ("not-an-image.txt", io.BytesIO(b"hello"), "text/plain")},
        headers=auth_headers,
    )
    assert res.status_code == 400


def test_working_hours_update_and_round_trip(client, auth_headers):
    res = client.patch(
        "/api/auth/me/working-hours",
        json={"working_hours": {"mon": {"start": "09:00", "end": "17:00"}}},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["working_hours"] == {"mon": {"start": "09:00", "end": "17:00"}}


def test_working_hours_rejects_unknown_day(client, auth_headers):
    res = client.patch(
        "/api/auth/me/working-hours",
        json={"working_hours": {"someday": {"start": "09:00", "end": "17:00"}}},
        headers=auth_headers,
    )
    assert res.status_code == 400


def test_working_hours_rejects_bad_time_format(client, auth_headers):
    res = client.patch(
        "/api/auth/me/working-hours",
        json={"working_hours": {"mon": {"start": "9am", "end": "17:00"}}},
        headers=auth_headers,
    )
    assert res.status_code == 400


def test_working_hours_rejected_for_patient(client, auth_headers):
    # Register a patient account and confirm it can't set working hours.
    res = client.post(
        "/api/auth/register-patient",
        json={
            "phone": "7000099001",
            "email": "workinghours.patient@example.com",
            "password": "testpassword123",
            "full_name": "Patient X",
            "age": 30,
            "skin_type": "normal",
        },
    )
    token = res.json()["access_token"]
    patient_headers = {"Authorization": f"Bearer {token}"}

    res = client.patch(
        "/api/auth/me/working-hours",
        json={"working_hours": {"mon": {"start": "09:00", "end": "17:00"}}},
        headers=patient_headers,
    )
    assert res.status_code == 403
