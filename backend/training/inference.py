"""
Unified inference module — used by FastAPI services after models are trained.

Replaces the classical CV analyzers in:
  backend/app/services/acne_analyzer.py
  backend/app/services/pigmentation_analyzer.py
  backend/app/services/wrinkle_analyzer.py

Usage (standalone test):
    python training/inference.py --image path/to/skin.jpg
"""

import argparse
import cv2
import numpy as np
import torch
import torch.nn.functional as F
from pathlib import Path
from ultralytics import YOLO
import timm
import torch.nn as nn
from torchvision import transforms
from PIL import Image
from dataclasses import dataclass

# Model paths
MODEL_DIR         = Path(__file__).parent.parent / "models"
ACNE_DET_WEIGHTS  = MODEL_DIR / "acne_detection"  / "weights" / "weights" / "best.pt"
SKIN_PROB_WEIGHTS = MODEL_DIR / "skin_problems"    / "weights" / "weights" / "best.pt"
SEVERITY_WEIGHTS  = MODEL_DIR / "acne_severity"    / "best.pth"
PIGMENTATION_SEV_WEIGHTS = MODEL_DIR / "pigmentation_severity" / "best.pth"
WRINKLE_SEV_WEIGHTS      = MODEL_DIR / "wrinkle_severity"      / "best.pth"

SEVERITY_LABELS = ["clear", "mild", "moderate", "severe"]
# Bootstrap-trained on the classical formula's own verdict (see
# train_pigmentation_wrinkle_severity.py) from a dataset with zero "severe"
# examples of either condition -- 3 classes, not 4, and callers must not
# trust a "severe" prediction from these two the way they can for acne
# (they can never actually produce one; see the override in analysis.py).
CONDITION_SEVERITY_LABELS = ["mild", "moderate", "severe"]

SKIN_CLASS_IDX = {
    "Acne": 0, "Blackheads": 1, "Dark-Spots": 2, "Dry-Skin": 3,
    "Enlarged-Pores": 4, "Eyebags": 5, "Oily-Skin": 6,
    "Skin-Redness": 7, "Whiteheads": 8, "Wrinkles": 9,
}

_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


@dataclass
class AcneResult:
    lesion_count: int
    lesion_types: dict        # {class_name: count}
    redness_index: float
    severity: str             # from EfficientNet classifier
    detections: list          # [{label, confidence, box: [x1,y1,x2,y2] normalized 0-1}]


@dataclass
class PigmentationResult:
    dark_spot_count: int
    pigmented_area_pct: float
    severity: str


@dataclass
class WrinkleResult:
    wrinkle_count: int
    skin_redness_count: int
    pore_count: int
    severity: str


class DermatoInference:
    def __init__(self):
        self._acne_det    = None
        self._skin_prob   = None
        self._severity_clf = None
        self._pigmentation_clf = None
        self._wrinkle_clf = None

    def _load_models(self):
        if self._acne_det is None and ACNE_DET_WEIGHTS.exists():
            self._acne_det = YOLO(str(ACNE_DET_WEIGHTS))
            print("Loaded acne detection model")

        if self._skin_prob is None and SKIN_PROB_WEIGHTS.exists():
            self._skin_prob = YOLO(str(SKIN_PROB_WEIGHTS))
            print("Loaded skin problems model")

        if self._severity_clf is None and SEVERITY_WEIGHTS.exists():
            model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=4)
            model.load_state_dict(torch.load(str(SEVERITY_WEIGHTS), map_location="cpu"))
            model.eval()
            self._severity_clf = model
            print("Loaded severity classifier model")

        if self._pigmentation_clf is None and PIGMENTATION_SEV_WEIGHTS.exists():
            model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=3)
            model.load_state_dict(torch.load(str(PIGMENTATION_SEV_WEIGHTS), map_location="cpu"))
            model.eval()
            self._pigmentation_clf = model
            print("Loaded pigmentation severity classifier model")

        if self._wrinkle_clf is None and WRINKLE_SEV_WEIGHTS.exists():
            model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=3)
            model.load_state_dict(torch.load(str(WRINKLE_SEV_WEIGHTS), map_location="cpu"))
            model.eval()
            self._wrinkle_clf = model
            print("Loaded wrinkle severity classifier model")

    def analyze(self, image_bgr: np.ndarray) -> dict:
        self._load_models()
        results = {}

        if self._acne_det:
            results["acne"] = self._analyze_acne(image_bgr)

        if self._skin_prob:
            results["skin_problems"] = self._analyze_skin_problems(image_bgr)

        return results

    def _analyze_acne(self, image_bgr: np.ndarray) -> AcneResult:
        det_results = self._acne_det(image_bgr, verbose=False)[0]
        boxes = det_results.boxes
        h, w = image_bgr.shape[:2]

        lesion_types = {}
        detections = []
        acne_classes = ["blackheads", "dark spot", "nodules", "papules", "pustules", "whiteheads"]
        cls_ids = boxes.cls.int().tolist() if boxes else []
        for i, cls_id in enumerate(cls_ids):
            name = acne_classes[cls_id]
            lesion_types[name] = lesion_types.get(name, 0) + 1
            detections.append(_normalized_box(name, boxes, i, w, h))

        redness = self._compute_redness(image_bgr)

        severity = "mild"
        if self._severity_clf:
            severity = self._classify_severity(image_bgr)

        return AcneResult(
            lesion_count=len(boxes) if boxes else 0,
            lesion_types=lesion_types,
            redness_index=redness,
            severity=severity,
            detections=detections,
        )

    def _analyze_skin_problems(self, image_bgr: np.ndarray) -> dict:
        det_results = self._skin_prob(image_bgr, verbose=False)[0]
        boxes = det_results.boxes
        h, w = image_bgr.shape[:2]

        skin_classes = list(SKIN_CLASS_IDX.keys())
        counts = {cls: 0 for cls in skin_classes}
        detections = []
        cls_ids = boxes.cls.int().tolist() if boxes else []
        for i, cls_id in enumerate(cls_ids):
            name = skin_classes[cls_id]
            counts[name] += 1
            detections.append(_normalized_box(name, boxes, i, w, h))

        img_area = image_bgr.shape[0] * image_bgr.shape[1]

        # Pigmentation — Dark-Spots box area %
        pig_area = 0
        for i, cls_id in enumerate(cls_ids):
            if skin_classes[cls_id] == "Dark-Spots":
                b = boxes.xyxy[i]
                box_area = (b[2] - b[0]) * (b[3] - b[1])
                pig_area += float(box_area)
        pig_pct = min((pig_area / img_area) * 100, 100.0) if img_area > 0 else 0

        if self._pigmentation_clf:
            pig_severity = self._classify_condition_severity(image_bgr, self._pigmentation_clf)
        else:
            pig_severity = _pigmentation_severity_from_area_pct(pig_pct)

        if self._wrinkle_clf:
            wrinkle_severity = self._classify_condition_severity(image_bgr, self._wrinkle_clf)
        else:
            wrinkle_severity = _severity_from_count(counts["Wrinkles"], thresholds=(2, 6))

        return {
            "detection_counts": counts,
            "detections": detections,
            "pigmentation": PigmentationResult(
                dark_spot_count=counts["Dark-Spots"],
                pigmented_area_pct=round(pig_pct, 2),
                severity=pig_severity,
            ),
            "wrinkle": WrinkleResult(
                wrinkle_count=counts["Wrinkles"],
                skin_redness_count=counts["Skin-Redness"],
                pore_count=counts["Enlarged-Pores"],
                severity=wrinkle_severity,
            ),
        }

    def _compute_redness(self, image_bgr: np.ndarray) -> float:
        r = image_bgr[:, :, 2].astype(float)
        g = image_bgr[:, :, 1].astype(float)
        b = image_bgr[:, :, 0].astype(float)
        denom = r + g + b
        denom[denom == 0] = 1
        ei = (r - g) / denom
        return round(float(np.mean(ei) * 100), 2)

    def _classify_severity(self, image_bgr: np.ndarray) -> str:
        pil = Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))
        tensor = _transform(pil).unsqueeze(0)
        with torch.no_grad():
            logits = self._severity_clf(tensor)
            probs  = F.softmax(logits, dim=1)
            pred   = probs.argmax(1).item()
        return SEVERITY_LABELS[pred]

    def _classify_condition_severity(self, image_bgr: np.ndarray, model) -> str:
        pil = Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))
        tensor = _transform(pil).unsqueeze(0)
        with torch.no_grad():
            logits = model(tensor)
            probs  = F.softmax(logits, dim=1)
            pred   = probs.argmax(1).item()
        return CONDITION_SEVERITY_LABELS[pred]


def _normalized_box(label: str, boxes, index: int, img_w: int, img_h: int) -> dict:
    x1, y1, x2, y2 = boxes.xyxy[index].tolist()
    conf = float(boxes.conf[index]) if boxes.conf is not None else None
    return {
        "label": label,
        "confidence": round(conf, 3) if conf is not None else None,
        "box": [round(x1 / img_w, 4), round(y1 / img_h, 4), round(x2 / img_w, 4), round(y2 / img_h, 4)],
    }


def _severity_from_count(count: int, thresholds: tuple) -> str:
    low, high = thresholds
    if count == 0 or count < low:
        return "mild"
    if count < high:
        return "moderate"
    return "severe"


def _pigmentation_severity_from_area_pct(pct: float) -> str:
    """Same pigmented-area-% bands as the classical CV path's
    classify_pigmentation()/_pig_area_band (backend/app/services/severity_classifier.py),
    which are calibrated against experimental_matrix.xlsx. Using a box-count
    threshold here instead would grade the same underlying quantity
    (pigmented_area_pct, already computed above) against an uncalibrated cutoff."""
    if pct > 30:
        return "severe"
    if pct >= 10:
        return "moderate"
    return "mild"


# Singleton used by FastAPI services
_inference = DermatoInference()


def run(image_bgr: np.ndarray) -> dict:
    return _inference.analyze(image_bgr)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to skin image")
    args = parser.parse_args()

    img = cv2.imread(args.image)
    if img is None:
        print(f"Cannot read image: {args.image}")
        exit(1)

    result = run(img)
    import json
    print(json.dumps(
        {k: v.__dict__ if hasattr(v, '__dict__') else
         {kk: (vv.__dict__ if hasattr(vv, '__dict__') else vv) for kk, vv in v.items()}
         for k, v in result.items()},
        indent=2
    ))
