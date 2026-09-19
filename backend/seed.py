"""Seed the database with demo staff, patients, and analysis history.

Usage (from the backend/ directory):
    .venv\\Scripts\\python.exe seed.py            # seed if the DB is empty
    .venv\\Scripts\\python.exe seed.py --reset     # wipe the database first, then seed

Not for production use — passwords are fixed/known on purpose so you can log
in and click around immediately.
"""
import argparse
import os
import random
import uuid
from datetime import datetime, timedelta

import cv2
import numpy as np

from app.core.config import settings
from app.core.security import hash_password
from app.db.database import client, get_db, next_id, to_ns
from app.services.acne_analyzer import AcneParams
from app.services.pigmentation_analyzer import PigmentationParams
from app.services.pore_analyzer import PoreParams
from app.services.recommendation_engine import get_recommendations
from app.services.severity_classifier import classify_acne, classify_pigmentation, classify_pore, classify_wrinkle
from app.services.treatment_tracker import update_treatment_plan
from app.services.wrinkle_analyzer import WrinkleParams

DEFAULT_PASSWORD = "password123"
ADMIN_EMAIL = settings.ADMIN_EMAIL
ADMIN_PASSWORD = settings.ADMIN_PASSWORD

DERMATOLOGISTS = [
    {"email": "dr.patel@dermato.local", "full_name": "Dr. Priya Patel"},
    {"email": "dr.kim@dermato.local", "full_name": "Dr. Steven Kim"},
]

PATIENTS = [
    {"name": "Alice Johnson", "age": 24, "skin_type": "oily"},
    {"name": "Bob Martinez", "age": 35, "skin_type": "dry"},
    {"name": "Carla Nguyen", "age": 29, "skin_type": "combination"},
    {"name": "David Lee", "age": 42, "skin_type": "normal"},
    {"name": "Emma Wilson", "age": 19, "skin_type": "sensitive"},
]

# index into PATIENTS -> login email; these two get patient portal accounts
PATIENT_LOGINS = {0: "alice@patient.local", 2: "carla@patient.local"}

SEVERITY_LEVELS = ["severe", "moderate", "mild"]


def step_down(level: str) -> str:
    """Simulates gradual improvement across visits."""
    i = SEVERITY_LEVELS.index(level)
    if i == len(SEVERITY_LEVELS) - 1 or random.random() < 0.4:
        return level
    return SEVERITY_LEVELS[i + 1]


def random_acne(sev: str) -> AcneParams:
    ranges = {
        "mild": (0, 5.9, -2, 14.9, 0, 20),
        "moderate": (6, 15, 15, 34.9, 20, 50),
        "severe": (15.1, 25, 35.1, 55, 50, 90),
    }
    lo_c, hi_c, lo_r, hi_r, lo_i, hi_i = ranges[sev]
    lesion_type = {"mild": "comedones", "moderate": "papules_pustules", "severe": "nodules_cysts"}[sev]
    return AcneParams(
        lesion_count_per_cm2=round(random.uniform(lo_c, hi_c), 2),
        redness_index=round(random.uniform(lo_r, hi_r), 2),
        lesion_type=lesion_type,
        inflammatory_pct=round(random.uniform(lo_i, hi_i), 2),
    )


def random_pigmentation(sev: str) -> PigmentationParams:
    ranges = {
        "mild": (0, 9.9, 0, 19.9, 0, 49.9),
        "moderate": (10, 30, 20, 50, 50, 100),
        "severe": (30.1, 45, 50.1, 70, 100.1, 140),
    }
    lo_a, hi_a, lo_g, hi_g, lo_m, hi_m = ranges[sev]
    return PigmentationParams(
        pigmented_area_pct=round(random.uniform(lo_a, hi_a), 2),
        delta_gray=round(random.uniform(lo_g, hi_g), 2),
        melanin_index=round(random.uniform(lo_m, hi_m), 2),
    )


def random_wrinkle(sev: str) -> WrinkleParams:
    ranges = {
        "mild": (0, 4.9, 0, 19.9, 0, 19.9),
        "moderate": (5, 10, 20, 40, 20, 50),
        "severe": (10.1, 16, 40.1, 60, 50.1, 75),
    }
    lo_c, hi_c, lo_l, hi_l, lo_d, hi_d = ranges[sev]
    return WrinkleParams(
        wrinkle_count_per_cm2=round(random.uniform(lo_c, hi_c), 2),
        avg_length_mm=round(random.uniform(lo_l, hi_l), 2),
        depth_delta_gray=round(random.uniform(lo_d, hi_d), 2),
        density_pct=round(random.uniform(0, 15), 2),
    )


def random_pore(sev: str) -> PoreParams:
    # Matches classify_pore's thresholds in severity_classifier.py: mild
    # <0.5%/<1.3%, moderate 0.5-1.5%/1.3-2.0%, severe >1.5%/>2.0%.
    ranges = {
        "mild": (0, 0.49, 0, 1.29),
        "moderate": (0.5, 1.5, 1.3, 2.0),
        "severe": (1.51, 2.5, 2.01, 3.0),
    }
    lo_d, hi_d, lo_s, hi_s = ranges[sev]
    return PoreParams(
        pore_density_pct=round(random.uniform(lo_d, hi_d), 3),
        avg_pore_size_pct=round(random.uniform(lo_s, hi_s), 3),
    )


def make_demo_image(seed_color: tuple, blemish_count: int) -> np.ndarray:
    img = np.full((300, 300, 3), seed_color, dtype=np.uint8)
    noise = np.random.randint(-8, 8, img.shape, dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    for _ in range(blemish_count):
        x, y = random.randint(15, 285), random.randint(15, 285)
        r = random.randint(2, 6)
        shade = tuple(max(c - random.randint(40, 90), 0) for c in seed_color)
        cv2.circle(img, (x, y), r, shade, -1)
    return img


def save_demo_image(seed_color: tuple, blemish_count: int) -> str:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"seed_{uuid.uuid4().hex}.jpg"
    img = make_demo_image(seed_color, blemish_count)
    cv2.imwrite(os.path.join(settings.UPLOAD_DIR, filename), img)
    return filename


SKIN_TONES = [(150, 180, 205), (140, 170, 200), (120, 155, 190), (160, 190, 215), (130, 165, 195)]


def seed_sessions_for_patient(db, patient, tone: tuple, visits: int) -> None:
    acne_sev = random.choice(["severe", "moderate"])
    pig_sev = random.choice(["moderate", "mild"])
    wrinkle_sev = random.choice(["moderate", "mild"])
    pore_sev = random.choice(["moderate", "mild"])

    base_time = datetime.utcnow() - timedelta(weeks=3 * visits)

    for visit in range(visits):
        acne = random_acne(acne_sev)
        pigmentation = random_pigmentation(pig_sev)
        wrinkle = random_wrinkle(wrinkle_sev)
        pore = random_pore(pore_sev)

        # sanity-check the generated params actually land in the severity band they were built for
        acne_result = classify_acne(acne)
        pig_result = classify_pigmentation(pigmentation)
        wrinkle_result = classify_wrinkle(wrinkle)
        pore_result = classify_pore(pore)

        acne_sev_actual = acne_result.severity
        pig_sev_actual = pig_result.severity
        wrinkle_sev_actual = wrinkle_result.severity
        pore_sev_actual = pore_result.severity

        recommendations = get_recommendations(db, acne_sev_actual, pig_sev_actual, wrinkle_sev_actual, pore_sev_actual)

        blemish_count = {"mild": 5, "moderate": 15, "severe": 30}[acne_sev_actual]
        filename = save_demo_image(tone, blemish_count)

        is_latest = visit == visits - 1
        ml_detections = None
        if is_latest:
            ml_detections = {
                "acne_lesion_types": {"papules": random.randint(0, 4), "blackheads": random.randint(0, 6)},
                "skin_problem_counts": {
                    "Acne": random.randint(0, 5),
                    "Dry-Skin": random.randint(0, 2),
                    "Enlarged-Pores": random.randint(0, 4),
                    "Wrinkles": random.randint(0, 3),
                },
            }

        session_doc = {
            "_id": next_id("sessions"),
            "patient_id": patient.id,
            "image_path": filename,
            "captured_at": base_time + timedelta(weeks=3 * visit),
            "acne_params": acne.__dict__,
            "pigmentation_params": pigmentation.__dict__,
            "wrinkle_params": wrinkle.__dict__,
            "pore_params": pore.__dict__,
            "acne_severity": acne_sev_actual,
            "pigmentation_severity": pig_sev_actual,
            "wrinkle_severity": wrinkle_sev_actual,
            "pore_severity": pore_sev_actual,
            "acne_wsi": acne_result.wsi,
            "pigmentation_wsi": pig_result.wsi,
            "wrinkle_wsi": wrinkle_result.wsi,
            "acne_flag": acne_result.flag,
            "pigmentation_flag": pig_result.flag,
            "wrinkle_flag": wrinkle_result.flag,
            "recommendations": recommendations,
            "ml_detections": ml_detections,
            "doctor_note": None,
        }
        db.sessions.insert_one(session_doc)
        session = to_ns(session_doc)

        update_treatment_plan(db, patient.id, "acne", session, acne_sev_actual, recommendations["acne"])
        update_treatment_plan(db, patient.id, "pigmentation", session, pig_sev_actual, recommendations["pigmentation"])
        update_treatment_plan(db, patient.id, "wrinkle", session, wrinkle_sev_actual, recommendations["wrinkle"])
        update_treatment_plan(db, patient.id, "pore", session, pore_sev_actual, recommendations["pore"])

        acne_sev, pig_sev, wrinkle_sev, pore_sev = (
            step_down(acne_sev),
            step_down(pig_sev),
            step_down(wrinkle_sev),
            step_down(pore_sev),
        )


def _insert_user(db, email, password, full_name, role, patient_id=None):
    doc = {
        "_id": next_id("users"),
        "email": email,
        "hashed_password": hash_password(password),
        "full_name": full_name,
        "role": role,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "patient_id": patient_id,
    }
    db.users.insert_one(doc)
    return to_ns(doc)


def seed(db) -> None:
    _insert_user(db, ADMIN_EMAIL, ADMIN_PASSWORD, "Default Admin", "admin")

    dermatologists = [
        _insert_user(db, derm["email"], DEFAULT_PASSWORD, derm["full_name"], "dermatologist")
        for derm in DERMATOLOGISTS
    ]

    for i, p in enumerate(PATIENTS):
        # Assign most patients to a doctor; leave one unclaimed to demo the "unassigned" state
        assigned_doctor_id = dermatologists[i % len(dermatologists)].id if i < len(PATIENTS) - 1 else None
        patient_doc = {
            "_id": next_id("patients"),
            "name": p["name"],
            "age": p["age"],
            "skin_type": p["skin_type"],
            "created_at": datetime.utcnow(),
            "assigned_doctor_id": assigned_doctor_id,
        }
        db.patients.insert_one(patient_doc)
        patient = to_ns(patient_doc)

        seed_sessions_for_patient(db, patient, SKIN_TONES[i % len(SKIN_TONES)], visits=random.randint(2, 4))

        if i in PATIENT_LOGINS:
            _insert_user(db, PATIENT_LOGINS[i], DEFAULT_PASSWORD, patient.name, "patient", patient_id=patient.id)


def print_summary() -> None:
    print("\nSeeded accounts (all staff/patient passwords except admin are: " + DEFAULT_PASSWORD + ")")
    print(f"  admin          {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    for derm in DERMATOLOGISTS:
        print(f"  dermatologist  {derm['email']}")
    for idx, email in PATIENT_LOGINS.items():
        print(f"  patient        {email}  (linked to {PATIENTS[idx]['name']})")
    print(f"\n{len(PATIENTS)} patients created, {len(PATIENT_LOGINS)} with portal logins.\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop the database before seeding")
    args = parser.parse_args()

    db = get_db()

    if args.reset:
        client.drop_database(db.name)
    elif db.patients.count_documents({}) > 0:
        print("Database already has patients — pass --reset to wipe and reseed.")
        return

    seed(db)
    print_summary()


if __name__ == "__main__":
    main()
