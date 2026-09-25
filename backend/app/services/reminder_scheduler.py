import threading
import time
import traceback
from datetime import datetime, timedelta

from app.core.config import settings
from app.db.database import get_db
from app.services.mailer import send_recheck_reminder_email
from app.services.notifier import notify_user


def send_due_recheck_reminders(db) -> int:
    """Proactively notifies patients whose active treatment plan has reached its
    expected_recheck_at — the actual "come back and rescan" nudge, as opposed to
    notifications.py's _sync_overdue_recheck_notifications, which only tells
    staff a patient is overdue and only when a doctor happens to open the app.

    reminder_sent_at gates this to firing once per plan; querying it as None
    matches both explicitly-null and (for any plan predating this field)
    missing values, so no migration is needed. Returns the number sent, for
    logging.
    """
    now = datetime.utcnow()
    due_plans = db.treatment_plans.find(
        {"status": "active", "expected_recheck_at": {"$ne": None, "$lte": now}, "reminder_sent_at": None}
    )

    sent = 0
    for plan in due_plans:
        patient = db.patients.find_one({"_id": plan["patient_id"]})
        patient_user = db.users.find_one({"patient_id": plan["patient_id"], "role": "patient"})
        # No login account (e.g. a staff-created patient with no portal access
        # yet) means no one to notify — mark it reminded anyway so this plan
        # doesn't get re-checked forever.
        if not patient or not patient_user:
            db.treatment_plans.update_one({"_id": plan["_id"]}, {"$set": {"reminder_sent_at": now}})
            continue

        # Analyze is mounted at "/", not "/analyze" -- there is no /analyze route
        # in the frontend router, so this used to link both the in-app
        # notification and the reminder email to a dead page.
        link = settings.FRONTEND_URL
        notify_user(
            db,
            patient_user["_id"],
            "recheck_due",
            f"Time for your {plan['condition']} recheck — it's been "
            f"{plan.get('duration_weeks') or 'a while'} weeks since your last scan.",
            "/",
            related_id=plan["_id"],
        )
        send_recheck_reminder_email(patient_user["email"], patient["name"], plan["condition"], link)

        db.treatment_plans.update_one({"_id": plan["_id"]}, {"$set": {"reminder_sent_at": now}})
        sent += 1

    return sent


def send_daily_treatment_reminders(db) -> int:
    """Nudges each patient with at least one active treatment plan to apply
    their routine today. Batched into ONE notification per patient rather
    than one per plan -- a patient can have up to 4 simultaneously active
    plans (one per condition), and 4 separate pushes the same evening would
    be spammy. Gated by patients.last_treatment_reminder_date (a "YYYY-MM-DD"
    string, distinct from treatment_plans.reminder_sent_at, which gates the
    unrelated once-ever recheck reminder above) so each patient gets at most
    one of these a day.

    Only fires once datetime.utcnow().hour >= 18 -- there's no per-patient
    timezone data anywhere in this app (every timestamp here is already
    UTC-only: captured_at, expected_recheck_at, reminder_sent_at), so this is
    an approximation, not a precise 6pm-local reminder. The actual send time
    also drifts by up to REMINDER_CHECK_INTERVAL_MINUTES past the hour,
    since this only runs on the same poll as everything else in this file.
    """
    now = datetime.utcnow()
    if now.hour < 18:
        return 0
    today = now.strftime("%Y-%m-%d")

    active_plans = list(db.treatment_plans.find({"status": "active"}))
    by_patient = {}
    for plan in active_plans:
        by_patient.setdefault(plan["patient_id"], []).append(plan)

    sent = 0
    for patient_id, plans in by_patient.items():
        patient = db.patients.find_one({"_id": patient_id})
        if not patient or patient.get("last_treatment_reminder_date") == today:
            continue

        patient_user = db.users.find_one({"patient_id": patient_id, "role": "patient"})
        if not patient_user:
            db.patients.update_one({"_id": patient_id}, {"$set": {"last_treatment_reminder_date": today}})
            continue

        conditions = sorted({p["condition"] for p in plans})
        message = (
            f"Time to apply your {conditions[0]} treatment today."
            if len(conditions) == 1
            else f"Time for today's routine — {len(conditions)} active treatments to apply."
        )
        notify_user(db, patient_user["_id"], "treatment_reminder", message, f"/progress/{patient_id}")

        db.patients.update_one({"_id": patient_id}, {"$set": {"last_treatment_reminder_date": today}})
        sent += 1

    return sent


def send_checkin_photo_reminders(db) -> int:
    """Nudges patients who haven't captured a new session in over a week to
    check in again. Only for patients with at least one prior session -- a
    patient who's never scanned belongs to a different "get started" flow,
    out of scope here. Gated on patients.last_checkin_reminder_at so this
    fires at most once a week per patient; no further backoff for v1, so a
    patient inactive for months still gets a weekly nudge."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    sent = 0
    for patient in db.patients.find({}):
        last_reminder = patient.get("last_checkin_reminder_at")
        if last_reminder and last_reminder > week_ago:
            continue

        last_session = db.sessions.find_one({"patient_id": patient["_id"]}, sort=[("captured_at", -1)])
        if not last_session or last_session["captured_at"] > week_ago:
            continue

        patient_user = db.users.find_one({"patient_id": patient["_id"], "role": "patient"})
        if not patient_user:
            db.patients.update_one({"_id": patient["_id"]}, {"$set": {"last_checkin_reminder_at": now}})
            continue

        # "/" is the Analyze page (see the comment on send_due_recheck_reminders
        # above -- same link, same "come scan again" intent).
        notify_user(
            db,
            patient_user["_id"],
            "checkin_reminder",
            "It's been a week — time for a new check-in photo to track your progress.",
            "/",
        )
        db.patients.update_one({"_id": patient["_id"]}, {"$set": {"last_checkin_reminder_at": now}})
        sent += 1

    return sent


def _run_loop() -> None:
    interval_seconds = settings.REMINDER_CHECK_INTERVAL_MINUTES * 60
    db = get_db()
    while True:
        # Each job gets its own try/except so a bad run in one never blocks
        # the others on that tick.
        try:
            send_due_recheck_reminders(db)
        except Exception:
            traceback.print_exc()
        try:
            send_daily_treatment_reminders(db)
        except Exception:
            traceback.print_exc()
        try:
            send_checkin_photo_reminders(db)
        except Exception:
            traceback.print_exc()
        time.sleep(interval_seconds)


def start_reminder_scheduler() -> None:
    """Runs the recheck-reminder check on a background daemon thread. A plain
    thread + sleep loop, not a scheduling library — this app runs a single
    uvicorn worker on a 1-vCPU VPS, and the job is one simple periodic query,
    so APScheduler's job store/misfire machinery would be overhead with no
    real use here.
    """
    thread = threading.Thread(target=_run_loop, daemon=True, name="reminder-scheduler")
    thread.start()
