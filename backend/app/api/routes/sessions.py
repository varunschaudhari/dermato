from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user, require_role
from app.db.database import get_db, next_id, to_ns
from app.schemas import DoctorNoteUpdate, SessionOut

router = APIRouter()


def _ensure_patient_access(patient_id: int, current_user) -> None:
    if current_user.role == "patient" and current_user.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this patient's sessions")


@router.get("/patient/{patient_id}", response_model=list[SessionOut])
def get_patient_sessions(
    patient_id: int, db=Depends(get_db), current_user=Depends(get_current_user)
):
    _ensure_patient_access(patient_id, current_user)
    sessions = db.sessions.find({"patient_id": patient_id}).sort("captured_at", 1)
    return [to_ns(s) for s in sessions]


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    session = db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    _ensure_patient_access(session["patient_id"], current_user)
    return to_ns(session)


@router.patch("/{session_id}/note", response_model=SessionOut)
def update_doctor_note(
    session_id: int,
    payload: DoctorNoteUpdate,
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "dermatologist")),
):
    session = db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    patient = db.patients.find_one({"_id": session["patient_id"]})
    if current_user.role == "dermatologist":
        if patient and patient.get("assigned_doctor_id") not in (None, current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized to note this patient's session")

    db.sessions.update_one({"_id": session_id}, {"$set": {"doctor_note": payload.note}})

    patient_user = db.users.find_one({"patient_id": session["patient_id"], "role": "patient"})
    if patient_user:
        db.notifications.insert_one(
            {
                "_id": next_id("notifications"),
                "user_id": patient_user["_id"],
                "type": "doctor_note",
                "message": f"{current_user.full_name} left a note on your {session['captured_at']:%b %d} check",
                "link": f"/progress/{session['patient_id']}",
                "related_id": session_id,
                "is_read": False,
                "created_at": datetime.utcnow(),
            }
        )

    return to_ns(db.sessions.find_one({"_id": session_id}))
