import csv
import io
import os
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from app.core.config import settings
from app.core.security import get_current_user, hash_password, require_role
from app.db.database import get_db, next_id, to_ns
from app.schemas import (
    AssignDoctorRequest,
    ImportResult,
    MessageCreate,
    MessageInboxItem,
    MessageOut,
    OverdueRecheckOut,
    PatientAccountCreate,
    PatientCreate,
    PatientOut,
    SkinHistoryUpdate,
    TreatmentPlanOut,
    UserOut,
)

router = APIRouter()


def _ensure_patient_access(patient_id: int, current_user) -> None:
    if current_user.role == "patient" and current_user.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this patient")


def _with_doctor(db, patient_doc):
    """Attaches the assigned_doctor sub-object PatientOut expects — Mongo has no
    join, so this is a manual lookup in place of the old ORM relationship."""
    doc = dict(patient_doc)
    doc["assigned_doctor"] = None
    doctor_id = doc.get("assigned_doctor_id")
    if doctor_id is not None:
        doctor = db.users.find_one({"_id": doctor_id})
        if doctor:
            doc["assigned_doctor"] = to_ns(doctor)
    return to_ns(doc)


# NOTE: must be declared before GET /{patient_id} — otherwise that route's `patient_id: int`
# path segment greedily matches "overdue-recheck" first and 422s on the int conversion.
@router.get("/overdue-recheck", response_model=list[OverdueRecheckOut])
def get_overdue_recheck(
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "dermatologist")),
):
    now = datetime.utcnow()
    plans = db.treatment_plans.find(
        {"status": "active", "expected_recheck_at": {"$ne": None, "$lt": now}}
    )

    results = []
    for plan in plans:
        patient = db.patients.find_one({"_id": plan["patient_id"]})
        if not patient:
            continue
        if current_user.role == "dermatologist" and patient.get("assigned_doctor_id") != current_user.id:
            continue
        results.append(
            OverdueRecheckOut(
                patient_id=patient["_id"],
                patient_name=patient["name"],
                condition=plan["condition"],
                remedy_type=plan["remedy_type"],
                expected_recheck_at=plan["expected_recheck_at"],
                days_overdue=(now - plan["expected_recheck_at"]).days,
            )
        )
    return results


@router.post("/import", response_model=ImportResult)
def import_patients_csv(
    file: UploadFile = File(...),
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "dermatologist")),
):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    raw = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))

    required_cols = {"name", "age", "skin_type"}
    headers = {(h or "").strip().lower() for h in (reader.fieldnames or [])}
    if not required_cols.issubset(headers):
        raise HTTPException(
            status_code=400, detail=f"CSV must have columns: {', '.join(sorted(required_cols))}"
        )

    created = []
    errors = []
    for row_num, row in enumerate(reader, start=2):  # row 1 is the header
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        name = row.get("name")
        if not name:
            errors.append({"row": row_num, "reason": "Missing name"})
            continue
        try:
            age = int(row.get("age") or 0)
        except ValueError:
            errors.append({"row": row_num, "reason": f"Invalid age: {row.get('age')!r}"})
            continue

        doc = {
            "_id": next_id("patients"),
            "name": name,
            "age": age,
            "skin_type": row.get("skin_type") or "unknown",
            "created_at": datetime.utcnow(),
            "assigned_doctor_id": current_user.id if current_user.role == "dermatologist" else None,
        }
        db.patients.insert_one(doc)
        created.append({"id": doc["_id"], "name": name})

    return {"created": created, "errors": errors}


@router.post("/", response_model=PatientOut)
def create_patient(
    payload: PatientCreate,
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "dermatologist")),
):
    doc = {
        "_id": next_id("patients"),
        "name": payload.name,
        "age": payload.age,
        "skin_type": payload.skin_type,
        "created_at": datetime.utcnow(),
        # A dermatologist creating a patient is presumed to be their treating doctor;
        # admins just manage accounts, so patients they create start unassigned.
        "assigned_doctor_id": current_user.id if current_user.role == "dermatologist" else None,
    }
    db.patients.insert_one(doc)
    return _with_doctor(db, doc)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    _ensure_patient_access(patient_id, current_user)
    patient = db.patients.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _with_doctor(db, patient)


@router.get("/", response_model=list[PatientOut])
def list_patients(
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "dermatologist")),
):
    query = {}
    if current_user.role == "dermatologist":
        # A dermatologist sees their own patients plus anyone still unclaimed
        query = {"$or": [{"assigned_doctor_id": current_user.id}, {"assigned_doctor_id": None}]}
    return [_with_doctor(db, p) for p in db.patients.find(query)]


@router.patch("/{patient_id}/assign-doctor", response_model=PatientOut)
def assign_doctor(
    patient_id: int,
    payload: AssignDoctorRequest,
    db=Depends(get_db),
    current_user=Depends(require_role("admin", "dermatologist")),
):
    patient = db.patients.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == "dermatologist":
        # Dermatologists can only claim an unassigned patient for themselves —
        # they cannot poach a patient already assigned to another dermatologist.
        if patient.get("assigned_doctor_id") not in (None, current_user.id):
            raise HTTPException(
                status_code=403, detail="This patient is already assigned to another dermatologist"
            )
        new_doctor_id = current_user.id
    else:
        # Admins may assign to any dermatologist, or clear the assignment with doctor_id: null
        if payload.doctor_id is not None:
            doctor = db.users.find_one({"_id": payload.doctor_id, "role": "dermatologist"})
            if not doctor:
                raise HTTPException(status_code=404, detail="Dermatologist not found")
        new_doctor_id = payload.doctor_id

    db.patients.update_one({"_id": patient_id}, {"$set": {"assigned_doctor_id": new_doctor_id}})
    return _with_doctor(db, db.patients.find_one({"_id": patient_id}))


@router.patch("/{patient_id}/skin-history", response_model=PatientOut)
def update_skin_history(
    patient_id: int, payload: SkinHistoryUpdate, db=Depends(get_db), current_user=Depends(get_current_user)
):
    _ensure_patient_access(patient_id, current_user)
    patient = db.patients.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    db.patients.update_one(
        {"_id": patient_id},
        {
            "$set": {
                "skin_history": {
                    "allergies": payload.allergies or "",
                    "current_products": payload.current_products or "",
                    "known_conditions": payload.known_conditions or "",
                    "medications": payload.medications or "",
                    "updated_at": datetime.utcnow(),
                }
            }
        },
    )
    return _with_doctor(db, db.patients.find_one({"_id": patient_id}))


@router.get("/{patient_id}/treatment-plans", response_model=list[TreatmentPlanOut])
def get_treatment_plans(patient_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    _ensure_patient_access(patient_id, current_user)
    plans = db.treatment_plans.find({"patient_id": patient_id}).sort("started_at", 1)
    return [to_ns(p) for p in plans]


@router.post(
    "/{patient_id}/account",
    response_model=UserOut,
    dependencies=[Depends(require_role("admin", "dermatologist"))],
)
def create_patient_account(patient_id: int, payload: PatientAccountCreate, db=Depends(get_db)):
    patient = db.patients.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if db.users.find_one({"patient_id": patient_id}):
        raise HTTPException(status_code=400, detail="This patient already has a login account")
    if db.users.find_one({"phone": payload.phone}):
        raise HTTPException(status_code=400, detail="Phone number already registered")
    if db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    doc = {
        "_id": next_id("users"),
        "phone": payload.phone,
        "email": payload.email,
        "hashed_password": hash_password(payload.password),
        "full_name": patient["name"],
        "role": "patient",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "patient_id": patient_id,
    }
    db.users.insert_one(doc)
    return to_ns(doc)


@router.get("/{patient_id}/messages", response_model=list[MessageOut])
def get_messages(patient_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    _ensure_patient_access(patient_id, current_user)
    docs = db.messages.find({"patient_id": patient_id}).sort("created_at", 1)
    return [to_ns(d) for d in docs]


@router.post("/{patient_id}/messages", response_model=MessageOut)
def send_message(
    patient_id: int, payload: MessageCreate, db=Depends(get_db), current_user=Depends(get_current_user)
):
    _ensure_patient_access(patient_id, current_user)
    patient = db.patients.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    doc = {
        "_id": next_id("messages"),
        "patient_id": patient_id,
        "sender_id": current_user.id,
        "sender_name": current_user.full_name,
        "sender_role": current_user.role,
        "body": payload.body.strip(),
        "created_at": datetime.utcnow(),
    }
    db.messages.insert_one(doc)

    # Notify whichever side didn't just send this message.
    if current_user.role == "patient":
        notify_user_id = patient.get("assigned_doctor_id")
        notify_message = f"New message from {patient['name']}"
    else:
        patient_user = db.users.find_one({"patient_id": patient_id, "role": "patient"})
        notify_user_id = patient_user["_id"] if patient_user else None
        notify_message = f"{current_user.full_name} sent you a message"

    if notify_user_id:
        db.notifications.insert_one(
            {
                "_id": next_id("notifications"),
                "user_id": notify_user_id,
                "type": "new_message",
                "message": notify_message,
                "link": f"/progress/{patient_id}",
                "related_id": doc["_id"],
                "is_read": False,
                "created_at": datetime.utcnow(),
            }
        )

    return to_ns(doc)


@router.get("/messages/inbox", response_model=list[MessageInboxItem])
def get_messages_inbox(db=Depends(get_db), current_user=Depends(require_role("admin", "dermatologist"))):
    """One row per patient the current staff member can see, with their most
    recent message and how many of this user's own 'new_message' notifications
    for that patient are still unread."""
    query = {}
    if current_user.role == "dermatologist":
        query = {"$or": [{"assigned_doctor_id": current_user.id}, {"assigned_doctor_id": None}]}

    items = []
    for patient in db.patients.find(query):
        last = next(iter(db.messages.find({"patient_id": patient["_id"]}).sort("created_at", -1).limit(1)), None)
        unread_count = db.notifications.count_documents(
            {
                "user_id": current_user.id,
                "type": "new_message",
                "link": f"/progress/{patient['_id']}",
                "is_read": False,
            }
        )
        items.append(
            MessageInboxItem(
                patient_id=patient["_id"],
                patient_name=patient["name"],
                last_message=last["body"] if last else None,
                last_sender_name=last["sender_name"] if last else None,
                last_sender_role=last["sender_role"] if last else None,
                last_message_at=last["created_at"] if last else None,
                unread_count=unread_count,
            )
        )

    items.sort(key=lambda i: i.last_message_at or datetime.min, reverse=True)
    return items


def _session_image_paths(session: dict) -> list[str]:
    if session.get("image_paths"):
        return list(session["image_paths"].values())
    if session.get("image_path"):
        return [session["image_path"]]
    return []


@router.get("/{patient_id}/export")
def export_patient_data(patient_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    """Full data-portability export for one patient — every record this app
    holds about them, as a single JSON document."""
    _ensure_patient_access(patient_id, current_user)
    patient = db.patients.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    def _clean(docs):
        cleaned = []
        for d in docs:
            d = dict(d)
            d["id"] = d.pop("_id")
            cleaned.append(d)
        return cleaned

    return {
        "patient": _clean([patient])[0],
        "sessions": _clean(db.sessions.find({"patient_id": patient_id})),
        "treatment_plans": _clean(db.treatment_plans.find({"patient_id": patient_id})),
        "messages": _clean(db.messages.find({"patient_id": patient_id})),
        "appointments": _clean(db.appointments.find({"patient_id": patient_id})),
        "exported_at": datetime.utcnow().isoformat(),
    }


@router.delete("/{patient_id}", dependencies=[Depends(require_role("admin"))])
def delete_patient(patient_id: int, db=Depends(get_db)):
    """Right-to-be-forgotten: permanently removes this patient and every
    record referencing them — sessions, treatment plans, messages,
    appointments, their linked login account, and their uploaded photos."""
    patient = db.patients.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    for session in db.sessions.find({"patient_id": patient_id}):
        for filename in _session_image_paths(session):
            full_path = os.path.join(settings.UPLOAD_DIR, filename)
            if os.path.exists(full_path):
                os.remove(full_path)

    linked_user = db.users.find_one({"patient_id": patient_id})

    db.sessions.delete_many({"patient_id": patient_id})
    db.treatment_plans.delete_many({"patient_id": patient_id})
    db.messages.delete_many({"patient_id": patient_id})
    db.appointments.delete_many({"patient_id": patient_id})
    if linked_user:
        db.notifications.delete_many({"user_id": linked_user["_id"]})
        db.users.delete_one({"_id": linked_user["_id"]})
    db.patients.delete_one({"_id": patient_id})

    return {"detail": f"{patient['name']} and all associated data have been deleted"}
