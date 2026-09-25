from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.db.database import get_db, to_ns
from app.schemas import NotificationOut
from app.services.notifier import notify_user

router = APIRouter()


def _sync_overdue_recheck_notifications(db, current_user) -> None:
    """Lazily ensures an unread 'recheck overdue' notification exists for every currently
    overdue plan this user can see. There's no scheduler in this app, so rather than a cron
    job, we just reconcile on read — dedup is keyed on (user, plan) via related_id."""
    if current_user.role not in ("admin", "dermatologist"):
        return

    now = datetime.utcnow()
    plans = db.treatment_plans.find(
        {"status": "active", "expected_recheck_at": {"$ne": None, "$lt": now}}
    )

    for plan in plans:
        patient = db.patients.find_one({"_id": plan["patient_id"]})
        if not patient:
            continue
        if current_user.role == "dermatologist" and patient.get("assigned_doctor_id") != current_user.id:
            continue

        exists = db.notifications.find_one(
            {
                "user_id": current_user.id,
                "type": "recheck_overdue",
                "related_id": plan["_id"],
            }
        )
        if exists:
            continue

        notify_user(
            db,
            current_user.id,
            "recheck_overdue",
            f"{patient['name']}'s {plan['condition']} recheck is overdue",
            f"/progress/{patient['_id']}",
            related_id=plan["_id"],
        )


@router.get("/", response_model=list[NotificationOut])
def list_notifications(
    limit: int = 30, skip: int = 0, db=Depends(get_db), current_user=Depends(get_current_user)
):
    _sync_overdue_recheck_notifications(db, current_user)
    notifications = (
        db.notifications.find({"user_id": current_user.id})
        .sort("created_at", -1)
        .skip(max(skip, 0))
        .limit(min(limit, 200))
    )
    return [to_ns(n) for n in notifications]


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    notification = db.notifications.find_one({"_id": notification_id, "user_id": current_user.id})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.notifications.update_one({"_id": notification_id}, {"$set": {"is_read": True}})
    return to_ns(db.notifications.find_one({"_id": notification_id}))


@router.post("/read-all")
def mark_all_read(db=Depends(get_db), current_user=Depends(get_current_user)):
    db.notifications.update_many(
        {"user_id": current_user.id, "is_read": False}, {"$set": {"is_read": True}}
    )
    return {"status": "ok"}


@router.post("/read-for-patient/{patient_id}")
def mark_patient_messages_read(patient_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    """Called when opening a patient's message thread (MessageThread.jsx) --
    clears just this patient's unread 'new_message' notifications for the
    current user, so the inbox's unread badge (get_messages_inbox) reflects
    threads actually read rather than staying stuck until the bell/notifications
    page is used separately."""
    db.notifications.update_many(
        {"user_id": current_user.id, "type": "new_message", "link": f"/progress/{patient_id}", "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"status": "ok"}
