from app.db.database import db
from app.services.condition_education import (
    _DEFAULT_EDUCATION,
    annotate_patient_guidance,
    get_education,
    list_education,
)


def test_fresh_education_includes_all_fields_for_every_condition():
    for condition in _DEFAULT_EDUCATION:
        doc = get_education(db, condition)
        assert doc["causes"]
        assert doc["what_to_expect"]
        assert doc["timeline"]
        assert doc["severe_guidance"]


def test_list_education_covers_all_four_conditions():
    docs = list_education(db)
    assert {d["_id"] for d in docs} == {"acne", "pigmentation", "wrinkle", "pore"}


def test_ensure_seeded_backfills_missing_field_onto_pre_existing_doc():
    db.condition_education.delete_one({"_id": "acne"})
    db.condition_education.insert_one({"_id": "acne", "causes": "Old causes text."})

    doc = get_education(db, "acne")

    assert doc["causes"] == "Old causes text."  # existing content survives untouched
    assert doc["what_to_expect"]
    assert doc["timeline"]
    assert doc["severe_guidance"]


def test_list_education_endpoint_requires_no_special_role(client, auth_headers):
    res = client.get("/api/education/", headers=auth_headers)
    assert res.status_code == 200
    conditions = {d["_id"] for d in res.json()}
    assert conditions == {"acne", "pigmentation", "wrinkle", "pore"}


def test_education_endpoint_requires_auth(client):
    res = client.get("/api/education/")
    assert res.status_code == 401


def test_update_education_requires_admin(client, auth_headers):
    res = client.put(
        "/api/education/acne",
        json={"causes": "x", "what_to_expect": "x", "timeline": "x", "severe_guidance": "x"},
        headers=auth_headers,
    )
    assert res.status_code == 403


def test_admin_can_update_education(client, admin_headers):
    res = client.put(
        "/api/education/pigmentation",
        json={
            "causes": "Updated causes.",
            "what_to_expect": "Updated expectations.",
            "timeline": "Updated timeline.",
            "severe_guidance": "Updated severe guidance.",
        },
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["severe_guidance"] == "Updated severe guidance."

    res = client.get("/api/education/", headers=admin_headers)
    updated = next(d for d in res.json() if d["_id"] == "pigmentation")
    assert updated["causes"] == "Updated causes."


def test_annotate_patient_guidance_only_for_severe_conditions():
    recommendations = {
        "acne": {"type": "Referral", "examples": []},
        "pigmentation": {"type": "OTC Cosmeceutical", "examples": []},
        "wrinkle": {"type": "Home remedy", "examples": []},
        "pore": {"type": "Home remedy", "examples": []},
    }
    detected_severities = {"acne": "severe", "pigmentation": "moderate", "wrinkle": "mild", "pore": "mild"}

    annotate_patient_guidance(db, recommendations, detected_severities)

    assert recommendations["acne"]["patient_guidance"]
    assert "patient_guidance" not in recommendations["pigmentation"]
    assert "patient_guidance" not in recommendations["wrinkle"]
    assert "patient_guidance" not in recommendations["pore"]


def test_annotate_patient_guidance_uses_detected_not_effective_severity():
    # Even though the caller might have escalated the *remedy tier* elsewhere,
    # this function only ever sees detected_severities -- the honest reading.
    recommendations = {"acne": {"type": "OTC Cosmeceutical", "examples": []}}
    annotate_patient_guidance(db, recommendations, {"acne": "moderate"})
    assert "patient_guidance" not in recommendations["acne"]


def test_update_education_rejects_unknown_condition(client, admin_headers):
    res = client.put(
        "/api/education/not-a-real-condition",
        json={"causes": "x", "what_to_expect": "x", "timeline": "x", "severe_guidance": "x"},
        headers=admin_headers,
    )
    assert res.status_code == 400
