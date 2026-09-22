import os

from pymongo import MongoClient

# Point the app at an isolated Mongo database and a permissive rate limit
# *before* any app module is imported, since Settings() and the rate limiter
# are both constructed at import time.
TEST_DB_NAME = "dermato_test"
os.environ["MONGO_DB_NAME"] = TEST_DB_NAME
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["ADMIN_EMAIL"] = "admin@test.local"
os.environ["ADMIN_PASSWORD"] = "testadminpass123"
os.environ["ADMIN_PHONE"] = "9000000000"
os.environ["LOGIN_RATE_LIMIT"] = "1000/minute"

_cleanup_client = MongoClient(os.environ.get("MONGO_URI", "mongodb://localhost:27017"))
_cleanup_client.drop_database(TEST_DB_NAME)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
    _cleanup_client.drop_database(TEST_DB_NAME)
    _cleanup_client.close()


@pytest.fixture
def dermatologist_token(client, unique_email, unique_phone):
    client.post(
        "/api/auth/register",
        json={
            "phone": unique_phone,
            "email": unique_email,
            "password": "testpassword123",
            "full_name": "Test Doctor",
        },
    )
    res = client.post(
        "/api/auth/login",
        data={"username": unique_phone, "password": "testpassword123"},
    )
    return res.json()["access_token"]


@pytest.fixture
def auth_headers(dermatologist_token):
    return {"Authorization": f"Bearer {dermatologist_token}"}


@pytest.fixture
def admin_headers(client):
    res = client.post(
        "/api/auth/login",
        data={"username": os.environ["ADMIN_PHONE"], "password": os.environ["ADMIN_PASSWORD"]},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


_counter = {"n": 0}


@pytest.fixture
def unique_email():
    _counter["n"] += 1
    return f"test_user_{_counter['n']}@example.com"


@pytest.fixture
def unique_phone():
    _counter["n"] += 1
    # 10-digit, doesn't collide with unique_email's shared counter or with
    # any fixed seed/admin phone number used elsewhere in the suite.
    return f"70000{_counter['n']:05d}"
