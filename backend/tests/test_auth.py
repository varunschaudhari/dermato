def test_register_and_login(client, unique_email):
    res = client.post(
        "/api/auth/register",
        json={"email": unique_email, "password": "testpassword123", "full_name": "New Doctor"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == unique_email
    assert body["role"] == "dermatologist"  # self-registration is always dermatologist

    res = client.post(
        "/api/auth/login",
        data={"username": unique_email, "password": "testpassword123"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_register_duplicate_email_rejected(client, unique_email):
    payload = {"email": unique_email, "password": "testpassword123", "full_name": "Dup"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 400


def test_login_wrong_password_rejected(client, unique_email):
    client.post(
        "/api/auth/register",
        json={"email": unique_email, "password": "testpassword123", "full_name": "X"},
    )
    res = client.post("/api/auth/login", data={"username": unique_email, "password": "wrongpass"})
    assert res.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["role"] == "dermatologist"


def test_forgot_password_does_not_leak_whether_email_exists(client, unique_email):
    res_unknown = client.post("/api/auth/forgot-password", json={"email": "nobody@nowhere.example"})
    client.post(
        "/api/auth/register",
        json={"email": unique_email, "password": "testpassword123", "full_name": "X"},
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
