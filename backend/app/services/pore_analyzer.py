import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class PoreParams:
    pore_density_per_cm2: float
    avg_pore_diameter_um: float


def analyze(image: np.ndarray, scale_cm_per_px: float = 0.026, skin_mask: Optional[np.ndarray] = None) -> PoreParams:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 3
    )
    if skin_mask is not None:
        # Adaptive thresholding fires heavily on hair, fabric weave, and
        # jewelry — none of that is a pore. Restrict to the detected skin
        # region (when a face was found) before even looking for contours.
        thresh = cv2.bitwise_and(thresh, skin_mask)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    um_per_px = scale_cm_per_px * 10_000
    diameters_um = []
    for c in contours:
        area = cv2.contourArea(c)
        if area <= 0:
            continue
        perimeter = cv2.arcLength(c, True)
        circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0
        if circularity < 0.5:
            continue
        diameter_px = 2 * np.sqrt(area / np.pi)
        diameters_um.append(diameter_px * um_per_px)

    region_pixels = int(np.count_nonzero(skin_mask)) if skin_mask is not None else image.shape[0] * image.shape[1]
    roi_area_cm2 = region_pixels * (scale_cm_per_px ** 2)
    pore_density_per_cm2 = len(diameters_um) / roi_area_cm2 if roi_area_cm2 > 0 else 0
    avg_pore_diameter_um = float(np.mean(diameters_um)) if diameters_um else 0.0

    return PoreParams(
        pore_density_per_cm2=round(pore_density_per_cm2, 2),
        avg_pore_diameter_um=round(avg_pore_diameter_um, 2),
    )
