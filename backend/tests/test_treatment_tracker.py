"""Covers compute_effective_severity's adherence gate: a resolved plan the patient
marked as not followed shouldn't count as evidence the remedy itself failed, so it
shouldn't contribute to auto-escalation. See treatment_tracker.py's docstring for
the escalation rule this gate sits on top of."""

from datetime import datetime

from app.db.database import db, next_id
from app.services.treatment_tracker import compute_effective_severity


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
