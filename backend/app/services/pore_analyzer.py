import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class PoreParams:
    # Both metrics are relative to the analyzed region (pixels-in, pixels-out)
    # rather than claiming an absolute physical size. A real pore is ~20-50
    # microns — even under the most generous per-photo face-width calibration
    # this app can do, that's a fraction of a single pixel, so any "average
    # pore diameter in microns" claim was measuring segmentation noise, not
    # pores. These two numbers answer the question the severity call actually
    # needs ("are pores visually prominent here") without pretending to a
    # precision no consumer photo can deliver.
    pore_density_pct: float    # % of the analyzed skin area covered by pore-like contours
    avg_pore_size_pct: float   # average pore contour's diameter, as % of the region's characteristic dimension


def analyze(image: np.ndarray, skin_mask: Optional[np.ndarray] = None) -> PoreParams:
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

    pore_pixel_area = 0.0
    diameters_px = []
    for c in contours:
        area = cv2.contourArea(c)
        if area <= 0:
            continue
        perimeter = cv2.arcLength(c, True)
        circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0
        if circularity < 0.5:
            continue
        diameters_px.append(2 * np.sqrt(area / np.pi))
        pore_pixel_area += area

    region_pixels = int(np.count_nonzero(skin_mask)) if skin_mask is not None else image.shape[0] * image.shape[1]
    pore_density_pct = (pore_pixel_area / region_pixels * 100) if region_pixels > 0 else 0.0

    # sqrt(region_pixels) as a "characteristic dimension" keeps this
    # comparable whether the analyzed region is the whole frame or a masked
    # face crop, without needing to track width/height separately.
    region_dim_px = np.sqrt(region_pixels) if region_pixels > 0 else 1.0
    avg_pore_size_pct = (float(np.mean(diameters_px)) / region_dim_px * 100) if diameters_px else 0.0

    return PoreParams(
        pore_density_pct=round(pore_density_pct, 3),
        avg_pore_size_pct=round(avg_pore_size_pct, 3),
    )
