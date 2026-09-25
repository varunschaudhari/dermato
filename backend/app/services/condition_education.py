# Same self-seeding/backfill pattern as recommendation_engine.py's remedies --
# one doc per condition, admin-editable from the Content page, missing fields
# on an already-seeded doc get backfilled from the defaults below rather than
# staying missing forever.
_DEFAULT_EDUCATION = {
    "acne": {
        "causes": "Acne forms when hair follicles get clogged with oil and dead skin cells, "
        "often made worse by hormones, stress, certain medications, or comedogenic products.",
        "what_to_expect": "Most people see fewer new breakouts within a few weeks of a "
        "consistent routine, though clearing existing marks/redness can take longer.",
        "timeline": "Home remedies: 2-4 weeks. OTC actives: 4-8 weeks. Give a routine the full "
        "window before judging it — switching products too often is a common reason acne "
        "doesn't improve.",
        "severe_guidance": "Your acne severity is high. We recommend booking an appointment "
        "with your dermatologist within the next week rather than waiting for a recheck.",
    },
    "pigmentation": {
        "causes": "Pigmentation (dark spots/patches) is usually triggered by sun exposure, "
        "inflammation from past breakouts, hormonal changes, or genetics.",
        "what_to_expect": "Pigmentation fades gradually and unevenly — daily sunscreen matters "
        "more than any single treatment, since new sun exposure can undo progress.",
        "timeline": "Home remedies: 2-4 weeks. OTC actives: 4-8 weeks, sometimes longer for "
        "deeper pigmentation — most people need at least a full month before seeing a clear change.",
        "severe_guidance": "Your pigmentation severity is high. We recommend booking an "
        "appointment with your dermatologist within the next week to rule out other causes.",
    },
    "wrinkle": {
        "causes": "Wrinkles come from a mix of sun exposure, natural aging (collagen loss), "
        "repeated facial movements, and lifestyle factors like smoking or dehydration.",
        "what_to_expect": "Prevention (daily sunscreen) has more impact than any single "
        "treatment. Existing fine lines soften gradually with consistent use of actives like "
        "retinol, but deeper lines change more slowly.",
        "timeline": "Home remedies: 2-4 weeks for skin texture. OTC actives: 4-8 weeks, often "
        "longer — retinol in particular needs gradual tolerance-building before you'll see results.",
        "severe_guidance": "Your wrinkle severity is high. Consider booking an appointment with "
        "your dermatologist in the coming weeks to discuss options beyond over-the-counter care.",
    },
    "pore": {
        "causes": "Enlarged pores are usually driven by excess oil production, sun damage "
        "reducing skin elasticity, or genetics — they can't be permanently shrunk, only made "
        "less noticeable.",
        "what_to_expect": "Consistent gentle cleansing and oil-regulating actives reduce how "
        "visible pores look over time, but over-cleansing or harsh scrubbing usually makes them "
        "look worse, not better.",
        "timeline": "Home remedies: 2-4 weeks. OTC actives: 4-8 weeks — introduce one new "
        "product at a time so you can tell what's actually helping.",
        "severe_guidance": "Your pore severity is high. We recommend booking an appointment "
        "with your dermatologist within the next week for a closer look.",
    },
}


def _ensure_seeded(db, condition: str) -> dict:
    doc = db.condition_education.find_one({"_id": condition})
    if doc is None:
        doc = {"_id": condition, **_DEFAULT_EDUCATION[condition]}
        db.condition_education.insert_one(doc)
        return doc

    updates = {k: v for k, v in _DEFAULT_EDUCATION[condition].items() if k not in doc}
    if updates:
        db.condition_education.update_one({"_id": condition}, {"$set": updates})
        doc = db.condition_education.find_one({"_id": condition})
    return doc


def get_education(db, condition: str) -> dict:
    return _ensure_seeded(db, condition)


def list_education(db) -> list[dict]:
    return [_ensure_seeded(db, condition) for condition in _DEFAULT_EDUCATION]


def annotate_patient_guidance(db, recommendations: dict, detected_severities: dict) -> dict:
    """Mutates `recommendations` in place, adding a `patient_guidance` key to
    any condition whose *detected* (honest, unadjusted) severity is severe.
    Deliberately takes detected_severities, not the escalation-adjusted
    effective_severities used to pick a remedy tier -- using the wrong one
    could show "severe, book now" copy next to a non-severe severity badge."""
    for condition, severity in detected_severities.items():
        if severity != "severe":
            continue
        guidance = get_education(db, condition).get("severe_guidance")
        if guidance:
            recommendations[condition]["patient_guidance"] = guidance
    return recommendations
