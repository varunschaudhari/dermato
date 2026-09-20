from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field


class PatientCreate(BaseModel):
    name: str
    age: int
    skin_type: str


class PatientSelfRegister(BaseModel):
    email: str
    password: str
    full_name: str
    age: int
    skin_type: str


class DoctorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: Optional[str] = None
    email: str


class SkinHistoryUpdate(BaseModel):
    allergies: Optional[str] = None
    current_products: Optional[str] = None
    known_conditions: Optional[str] = None
    medications: Optional[str] = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    age: Optional[int] = None
    skin_type: Optional[str] = None
    created_at: datetime
    assigned_doctor_id: Optional[int] = None
    assigned_doctor: Optional[DoctorSummary] = None
    skin_history: Optional[dict] = None


class AssignDoctorRequest(BaseModel):
    doctor_id: Optional[int] = None


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    image_path: str
    image_paths: Optional[dict] = None
    captured_at: datetime
    acne_params: Optional[dict] = None
    pigmentation_params: Optional[dict] = None
    wrinkle_params: Optional[dict] = None
    pore_params: Optional[dict] = None
    acne_severity: Optional[str] = None
    pigmentation_severity: Optional[str] = None
    wrinkle_severity: Optional[str] = None
    pore_severity: Optional[str] = None
    acne_wsi: Optional[float] = None
    pigmentation_wsi: Optional[float] = None
    wrinkle_wsi: Optional[float] = None
    acne_flag: Optional[str] = None
    pigmentation_flag: Optional[str] = None
    wrinkle_flag: Optional[str] = None
    recommendations: Optional[dict] = None
    ml_detections: Optional[dict] = None
    overlays: Optional[dict] = None
    doctor_note: Optional[str] = None
    patient_note: Optional[str] = None

    @computed_field
    @property
    def model_powered(self) -> bool:
        return self.ml_detections is not None

    @computed_field
    @property
    def image_url(self) -> str:
        return f"/uploads/{self.image_path}"

    @computed_field
    @property
    def images(self) -> dict:
        """angle -> URL, e.g. {"front": "/uploads/x.jpg", "left": "/uploads/y.jpg"}.
        Falls back to just the front image for sessions captured before
        multi-angle support existed (they only ever had `image_path`)."""
        paths = self.image_paths or {"front": self.image_path}
        return {angle: f"/uploads/{p}" for angle, p in paths.items()}


class DoctorNoteUpdate(BaseModel):
    note: str


class PatientNoteUpdate(BaseModel):
    note: str


class TreatmentPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    condition: str
    started_session_id: int
    started_at: datetime
    severity_at_start: str
    remedy_type: str
    remedy_text: str
    duration_weeks: Optional[str] = None
    expected_recheck_at: Optional[datetime] = None
    status: str
    outcome_session_id: Optional[int] = None
    resolved_at: Optional[datetime] = None
    outcome_severity: Optional[str] = None
    outcome: Optional[str] = None


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "dermatologist"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    patient_id: Optional[int] = None
    consent_given_at: Optional[datetime] = None


class PatientAccountCreate(BaseModel):
    email: str
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime


class OverdueRecheckOut(BaseModel):
    patient_id: int
    patient_name: str
    condition: str
    remedy_type: str
    expected_recheck_at: datetime
    days_overdue: int


class MessageCreate(BaseModel):
    body: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    sender_id: int
    sender_name: Optional[str] = None
    sender_role: str
    body: str
    created_at: datetime


class MessageInboxItem(BaseModel):
    patient_id: int
    patient_name: str
    last_message: Optional[str] = None
    last_sender_name: Optional[str] = None
    last_sender_role: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0


class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    scheduled_at: datetime
    reason: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    status: str  # "cancelled" | "completed"


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    patient_name: str
    doctor_id: int
    doctor_name: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    reason: Optional[str] = None
    created_at: datetime


class DoctorOption(BaseModel):
    id: int
    full_name: Optional[str] = None


class ImportError_(BaseModel):
    row: int
    reason: str


class ImportResult(BaseModel):
    created: list[dict]
    errors: list[ImportError_]
