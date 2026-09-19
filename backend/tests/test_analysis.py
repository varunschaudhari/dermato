import io

import cv2
import numpy as np


def _create_patient(client, headers, name="Analysis Patient"):
    res = client.post(
        "/api/patients/", json={"name": name, "age": 28, "skin_type": "oily"}, headers=headers
    )
    return res.json()["id"]


def _fake_jpeg_bytes(color=(120, 90, 200)):
    # 480x480 is quality_gate's resolution floor. A perfectly flat color would
    # also fail its blur-variance check (a constant image has zero Laplacian
    # variance), so add noise for texture.
    rng = np.random.default_rng(0)
    image = np.full((480, 480, 3), color, dtype=np.int16)
    image += rng.integers(-18, 19, size=image.shape, dtype=np.int16)
    image = np.clip(image, 0, 255).astype(np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok
    return encoded.tobytes()


def test_analyze_front_only(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    files = {"file": ("front.jpg", io.BytesIO(_fake_jpeg_bytes()), "image/jpeg")}
    res = client.post(
        "/api/analysis/analyze", files=files, data={"patient_id": patient_id}, headers=auth_headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["patient_id"] == patient_id
    assert list(body["images"].keys()) == ["front"]
    assert "acne" in body["severity"]


def test_analyze_with_left_and_right_angles(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    files = {
        "file": ("front.jpg", io.BytesIO(_fake_jpeg_bytes()), "image/jpeg"),
        "file_left": ("left.jpg", io.BytesIO(_fake_jpeg_bytes((50, 50, 50))), "image/jpeg"),
        "file_right": ("right.jpg", io.BytesIO(_fake_jpeg_bytes((200, 200, 200))), "image/jpeg"),
    }
    res = client.post(
        "/api/analysis/analyze", files=files, data={"patient_id": patient_id}, headers=auth_headers
    )
    assert res.status_code == 200
    body = res.json()
    assert set(body["images"].keys()) == {"front", "left", "right"}

    sessions = client.get(f"/api/sessions/patient/{patient_id}", headers=auth_headers).json()
    assert len(sessions) == 1
    assert set(sessions[0]["images"].keys()) == {"front", "left", "right"}


def test_analyze_requires_valid_image(client, auth_headers):
    patient_id = _create_patient(client, auth_headers)
    files = {"file": ("front.txt", io.BytesIO(b"not an image"), "text/plain")}
    res = client.post(
        "/api/analysis/analyze", files=files, data={"patient_id": patient_id}, headers=auth_headers
    )
    assert res.status_code == 400


def test_analyze_requires_existing_patient(client, auth_headers):
    files = {"file": ("front.jpg", io.BytesIO(_fake_jpeg_bytes()), "image/jpeg")}
    res = client.post(
        "/api/analysis/analyze", files=files, data={"patient_id": 999999}, headers=auth_headers
    )
    assert res.status_code == 404
