from types import SimpleNamespace

from pymongo import MongoClient, ReturnDocument

from app.core.config import settings

client = MongoClient(settings.MONGO_URI)
db = client[settings.MONGO_DB_NAME]


def get_db():
    return db


def next_id(collection_name: str) -> int:
    """Emulates SQL auto-increment integer primary keys on top of MongoDB —
    every document's `_id` is one of these ints rather than an ObjectId, so
    existing route params/schemas typed as `int` don't need to change."""
    result = db.counters.find_one_and_update(
        {"_id": collection_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return result["seq"]


def to_ns(doc):
    """Wraps a Mongo document (or None) in a SimpleNamespace with `.id` instead
    of `._id`, so code written against the old SQLAlchemy ORM objects — plain
    attribute access like `user.role` or `patient.assigned_doctor_id` — keeps
    working unchanged against Mongo documents."""
    if doc is None:
        return None
    data = dict(doc)
    data["id"] = data.pop("_id")
    return SimpleNamespace(**data)
