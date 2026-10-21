from pathlib import Path
import shutil

# ============================================================
# SETTINGS
# ============================================================

# CHANGE THIS to the newly downloaded Roboflow dataset
SOURCE_ROOT = Path(
    r"C:\Users\markh\Downloads\Old Fruits Relabeled.v1i.yolov11"
)

# Keep it separate from everything else
OUTPUT_ROOT = Path(
    r"D:\Fruit Detection\Converted_Old_Fruits"
)


# ============================================================
# FINAL 5 CLASSES
# ============================================================

# IMPORTANT:
# This assumes the NEW Roboflow data.yaml says:
#
# 0 apple
# 1 mango
# 2 banana
# 3 orange
# 4 grapes

CLASS_MAP = {
    0: 0,  # apple
    1: 1,  # mango
    2: 2,  # banana
    3: 3,  # orange
    4: 4,  # grapes
}

CLASS_NAMES = {
    0: "apple",
    1: "mango",
    2: "banana",
    3: "orange",
    4: "grapes",
}

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp"
}


# ============================================================
# POLYGON -> YOLO BOUNDING BOX
# ============================================================

def polygon_to_bbox(values):
    x_values = values[0::2]
    y_values = values[1::2]

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
# FIND MATCHING IMAGE
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
# PROCESS ONE SPLIT
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
    print(f"Processing: {split_name}")
    print("=" * 60)

    if not source_images.exists():
        print("ERROR: images folder not found:")
        print(source_images)
        return

    if not source_labels.exists():
        print("ERROR: labels folder not found:")
        print(source_labels)
        return

    label_files = sorted(source_labels.glob("*.txt"))

    saved_images = 0
    skipped_images = 0
    polygon_objects = 0
    box_objects = 0

    class_counts = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
        4: 0,
    }

    file_counter = 1

    for label_path in label_files:

        image_path = find_image(
            source_images,
            label_path.stem
        )

        if image_path is None:
            print(
                f"WARNING: No image for {label_path.name}"
            )
            skipped_images += 1
            continue

        text = label_path.read_text(
            encoding="utf-8-sig"
        ).strip()

        if not text:
            skipped_images += 1
            continue

        new_annotations = []
        classes_in_image = []

        for line in text.splitlines():

            parts = line.split()

            if len(parts) < 5:
                print(
                    f"WARNING: Invalid annotation: "
                    f"{label_path.name}"
                )
                continue

            try:
                old_class = int(float(parts[0]))

                coordinates = [
                    float(x)
                    for x in parts[1:]
                ]

            except ValueError:
                print(
                    f"WARNING: Invalid values: "
                    f"{label_path.name}"
                )
                continue

            # Ignore anything outside our 5 classes
            if old_class not in CLASS_MAP:
                continue

            new_class = CLASS_MAP[old_class]

            # ==============================================
            # Already normal YOLO bounding box
            # ==============================================

            if len(coordinates) == 4:

                x_center = coordinates[0]
                y_center = coordinates[1]
                width = coordinates[2]
                height = coordinates[3]

                box_objects += 1

            # ==============================================
            # Polygon / segmentation annotation
            # ==============================================

            else:

                if len(coordinates) < 6:
                    print(
                        f"WARNING: Too few polygon points: "
                        f"{label_path.name}"
                    )
                    continue

                if len(coordinates) % 2 != 0:
                    print(
                        f"WARNING: Odd polygon coordinates: "
                        f"{label_path.name}"
                    )
                    continue

                (
                    x_center,
                    y_center,
                    width,
                    height
                ) = polygon_to_bbox(coordinates)

                polygon_objects += 1

            # Keep values valid for YOLO
            x_center = max(0.0, min(1.0, x_center))
            y_center = max(0.0, min(1.0, y_center))
            width = max(0.0, min(1.0, width))
            height = max(0.0, min(1.0, height))

            if width <= 0 or height <= 0:
                continue

            new_line = (
                f"{new_class} "
                f"{x_center:.6f} "
                f"{y_center:.6f} "
                f"{width:.6f} "
                f"{height:.6f}"
            )

            new_annotations.append(new_line)
            classes_in_image.append(new_class)

            class_counts[new_class] += 1

        if not new_annotations:
            skipped_images += 1
            continue

        # ==============================================
        # File naming
        # ==============================================

        unique_classes = sorted(
            set(classes_in_image)
        )

        if len(unique_classes) == 1:
            fruit_name = CLASS_NAMES[
                unique_classes[0]
            ]
        else:
            fruit_name = "mixed"

        new_stem = (
            f"old_{split_name}_"
            f"{file_counter:05d}_"
            f"{fruit_name}"
        )

        new_image_name = (
            new_stem + image_path.suffix.lower()
        )

        new_label_name = new_stem + ".txt"

        # Copy image
        shutil.copy2(
            image_path,
            output_images / new_image_name
        )

        # Save converted annotation
        (
            output_labels / new_label_name
        ).write_text(
            "\n".join(new_annotations) + "\n",
            encoding="utf-8"
        )

        saved_images += 1
        file_counter += 1

    # ==============================================
    # REPORT
    # ==============================================

    print()
    print(f"{split_name} completed.")
    print(f"Saved images:       {saved_images}")
    print(f"Skipped images:     {skipped_images}")
    print(f"Polygon objects:    {polygon_objects}")
    print(f"Bounding boxes:     {box_objects}")

    print()
    print("Objects by class:")

    for class_id, count in class_counts.items():

        print(
            f"{class_id} "
            f"{CLASS_NAMES[class_id]:<8} "
            f": {count}"
        )


# ============================================================
# MAIN
# ============================================================

def main():

    print("Starting corrected old dataset conversion...")
    print(f"Source: {SOURCE_ROOT}")
    print(f"Output: {OUTPUT_ROOT}")

    for split in ["train", "valid", "test"]:
        process_split(split)

    print()
    print("=" * 60)
    print("CONVERSION FINISHED")
    print("=" * 60)

    print()
    print("Final class mapping:")
    print("0 = apple")
    print("1 = mango")
    print("2 = banana")
    print("3 = orange")
    print("4 = grapes")

    print()
    print(f"Converted dataset:\n{OUTPUT_ROOT}")


if __name__ == "__main__":
    main()