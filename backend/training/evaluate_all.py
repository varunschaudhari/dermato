"""
Evaluate all three trained models and print a consolidated report.

Run:
    python training/evaluate_all.py
"""

from pathlib import Path
from ultralytics import YOLO

MODEL_DIR         = Path(__file__).parent.parent / "models"
ACNE_DET_WEIGHTS  = MODEL_DIR / "acne_detection"  / "weights" / "weights" / "best.pt"
SKIN_PROB_WEIGHTS = MODEL_DIR / "skin_problems"    / "weights" / "weights" / "best.pt"
SEVERITY_WEIGHTS  = MODEL_DIR / "acne_severity"    / "best.pth"

ACNE_YAML    = Path(__file__).parent / "configs" / "acne_detection.yaml"
SKIN_YAML    = Path(__file__).parent / "configs" / "skin_problems.yaml"
DATASET_ROOT = Path("C:/Users/VarunChaudhari/my-projects/dermato/dataset/Classification/Classification")
IMAGE_DIR    = DATASET_ROOT / "JPEGImages"


def evaluate_yolo(name: str, weights: Path, yaml: Path):
    if not weights.exists():
        print(f"[{name}] Model not found: {weights}")
        return

    print(f"\n{'='*50}")
    print(f"  {name}")
    print(f"{'='*50}")

    model   = YOLO(str(weights))
    metrics = model.val(data=str(yaml), split="test", verbose=False)

    print(f"  mAP50      : {metrics.box.map50:.4f}")
    print(f"  mAP50-95   : {metrics.box.map:.4f}")
    print(f"  Precision  : {metrics.box.mp:.4f}")
    print(f"  Recall     : {metrics.box.mr:.4f}")
    print(f"\n  Per-class AP50:")
    for i, cls in enumerate(metrics.names.values()):
        if i < len(metrics.box.ap50):
            print(f"    {cls:20s}: {metrics.box.ap50[i]:.4f}")


def evaluate_severity():
    import torch
    import timm
    import numpy as np
    from sklearn.metrics import classification_report, confusion_matrix
    from torch.utils.data import DataLoader
    from torchvision import transforms
    from PIL import Image
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from train_acne_severity import AcneSeverityDataset

    if not SEVERITY_WEIGHTS.exists():
        print(f"\n[Acne Severity Classifier] Model not found: {SEVERITY_WEIGHTS}")
        return

    print(f"\n{'='*50}")
    print(f"  Acne Severity Classifier (EfficientNet-B0)")
    print(f"{'='*50}")

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    val_ds = AcneSeverityDataset(IMAGE_DIR, DATASET_ROOT, transform, split="val")
    loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=2)

    model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=4)
    model.load_state_dict(torch.load(str(SEVERITY_WEIGHTS), map_location="cpu"))
    model.eval()

    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, labels in loader:
            preds = model(images).argmax(1)
            all_preds.extend(preds.numpy())
            all_labels.extend(labels.numpy())

    print(classification_report(all_labels, all_preds,
                                target_names=["clear", "mild", "moderate", "severe"]))
    print("Confusion Matrix:")
    print(confusion_matrix(all_labels, all_preds))


if __name__ == "__main__":
    evaluate_yolo("Acne Detection (YOLOv8)",         ACNE_DET_WEIGHTS,  ACNE_YAML)
    evaluate_yolo("Face Skin Problems (YOLOv8)",     SKIN_PROB_WEIGHTS, SKIN_YAML)
    evaluate_severity()
    print("\nDone.")
