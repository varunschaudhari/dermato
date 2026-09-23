import threading
import time
import traceback
from datetime import datetime

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


def _run_loop() -> None:
    interval_seconds = settings.REMINDER_CHECK_INTERVAL_MINUTES * 60
    db = get_db()
    while True:
        try:
            send_due_recheck_reminders(db)
        except Exception:
            # A bad run shouldn't kill the background loop or the app — log and retry next tick.
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
