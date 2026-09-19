import cv2
import numpy as np
from dataclasses import dataclass


@dataclass
class AcneParams:
    lesion_count_per_cm2: float
    redness_index: float
    lesion_type: str       # comedones / papules_pustules / nodules_cysts
    inflammatory_pct: float


def _lesion_contours(image: np.ndarray):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Watershed segmentation for lesion detection
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return contours


def analyze(image: np.ndarray, scale_cm_per_px: float = 0.026) -> AcneParams:
    contours = _lesion_contours(image)

    lesion_count = len(contours)
    roi_area_cm2 = (image.shape[0] * image.shape[1]) * (scale_cm_per_px ** 2)
    lesion_count_per_cm2 = lesion_count / roi_area_cm2 if roi_area_cm2 > 0 else 0

    redness_index = _compute_redness_index(image)
    lesion_type, inflammatory_pct = _classify_lesions(contours, image)

    return AcneParams(
        lesion_count_per_cm2=round(lesion_count_per_cm2, 2),
        redness_index=round(redness_index, 2),
        lesion_type=lesion_type,
        inflammatory_pct=round(inflammatory_pct, 2),
    )


def overlay_regions(image: np.ndarray, max_regions: int = 60) -> list:
    """Normalized (0-1) bounding boxes of the detected lesions, largest first,
    for drawing on the uploaded photo. Uses the same segmentation as analyze()
    and the same minimum-area cutoff as the lesion classifier."""
    h, w = image.shape[:2]
    # Contours covering a large fraction of the frame are segmentation artifacts
    # (hair, shadows, background), not lesions — skip them for display.
    max_area = 0.05 * h * w
    boxes = []
    for c in _lesion_contours(image):
        if cv2.contourArea(c) < 0.1:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        if bw * bh > max_area:
            continue
        boxes.append((bw * bh, [round(x / w, 4), round(y / h, 4), round((x + bw) / w, 4), round((y + bh) / h, 4)]))
    boxes.sort(key=lambda b: b[0], reverse=True)
    return [{"box": b} for _, b in boxes[:max_regions]]


def _compute_redness_index(image: np.ndarray) -> float:
    """Standard Erythema Index EI = (R-G)/(R+G+B)."""
    r = image[:, :, 2].astype(float)
    g = image[:, :, 1].astype(float)
    b = image[:, :, 0].astype(float)
    denom = r + g + b
    denom[denom == 0] = 1
    ei = (r - g) / denom
    return float(np.mean(ei) * 100)


def _classify_lesions(contours, image):
    pustule_count = papule_count = nodule_count = 0
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.1:
            continue
        perimeter = cv2.arcLength(c, True)
        circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0
        mask = np.zeros(gray.shape, np.uint8)
        cv2.drawContours(mask, [c], -1, 255, -1)
        mean_intensity = cv2.mean(gray, mask=mask)[0]

        if area >= 5 or circularity < 0.4:
            nodule_count += 1
        elif 0.3 <= area < 5 and circularity > 0.6 and mean_intensity > 180:
            pustule_count += 1
        else:
            papule_count += 1

    total = pustule_count + papule_count + nodule_count or 1
    inflammatory_pct = (pustule_count + nodule_count) / total * 100

    if nodule_count > papule_count:
        lesion_type = "nodules_cysts"
    elif pustule_count > papule_count:
        lesion_type = "papules_pustules"
    else:
        lesion_type = "comedones"

    return lesion_type, inflammatory_pct
