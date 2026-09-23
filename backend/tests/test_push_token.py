from app.db.database import db


def test_set_and_clear_push_token(client, auth_headers):
    user_id = client.get("/api/auth/me", headers=auth_headers).json()["id"]

    res = client.post("/api/auth/me/push-token", json={"token": "fcm-token-abc"}, headers=auth_headers)
    assert res.status_code == 200
    assert db.users.find_one({"_id": user_id})["push_token"] == "fcm-token-abc"

    res = client.delete("/api/auth/me/push-token", headers=auth_headers)
    assert res.status_code == 200
    assert db.users.find_one({"_id": user_id})["push_token"] is None


def test_push_token_requires_auth(client):
    res = client.post("/api/auth/me/push-token", json={"token": "fcm-token-abc"})
    assert res.status_code == 401
