"""Covers GET /notifications' skip/limit pagination, added because daily
reminders (reminder_scheduler.py) make the previously-theoretical "more than
200 notifications" case a real, reachable one."""

from app.db.database import db, next_id
from app.services.notifier import notify_user


def _own_user_id(client, headers):
    return client.get("/api/auth/me", headers=headers).json()["id"]


def test_list_notifications_respects_skip(client, auth_headers):
    user_id = _own_user_id(client, auth_headers)
    for i in range(5):
        notify_user(db, user_id, "test_type", f"message {i}", "/somewhere")

    first_page = client.get("/api/notifications/", params={"limit": 2, "skip": 0}, headers=auth_headers).json()
    second_page = client.get("/api/notifications/", params={"limit": 2, "skip": 2}, headers=auth_headers).json()

    assert len(first_page) == 2
    assert len(second_page) == 2
    first_ids = {n["id"] for n in first_page}
    second_ids = {n["id"] for n in second_page}
    assert first_ids.isdisjoint(second_ids)


def test_list_notifications_default_skip_is_zero(client, auth_headers):
    user_id = _own_user_id(client, auth_headers)
    notify_user(db, user_id, "test_type", "no skip param", "/somewhere")

    with_default = client.get("/api/notifications/", params={"limit": 50}, headers=auth_headers).json()
    with_explicit_zero = client.get(
        "/api/notifications/", params={"limit": 50, "skip": 0}, headers=auth_headers
    ).json()

    assert [n["id"] for n in with_default] == [n["id"] for n in with_explicit_zero]
