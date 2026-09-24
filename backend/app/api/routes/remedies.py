from fastapi import APIRouter, Depends, HTTPException
from app.db.database import get_db
from app.services.recommendation_engine import CONDITIONS, SEVERITIES, _ensure_seeded

router = APIRouter()


@router.get("/")
def list_remedies(db=Depends(get_db)):
    return [_ensure_seeded(db, condition) for condition in CONDITIONS]


@router.put("/{condition}/{severity}")
def update_remedy(condition: str, severity: str, body: dict, db=Depends(get_db)):
    if condition not in CONDITIONS:
        raise HTTPException(status_code=400, detail=f"condition must be one of {CONDITIONS}")
    if severity not in SEVERITIES:
        raise HTTPException(status_code=400, detail=f"severity must be one of {SEVERITIES}")

    entry = {
        "type": body.get("type"),
        "examples": body.get("examples"),
        "duration_weeks": body.get("duration_weeks"),
        "how_to": body.get("how_to"),
    }
    db.remedies.update_one({"_id": condition}, {"$set": {severity: entry}}, upsert=True)
    return db.remedies.find_one({"_id": condition})
