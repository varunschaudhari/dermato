"""
Facial landmarks via mediapipe's FaceLandmarker, used by face_detector.py for
two things:

1. A precise mouth+mustache exclusion box, replacing a fixed-proportion
   mouth-box guess that let mustache hair and lip edges leak into the
   analyzed skin_mask (bug report 2026-10: a mustache measured as
   "pigmentation", lips measured as "wrinkles").

2. A fallback face box for photos where face_detector.py's primary Haar
   cascade finds no face at all — confirmed this happens reliably on
   tightly-cropped, edge-to-edge selfies (a real user's own follow-up photo:
   Haar found zero faces at any scaleFactor/minNeighbors setting, mediapipe
   found 478 landmarks without trouble).

Both return None whenever mediapipe can't find a face or fails to load at
all — callers keep their own existing fallback behavior in that case, so
this module only ever adds precision/coverage on top of face_detector.py's
existing behavior, never replaces its "no face found at all" path (e.g. a
genuine tight skin-ROI crop with no face in frame).
"""
import os
from typing import List, Optional, Tuple

import cv2
import numpy as np

try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    _MODEL_PATH = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "models", "mediapipe", "face_landmarker.task")
    )
    _landmarker = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=_MODEL_PATH),
            num_faces=1,
        )
    )
except Exception as exc:  # pragma: no cover - defensive, see module docstring
    print(f"mediapipe FaceLandmarker unavailable, falling back to proportional mouth box: {exc}")
    mp = None
    _landmarker = None

# Indices from mediapipe's standard 468/478-point face mesh topology,
# verified visually against real reported bug photos (nose_tip sits right
# where a mustache begins; mouth corners/lip/cheek/forehead/chin points all
# land exactly where anatomically expected) rather than assumed from
# documentation alone.
_NOSE_TIP = 1
_MOUTH_LEFT = 61
_MOUTH_RIGHT = 291
_LIP_BOTTOM = 17
_CHEEK_LEFT = 234
_CHEEK_RIGHT = 454
_FOREHEAD_TOP = 10
_CHIN = 152


def _detect_landmarks(image_bgr: np.ndarray) -> Optional[List]:
    if _landmarker is None:
        return None
    try:
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        result = _landmarker.detect(mp_image)
    except Exception as exc:  # pragma: no cover - defensive, see module docstring
        print(f"mediapipe FaceLandmarker.detect failed: {exc}")
        return None
    return result.face_landmarks[0] if result.face_landmarks else None


def _mouth_box_from_landmarks(lm: List, w: int, h: int) -> Tuple[int, int, int, int]:
    nose_tip_y = lm[_NOSE_TIP].y * h
    lip_bottom_y = lm[_LIP_BOTTOM].y * h
    mouth_left_x = lm[_MOUTH_LEFT].x * w
    mouth_right_x = lm[_MOUTH_RIGHT].x * w

    x0, x1 = sorted((mouth_left_x, mouth_right_x))
    mouth_w = x1 - x0
    mouth_h = max(1.0, lip_bottom_y - nose_tip_y)

    # Horizontal padding catches the shadowed skin right at the mouth
    # corners; the top bound reaches up to the nose tip (where a mustache
    # begins) rather than a fixed fraction of face height, and the bottom
    # bound extends past the lower lip for lip-shadow/chin-crease coverage.
    x0 -= mouth_w * 0.25
    x1 += mouth_w * 0.25
    y0 = nose_tip_y - mouth_h * 0.1
    y1 = lip_bottom_y + mouth_h * 0.35

    return (
        max(0, int(x0)), max(0, int(y0)),
        min(w, int(x1)), min(h, int(y1)),
    )


def mouth_mustache_box(image_bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """Returns (x0, y0, x1, y1) in full-image pixel coords bounding the
    mouth, lips, and mustache/philtrum region for the largest face in
    `image_bgr`, or None if mediapipe is unavailable or finds no face.
    """
    h, w = image_bgr.shape[:2]
    lm = _detect_landmarks(image_bgr)
    if lm is None:
        return None
    return _mouth_box_from_landmarks(lm, w, h)


def face_box_from_landmarks(image_bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """Returns (x, y, fw, fh) — a face bounding box in the same shape
    face_detector.py's Haar cascade normally returns (top-left corner, width,
    height), built from mediapipe landmarks instead: cheek-to-cheek for
    width (the same bizygomatic measurement _AVG_FACE_WIDTH_CM assumes,
    arguably more precisely than Haar's rough box), forehead-to-chin for
    height. For use when the Haar cascade finds no face at all — confirmed
    this happens reliably on tightly-cropped, edge-to-edge selfies where
    mediapipe still succeeds. Returns None if mediapipe can't find a face
    either, or if the result is implausibly small (degenerate detection).
    """
    h, w = image_bgr.shape[:2]
    lm = _detect_landmarks(image_bgr)
    if lm is None:
        return None

    x_left = lm[_CHEEK_LEFT].x * w
    x_right = lm[_CHEEK_RIGHT].x * w
    y_top = lm[_FOREHEAD_TOP].y * h
    y_bottom = lm[_CHIN].y * h

    x0, x1 = sorted((x_left, x_right))
    if x1 - x0 < 10 or y_bottom - y_top < 10:
        return None

    x0 = max(0, int(x0))
    y0 = max(0, int(y_top))
    fw = min(w - x0, int(x1 - x0))
    fh = min(h - y0, int(y_bottom - y_top))
    return (x0, y0, fw, fh)
