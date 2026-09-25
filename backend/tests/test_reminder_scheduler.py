"""Covers the two new reminder_scheduler.py jobs added alongside the existing
send_due_recheck_reminders: send_daily_treatment_reminders (batches across a
patient's active plans, gated by an evening UTC threshold and a once-per-day
field) and send_checkin_photo_reminders (gated by a 7-day-stale-session check
and a once-per-week field)."""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from app.db.database import db, next_id
from app.services.reminder_scheduler import send_checkin_photo_reminders, send_daily_treatment_reminders


def _patched_now(hour_or_dt):
    """Returns a context manager patching reminder_scheduler's datetime.utcnow()
    to a fixed value, either a specific datetime or "today at this hour"."""
    fixed = hour_or_dt if isinstance(hour_or_dt, datetime) else datetime.utcnow().replace(hour=hour_or_dt, minute=0, second=0, microsecond=0)
    mock_datetime = MagicMock(wraps=datetime)
    mock_datetime.utcnow.return_value = fixed
    return patch("app.services.reminder_scheduler.datetime", mock_datetime), fixed


def _make_patient(name="Reminder Patient"):
    patient_id = next_id("patients")
    db.patients.insert_one(
        {"_id": patient_id, "name": name, "age": 30, "skin_type": "normal", "assigned_doctor_id": None}
    )
    return patient_id


def _make_patient_user(patient_id):
    user_id = next_id("users")
    db.users.insert_one(
        {
            "_id": user_id,
            "phone": f"reminder-test-{user_id}",
            "email": f"reminder-test-{user_id}@example.com",
            "full_name": "Reminder Test Patient",
            "role": "patient",
            "is_active": True,
            "patient_id": patient_id,
            "push_token": None,
        }
    )
    return user_id


def _active_plan(patient_id, condition="acne"):
    db.treatment_plans.insert_one(
        {
            "_id": next_id("treatment_plans"),
            "patient_id": patient_id,
            "condition": condition,
            "started_session_id": 1,
            "started_at": datetime.utcnow(),
            "severity_at_start": "mild",
            "remedy_type": "Home remedy",
            "remedy_text": "Tea tree oil",
            "how_to": "Apply once daily.",
            "duration_weeks": "2-4",
            "expected_recheck_at": None,
            "status": "active",
            "outcome_session_id": None,
            "resolved_at": None,
            "outcome_severity": None,
            "outcome": None,
            "adherence": None,
            "reminder_sent_at": None,
        }
    )


# --- send_daily_treatment_reminders ---------------------------------------


def test_treatment_reminder_skipped_before_evening_threshold():
    patient_id = _make_patient()
    _make_patient_user(patient_id)
    _active_plan(patient_id)

    ctx, _ = _patched_now(10)
    with ctx:
        assert send_daily_treatment_reminders(db) == 0


def test_treatment_reminder_batches_multiple_active_plans_into_one_notification():
    # Asserts against this patient's own DB state rather than the function's
    # aggregate return value -- other tests in this file also leave active
    # plans/patients behind (e.g. the before-threshold test's patient is
    # never gated, since its call returns before touching the DB), so a
    # shared-session global sent-count isn't a safe thing to pin an exact
    # value to here.
    patient_id = _make_patient()
    user_id = _make_patient_user(patient_id)
    _active_plan(patient_id, "acne")
    _active_plan(patient_id, "pigmentation")

    ctx, fixed = _patched_now(19)
    with ctx:
        sent = send_daily_treatment_reminders(db)

    assert sent >= 1
    rows = list(db.notifications.find({"user_id": user_id, "type": "treatment_reminder"}))
    assert len(rows) == 1
    assert "2 active treatments" in rows[0]["message"]
    patient = db.patients.find_one({"_id": patient_id})
    assert patient["last_treatment_reminder_date"] == fixed.strftime("%Y-%m-%d")


def test_treatment_reminder_not_sent_twice_same_day():
    patient_id = _make_patient()
    user_id = _make_patient_user(patient_id)
    _active_plan(patient_id)

    ctx, _ = _patched_now(19)
    with ctx:
        send_daily_treatment_reminders(db)
        send_daily_treatment_reminders(db)

    # Exactly one notification for THIS patient, regardless of how many
    # other patients also got reminded across both calls.
    rows = list(db.notifications.find({"user_id": user_id, "type": "treatment_reminder"}))
    assert len(rows) == 1


def test_treatment_reminder_skipped_for_patient_without_login_account():
    patient_id = _make_patient()
    _active_plan(patient_id)  # no user account linked

    ctx, _ = _patched_now(19)
    with ctx:
        send_daily_treatment_reminders(db)

    assert db.notifications.find_one({"link": f"/progress/{patient_id}", "type": "treatment_reminder"}) is None


# --- send_checkin_photo_reminders -----------------------------------------


def _session(patient_id, captured_at):
    db.sessions.insert_one(
        {
            "_id": next_id("sessions"),
            "patient_id": patient_id,
            "image_path": "x.jpg",
            "captured_at": captured_at,
        }
    )


def test_checkin_reminder_skipped_for_recent_session():
    patient_id = _make_patient()
    _make_patient_user(patient_id)
    _session(patient_id, datetime.utcnow())

    assert send_checkin_photo_reminders(db) == 0


def test_checkin_reminder_sent_for_stale_session():
    patient_id = _make_patient()
    user_id = _make_patient_user(patient_id)
    _session(patient_id, datetime.utcnow() - timedelta(days=10))

    sent = send_checkin_photo_reminders(db)
    assert sent == 1
    row = db.notifications.find_one({"user_id": user_id, "type": "checkin_reminder"})
    assert row is not None
    patient = db.patients.find_one({"_id": patient_id})
    assert patient["last_checkin_reminder_at"] is not None


def test_checkin_reminder_skipped_for_patient_with_no_sessions():
    patient_id = _make_patient()
    _make_patient_user(patient_id)
    assert send_checkin_photo_reminders(db) == 0


def test_checkin_reminder_gated_by_recent_reminder():
    patient_id = _make_patient()
    _make_patient_user(patient_id)
    _session(patient_id, datetime.utcnow() - timedelta(days=10))
    db.patients.update_one(
        {"_id": patient_id}, {"$set": {"last_checkin_reminder_at": datetime.utcnow() - timedelta(days=2)}}
    )

    assert send_checkin_photo_reminders(db) == 0
