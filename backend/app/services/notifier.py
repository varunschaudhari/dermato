from datetime import datetime
from typing import Optional

from app.db.database import next_id
from app.services.push_sender import send_push


def notify_user(db, user_id: int, type: str, message: str, link: str, related_id: Optional[int] = None) -> None:
    """The one place every in-app notification gets created -- inserts the same
    db.notifications row every call site used to build by hand, and additionally
    pushes to the user's device if they've registered one (mobile app only; a
    dermatologist/admin never has a push_token, so this is a no-op for them)."""
    doc = {
        "_id": next_id("notifications"),
        "user_id": user_id,
        "type": type,
        "message": message,
        "link": link,
        "related_id": related_id,
        "is_read": False,
        "created_at": datetime.utcnow(),
    }
    db.notifications.insert_one(doc)

    user = db.users.find_one({"_id": user_id})
    if user and user.get("push_token"):
        send_push(user["push_token"], title="Dermato", body=message, link=link)
