"""Covers notifier.py's notify_user -- the one function every notification call
site in the app now goes through (see routes/analysis.py, appointments.py,
notifications.py, patients.py, sessions.py and services/reminder_scheduler.py).
The in-app row is unconditional; the push half only fires when the target user
has a registered device token, and is a no-op otherwise."""

from unittest.mock import patch

from app.db.database import db
from app.services.notifier import notify_user


def _make_user(push_token=None):
    from app.db.database import next_id

    user_id = next_id("users")
    db.users.insert_one({"_id": user_id, "full_name": "Notifier Test User", "push_token": push_token})
    return user_id


def test_notify_user_always_inserts_notification_row():
    user_id = _make_user()
    notify_user(db, user_id, "test_type", "hello", "/somewhere", related_id=42)

    row = db.notifications.find_one({"user_id": user_id, "type": "test_type"})
    assert row is not None
    assert row["message"] == "hello"
    assert row["link"] == "/somewhere"
    assert row["related_id"] == 42
    assert row["is_read"] is False


def test_notify_user_skips_push_without_token():
    user_id = _make_user(push_token=None)
    with patch("app.services.notifier.send_push") as mock_send:
        notify_user(db, user_id, "test_type", "hello", "/somewhere")
    mock_send.assert_not_called()


def test_notify_user_sends_push_when_token_present():
    user_id = _make_user(push_token="fcm-token-xyz")
    with patch("app.services.notifier.send_push") as mock_send:
        notify_user(db, user_id, "test_type", "hello", "/somewhere")
    mock_send.assert_called_once_with("fcm-token-xyz", title="Dermato", body="hello", link="/somewhere")


def test_send_push_noop_when_firebase_unconfigured():
    # FIREBASE_CREDENTIALS_PATH is left empty in the test environment (see
    # conftest.py) -- this confirms that state never touches firebase_admin.
    from app.services.push_sender import send_push

    send_push("some-token", "Title", "Body", "/link")
