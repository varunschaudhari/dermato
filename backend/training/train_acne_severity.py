"""
Train EfficientNet-B0 for acne severity classification.

Dataset : Classification/Classification/
          levle0 → clear/mild (0), levle1 → mild (1),
          levle2 → moderate (2), levle3 → severe (3)
Labels  : NNEW_trainval_*.txt  → "filename.jpg  grade  count"
Output  : backend/models/acne_severity/best.pth

Run:
    python training/train_acne_severity.py
    python training/train_acne_severity.py --epochs 50 --batch 32
"""

import argparse
import os
from pathlib import Path

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import transforms
from PIL import Image
import timm
from sklearn.metrics import classification_report, confusion_matrix
import numpy as np

DATASET_ROOT = Path("C:/Users/varun.chaudhari/my-projects/dermato/dataset/Classification/Classification")
IMAGE_DIR    = DATASET_ROOT / "JPEGImages"
OUTPUT_DIR   = Path(__file__).parent.parent / "models" / "acne_severity"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Map level → severity label
LEVEL_TO_SEVERITY = {0: "clear", 1: "mild", 2: "moderate", 3: "severe"}
NUM_CLASSES = 4


class AcneSeverityDataset(Dataset):
    """Reads all NNEW_trainval_*.txt files and returns (image, label) pairs."""

    def __init__(self, image_dir: Path, label_dir: Path, transform=None, split="train", val_ratio=0.15):
        self.image_dir = image_dir
        self.transform = transform
        self.samples = []

        # Collect all entries from the 5 fold files
        all_entries = {}
        for fold_file in sorted(label_dir.glob("NNEW_trainval_*.txt")):
            for line in fold_file.read_text().strip().splitlines():
                parts = line.split()
                if len(parts) >= 2:
                    fname, label = parts[0], int(parts[1])
                    all_entries[fname] = label

        items = list(all_entries.items())
        np.random.seed(42)
        np.random.shuffle(items)

        n_val = int(len(items) * val_ratio)
        if split == "train":
            items = items[n_val:]
        else:
            items = items[:n_val]

        for fname, label in items:
            img_path = image_dir / fname
            if img_path.exists():
                self.samples.append((img_path, label))

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
            transforms.RandomVerticalFlip(p=0.1),
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


def build_model(num_classes: int, pretrained: bool = True) -> nn.Module:
    model = timm.create_model("efficientnet_b0", pretrained=pretrained, num_classes=num_classes)
    return model


def train(epochs: int, batch: int, lr: float, device_str: str):
    device = torch.device(device_str if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}")

    train_ds = AcneSeverityDataset(IMAGE_DIR, DATASET_ROOT, get_transforms("train"), split="train")
    val_ds   = AcneSeverityDataset(IMAGE_DIR, DATASET_ROOT, get_transforms("val"),   split="val")
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")

    train_loader = DataLoader(train_ds, batch_size=batch, shuffle=True,  num_workers=4, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=batch, shuffle=False, num_workers=4, pin_memory=True)

    # Class weights to handle imbalance (level2 & level3 have fewer samples)
    counts = [497, 637, 186, 137]
    total  = sum(counts)
    weights = torch.tensor([total / c for c in counts], dtype=torch.float).to(device)

    model     = build_model(NUM_CLASSES).to(device)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_acc = 0.0

    for epoch in range(1, epochs + 1):
        # --- Train ---
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss   += loss.item() * images.size(0)
            train_correct += (outputs.argmax(1) == labels).sum().item()
            train_total   += images.size(0)
        scheduler.step()

        # --- Validate ---
        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss    += loss.item() * images.size(0)
                val_correct += (outputs.argmax(1) == labels).sum().item()
                val_total   += images.size(0)

        train_acc = train_correct / train_total
        val_acc   = val_correct   / val_total

        print(f"Epoch {epoch:3d}/{epochs} | "
              f"Train Loss: {train_loss/train_total:.4f} Acc: {train_acc:.4f} | "
              f"Val Loss: {val_loss/val_total:.4f} Acc: {val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), OUTPUT_DIR / "best.pth")
            print(f"  ✓ Saved best model (val acc: {best_val_acc:.4f})")

    print(f"\nTraining complete. Best val acc: {best_val_acc:.4f}")
    print(f"Model saved: {OUTPUT_DIR / 'best.pth'}")


def evaluate(weights_path: str, device_str: str):
    device = torch.device(device_str if torch.cuda.is_available() else "cpu")

    val_ds     = AcneSeverityDataset(IMAGE_DIR, DATASET_ROOT, get_transforms("val"), split="val")
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=4)

    model = build_model(NUM_CLASSES, pretrained=False)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.to(device).eval()

    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, labels in val_loader:
            outputs = model(images.to(device))
            all_preds.extend(outputs.argmax(1).cpu().numpy())
            all_labels.extend(labels.numpy())

    print("\nClassification Report:")
    print(classification_report(all_labels, all_preds,
                                target_names=list(LEVEL_TO_SEVERITY.values())))
    print("Confusion Matrix:")
    print(confusion_matrix(all_labels, all_preds))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs",   type=int,   default=40)
    parser.add_argument("--batch",    type=int,   default=32)
    parser.add_argument("--lr",       type=float, default=1e-3)
    parser.add_argument("--device",   default="cuda")
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--weights",  default=str(OUTPUT_DIR / "best.pth"))
    args = parser.parse_args()

    if args.evaluate:
        evaluate(args.weights, args.device)
    else:
        train(args.epochs, args.batch, args.lr, args.device)
