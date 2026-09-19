_DEFAULT_REMEDIES = {
    "acne": {
        "mild": {
            "type": "Home remedy",
            "examples": ["Cleanser", "Tea-tree oil", "Honey mask", "Low sugar diet"],
            "duration_weeks": "2-4",
        },
        "moderate": {
            "type": "OTC Cosmeceutical",
            "examples": ["Benzoyl peroxide 2.5-5% gel", "Niacinamide serum", "Salicylic acid 2% cleanser"],
            "duration_weeks": "4-8",
        },
        "severe": {
            "type": "Referral",
            "examples": ["Consult a dermatologist"],
            "duration_weeks": None,
        },
    },
    "pigmentation": {
        "mild": {
            "type": "Home remedy",
            "examples": ["Aloe vera gel", "Green tea extract"],
            "duration_weeks": "2-4",
        },
        "moderate": {
            "type": "OTC Cosmeceutical",
            "examples": ["Vitamin C serum", "Niacinamide 5-10%"],
            "duration_weeks": "4-8",
        },
        "severe": {
            "type": "Referral",
            "examples": ["Consult a dermatologist"],
            "duration_weeks": None,
        },
    },
    "wrinkle": {
        "mild": {
            "type": "Home remedy",
            "examples": ["Aloe vera", "Honey", "Cucumber mask", "Sunscreen"],
            "duration_weeks": "2-4",
        },
        "moderate": {
            "type": "OTC Cosmeceutical",
            "examples": ["Retinol 0.1-0.3%", "Hyaluronic acid serum"],
            "duration_weeks": "4-8",
        },
        "severe": {
            "type": "Referral",
            "examples": ["Consult a dermatologist"],
            "duration_weeks": None,
        },
    },
    "pore": {
        "mild": {
            "type": "Home remedy",
            "examples": ["Gentle cleanser", "Clay mask", "Non-comedogenic moisturizer"],
            "duration_weeks": "2-4",
        },
        "moderate": {
            "type": "OTC Cosmeceutical",
            "examples": ["Niacinamide 5-10% serum", "Salicylic acid (BHA) 2% toner"],
            "duration_weeks": "4-8",
        },
        "severe": {
            "type": "Referral",
            "examples": ["Consult a dermatologist"],
            "duration_weeks": None,
        },
    },
}

CONDITIONS = list(_DEFAULT_REMEDIES.keys())
SEVERITIES = ["mild", "moderate", "severe"]

DISCLAIMER = "For informational use only. Please consult a dermatologist for medical advice."


def _ensure_seeded(db, condition: str) -> dict:
    """Returns the live remedies document for `condition`, seeding it from
    _DEFAULT_REMEDIES on first use so the `remedies` collection is
    self-populating and an admin never has to pre-load it by hand."""
    doc = db.remedies.find_one({"_id": condition})
    if doc is None:
        doc = {"_id": condition, **_DEFAULT_REMEDIES[condition]}
        db.remedies.insert_one(doc)
    return doc


def get_recommendations(db, acne_sev: str, pigmentation_sev: str, wrinkle_sev: str, pore_sev: str) -> dict:
    severities = {
        "acne": acne_sev,
        "pigmentation": pigmentation_sev,
        "wrinkle": wrinkle_sev,
        "pore": pore_sev,
    }
    result = {"disclaimer": DISCLAIMER}
    for condition, severity in severities.items():
        doc = _ensure_seeded(db, condition)
        # Fresh copy — callers (e.g. analysis.py) mutate the returned dict in
        # place to add an "escalated" key, and `doc[severity]` here may be the
        # same dict object reused across calls, so never hand back a live
        # reference into it.
        result[condition] = {**doc[severity]}
    return result
