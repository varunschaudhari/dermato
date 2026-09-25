"""Covers compute_effective_severity's adherence gate: a resolved plan the patient
marked as not followed shouldn't count as evidence the remedy itself failed, so it
shouldn't contribute to auto-escalation. See treatment_tracker.py's docstring for
the escalation rule this gate sits on top of."""

from datetime import datetime

from app.db.database import db, next_id
from app.services.treatment_tracker import checklist_items_for_plan, compute_effective_severity


def _resolved_plan(patient_id, condition, outcome, adherence=None):
    # Schema-complete even though compute_effective_severity only reads outcome/adherence --
    # patient_id here comes from a test-only counter that can numerically collide with a real
    # patient_id from another test file (different counter, same shared treatment_plans
    # collection), so an incomplete doc can otherwise fail TreatmentPlanOut validation if it
    # ever gets pulled back through a real GET in that other test.
    db.treatment_plans.insert_one(
        {
            "_id": next_id("treatment_plans"),
            "patient_id": patient_id,
            "condition": condition,
            "started_session_id": 1,
            "started_at": datetime.utcnow(),
            "status": "resolved",
            "severity_at_start": "mild",
            "remedy_type": "Home remedy",
            "remedy_text": "Tea tree oil",
            "outcome_severity": "mild",
            "outcome": outcome,
            "adherence": adherence,
            "resolved_at": datetime.utcnow(),
        }
    )


def test_escalation_skipped_when_last_failed_plan_was_not_followed():
    patient_id = next_id("test_patient_ids")
    _resolved_plan(patient_id, "acne", "unchanged", adherence="not_followed")
    _resolved_plan(patient_id, "acne", "unchanged", adherence="not_followed")

    effective, escalated = compute_effective_severity(db, patient_id, "acne", "mild")
    assert escalated is False
    assert effective == "mild"


def test_escalation_still_fires_when_adherence_unanswered():
    patient_id = next_id("test_patient_ids")
    _resolved_plan(patient_id, "acne", "unchanged")
    _resolved_plan(patient_id, "acne", "unchanged")

    effective, escalated = compute_effective_severity(db, patient_id, "acne", "mild")
    assert escalated is True
    assert effective == "moderate"


def test_escalation_fires_when_adherence_was_followed():
    patient_id = next_id("test_patient_ids")
    _resolved_plan(patient_id, "acne", "worsened", adherence="followed")
    _resolved_plan(patient_id, "acne", "unchanged", adherence="followed")

    effective, escalated = compute_effective_severity(db, patient_id, "acne", "mild")
    assert escalated is True
    assert effective == "moderate"


def test_one_not_followed_plan_out_of_two_still_blocks_escalation():
    patient_id = next_id("test_patient_ids")
    _resolved_plan(patient_id, "acne", "unchanged", adherence="followed")
    _resolved_plan(patient_id, "acne", "unchanged", adherence="not_followed")

    effective, escalated = compute_effective_severity(db, patient_id, "acne", "mild")
    assert escalated is False
    assert effective == "mild"


def test_checklist_splits_on_newlines_when_present():
    plan = {"remedy_type": "OTC Cosmeceutical", "how_to": "Cleanse gently.\nApply serum.\nMoisturize."}
    assert checklist_items_for_plan(plan) == ["Cleanse gently.", "Apply serum.", "Moisturize."]


def test_checklist_falls_back_to_single_item_with_no_newlines():
    # The real seeded how_to text has no newlines and mixes daily actions
    # with conditional warnings -- sentence-splitting it would produce wrong
    # checkboxes, so a single honest item is the only safe fallback.
    plan = {
        "remedy_type": "Home remedy",
        "how_to": "Cleanse gently twice daily. Stop and reassess if you notice redness or irritation.",
    }
    assert checklist_items_for_plan(plan) == [
        "Cleanse gently twice daily. Stop and reassess if you notice redness or irritation."
    ]


def test_checklist_falls_back_to_remedy_text_when_how_to_missing():
    plan = {"remedy_type": "Home remedy", "how_to": None, "remedy_text": "Tea tree oil, Honey mask"}
    assert checklist_items_for_plan(plan) == ["Tea tree oil, Honey mask"]


def test_checklist_empty_for_referral_plans():
    plan = {"remedy_type": "Referral", "how_to": "Book a consultation with a dermatologist."}
    assert checklist_items_for_plan(plan) == []


def test_checklist_empty_when_no_text_at_all():
    plan = {"remedy_type": "Home remedy", "how_to": None, "remedy_text": ""}
    assert checklist_items_for_plan(plan) == []
