"""Covers recommendation_engine.py's how_to field: present in fresh defaults,
and backfilled onto remedies docs seeded before how_to existed (simulating
production's already-seeded collection) -- see _ensure_seeded's docstring."""

from app.db.database import db
from app.services.recommendation_engine import get_recommendations, _ensure_seeded


def test_fresh_recommendations_include_how_to():
    recs = get_recommendations(db, "mild", "mild", "mild", "mild")
    assert recs["acne"]["how_to"]
    assert recs["pigmentation"]["how_to"]
    assert recs["wrinkle"]["how_to"]
    assert recs["pore"]["how_to"]


def test_ensure_seeded_backfills_how_to_onto_pre_existing_doc():
    # Simulates a remedies doc seeded before how_to existed on this condition
    # (e.g. production data from before this change) -- no how_to key at all.
    db.remedies.delete_one({"_id": "acne"})
    db.remedies.insert_one(
        {
            "_id": "acne",
            "mild": {"type": "Home remedy", "examples": ["Cleanser"], "duration_weeks": "2-4"},
            "moderate": {"type": "OTC Cosmeceutical", "examples": ["Benzoyl peroxide"], "duration_weeks": "4-8"},
            "severe": {"type": "Referral", "examples": ["Consult a dermatologist"], "duration_weeks": None},
        }
    )

    doc = _ensure_seeded(db, "acne")

    assert "how_to" in doc["mild"]
    assert doc["mild"]["how_to"]
    # Backfill only adds missing keys -- existing content must survive untouched.
    assert doc["mild"]["examples"] == ["Cleanser"]


def test_ensure_seeded_preserves_admin_customized_how_to():
    db.remedies.delete_one({"_id": "pore"})
    db.remedies.insert_one(
        {
            "_id": "pore",
            "mild": {
                "type": "Home remedy",
                "examples": ["Gentle cleanser"],
                "duration_weeks": "2-4",
                "how_to": "Admin-customized instructions.",
            },
            "moderate": {"type": "OTC Cosmeceutical", "examples": ["Niacinamide"], "duration_weeks": "4-8", "how_to": "x"},
            "severe": {"type": "Referral", "examples": ["Consult a dermatologist"], "duration_weeks": None, "how_to": "x"},
        }
    )

    doc = _ensure_seeded(db, "pore")

    assert doc["mild"]["how_to"] == "Admin-customized instructions."
