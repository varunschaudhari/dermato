import cv2
import numpy as np
from skimage.morphology import skeletonize
from dataclasses import dataclass
from typing import Optional


@dataclass
class WrinkleParams:
    wrinkle_count_per_cm2: float
    avg_length_mm: float
    depth_delta_gray: float
    density_pct: float


def _skeleton_image(gray: np.ndarray, skin_mask: Optional[np.ndarray] = None) -> np.ndarray:
    edges = cv2.Canny(gray, 50, 150)
    # Skeletonize to get wrinkle lines
    skeleton = skeletonize(edges > 0)
    skeleton_img = (skeleton * 255).astype(np.uint8)
    # Canny finds edges everywhere — hair strands and fabric patterns produce
    # very strong ones. Restricting to the detected skin region (when a face
    # was found) is what actually separates real wrinkle candidates from those.
    if skin_mask is not None:
        skeleton_img = cv2.bitwise_and(skeleton_img, skin_mask)
    return skeleton_img


def analyze(image: np.ndarray, scale_cm_per_px: float = 0.026, skin_mask: Optional[np.ndarray] = None) -> WrinkleParams:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    skeleton_img = _skeleton_image(gray, skin_mask)

    contours, _ = cv2.findContours(skeleton_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    roi_area_cm2 = (image.shape[0] * image.shape[1]) * (scale_cm_per_px ** 2)
    wrinkle_count_per_cm2 = len(contours) / roi_area_cm2 if roi_area_cm2 > 0 else 0

    px_per_mm = (1 / scale_cm_per_px) / 10
    lengths = [cv2.arcLength(c, False) / px_per_mm for c in contours if len(c) > 1]
    avg_length_mm = float(np.mean(lengths)) if lengths else 0.0

    depth_delta_gray = _wrinkle_depth(gray, skeleton_img, skin_mask)

    region_pixels = int(np.count_nonzero(skin_mask)) if skin_mask is not None else image.shape[0] * image.shape[1]
    wrinkle_pixels = np.count_nonzero(skeleton_img)
    density_pct = (wrinkle_pixels / region_pixels) * 100 if region_pixels > 0 else 0

    return WrinkleParams(
        wrinkle_count_per_cm2=round(wrinkle_count_per_cm2, 2),
        avg_length_mm=round(avg_length_mm, 2),
        depth_delta_gray=round(depth_delta_gray, 2),
        density_pct=round(density_pct, 2),
    )


def overlay_regions(image: np.ndarray, max_regions: int = 50, skin_mask: Optional[np.ndarray] = None) -> list:
    """Normalized (0-1) polylines tracing the detected wrinkle lines, longest
    first, for drawing on the uploaded photo. Uses the same Canny+skeleton
    pipeline as analyze(); very short fragments are skipped as visual noise."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    skeleton_img = _skeleton_image(gray, skin_mask)
    contours, _ = cv2.findContours(skeleton_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = image.shape[:2]
    min_length_px = 0.03 * max(h, w)
    lines = []
    for c in sorted(contours, key=lambda c: cv2.arcLength(c, False), reverse=True)[:max_regions]:
        if cv2.arcLength(c, False) < min_length_px:
            break
        approx = cv2.approxPolyDP(c, 2.0, False)
        if len(approx) < 2:
            continue
        lines.append({"line": [[round(float(p[0][0]) / w, 4), round(float(p[0][1]) / h, 4)] for p in approx]})
    return lines


def _wrinkle_depth(gray: np.ndarray, skeleton: np.ndarray, skin_mask: Optional[np.ndarray] = None) -> float:
    wrinkle_mask = skeleton > 0
    normal_mask = ~wrinkle_mask
    if skin_mask is not None:
        # Compare wrinkle-line pixels against other SKIN pixels, not against
        # hair/background — otherwise this measures skin-vs-hair contrast,
        # which is large and meaningless as a "wrinkle depth" signal.
        normal_mask = normal_mask & (skin_mask > 0)
    wrinkle_mean = gray[wrinkle_mask].mean() if wrinkle_mask.any() else 0
    normal_mean = gray[normal_mask].mean() if normal_mask.any() else 0
    return abs(normal_mean - wrinkle_mean)
