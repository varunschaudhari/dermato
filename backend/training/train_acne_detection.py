"""
Train YOLOv8 for acne lesion detection + type classification.

Dataset : Acne.v21i.yolo26
Classes  : blackheads, dark spot, nodules, papules, pustules, whiteheads
Output   : backend/models/acne_detection/weights/best.pt

Run:
    python training/train_acne_detection.py
    python training/train_acne_detection.py --epochs 100 --batch 32 --model yolov8m.pt
"""

import argparse
from pathlib import Path
import torch
from ultralytics import YOLO

DATASET_YAML = Path(__file__).parent / "configs" / "acne_detection.yaml"
OUTPUT_DIR   = Path(__file__).parent.parent / "models" / "acne_detection"


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

        # Augmentation — important for skin images
        hsv_h=0.015,     # hue shift (slight color variation)
        hsv_s=0.5,       # saturation
        hsv_v=0.3,       # brightness
        fliplr=0.5,      # horizontal flip
        flipud=0.1,      # vertical flip
        degrees=10.0,    # rotation
        translate=0.1,
        scale=0.3,
        mosaic=1.0,

        # Training settings
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        weight_decay=0.0005,
        patience=20,     # early stopping
        save_period=10,

        # Logging
        plots=True,
        verbose=True,
    )

    print(f"\nBest model saved at: {OUTPUT_DIR}/weights/weights/best.pt")
    print(f"mAP50: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")
    print(f"mAP50-95: {results.results_dict.get('metrics/mAP50-95(B)', 'N/A')}")


def validate(weights: str):
    model = YOLO(weights)
    metrics = model.val(data=str(DATASET_YAML), split="test")
    print(f"\nTest mAP50     : {metrics.box.map50:.4f}")
    print(f"Test mAP50-95  : {metrics.box.map:.4f}")
    print(f"Precision      : {metrics.box.mp:.4f}")
    print(f"Recall         : {metrics.box.mr:.4f}")
    for i, cls in enumerate(['blackheads', 'dark spot', 'nodules', 'papules', 'pustules', 'whiteheads']):
        print(f"  {cls:12s} AP50: {metrics.box.ap50[i]:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",   default="yolov8n.pt",   help="Base YOLO model (n/s/m/l/x)")
    parser.add_argument("--epochs",  type=int, default=50)
    parser.add_argument("--batch",   type=int, default=16)
    parser.add_argument("--imgsz",   type=int, default=640)
    parser.add_argument("--device",  default="0" if torch.cuda.is_available() else "cpu",
                        help="cuda device (e.g. '0') or 'cpu'; auto-detects by default")
    parser.add_argument("--validate", action="store_true",    help="Run test evaluation only")
    parser.add_argument("--weights",  default=str(OUTPUT_DIR / "weights" / "weights" / "best.pt"))
    args = parser.parse_args()

    if args.validate:
        validate(args.weights)
    else:
        train(args.model, args.epochs, args.batch, args.imgsz, args.device)
