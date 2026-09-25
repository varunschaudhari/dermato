from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_role
from app.db.database import get_db
from app.schemas import ConditionEducationUpdate
from app.services.condition_education import _DEFAULT_EDUCATION, get_education, list_education

router = APIRouter()


@router.get("/")
def list_condition_education(db=Depends(get_db)):
    return list_education(db)


@router.put("/{condition}", dependencies=[Depends(require_role("admin"))])
def update_condition_education(condition: str, payload: ConditionEducationUpdate, db=Depends(get_db)):
    if condition not in _DEFAULT_EDUCATION:
        raise HTTPException(status_code=400, detail=f"condition must be one of {list(_DEFAULT_EDUCATION)}")

    db.condition_education.update_one({"_id": condition}, {"$set": payload.model_dump()}, upsert=True)
    return get_education(db, condition)
