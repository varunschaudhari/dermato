"""
Bootstrap EfficientNet-B0 severity classifiers for pigmentation and wrinkles
from the existing classical-CV pipeline, since no manually severity-graded
dataset exists for either condition (unlike acne's ACNE04 dataset — see
train_acne_severity.py).

Rather than leaving these two conditions on the classical CV formula forever,
this treats that formula's own output (already calibrated against
experimental_matrix.xlsx — see severity_classifier.py) as a "silver label":
run every image in dataset/archive/dataset/{pigmentation,dark spots,wrinkles}
through the real production pipeline (preprocessor -> face_detector ->
pigmentation_analyzer/wrinkle_analyzer -> severity_classifier) and train a
CNN to predict that same verdict directly from pixels.

This can only ever be as accurate as the classical formula it's imitating —
it is not a source of new ground truth. What it buys is robustness: a CNN
generalizes across lighting/skin-tone/blur better than the hand-tuned CV
steps (contour-finding, skeletonization) it's distilling, which is exactly
where the classical pipeline is fragile. Replacing this with a model trained
on real dermatologist-confirmed labels (once that dataset exists) is the
actual fix — this is a stopgap that's better than the fragile classical path
alone, not a replacement for real ground truth.

Silver labels are computed once and cached to a JSON manifest next to the
source images (labeling requires the full classical CV pipeline per image;
training does not, and re-running this for different --epochs/--batch would
otherwise repeat that work every time).

Run:
    python training/train_pigmentation_wrinkle_severity.py --condition pigmentation
    python training/train_pigmentation_wrinkle_severity.py --condition wrinkle
    python training/train_pigmentation_wrinkle_severity.py --condition pigmentation --evaluate
"""

import argparse
import json
import sys

# Windows consoles default to cp1252, which chokes on the checkmark below.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import timm
from sklearn.metrics import classification_report, confusion_matrix

# app/ is a sibling of training/, not a sub-package of it
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.services import preprocessor, face_detector, pigmentation_analyzer, wrinkle_analyzer
from app.services.severity_classifier import classify_pigmentation, classify_wrinkle

ARCHIVE_ROOT = Path("C:/Users/VarunChaudhari/my-projects/dermato/dataset/archive/dataset")
OUTPUT_ROOT = Path(__file__).parent.parent / "models"

# Same source folders train_condition_severity.py uses for these two
# conditions (see CONDITION_FOLDERS there) — pigmentation draws from both
# "pigmentation" and "dark spots", since both are the same underlying
# condition split across two archive folders.
CONDITION_FOLDERS = {
    "pigmentation": ["pigmentation", "dark spots"],
    "wrinkle": ["wrinkles"],
}
SEVERITY_TO_LABEL = {"mild": 0, "moderate": 1, "severe": 2}
LABEL_TO_SEVERITY = {v: k for k, v in SEVERITY_TO_LABEL.items()}
NUM_CLASSES = 3

IMG_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def _collect_images(condition: str) -> list:
    images = []
    for folder in CONDITION_FOLDERS[condition]:
        folder_path = ARCHIVE_ROOT / folder
        if not folder_path.exists():
            print(f"  (missing folder, skipping: {folder_path})")
            continue
        images.extend(f for f in folder_path.iterdir() if f.suffix.lower() in IMG_EXTENSIONS)
    return images


def _silver_label(condition: str, image_bgr: np.ndarray) -> str:
    """Runs the exact same steps app/api/routes/analysis.py does for the
    classical CV path, and returns the resulting severity band."""
    processed = preprocessor.preprocess(image_bgr)
    calibration = face_detector.detect_and_calibrate(processed)
    scale = calibration.scale_cm_per_px if calibration else 0.026
    skin_mask = calibration.skin_mask if calibration else None

    if condition == "pigmentation":
        params = pigmentation_analyzer.analyze(processed, skin_mask=skin_mask)
        return classify_pigmentation(params).severity
    else:
        params = wrinkle_analyzer.analyze(processed, scale_cm_per_px=scale, skin_mask=skin_mask)
        return classify_wrinkle(params).severity


def _manifest_path(condition: str) -> Path:
    out_dir = OUTPUT_ROOT / f"{condition}_severity"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / "silver_labels.json"


def build_silver_label_manifest(condition: str, relabel: bool = False) -> dict:
    """Returns {filename: severity_label}, computing + caching it if needed."""
    manifest_path = _manifest_path(condition)
    if manifest_path.exists() and not relabel:
        print(f"Using cached silver labels: {manifest_path}")
        return json.loads(manifest_path.read_text())

    print(f"Generating silver labels for '{condition}' via the classical CV pipeline...")
    images = _collect_images(condition)
    print(f"  Found {len(images)} candidate images")

    labels = {}
    failed = 0
    for i, img_path in enumerate(images, 1):
        image = cv2.imread(str(img_path))
        if image is None:
            failed += 1
            continue
        try:
            labels[img_path.name] = _silver_label(condition, image)
        except Exception as exc:
            failed += 1
            print(f"  [{i}/{len(images)}] failed on {img_path.name}: {exc}")
            continue
        if i % 100 == 0:
            print(f"  [{i}/{len(images)}] labeled")

    counts = {sev: sum(1 for v in labels.values() if v == sev) for sev in SEVERITY_TO_LABEL}
    print(f"  Done. {len(labels)} labeled, {failed} failed/skipped. Distribution: {counts}")

    manifest_path.write_text(json.dumps(labels, indent=2))
    print(f"  Cached to {manifest_path}")
    return labels


class SilverLabeledDataset(Dataset):
    def __init__(self, condition: str, labels: dict, transform=None, split="train", val_ratio=0.15, seed=42):
        self.transform = transform

        available = _collect_images(condition)
        by_name = {p.name: p for p in available}
        items = [(by_name[name], SEVERITY_TO_LABEL[sev]) for name, sev in labels.items() if name in by_name]

        rng = np.random.default_rng(seed)
        rng.shuffle(items)

        n_val = int(len(items) * val_ratio)
        self.samples = items[n_val:] if split == "train" else items[:n_val]

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        image = Image.open(img_path).convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, label


def get_transforms(split: str):
    if split == "train":
        return transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.RandomCrop(224),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.05),
            transforms.RandomRotation(15),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


def build_model(pretrained: bool = True) -> nn.Module:
    return timm.create_model("efficientnet_b0", pretrained=pretrained, num_classes=NUM_CLASSES)


def train(condition: str, epochs: int, batch: int, lr: float, device_str: str, relabel: bool):
    device = torch.device(device_str if torch.cuda.is_available() else "cpu")
    print(f"Training '{condition}' severity classifier on: {device}")

    labels = build_silver_label_manifest(condition, relabel=relabel)
    out_dir = OUTPUT_ROOT / f"{condition}_severity"

    train_ds = SilverLabeledDataset(condition, labels, get_transforms("train"), split="train")
    val_ds = SilverLabeledDataset(condition, labels, get_transforms("val"), split="val")
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")
    if len(train_ds) == 0 or len(val_ds) == 0:
        print("Not enough labeled images to train — aborting.")
        return

    # num_workers=0 (main process only) -- 2 deadlocked reliably on Windows
    # when two training runs' worker pools were spawned concurrently.
    train_loader = DataLoader(train_ds, batch_size=batch, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=batch, shuffle=False, num_workers=0, pin_memory=True)

    # Inverse-frequency class weights — the silver-label distribution isn't
    # known ahead of time (unlike acne's fixed, published ACNE04 counts), so
    # this is computed from whatever the classical pipeline actually produced.
    counts = [max(1, sum(1 for _, l in train_ds.samples if l == c)) for c in range(NUM_CLASSES)]
    total = sum(counts)
    weights = torch.tensor([total / c for c in counts], dtype=torch.float).to(device)
    print(f"Train class counts (mild/moderate/severe): {counts}")

    model = build_model().to(device)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_acc = 0.0
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        for images, batch_labels in train_loader:
            images, batch_labels = images.to(device), batch_labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, batch_labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * images.size(0)
            train_correct += (outputs.argmax(1) == batch_labels).sum().item()
            train_total += images.size(0)
        scheduler.step()

        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0
        with torch.no_grad():
            for images, batch_labels in val_loader:
                images, batch_labels = images.to(device), batch_labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, batch_labels)
                val_loss += loss.item() * images.size(0)
                val_correct += (outputs.argmax(1) == batch_labels).sum().item()
                val_total += images.size(0)

        train_acc = train_correct / train_total
        val_acc = val_correct / val_total
        print(f"Epoch {epoch:3d}/{epochs} | "
              f"Train Loss: {train_loss/train_total:.4f} Acc: {train_acc:.4f} | "
              f"Val Loss: {val_loss/val_total:.4f} Acc: {val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), out_dir / "best.pth")
            print(f"  \u2713 Saved best model (val acc: {best_val_acc:.4f})")

    print(f"\nTraining complete. Best val acc: {best_val_acc:.4f}")
    print(f"Model saved: {out_dir / 'best.pth'}")
    print("NOTE: this model reproduces the classical-CV formula's own judgment "
          "(its training signal), not independently-verified ground truth. "
          "Treat val accuracy as 'agreement with the formula', not clinical accuracy.")


def evaluate(condition: str, weights_path: str, device_str: str):
    device = torch.device(device_str if torch.cuda.is_available() else "cpu")

    labels = build_silver_label_manifest(condition)
    val_ds = SilverLabeledDataset(condition, labels, get_transforms("val"), split="val")
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=0)

    model = build_model(pretrained=False)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.to(device).eval()

    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, batch_labels in val_loader:
            outputs = model(images.to(device))
            all_preds.extend(outputs.argmax(1).cpu().numpy())
            all_labels.extend(batch_labels.numpy())

    print("\nClassification Report (agreement with the classical-CV silver label):")
    print(classification_report(all_labels, all_preds, target_names=list(SEVERITY_TO_LABEL.keys())))
    print("Confusion Matrix:")
    print(confusion_matrix(all_labels, all_preds))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--condition", required=True, choices=list(CONDITION_FOLDERS.keys()))
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--relabel", action="store_true", help="Recompute silver labels instead of using the cached manifest")
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--weights", default=None)
    args = parser.parse_args()

    if args.evaluate:
        weights = args.weights or str(OUTPUT_ROOT / f"{args.condition}_severity" / "best.pth")
        evaluate(args.condition, weights, args.device)
    else:
        train(args.condition, args.epochs, args.batch, args.lr, args.device, args.relabel)
