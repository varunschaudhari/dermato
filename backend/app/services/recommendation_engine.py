
# how_to is deliberately generic, package-label-style guidance (frequency/
# pattern, not specific dosing) -- clinic admins can override it per
# condition/severity from the Content page (AdminContentPage.jsx) with
# anything more specific to what they actually stock/recommend.
_REFERRAL_HOW_TO = "Book a consultation with a dermatologist as soon as you can for a proper diagnosis and treatment plan."

_DEFAULT_REMEDIES = {
    "acne": {
        "mild": {
            "type": "Home remedy",
            "examples": ["Cleanser", "Tea-tree oil", "Honey mask", "Low sugar diet"],
            "duration_weeks": "2-4",
            "how_to": "Cleanse gently twice daily and introduce one new product at a time. Stop and reassess if you notice redness or irritation.",
        },
        "moderate": {
            "type": "OTC Cosmeceutical",
            "examples": ["Benzoyl peroxide 2.5-5% gel", "Niacinamide serum", "Salicylic acid 2% cleanser"],
            "duration_weeks": "4-8",
            "how_to": "Follow the directions on the product label, typically once daily to start. Use a daily sunscreen, since these actives can increase sun sensitivity.",
        },
        "severe": {"type": "Referral", "examples": ["Consult a dermatologist"], "duration_weeks": None, "how_to": _REFERRAL_HOW_TO},
    },
    "pigmentation": {
        "mild": {
            "type": "Home remedy",
            "examples": ["Aloe vera gel", "Green tea extract"],
            "duration_weeks": "2-4",
            "how_to": "Apply to clean skin once daily. Consistent daily sunscreen matters more than any single product for pigmentation.",
        },
        "moderate": {
            "type": "OTC Cosmeceutical",
            "examples": ["Vitamin C serum", "Niacinamide 5-10%"],
            "duration_weeks": "4-8",
            "how_to": "Apply in the morning under sunscreen, following the product label. Give it the full duration below before judging results — pigmentation fades slowly.",
        },
        "severe": {"type": "Referral", "examples": ["Consult a dermatologist"], "duration_weeks": None, "how_to": _REFERRAL_HOW_TO},
    },
    "wrinkle": {
        "mild": {
            "type": "Home remedy",
            "examples": ["Aloe vera", "Honey", "Cucumber mask", "Sunscreen"],
            "duration_weeks": "2-4",
            "how_to": "Use daily sunscreen as the baseline — it does more to prevent further wrinkling than any mask. Masks 2-3x/week are a reasonable addition.",
        },
        "moderate": {
            "type": "OTC Cosmeceutical",
            "examples": ["Retinol 0.1-0.3%", "Hyaluronic acid serum"],
            "duration_weeks": "4-8",
            "how_to": "Start retinol just 2-3 nights a week to build tolerance, increasing frequency as skin adjusts. Always pair with daytime sunscreen.",
        },
        "severe": {"type": "Referral", "examples": ["Consult a dermatologist"], "duration_weeks": None, "how_to": _REFERRAL_HOW_TO},
    },
    "pore": {
        "mild": {
            "type": "Home remedy",
            "examples": ["Gentle cleanser", "Clay mask", "Non-comedogenic moisturizer"],
            "duration_weeks": "2-4",
            "how_to": "Cleanse twice daily and use a clay mask once or twice a week. Avoid over-cleansing, which can worsen oil production.",
        },
        "moderate": {
            "type": "OTC Cosmeceutical",
            "examples": ["Niacinamide 5-10% serum", "Salicylic acid (BHA) 2% toner"],
            "duration_weeks": "4-8",
            "how_to": "Follow the product label, typically once daily to start. Introduce one new active at a time so you can tell what's helping.",
        },
        "severe": {"type": "Referral", "examples": ["Consult a dermatologist"], "duration_weeks": None, "how_to": _REFERRAL_HOW_TO},
    },
}

CONDITIONS = list(_DEFAULT_REMEDIES.keys())
SEVERITIES = ["mild", "moderate", "severe"]

DISCLAIMER = "For informational use only. Please consult a dermatologist for medical advice."


def _ensure_seeded(db, condition: str) -> dict:
    """Returns the live remedies document for `condition`, seeding it from
    _DEFAULT_REMEDIES on first use so the `remedies` collection is
    self-populating and an admin never has to pre-load it by hand. Also
    backfills any field _DEFAULT_REMEDIES has that an already-seeded doc is
    missing (e.g. how_to, added after some remedies were already seeded) --
    without this, older seeded docs would silently stay missing new default
    fields forever, since the insert above only runs once per condition."""
    doc = db.remedies.find_one({"_id": condition})
    if doc is None:
        doc = {"_id": condition, **_DEFAULT_REMEDIES[condition]}
        db.remedies.insert_one(doc)
        return doc

    updates = {}
    for severity, defaults in _DEFAULT_REMEDIES[condition].items():
        for key, value in defaults.items():
            if key not in doc.get(severity, {}):
                updates[f"{severity}.{key}"] = value
    if updates:
        db.remedies.update_one({"_id": condition}, {"$set": updates})
        doc = db.remedies.find_one({"_id": condition})
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
