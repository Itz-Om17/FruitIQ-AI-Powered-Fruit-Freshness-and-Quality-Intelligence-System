from pathlib import Path
import shutil

# ============================================================
# SETTINGS
# ============================================================

# Folder containing:
# train/images
# train/labels
# valid/images
# valid/labels
# test/images
# test/labels

SOURCE_ROOT = Path(
    r"C:\Users\markh\Downloads\check_newconverted_fruits1.v1-check_new.yolov11"
)

# New cleaned copy
OUTPUT_ROOT = Path(
    r"D:\Fruit Detection\check_newdata"
)

# ============================================================
# CLASS DEFINITIONS
# ============================================================

# Final 4-class mapping:
# 0 -> apple
# 1 -> mango
# 2 -> banana
# 3 -> orange

CLASS_NAMES = {
    0: "apple",
    1: "mango",
    2: "banana",
    3: "orange",
}

VALID_CLASSES = set(CLASS_NAMES.keys())

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp",
}

# ============================================================
# POLYGON -> BOUNDING BOX
# ============================================================

def polygon_to_bbox(coords):
    x_values = coords[0::2]
    y_values = coords[1::2]

    xmin = min(x_values)
    xmax = max(x_values)

    ymin = min(y_values)
    ymax = max(y_values)

    x_center = (xmin + xmax) / 2
    y_center = (ymin + ymax) / 2

    width = xmax - xmin
    height = ymax - ymin

    return x_center, y_center, width, height

# ============================================================
# FIND IMAGE
# ============================================================

def find_image(images_folder, stem):
    for image_path in images_folder.iterdir():
        if (
            image_path.is_file()
            and image_path.suffix.lower() in IMAGE_EXTENSIONS
            and image_path.stem.lower() == stem.lower()
        ):
            return image_path

    return None

# ============================================================
# PROCESS SPLIT
# ============================================================

def process_split(split_name):

    source_images = SOURCE_ROOT / split_name / "images"
    source_labels = SOURCE_ROOT / split_name / "labels"

    output_images = OUTPUT_ROOT / split_name / "images"
    output_labels = OUTPUT_ROOT / split_name / "labels"

    output_images.mkdir(parents=True, exist_ok=True)
    output_labels.mkdir(parents=True, exist_ok=True)

    print()
    print("=" * 60)
    print(f"PROCESSING {split_name.upper()}")
    print("=" * 60)

    if not source_images.exists():
        print(f"ERROR: missing {source_images}")
        return

    if not source_labels.exists():
        print(f"ERROR: missing {source_labels}")
        return

    counts = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
    }

    polygons_converted = 0
    normal_boxes = 0
    saved_images = 0
    invalid_lines = 0
    invalid_classes = 0

    for label_path in sorted(source_labels.glob("*.txt")):

        image_path = find_image(
            source_images,
            label_path.stem
        )

        if image_path is None:
            print(f"WARNING: image missing for {label_path.name}")
            continue

        text = label_path.read_text(
            encoding="utf-8-sig"
        ).strip()

        if not text:
            print(f"WARNING: empty label {label_path.name}")
            continue

        new_lines = []

        for line in text.splitlines():

            parts = line.split()

            if len(parts) < 5:
                print(f"INVALID: {label_path.name}")
                invalid_lines += 1
                continue

            try:
                class_id = int(float(parts[0]))

                coords = [
                    float(value)
                    for value in parts[1:]
                ]

            except ValueError:
                print(f"INVALID VALUES: {label_path.name}")
                invalid_lines += 1
                continue

            # =================================================
            # CHECK CLASS ID
            # =================================================

            if class_id not in VALID_CLASSES:
                print(
                    f"INVALID CLASS {class_id} "
                    f"in {label_path.name}"
                )

                invalid_classes += 1
                continue

            # =================================================
            # ALREADY NORMAL YOLO BOX
            # =================================================

            if len(coords) == 4:

                x_center = coords[0]
                y_center = coords[1]
                width = coords[2]
                height = coords[3]

                normal_boxes += 1

            # =================================================
            # POLYGON
            # =================================================

            else:

                if len(coords) < 6:
                    print(
                        f"TOO FEW POLYGON VALUES: "
                        f"{label_path.name}"
                    )
                    invalid_lines += 1
                    continue

                if len(coords) % 2 != 0:
                    print(
                        f"ODD POLYGON VALUES: "
                        f"{label_path.name}"
                    )
                    invalid_lines += 1
                    continue

                (
                    x_center,
                    y_center,
                    width,
                    height
                ) = polygon_to_bbox(coords)

                polygons_converted += 1

            # =================================================
            # VALIDATE COORDINATES
            # =================================================

            x_center = max(0.0, min(1.0, x_center))
            y_center = max(0.0, min(1.0, y_center))
            width = max(0.0, min(1.0, width))
            height = max(0.0, min(1.0, height))

            if width <= 0 or height <= 0:
                print(
                    f"INVALID BOX SIZE: "
                    f"{label_path.name}"
                )
                invalid_lines += 1
                continue

            new_line = (
                f"{class_id} "
                f"{x_center:.6f} "
                f"{y_center:.6f} "
                f"{width:.6f} "
                f"{height:.6f}"
            )

            new_lines.append(new_line)

            counts[class_id] += 1

        # =====================================================
        # SAVE IMAGE + LABEL
        # =====================================================

        if not new_lines:
            continue

        shutil.copy2(
            image_path,
            output_images / image_path.name
        )

        (
            output_labels / label_path.name
        ).write_text(
            "\n".join(new_lines) + "\n",
            encoding="utf-8"
        )

        saved_images += 1

    # =========================================================
    # REPORT
    # =========================================================

    print()
    print(f"Images saved:        {saved_images}")
    print(f"Polygons converted:  {polygons_converted}")
    print(f"Existing boxes:      {normal_boxes}")
    print(f"Invalid lines:       {invalid_lines}")
    print(f"Invalid classes:     {invalid_classes}")

    print()
    print("CLASS COUNTS:")

    for class_id in range(4):
        print(
            f"{class_id} -> "
            f"{CLASS_NAMES[class_id]:<7} : "
            f"{counts[class_id]}"
        )

# ============================================================
# MAIN
# ============================================================

def main():

    print("Starting dataset conversion...")
    print(f"Source: {SOURCE_ROOT}")
    print(f"Output: {OUTPUT_ROOT}")

    for split in ["train", "valid", "test"]:
        process_split(split)

    print()
    print("=" * 60)
    print("DONE")
    print("=" * 60)

    print()
    print("Expected classes:")
    print("0 -> apple")
    print("1 -> mango")
    print("2 -> banana")
    print("3 -> orange")


if __name__ == "__main__":
    main()