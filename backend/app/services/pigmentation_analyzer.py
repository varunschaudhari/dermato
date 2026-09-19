import cv2
import numpy as np
from dataclasses import dataclass


@dataclass
class PigmentationParams:
    pigmented_area_pct: float
    delta_gray: float
    melanin_index: float


def _pigment_mask(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    # Brown/dark pigmentation mask in HSV
    lower = np.array([0, 20, 30])
    upper = np.array([30, 255, 200])
    return cv2.inRange(hsv, lower, upper)


def analyze(image: np.ndarray) -> PigmentationParams:
    mask = _pigment_mask(image)

    total_pixels = image.shape[0] * image.shape[1]
    pigmented_pixels = np.count_nonzero(mask)
    pigmented_area_pct = (pigmented_pixels / total_pixels) * 100

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    pigmented_mean = cv2.mean(gray, mask=mask)[0] if pigmented_pixels > 0 else 0
    normal_mask = cv2.bitwise_not(mask)
    normal_mean = cv2.mean(gray, mask=normal_mask)[0]
    delta_gray = abs(normal_mean - pigmented_mean)

    melanin_index = _melanin_index(image)

    return PigmentationParams(
        pigmented_area_pct=round(pigmented_area_pct, 2),
        delta_gray=round(delta_gray, 2),
        melanin_index=round(melanin_index, 2),
    )


def overlay_regions(image: np.ndarray, max_regions: int = 25) -> list:
    """Normalized (0-1) polygon outlines of the pigmented patches, largest first,
    for drawing on the uploaded photo. Uses the same HSV mask as analyze(); a
    light open/close pass merges pixel noise into coherent patches — this is
    visualization-only and does not affect the measured pigmented_area_pct."""
    mask = _pigment_mask(image)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = image.shape[:2]
    min_area = 0.001 * h * w
    polygons = []
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:max_regions]:
        if cv2.contourArea(c) < min_area:
            break
        approx = cv2.approxPolyDP(c, 0.01 * cv2.arcLength(c, True), True)
        if len(approx) < 3:
            continue
        polygons.append({"polygon": [[round(float(p[0][0]) / w, 4), round(float(p[0][1]) / h, 4)] for p in approx]})
    return polygons


def _melanin_index(image: np.ndarray) -> float:
    """Approximation: MI = 100 * log10(1 / reflectance_red)."""
    r = image[:, :, 2].astype(float)
    r[r == 0] = 1
    mi = 100 * np.log10(255 / r)
    return float(np.mean(mi))
