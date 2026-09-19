from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    get_current_user,
    hash_password,
    require_role,
    verify_password,
    verify_password_reset_token,
)
from app.db.database import get_db, next_id, to_ns
from app.schemas import (
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    Token,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.services.mailer import send_password_reset_email

router = APIRouter()

# Roles creatable via POST /users (this endpoint is for staff accounts only —
# patient login accounts are created via POST /api/patients/{patient_id}/account
# so they can be linked to an existing patient record).
STAFF_ROLES = {"admin", "dermatologist"}


@router.post("/register", response_model=UserOut)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def register(request: Request, payload: UserCreate, db=Depends(get_db)):
    if db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Public self-registration is always a dermatologist account; admin accounts
    # are created by an existing admin via POST /users.
    doc = {
        "_id": next_id("users"),
        "email": payload.email,
        "hashed_password": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": "dermatologist",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "patient_id": None,
    }
    db.users.insert_one(doc)
    return to_ns(doc)


@router.post("/login", response_model=Token)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    user = to_ns(db.users.find_one({"email": form_data.username}))
    if not user or not verify_password(form_data.password, user.hashed_password) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=user.email)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, db=Depends(get_db), current_user=Depends(get_current_user)):
    updates = {}
    if payload.email and payload.email != current_user.email:
        if db.users.find_one({"email": payload.email}):
            raise HTTPException(status_code=400, detail="Email already registered")
        updates["email"] = payload.email
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name

    if updates:
        db.users.update_one({"_id": current_user.id}, {"$set": updates})

    return to_ns(db.users.find_one({"_id": current_user.id}))


@router.post("/me/consent", response_model=UserOut)
def give_consent(db=Depends(get_db), current_user=Depends(get_current_user)):
    """Records acceptance of the AI-assisted-screening disclaimer. One-time per
    account — the frontend gates self-service analysis behind this."""
    db.users.update_one({"_id": current_user.id}, {"$set": {"consent_given_at": datetime.utcnow()}})
    return to_ns(db.users.find_one({"_id": current_user.id}))


@router.post("/me/password")
def change_password(payload: PasswordChange, db=Depends(get_db), current_user=Depends(get_current_user)):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    db.users.update_one(
        {"_id": current_user.id}, {"$set": {"hashed_password": hash_password(payload.new_password)}}
    )
    return {"detail": "Password updated"}


@router.post("/forgot-password")
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def forgot_password(request: Request, payload: PasswordResetRequest, db=Depends(get_db)):
    user = to_ns(db.users.find_one({"email": payload.email}))
    if user and user.is_active:
        token = create_password_reset_token(user)
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        send_password_reset_email(user.email, reset_link)

    # Same response whether or not the email is registered, so this endpoint
    # can't be used to enumerate which emails have accounts.
    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def reset_password(request: Request, payload: PasswordResetConfirm, db=Depends(get_db)):
    user = verify_password_reset_token(payload.token, db)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    db.users.update_one({"_id": user.id}, {"$set": {"hashed_password": hash_password(payload.new_password)}})
    return {"detail": "Password reset successful"}


@router.get("/users", response_model=list[UserOut])
def list_users(db=Depends(get_db), _=Depends(require_role("admin"))):
    return [to_ns(d) for d in db.users.find()]


@router.post("/users", response_model=UserOut)
def create_user(payload: UserCreate, db=Depends(get_db), _=Depends(require_role("admin"))):
    if payload.role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(STAFF_ROLES)}")
    if db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    doc = {
        "_id": next_id("users"),
        "email": payload.email,
        "hashed_password": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": payload.role,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "patient_id": None,
    }
    db.users.insert_one(doc)
    return to_ns(doc)


@router.patch("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(user_id: int, db=Depends(get_db), admin=Depends(require_role("admin"))):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    if not db.users.find_one({"_id": user_id}):
        raise HTTPException(status_code=404, detail="User not found")

    db.users.update_one({"_id": user_id}, {"$set": {"is_active": False}})
    return to_ns(db.users.find_one({"_id": user_id}))
