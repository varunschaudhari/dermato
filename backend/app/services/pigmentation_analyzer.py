import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class PigmentationParams:
    pigmented_area_pct: float
    delta_gray: float
    melanin_index: float


def _pigment_mask(image: np.ndarray, skin_mask: Optional[np.ndarray] = None) -> np.ndarray:
    """Flags pixels that are notably darker than their LOCAL surroundings,
    rather than pixels that fall in a fixed absolute color range.

    The old approach (a fixed HSV brown/dark band) reads differently on
    different skin tones by construction — a tan/brown complexion has more
    pixels inside "brown/dark" than a fair one even with zero real
    hyperpigmentation, which is exactly the bias a real accuracy check turned
    up. Black-hat morphology fixes this by comparing each pixel to a local
    baseline (its own neighborhood) instead of a global constant: the kernel
    is much larger than a real dark spot but much smaller than the whole
    face, so a genuine patch that's darker than its immediate surroundings
    pops out, while smooth lighting/shading gradients — which vary slowly
    over a large area — get subtracted away entirely.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    dim = min(image.shape[0], image.shape[1])
    k = max(15, (dim // 20) | 1)  # odd kernel, ~5% of the shorter side
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
    _, mask = cv2.threshold(blackhat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Otsu always finds *a* split, even across pure sensor noise on genuinely
    # clear skin — an absolute floor keeps that from being read as "spots".
    _, noise_floor = cv2.threshold(blackhat, 8, 255, cv2.THRESH_BINARY)
    mask = cv2.bitwise_and(mask, noise_floor)
    # Without this, dark hair falling across the frame reads as one giant
    # "pigmented patch" — restricting to the detected skin region (when a face
    # was found) is what actually fixes that, not the contrast method itself.
    # Inset by roughly half the kernel radius first: any pixel closer than
    # that to the mask boundary has hair/background inside its own
    # neighborhood, so the local-contrast value there reflects the boundary,
    # not real skin content, and isn't trustworthy.
    if skin_mask is not None:
        erode_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k // 2, k // 2))
        safe_region = cv2.erode(skin_mask, erode_kernel)
        mask = cv2.bitwise_and(mask, safe_region)
    return mask


def analyze(image: np.ndarray, skin_mask: Optional[np.ndarray] = None) -> PigmentationParams:
    mask = _pigment_mask(image, skin_mask)

    # % of pigmented area is relative to the analyzed region (the detected
    # skin area, if we have one) — not the whole frame, which would otherwise
    # include hair/background/clothing as part of the denominator.
    region_pixels = int(np.count_nonzero(skin_mask)) if skin_mask is not None else image.shape[0] * image.shape[1]
    pigmented_pixels = np.count_nonzero(mask)
    pigmented_area_pct = (pigmented_pixels / region_pixels) * 100 if region_pixels > 0 else 0

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    pigmented_mean = cv2.mean(gray, mask=mask)[0] if pigmented_pixels > 0 else 0
    normal_mask = cv2.bitwise_not(mask)
    if skin_mask is not None:
        normal_mask = cv2.bitwise_and(normal_mask, skin_mask)
    normal_mean = cv2.mean(gray, mask=normal_mask)[0]
    delta_gray = abs(normal_mean - pigmented_mean)

    melanin_index = _melanin_index(image, skin_mask)

    return PigmentationParams(
        pigmented_area_pct=round(pigmented_area_pct, 2),
        delta_gray=round(delta_gray, 2),
        melanin_index=round(melanin_index, 2),
    )


def overlay_regions(image: np.ndarray, max_regions: int = 25, skin_mask: Optional[np.ndarray] = None) -> list:
    """Normalized (0-1) polygon outlines of the pigmented patches, largest first,
    for drawing on the uploaded photo. Uses the same HSV mask as analyze(); a
    light open/close pass merges pixel noise into coherent patches — this is
    visualization-only and does not affect the measured pigmented_area_pct."""
    mask = _pigment_mask(image, skin_mask)
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


def _melanin_index(image: np.ndarray, skin_mask: Optional[np.ndarray] = None) -> float:
    """Approximation: MI = 100 * log10(1 / reflectance_red). Hair is dark (low
    red reflectance) and would inflate this if it dominates the frame, so this
    averages over skin pixels only where a mask is available."""
    r = image[:, :, 2].astype(float)
    r[r == 0] = 1
    mi = 100 * np.log10(255 / r)
    if skin_mask is not None and skin_mask.any():
        return float(mi[skin_mask > 0].mean())
    return float(np.mean(mi))
