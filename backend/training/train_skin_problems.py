"""
Train YOLOv8 for multi-condition face skin problem detection.

Dataset : Face Skin Problems.v1i.yolo26
Classes  : Acne, Blackheads, Dark-Spots, Dry-Skin, Enlarged-Pores,
           Eyebags, Oily-Skin, Skin-Redness, Whiteheads, Wrinkles
Output   : backend/models/skin_problems/weights/best.pt

Maps to project parameters:
  Dark-Spots    → Pigmentation analysis
  Skin-Redness  → Erythema / redness index
  Wrinkles      → Wrinkle detection
  Enlarged-Pores → Pore size & density

Run:
    python training/train_skin_problems.py
    python training/train_skin_problems.py --epochs 100 --model yolov8s.pt
"""

import argparse
from pathlib import Path
import torch
from ultralytics import YOLO

DATASET_YAML = Path(__file__).parent / "configs" / "skin_problems.yaml"
OUTPUT_DIR   = Path(__file__).parent.parent / "models" / "skin_problems"

CLASS_NAMES = [
    "Acne", "Blackheads", "Dark-Spots", "Dry-Skin", "Enlarged-Pores",
    "Eyebags", "Oily-Skin", "Skin-Redness", "Whiteheads", "Wrinkles"
]


def train(model_name: str, epochs: int, batch: int, imgsz: int, device: str):
    model = YOLO(model_name)

    results = model.train(
        data=str(DATASET_YAML),
        epochs=epochs,
        batch=batch,
        imgsz=imgsz,
        device=device,
        project=str(OUTPUT_DIR),
        name="weights",
        exist_ok=True,

        # Augmentation
        hsv_h=0.02,
        hsv_s=0.6,
        hsv_v=0.4,
        fliplr=0.5,
        degrees=15.0,
        translate=0.1,
        scale=0.4,
        mosaic=1.0,
        mixup=0.1,       # blend images — helps generalise across skin tones

        # Training
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        warmup_epochs=3,
        patience=20,
        save_period=10,
        plots=True,
        verbose=True,
    )

    print(f"\nBest model saved at: {OUTPUT_DIR}/weights/weights/best.pt")
    print(f"mAP50: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")


def validate(weights: str):
    model = YOLO(weights)
    metrics = model.val(data=str(DATASET_YAML), split="test")
    print(f"\nTest Results:")
    print(f"  mAP50     : {metrics.box.map50:.4f}")
    print(f"  mAP50-95  : {metrics.box.map:.4f}")
    print(f"  Precision : {metrics.box.mp:.4f}")
    print(f"  Recall    : {metrics.box.mr:.4f}")
    print(f"\nPer-class AP50:")
    for i, cls in enumerate(CLASS_NAMES):
        print(f"  {cls:18s}: {metrics.box.ap50[i]:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",    default="yolov8n.pt")
    parser.add_argument("--epochs",   type=int, default=60)
    parser.add_argument("--batch",    type=int, default=16)
    parser.add_argument("--imgsz",    type=int, default=640)
    parser.add_argument("--device",   default="0" if torch.cuda.is_available() else "cpu",
                        help="cuda device (e.g. '0') or 'cpu'; auto-detects by default")
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--weights",  default=str(OUTPUT_DIR / "weights" / "weights" / "best.pt"))
    args = parser.parse_args()

    if args.validate:
        validate(args.weights)
    else:
        train(args.model, args.epochs, args.batch, args.imgsz, args.device)
