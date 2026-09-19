from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.db.database import get_db, next_id, to_ns
from app.schemas import NotificationOut

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

        db.notifications.insert_one(
            {
                "_id": next_id("notifications"),
                "user_id": current_user.id,
                "type": "recheck_overdue",
                "message": f"{patient['name']}'s {plan['condition']} recheck is overdue",
                "link": f"/progress/{patient['_id']}",
                "related_id": plan["_id"],
                "is_read": False,
                "created_at": datetime.utcnow(),
            }
        )


@router.get("/", response_model=list[NotificationOut])
def list_notifications(limit: int = 30, db=Depends(get_db), current_user=Depends(get_current_user)):
    _sync_overdue_recheck_notifications(db, current_user)
    notifications = (
        db.notifications.find({"user_id": current_user.id}).sort("created_at", -1).limit(min(limit, 200))
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
