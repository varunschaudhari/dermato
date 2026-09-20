import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from app.core.config import settings
from app.core.security import get_current_user
from app.db.database import get_db, next_id, to_ns
from app.services import preprocessor, quality_gate, acne_analyzer, pigmentation_analyzer, wrinkle_analyzer, pore_analyzer, face_detector
from app.services.severity_classifier import classify_acne, classify_pigmentation, classify_wrinkle, classify_pore
from app.services.recommendation_engine import get_recommendations
from app.services.treatment_tracker import compute_effective_severity, update_treatment_plan

# backend/training/inference.py is a sibling of backend/app/, not a sub-package of it
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

try:
    from training.inference import run as ml_analyze
    ML_AVAILABLE = True
except ImportError as exc:
    print(f"ML inference unavailable, using classical CV analyzers only: {exc}")
    ml_analyze = None
    ML_AVAILABLE = False

router = APIRouter()

# The acne severity classifier has a 4th "clear" class; the recommendation
# table only defines mild/moderate/severe tiers.
_SEVERITY_ALIAS = {"clear": "mild"}


async def _read_and_validate(file: UploadFile) -> bytes:
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    contents = await file.read()
    max_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Image exceeds the {settings.MAX_IMAGE_SIZE_MB}MB limit")
    return contents


def _save_upload(contents: bytes, original_filename: str) -> str:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(original_filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(settings.UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)
    return filename


@router.post("/quality-check")
async def check_quality(file: UploadFile = File(...)):
    """Runs just the quality gate against a single photo — no analyzers, no DB
    writes, no patient_id — so the capture screen can flag a bad photo (blurry,
    too dark, no skin in frame, ...) the moment it's taken, instead of the
    patient only finding out after tapping Analyze and waiting for the full
    pipeline. Reuses quality_gate.assess()'s exact 422 {reason, message} shape,
    so both platforms can share one error-rendering code path for this and the
    final /analyze call's own gate (which stays in place as the real backstop —
    this is a same-checks preview, not a replacement).
    """
    contents = await _read_and_validate(file)
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    quality_gate.assess(image)
    return {"status": "ok"}


@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(..., description="Front-facing photo — required, drives the analysis"),
    file_left: Optional[UploadFile] = File(None, description="Left-angle photo — optional, stored for reference only"),
    file_right: Optional[UploadFile] = File(None, description="Right-angle photo — optional, stored for reference only"),
    patient_id: int = Form(...),
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == "patient" and current_user.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Not authorized to analyze on behalf of this patient")

    patient = to_ns(db.patients.find_one({"_id": patient_id}))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    contents = await _read_and_validate(file)

    # Only the front photo drives analysis — left/right are captured purely for
    # richer visual tracking and aren't run through the analyzers/ML models.
    left_contents = await _read_and_validate(file_left) if file_left else None
    right_contents = await _read_and_validate(file_right) if file_right else None

    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    quality_gate.assess(image)

    processed = preprocessor.preprocess(image)

    # If a whole face is in frame (a normal portrait, not a tight skin-ROI
    # crop), calibrate the physical scale from its detected width and confine
    # every analyzer to the actual skin region instead of the full frame —
    # otherwise hair, jewelry, and clothing get scored as skin. No face found
    # (e.g. a genuine close-up crop) falls back to each analyzer's original,
    # unmasked, fixed-scale behavior unchanged.
    calibration = face_detector.detect_and_calibrate(processed)
    scale = calibration.scale_cm_per_px if calibration else 0.026
    skin_mask = calibration.skin_mask if calibration else None

    acne = acne_analyzer.analyze(processed, scale_cm_per_px=scale, skin_mask=skin_mask)
    pigmentation = pigmentation_analyzer.analyze(processed, skin_mask=skin_mask)
    wrinkle = wrinkle_analyzer.analyze(processed, scale_cm_per_px=scale, skin_mask=skin_mask)
    pore = pore_analyzer.analyze(processed, skin_mask=skin_mask)

    # Normalized regions from the same classical segmentation, so the frontend
    # can plot what each analyzer actually looked at on the uploaded photo.
    overlays = {
        "acne": acne_analyzer.overlay_regions(processed, skin_mask=skin_mask),
        "pigmentation": pigmentation_analyzer.overlay_regions(processed, skin_mask=skin_mask),
        "wrinkle": wrinkle_analyzer.overlay_regions(processed, skin_mask=skin_mask),
    }

    acne_result = classify_acne(acne)
    pig_result = classify_pigmentation(pigmentation)
    wrinkle_result = classify_wrinkle(wrinkle)
    pore_result = classify_pore(pore)

    acne_sev = acne_result.severity
    pig_sev = pig_result.severity
    wrinkle_sev = wrinkle_result.severity
    pore_sev = pore_result.severity

    # WSI/flag are always the honest classical-CV weighted-index reading, even
    # when a trained ML model overrides the discrete severity label below.
    wsi = {"acne": acne_result.wsi, "pigmentation": pig_result.wsi, "wrinkle": wrinkle_result.wsi, "pore": pore_result.wsi}
    flags = {"acne": acne_result.flag, "pigmentation": pig_result.flag, "wrinkle": wrinkle_result.flag, "pore": pore_result.flag}

    # Trained YOLO/EfficientNet models override the classical CV severity
    # calls where available; pore severity has no trained model yet, so it
    # always comes from the classical analyzer above.
    # These models were trained on raw dataset images (see training/train_*.py —
    # no denoise/white-balance step anywhere in the training pipeline), so they
    # must run on the original `image`, not `processed`: feeding them the
    # denoised/white-balanced version measurably suppresses or mislabels
    # detections (verified — Dark-Spots/Wrinkles detections vanished entirely
    # on preprocessed input where the raw image found them at 0.25-0.4 confidence).
    ml_detections = None
    if ML_AVAILABLE:
        try:
            ml_results = ml_analyze(image)
        except Exception as exc:
            print(f"ML inference failed, falling back to classical CV severity: {exc}")
            ml_results = None

        if ml_results:
            ml_detections = {"detections": []}
            ai_acne = ml_results.get("acne")
            if ai_acne:
                acne_sev = _SEVERITY_ALIAS.get(ai_acne.severity, ai_acne.severity)
                # The flag text describes the classical WSI vote's own reasoning —
                # if the ML model landed on a different severity, that reasoning no
                # longer explains what's being shown, so drop it rather than
                # display a flag that contradicts the visible severity.
                if acne_sev != acne_result.severity:
                    flags["acne"] = None
                ml_detections["acne_lesion_types"] = ai_acne.lesion_types
                ml_detections["detections"].extend(ai_acne.detections)

            skin_problems = ml_results.get("skin_problems")
            if skin_problems:
                pig_sev = skin_problems["pigmentation"].severity
                wrinkle_sev = skin_problems["wrinkle"].severity
                # The pigmentation/wrinkle classifiers were bootstrap-trained on
                # the classical formula's own output (see
                # train_pigmentation_wrinkle_severity.py) from a dataset with
                # zero "severe" examples of either condition -- they structurally
                # cannot predict "severe". The classical WSI verdict is the only
                # signal that can, so it wins whenever it says severe, same as
                # the existing hard overrides in severity_classifier.py
                # (nodules/cysts, >50% pigmented area).
                if pig_result.severity == "severe":
                    pig_sev = "severe"
                if wrinkle_result.severity == "severe":
                    wrinkle_sev = "severe"
                if pig_sev != pig_result.severity:
                    flags["pigmentation"] = None
                if wrinkle_sev != wrinkle_result.severity:
                    flags["wrinkle"] = None
                ml_detections["skin_problem_counts"] = skin_problems["detection_counts"]
                ml_detections["detections"].extend(skin_problems.get("detections", []))

    detected_severities = {"acne": acne_sev, "pigmentation": pig_sev, "wrinkle": wrinkle_sev, "pore": pore_sev}

    # If the same condition failed to respond to its last two remedies, escalate the
    # recommendation tier (e.g. Home remedy -> OTC) rather than repeating what didn't work.
    # This only changes which remedy is recommended — the severity shown/stored is always
    # the honest, unadjusted reading from this photo.
    effective_severities = {}
    escalated_flags = {}
    for condition, sev in detected_severities.items():
        eff, escalated = compute_effective_severity(db, patient_id, condition, sev)
        effective_severities[condition] = eff
        escalated_flags[condition] = escalated

    recommendations = get_recommendations(
        db,
        effective_severities["acne"],
        effective_severities["pigmentation"],
        effective_severities["wrinkle"],
        effective_severities["pore"],
    )
    # get_recommendations already hands back a fresh dict per condition, but we
    # copy again defensively before annotating so this loop never risks mutating
    # shared state, even if that guarantee changes upstream.
    for condition in detected_severities:
        recommendations[condition] = {**recommendations[condition], "escalated": escalated_flags[condition]}

    filename = _save_upload(contents, file.filename)
    image_paths = {"front": filename}
    if left_contents:
        image_paths["left"] = _save_upload(left_contents, file_left.filename)
    if right_contents:
        image_paths["right"] = _save_upload(right_contents, file_right.filename)

    session_doc = {
        "_id": next_id("sessions"),
        "patient_id": patient_id,
        "image_path": filename,
        "image_paths": image_paths,
        "captured_at": datetime.utcnow(),
        "acne_params": acne.__dict__,
        "pigmentation_params": pigmentation.__dict__,
        "wrinkle_params": wrinkle.__dict__,
        "pore_params": pore.__dict__,
        "acne_severity": acne_sev,
        "pigmentation_severity": pig_sev,
        "wrinkle_severity": wrinkle_sev,
        "pore_severity": pore_sev,
        "acne_wsi": wsi["acne"],
        "pigmentation_wsi": wsi["pigmentation"],
        "wrinkle_wsi": wsi["wrinkle"],
        "acne_flag": flags["acne"],
        "pigmentation_flag": flags["pigmentation"],
        "wrinkle_flag": flags["wrinkle"],
        "recommendations": recommendations,
        "ml_detections": ml_detections,
        "overlays": overlays,
        "doctor_note": None,
        "patient_note": None,
    }
    db.sessions.insert_one(session_doc)
    session = to_ns(session_doc)

    previous_severities = {}
    for condition, sev in detected_severities.items():
        resolved_plan = update_treatment_plan(db, patient_id, condition, session, sev, recommendations[condition])
        if resolved_plan:
            previous_severities[condition] = resolved_plan.severity_at_start
            if resolved_plan.outcome == "worsened" and patient.assigned_doctor_id:
                db.notifications.insert_one(
                    {
                        "_id": next_id("notifications"),
                        "user_id": patient.assigned_doctor_id,
                        "type": "severity_worsened",
                        "message": f"{patient.name}'s {condition} got worse since the last check",
                        "link": f"/progress/{patient_id}",
                        "related_id": session.id,
                        "is_read": False,
                        "created_at": datetime.utcnow(),
                    }
                )

    return {
        "session_id": session.id,
        "patient_id": patient_id,
        "image_url": f"/uploads/{filename}",
        "images": {angle: f"/uploads/{p}" for angle, p in image_paths.items()},
        "model_powered": ml_detections is not None,
        "parameters": {
            "acne": acne.__dict__,
            "pigmentation": pigmentation.__dict__,
            "wrinkle": wrinkle.__dict__,
            "pore": pore.__dict__,
        },
        "severity": {
            "acne": acne_sev,
            "pigmentation": pig_sev,
            "wrinkle": wrinkle_sev,
            "pore": pore_sev,
        },
        "wsi": wsi,
        "flags": flags,
        "previous_severity": previous_severities,
        "recommendations": recommendations,
        "ml_detections": ml_detections,
        "overlays": overlays,
    }
