"""
Train EfficientNet-B0 severity classifiers for all conditions
using the archive dataset + existing labeled data.

Archive folder structure (folder = condition, all images = "has condition"):
    archive/dataset/wrinkles/           → wrinkle images
    archive/dataset/pigmentation/       → pigmentation images
    archive/dataset/dark spots/         → dark spot images
    archive/dataset/inflammatory acne/  → inflammatory acne images
    archive/dataset/Redness/            → redness images
    archive/dataset/pores/              → pore images

Since archive has no severity labels, we combine:
  - Archive images        → used for binary: condition present (1) vs absent (0)
  - Classification dataset → used for acne severity grades 0-3

Trains one binary classifier per condition:
    models/severity/wrinkle_clf.pth
    models/severity/pigmentation_clf.pth
    models/severity/redness_clf.pth
    models/severity/pores_clf.pth

Run:
    python training/train_condition_severity.py --condition wrinkle
    python training/train_condition_severity.py --condition pigmentation
    python training/train_condition_severity.py --condition redness
    python training/train_condition_severity.py --condition pores
    python training/train_condition_severity.py --all
"""

import argparse
import random
from pathlib import Path

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import timm
import numpy as np
from sklearn.metrics import classification_report

# Paths
ARCHIVE_ROOT = Path("C:/Users/varun.chaudhari/my-projects/dermato/dataset/archive/dataset")
OUTPUT_DIR   = Path(__file__).parent.parent / "models" / "severity"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Map condition name → archive folder name
CONDITION_FOLDERS = {
    "wrinkle":       ["wrinkles"],
    "pigmentation":  ["pigmentation", "dark spots"],
    "redness":       ["Redness"],
    "pores":         ["pores"],
    "acne":          ["inflammatory acne", "non inflammatory acne black heads",
                      "non inflammatory acne white heads"],
}

# Negative samples come from OTHER condition folders (not the target)
ALL_FOLDERS = [f for folders in CONDITION_FOLDERS.values() for f in folders]

IMG_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def collect_images(folders: list, root: Path) -> list:
    images = []
    for folder in folders:
        folder_path = root / folder
        if folder_path.exists():
            for f in folder_path.iterdir():
                if f.suffix.lower() in IMG_EXTENSIONS:
                    images.append(f)
    return images


class BinaryConditionDataset(Dataset):
    """
    Positive class (1): images of the target condition.
    Negative class (0): images from OTHER condition folders.
    Balanced automatically.
    """

    def __init__(self, positive_imgs: list, negative_imgs: list,
                 transform=None, split="train", val_ratio=0.15, seed=42):
        random.seed(seed)

        pos = list(positive_imgs)
        neg = list(negative_imgs)
        random.shuffle(pos)
        random.shuffle(neg)

        # Balance classes — use min count for both
        min_count = min(len(pos), len(neg))
        pos = pos[:min_count]
        neg = neg[:min_count]

        all_items = [(p, 1) for p in pos] + [(n, 0) for n in neg]
        random.shuffle(all_items)

        n_val = int(len(all_items) * val_ratio)
        if split == "train":
            self.items = all_items[n_val:]
        else:
            self.items = all_items[:n_val]

        self.transform = transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        img_path, label = self.items[idx]
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception:
            image = Image.new("RGB", (224, 224), (128, 128, 128))
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


def train_condition(condition: str, epochs: int, batch: int, device_str: str):
    device = torch.device(device_str if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*50}")
    print(f"Training: {condition} classifier  |  device: {device}")
    print(f"{'='*50}")

    target_folders = CONDITION_FOLDERS[condition]
    other_folders  = [f for f in ALL_FOLDERS if f not in target_folders]

    positive_imgs = collect_images(target_folders, ARCHIVE_ROOT)
    negative_imgs = collect_images(other_folders,  ARCHIVE_ROOT)

    print(f"  Positive ({condition}): {len(positive_imgs)} images")
    print(f"  Negative (other):       {len(negative_imgs)} images")

    if len(positive_imgs) < 50:
        print(f"  ⚠ Too few positive images for {condition}. Skipping.")
        return

    train_ds = BinaryConditionDataset(positive_imgs, negative_imgs, get_transforms("train"), "train")
    val_ds   = BinaryConditionDataset(positive_imgs, negative_imgs, get_transforms("val"),   "val")
    print(f"  Train: {len(train_ds)}  Val: {len(val_ds)}")

    train_loader = DataLoader(train_ds, batch_size=batch, shuffle=True,  num_workers=2, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=batch, shuffle=False, num_workers=2, pin_memory=True)

    model     = timm.create_model("efficientnet_b0", pretrained=True, num_classes=2).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_acc = 0.0
    output_path  = OUTPUT_DIR / f"{condition}_clf.pth"

    for epoch in range(1, epochs + 1):
        model.train()
        correct, total = 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            loss = criterion(model(imgs), labels)
            loss.backward()
            optimizer.step()
            correct += (model(imgs).argmax(1) == labels).sum().item()
            total   += imgs.size(0)
        scheduler.step()

        model.eval()
        val_correct, val_total = 0, 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                val_correct += (model(imgs).argmax(1) == labels).sum().item()
                val_total   += imgs.size(0)

        val_acc = val_correct / val_total
        print(f"  Epoch {epoch:3d}/{epochs}  val_acc: {val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), output_path)
            print(f"    ✓ Saved  ({output_path.name})")

    print(f"\n  Best val acc: {best_val_acc:.4f}")
    print(f"  Model: {output_path}")


def evaluate_condition(condition: str, device_str: str):
    device = torch.device(device_str if torch.cuda.is_available() else "cpu")
    weights = OUTPUT_DIR / f"{condition}_clf.pth"
    if not weights.exists():
        print(f"No weights found: {weights}")
        return

    target_folders = CONDITION_FOLDERS[condition]
    other_folders  = [f for f in ALL_FOLDERS if f not in target_folders]
    positive_imgs  = collect_images(target_folders, ARCHIVE_ROOT)
    negative_imgs  = collect_images(other_folders,  ARCHIVE_ROOT)

    val_ds     = BinaryConditionDataset(positive_imgs, negative_imgs, get_transforms("val"), "val")
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=2)

    model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=2)
    model.load_state_dict(torch.load(str(weights), map_location=device))
    model.to(device).eval()

    all_preds, all_labels = [], []
    with torch.no_grad():
        for imgs, labels in val_loader:
            preds = model(imgs.to(device)).argmax(1)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.numpy())

    print(f"\n{condition} classifier evaluation:")
    print(classification_report(all_labels, all_preds, target_names=["absent", "present"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--condition", choices=list(CONDITION_FOLDERS.keys()),
                        help="Which condition to train")
    parser.add_argument("--all",      action="store_true", help="Train all conditions")
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--epochs",   type=int, default=30)
    parser.add_argument("--batch",    type=int, default=32)
    parser.add_argument("--device",   default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    conditions = list(CONDITION_FOLDERS.keys()) if args.all else [args.condition]

    for cond in conditions:
        if args.evaluate:
            evaluate_condition(cond, args.device)
        else:
            train_condition(cond, args.epochs, args.batch, args.device)

    print("\nAll done.")
