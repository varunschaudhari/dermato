import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional

_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

# Average adult bizygomatic (cheekbone-to-cheekbone) face width, in cm — used
# to turn a detected face's pixel width into a per-photo cm-per-pixel scale.
# Replaces the fixed scale_cm_per_px assumption the analyzers used to default
# to unconditionally, which only holds for a photo captured at one specific,
# undocumented distance/zoom (verified wrong by >10x on a normal portrait —
# see the accuracy check that motivated this module).
_AVG_FACE_WIDTH_CM = 14.0

# Same skin-tone band quality_gate.py already uses to sanity-check "is there
# skin in this photo at all" — reused here to exclude hair/eyebrows/eyes from
# inside the face box, not just crop to a rectangle.
_SKIN_YCRCB_LOW = (0, 140, 85)
_SKIN_YCRCB_HIGH = (255, 175, 125)


@dataclass
class FaceCalibration:
    scale_cm_per_px: float
    skin_mask: np.ndarray  # uint8, single channel: 255 = analyze this pixel


def detect_and_calibrate(image: np.ndarray) -> Optional[FaceCalibration]:
    """Detects the largest face in `image` and derives a per-photo scale and
    skin mask from it.

    Returns None if no face is found — callers should fall back to the
    analyzers' default fixed scale and analyze the full frame unmasked, which
    is the original behavior. That matters for this app's primary intended
    input: a tight skin-ROI crop (e.g. a forehead close-up) that deliberately
    doesn't contain a whole face, and where a Haar cascade won't fire — this
    calibration only ever *adds* accuracy for wider portrait-style photos, it
    never overrides the tuned default for genuine close-ups.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = _face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(faces) == 0:
        return None

    # Largest detected face, in case of multiple/spurious detections
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    scale_cm_per_px = _AVG_FACE_WIDTH_CM / fw

    h, w = image.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    # Padded beyond the raw face box so cheeks/jaw/forehead aren't clipped —
    # Haar's box tends to run a bit tight — while still excluding hair and
    # background falling outside it.
    pad_x, pad_y = int(fw * 0.15), int(fh * 0.15)
    x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
    x1, y1 = min(w, x + fw + pad_x), min(h, y + fh + pad_y)
    mask[y0:y1, x0:x1] = 255

    # The face rectangle alone still contains plenty of non-skin pixels
    # (forehead hair, eyebrows, eyes) — intersecting with a skin-tone mask
    # is what actually keeps those out of the analyzed region.
    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
    skin = cv2.inRange(ycrcb, _SKIN_YCRCB_LOW, _SKIN_YCRCB_HIGH)
    mask = cv2.bitwise_and(mask, skin)
    # Skin-tone masks are speckled pixel-by-pixel; closing small gaps avoids
    # a lesion sitting on a few off-color pixels being excluded by accident.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    return FaceCalibration(scale_cm_per_px=scale_cm_per_px, skin_mask=mask)
