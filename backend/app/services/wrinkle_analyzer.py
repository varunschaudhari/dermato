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


def _orientation(contour: np.ndarray) -> float:
    """Dominant angle of a contour's line, from its two endpoints. Mod pi
    since a line's direction (not which end is which) is what matters for
    "roughly parallel"."""
    pts = contour.reshape(-1, 2)
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    return float(np.arctan2(y1 - y0, x1 - x0) % np.pi)


def _centroid(contour: np.ndarray) -> np.ndarray:
    m = cv2.moments(contour)
    if m["m00"] == 0:
        return contour.reshape(-1, 2).mean(axis=0)
    return np.array([m["m10"] / m["m00"], m["m01"] / m["m00"]])


def _filter_clustered(contours: list, region_dim_px: float) -> list:
    """Keeps only contours with at least one nearby, roughly-parallel
    neighbor — the defining visual trait of a real wrinkle. Wrinkles form in
    clusters (forehead lines, crow's feet, nasolabial folds are never just
    one line), whereas a single isolated edge — an eyebrow arc, an eyelid
    crease, a jaw silhouette — has no such companion. This is what actually
    separates "a real wrinkle" from "any edge Canny happened to find", which
    skin-region masking alone can't do (a real facial edge is still inside
    the masked skin area).
    """
    if len(contours) < 2:
        return []
    info = [(_centroid(c), _orientation(c)) for c in contours]
    neighbor_radius = region_dim_px * 0.06  # ~6% of the region's characteristic size
    angle_tol = np.deg2rad(25)

    kept = []
    for i, c in enumerate(contours):
        ci, ai = info[i]
        for j in range(len(contours)):
            if i == j:
                continue
            cj, aj = info[j]
            if np.linalg.norm(ci - cj) > neighbor_radius:
                continue
            angle_diff = min(abs(ai - aj), np.pi - abs(ai - aj))
            if angle_diff <= angle_tol:
                kept.append(c)
                break
    return kept


def _wrinkle_contours(image: np.ndarray, skin_mask: Optional[np.ndarray]) -> list:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    skeleton_img = _skeleton_image(gray, skin_mask)
    contours, _ = cv2.findContours(skeleton_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = [c for c in contours if len(c) >= 2]

    # The clustering criterion needs a real face's worth of context to make
    # sense (it's checking for OTHER nearby wrinkle-like lines) — on a tight
    # skin-ROI crop with no face detected, skip it and keep the original
    # skin-masked-only behavior rather than risk discarding real wrinkles in
    # a crop that's deliberately zoomed into a single wrinkle-prone area.
    if skin_mask is None:
        return contours

    region_pixels = int(np.count_nonzero(skin_mask))
    region_dim_px = np.sqrt(region_pixels) if region_pixels > 0 else 1.0
    return _filter_clustered(contours, region_dim_px)


def analyze(image: np.ndarray, scale_cm_per_px: float = 0.026, skin_mask: Optional[np.ndarray] = None) -> WrinkleParams:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    contours = _wrinkle_contours(image, skin_mask)

    # Rebuild a skeleton image from just the surviving (clustered) contours,
    # so density/depth reflect the same filtered set as the count/length do.
    skeleton_img = np.zeros(gray.shape, np.uint8)
    cv2.drawContours(skeleton_img, contours, -1, 255, 1)

    roi_area_cm2 = (image.shape[0] * image.shape[1]) * (scale_cm_per_px ** 2)
    wrinkle_count_per_cm2 = len(contours) / roi_area_cm2 if roi_area_cm2 > 0 else 0

    px_per_mm = (1 / scale_cm_per_px) / 10
    lengths = [cv2.arcLength(c, False) / px_per_mm for c in contours]
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
    first, for drawing on the uploaded photo. Uses the same clustered-contour
    selection as analyze(); very short fragments are skipped as visual noise."""
    contours = _wrinkle_contours(image, skin_mask)

    h, w = image.shape[:2]
    min_length_px = 0.03 * max(h, w)
    lines = []
    for c in sorted(contours, key=lambda c: cv2.arcLength(c, False), reverse=True)[:max_regions]:
        if cv2.arcLength(c, False) < min_length_px:
            continue
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
