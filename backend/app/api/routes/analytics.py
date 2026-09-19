from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from app.db.database import get_db

router = APIRouter()

CONDITIONS = ["acne", "pigmentation", "wrinkle", "pore"]
SEVERITY_RANK = {"mild": 1, "moderate": 2, "severe": 3}


def _avg_severity_rank(session: dict) -> float:
    ranks = [SEVERITY_RANK[session[f"{c}_severity"]] for c in CONDITIONS if session.get(f"{c}_severity") in SEVERITY_RANK]
    return sum(ranks) / len(ranks) if ranks else 0


@router.get("/summary")
def get_summary(db=Depends(get_db)):
    total_patients = db.patients.count_documents({})
    total_sessions = db.sessions.count_documents({})

    week_ago = datetime.utcnow() - timedelta(days=7)
    sessions_this_week = db.sessions.count_documents({"captured_at": {"$gte": week_ago}})

    unassigned_patients = db.patients.count_documents({"assigned_doctor_id": None})

    severity_distribution = {}
    for condition in CONDITIONS:
        field = f"{condition}_severity"
        pipeline = [
            {"$match": {field: {"$ne": None}}},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
        ]
        severity_distribution[condition] = {row["_id"]: row["count"] for row in db.sessions.aggregate(pipeline)}

    doctor_caseloads = []
    for doc in db.users.find({"role": "dermatologist"}):
        count = db.patients.count_documents({"assigned_doctor_id": doc["_id"]})
        doctor_caseloads.append({"doctor_name": doc["full_name"], "patient_count": count})

    treatment_summary = {
        "active_plans": db.treatment_plans.count_documents({"status": "active"}),
        "outcome_distribution": {"improved": 0, "unchanged": 0, "worsened": 0},
    }
    for row in db.treatment_plans.aggregate(
        [
            {"$match": {"status": {"$ne": "active"}, "outcome": {"$ne": None}}},
            {"$group": {"_id": "$outcome", "count": {"$sum": 1}}},
        ]
    ):
        if row["_id"] in treatment_summary["outcome_distribution"]:
            treatment_summary["outcome_distribution"][row["_id"]] = row["count"]

    # Compares each patient's first vs. most recent session (avg. severity rank
    # across whichever conditions were checked) to bucket them by overall trend.
    progress_summary = {"improving": 0, "stable": 0, "worsening": 0}
    for patient in db.patients.find():
        sessions = list(db.sessions.find({"patient_id": patient["_id"]}).sort("captured_at", 1))
        if len(sessions) < 2:
            continue
        first_rank = _avg_severity_rank(sessions[0])
        last_rank = _avg_severity_rank(sessions[-1])
        if last_rank < first_rank:
            progress_summary["improving"] += 1
        elif last_rank > first_rank:
            progress_summary["worsening"] += 1
        else:
            progress_summary["stable"] += 1

    return {
        "total_patients": total_patients,
        "total_sessions": total_sessions,
        "sessions_this_week": sessions_this_week,
        "unassigned_patients": unassigned_patients,
        "severity_distribution": severity_distribution,
        "doctor_caseloads": doctor_caseloads,
        "treatment_summary": treatment_summary,
        "progress_summary": progress_summary,
    }
