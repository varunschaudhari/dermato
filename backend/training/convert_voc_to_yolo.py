"""
Convert VOC2007 XML annotations → YOLO txt format.

Source : dataset/Detection/Detection/VOC2007/
Output : dataset/Detection_YOLO/   (train/valid/test splits)

The Detection dataset is the Acne04 dataset which has 4 acne grade levels.
After conversion it can be used to augment the Acne.v21i.yolo26 dataset.

Run:
    python training/convert_voc_to_yolo.py
    python training/convert_voc_to_yolo.py --val_ratio 0.15 --test_ratio 0.1
"""

import argparse
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
import random

VOC_ROOT    = Path("C:/Users/varun.chaudhari/my-projects/dermato/dataset/Detection/Detection/VOC2007")
ANNOT_DIR   = VOC_ROOT / "Annotations"
OUTPUT_ROOT = Path("C:/Users/varun.chaudhari/my-projects/dermato/dataset/Detection_YOLO")

# Map VOC class names → YOLO class index
# "fore" is the generic acne foreground label used in this dataset
CLASS_MAP = {
    "fore":       0,   # generic acne lesion
    "blackhead":  1,
    "whitehead":  2,
    "papule":     3,
    "pustule":    4,
    "nodule":     5,
}


def parse_xml(xml_path: Path):
    tree = ET.parse(xml_path)
    root = tree.getroot()

    size  = root.find("size")
    width  = int(size.find("width").text)
    height = int(size.find("height").text)
    filename = root.find("filename").text

    objects = []
    for obj in root.findall("object"):
        name = obj.find("name").text.lower().strip()
        if name not in CLASS_MAP:
            continue
        bbox = obj.find("bndbox")
        xmin = float(bbox.find("xmin").text)
        ymin = float(bbox.find("ymin").text)
        xmax = float(bbox.find("xmax").text)
        ymax = float(bbox.find("ymax").text)

        # Convert to YOLO format (normalized cx, cy, w, h)
        cx = ((xmin + xmax) / 2) / width
        cy = ((ymin + ymax) / 2) / height
        w  = (xmax - xmin) / width
        h  = (ymax - ymin) / height

        objects.append((CLASS_MAP[name], cx, cy, w, h))

    return filename, objects


def convert(val_ratio: float, test_ratio: float, seed: int):
    random.seed(seed)

    xml_files = sorted(ANNOT_DIR.glob("*.xml"))
    print(f"Found {len(xml_files)} XML annotation files")

    # Build image path lookup from Classification JPEGImages
    img_source = Path("C:/Users/varun.chaudhari/my-projects/dermato/dataset/Classification/Classification/JPEGImages")

    # Create output directories
    for split in ("train", "valid", "test"):
        (OUTPUT_ROOT / split / "images").mkdir(parents=True, exist_ok=True)
        (OUTPUT_ROOT / split / "labels").mkdir(parents=True, exist_ok=True)

    # Split files
    random.shuffle(xml_files)
    n_total = len(xml_files)
    n_test  = int(n_total * test_ratio)
    n_val   = int(n_total * val_ratio)
    splits  = {
        "test":  xml_files[:n_test],
        "valid": xml_files[n_test:n_test + n_val],
        "train": xml_files[n_test + n_val:],
    }

    stats = {"train": 0, "valid": 0, "test": 0, "skipped": 0}

    for split, files in splits.items():
        for xml_path in files:
            try:
                filename, objects = parse_xml(xml_path)
            except Exception as e:
                print(f"  Skip {xml_path.name}: {e}")
                stats["skipped"] += 1
                continue

            if not objects:
                stats["skipped"] += 1
                continue

            # Find source image
            src_img = img_source / filename
            if not src_img.exists():
                stats["skipped"] += 1
                continue

            # Copy image
            dst_img = OUTPUT_ROOT / split / "images" / filename
            shutil.copy2(src_img, dst_img)

            # Write YOLO label
            dst_label = OUTPUT_ROOT / split / "labels" / (Path(filename).stem + ".txt")
            with open(dst_label, "w") as f:
                for cls_id, cx, cy, w, h in objects:
                    f.write(f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")

            stats[split] += 1

    # Write data.yaml
    yaml_content = f"""path: {OUTPUT_ROOT.as_posix()}

train: train/images
val:   valid/images
test:  test/images

nc: {len(CLASS_MAP)}
names: {list(CLASS_MAP.keys())}
"""
    (OUTPUT_ROOT / "data.yaml").write_text(yaml_content)

    print(f"\nConversion complete:")
    print(f"  Train  : {stats['train']}")
    print(f"  Valid  : {stats['valid']}")
    print(f"  Test   : {stats['test']}")
    print(f"  Skipped: {stats['skipped']}")
    print(f"\nOutput: {OUTPUT_ROOT}")
    print(f"data.yaml written. Use this with YOLOv8 training.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--val_ratio",  type=float, default=0.15)
    parser.add_argument("--test_ratio", type=float, default=0.10)
    parser.add_argument("--seed",       type=int,   default=42)
    args = parser.parse_args()
    convert(args.val_ratio, args.test_ratio, args.seed)
