from datetime import timedelta
from typing import Optional

from app.db.database import next_id, to_ns

SEVERITY_RANK = {"mild": 1, "moderate": 2, "severe": 3}
SEVERITY_ORDER = ["mild", "moderate", "severe"]


def _parse_recheck_weeks(duration_weeks: Optional[str]) -> Optional[int]:
    """'2-4' -> 4 (track to the far edge of the recommended window). None/unparsable -> None."""
    if not duration_weeks:
        return None
    try:
        return int(duration_weeks.split("-")[-1].strip())
    except ValueError:
        return None


def _compare_severity(start: str, end: str) -> str:
    start_rank = SEVERITY_RANK.get(start, 2)
    end_rank = SEVERITY_RANK.get(end, 2)
    if end_rank < start_rank:
        return "improved"
    if end_rank > start_rank:
        return "worsened"
    return "unchanged"


def compute_effective_severity(db, patient_id: int, condition: str, detected_severity: str):
    """If the two most recently resolved plans for this condition both failed to improve,
    bump the recommendation tier one level. A plan the patient explicitly marked as not
    followed (adherence == "not_followed") doesn't count toward this -- a remedy that was
    never tried isn't evidence the remedy itself doesn't work. This only affects which
    remedy gets recommended -- the detected severity stored on the session is always the
    honest, unadjusted reading.
    Returns (effective_severity, escalated: bool).
    """
    recent = list(
        db.treatment_plans.find(
            {"patient_id": patient_id, "condition": condition, "status": "resolved"}
        )
        .sort("resolved_at", -1)
        .limit(2)
    )
    failed_twice = len(recent) == 2 and all(
        p.get("outcome") in ("unchanged", "worsened") and p.get("adherence") != "not_followed" for p in recent
    )
    if not failed_twice:
        return detected_severity, False

    idx = SEVERITY_ORDER.index(detected_severity)
    escalated_idx = min(idx + 1, len(SEVERITY_ORDER) - 1)
    return SEVERITY_ORDER[escalated_idx], escalated_idx != idx


def update_treatment_plan(db, patient_id: int, condition: str, session, severity: str, recommendation: dict):
    """Closes out the patient's active plan for this condition (recording the outcome) and
    opens a new one from the just-computed recommendation. Called once per condition on every
    analysis, so a treatment plan always reflects the most recent recommendation for that patient.
    Returns the just-resolved plan, or None if there was no prior active plan.
    """
    active_doc = db.treatment_plans.find_one(
        {"patient_id": patient_id, "condition": condition, "status": "active"}
    )

    resolved = None
    if active_doc:
        outcome = _compare_severity(active_doc["severity_at_start"], severity)
        updates = {
            "status": "resolved",
            "outcome_session_id": session.id,
            "resolved_at": session.captured_at,
            "outcome_severity": severity,
            "outcome": outcome,
        }
        db.treatment_plans.update_one({"_id": active_doc["_id"]}, {"$set": updates})
        resolved = to_ns({**active_doc, **updates})

    weeks = _parse_recheck_weeks(recommendation.get("duration_weeks"))
    new_plan_doc = {
        "_id": next_id("treatment_plans"),
        "patient_id": patient_id,
        "condition": condition,
        "started_session_id": session.id,
        "started_at": session.captured_at,
        "severity_at_start": severity,
        "remedy_type": recommendation["type"],
        "remedy_text": ", ".join(recommendation.get("examples", [])),
        "how_to": recommendation.get("how_to"),
        "duration_weeks": recommendation.get("duration_weeks"),
        "expected_recheck_at": (session.captured_at + timedelta(weeks=weeks)) if weeks else None,
        "status": "active",
        "outcome_session_id": None,
        "resolved_at": None,
        "outcome_severity": None,
        "outcome": None,
        "adherence": None,
        "reminder_sent_at": None,
    }
    db.treatment_plans.insert_one(new_plan_doc)
    return resolved


def checklist_items_for_plan(plan: dict) -> list:
    """Derives today's routine checklist from the plan's snapshotted how_to
    (falling back to remedy_text for plans predating the how_to field). Takes
    a raw Mongo doc, not a to_ns()-wrapped object -- every call site already
    has the plan as a dict from db.treatment_plans.find_one(...).

    Referral-tier plans ("book a consultation...") have no daily routine to
    check off -- the severity-guidance banner covers that case instead.
    Splits ONLY on literal newlines, never on sentences: the seeded how_to
    text mixes daily actions with conditional warnings and every-few-days
    cadences (e.g. "Stop and reassess if you notice redness", "2-3 nights a
    week to build tolerance") that a naive sentence-split would turn into
    wrong daily checkboxes. With no newlines, the whole string becomes one
    honest single item rather than a mis-parsed list."""
    if plan.get("remedy_type") == "Referral":
        return []

    text = (plan.get("how_to") or plan.get("remedy_text") or "").strip()
    if not text:
        return []
    if "\n" in text:
        return [line.strip() for line in text.split("\n") if line.strip()]
    return [text]
