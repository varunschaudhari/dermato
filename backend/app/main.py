import os
from datetime import datetime

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.api.routes import analysis, analytics, appointments, auth, notifications, remedies, sessions, patients
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import get_current_user, hash_password, require_role
from app.db.database import get_db, next_id
from app.services.reminder_scheduler import start_reminder_scheduler


def _bootstrap_admin() -> None:
    db = get_db()
    if db.users.count_documents({}) == 0:
        db.users.insert_one(
            {
                "_id": next_id("users"),
                "phone": settings.ADMIN_PHONE,
                "email": settings.ADMIN_EMAIL,
                "hashed_password": hash_password(settings.ADMIN_PASSWORD),
                "full_name": "Default Admin",
                "role": "admin",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "patient_id": None,
            }
        )
        print(
            f"Created default admin user: {settings.ADMIN_PHONE} / {settings.ADMIN_PASSWORD} "
            "— change this password immediately."
        )


_bootstrap_admin()
start_reminder_scheduler()

app = FastAPI(title="Dermato API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(
    analysis.router,
    prefix="/api/analysis",
    tags=["Analysis"],
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    sessions.router, prefix="/api/sessions", tags=["Sessions"], dependencies=[Depends(get_current_user)]
)
app.include_router(
    patients.router, prefix="/api/patients", tags=["Patients"], dependencies=[Depends(get_current_user)]
)
app.include_router(
    analytics.router,
    prefix="/api/analytics",
    tags=["Analytics"],
    dependencies=[Depends(require_role("admin"))],
)
app.include_router(
    remedies.router,
    prefix="/api/remedies",
    tags=["Remedies"],
    dependencies=[Depends(require_role("admin"))],
)
app.include_router(
    notifications.router,
    prefix="/api/notifications",
    tags=["Notifications"],
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    appointments.router,
    prefix="/api/appointments",
    tags=["Appointments"],
    dependencies=[Depends(get_current_user)],
)


@app.get("/health")
def health():
    return {"status": "ok"}
