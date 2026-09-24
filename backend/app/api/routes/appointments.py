from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.db.database import get_db, next_id, to_ns
from app.schemas import AppointmentCreate, AppointmentOut, AppointmentStatusUpdate, DoctorOption
from app.services.notifier import notify_user

router = APIRouter()

DURATION_MINUTES = 30


def _enrich(db, doc) -> dict:
    """Attaches patient_name/doctor_name — Mongo has no joins, so this is a
    manual lookup, same pattern as patients.py's _with_doctor."""
    d = dict(doc)
    patient = db.patients.find_one({"_id": d["patient_id"]})
    doctor = db.users.find_one({"_id": d["doctor_id"]})
    d["patient_name"] = patient["name"] if patient else "Unknown patient"
    d["doctor_name"] = doctor["full_name"] if doctor else "Unknown doctor"
    return d


# NOTE: declared before any dynamic /{appointment_id} route so "doctors" never
# gets swallowed by an int-path-param match (same gotcha as patients.py).
@router.get("/doctors", response_model=list[DoctorOption])
def list_available_doctors(db=Depends(get_db), current_user=Depends(get_current_user)):
    docs = db.users.find({"role": "dermatologist", "is_active": True})
    return [{"id": d["_id"], "full_name": d["full_name"]} for d in docs]


@router.get("/doctors/{doctor_id}/busy-times")
def get_doctor_busy_times(
    doctor_id: int, date: str, db=Depends(get_db), current_user=Depends(get_current_user)
):
    """This doctor's already-booked start times on `date` (YYYY-MM-DD) -- just
    times, no patient names or other identifying details, so any patient can
    check before picking a slot. Same auth level as /doctors and the GET /
    list below: any authenticated user, not staff-only, since patients are
    the ones who need this to book."""
    try:
        day_start = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    docs = db.appointments.find(
        {
            "doctor_id": doctor_id,
            "status": "scheduled",
            "scheduled_at": {"$gte": day_start, "$lt": day_start + timedelta(days=1)},
        }
    ).sort("scheduled_at", 1)
    return [d["scheduled_at"] for d in docs]


@router.get("/", response_model=list[AppointmentOut])
def list_appointments(db=Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "patient":
        query = {"patient_id": current_user.patient_id}
    elif current_user.role == "dermatologist":
        query = {"doctor_id": current_user.id}
    else:
        query = {}
    docs = db.appointments.find(query).sort("scheduled_at", 1)
    return [to_ns(_enrich(db, d)) for d in docs]


@router.post("/", response_model=AppointmentOut)
def create_appointment(payload: AppointmentCreate, db=Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "patient" and current_user.patient_id != payload.patient_id:
        raise HTTPException(status_code=403, detail="Not authorized to book on behalf of this patient")

    if not db.patients.find_one({"_id": payload.patient_id}):
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = db.users.find_one({"_id": payload.doctor_id, "role": "dermatologist"})
    if not doctor:
        raise HTTPException(status_code=404, detail="Dermatologist not found")

    # Simple fixed-duration slot conflict check: no other *scheduled* appointment
    # for this doctor may start within DURATION_MINUTES of the requested time.
    window_start = payload.scheduled_at - timedelta(minutes=DURATION_MINUTES - 1)
    window_end = payload.scheduled_at + timedelta(minutes=DURATION_MINUTES - 1)
    conflict = db.appointments.find_one(
        {
            "doctor_id": payload.doctor_id,
            "status": "scheduled",
            "scheduled_at": {"$gt": window_start, "$lt": window_end},
        }
    )
    if conflict:
        raise HTTPException(status_code=409, detail="This doctor already has an appointment at that time")

    doc = {
        "_id": next_id("appointments"),
        "patient_id": payload.patient_id,
        "doctor_id": payload.doctor_id,
        "scheduled_at": payload.scheduled_at,
        "duration_minutes": DURATION_MINUTES,
        "status": "scheduled",
        "reason": payload.reason,
        "created_at": datetime.utcnow(),
    }
    db.appointments.insert_one(doc)

    notify_user(
        db,
        doctor["_id"],
        "appointment_booked",
        f"New appointment booked for {payload.scheduled_at:%b %d, %I:%M %p}",
        "/appointments",
        related_id=doc["_id"],
    )

    return to_ns(_enrich(db, doc))


@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    appointment = db.appointments.find_one({"_id": appointment_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "patient" and current_user.patient_id != appointment["patient_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this appointment")
    if current_user.role == "dermatologist" and current_user.id != appointment["doctor_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this appointment")

    if payload.status not in ("cancelled", "completed"):
        raise HTTPException(status_code=400, detail="status must be 'cancelled' or 'completed'")
    if current_user.role == "patient" and payload.status == "completed":
        raise HTTPException(status_code=403, detail="Only staff can mark an appointment completed")

    db.appointments.update_one({"_id": appointment_id}, {"$set": {"status": payload.status}})
    return to_ns(_enrich(db, db.appointments.find_one({"_id": appointment_id})))
