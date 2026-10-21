import cv2
from pathlib import Path

# ============================================================
# SETTINGS
# ============================================================

DATA_ROOT = Path(r"D:\Fruit Detection\webcam_negatives")

IMAGES_FOLDER = DATA_ROOT / "images"
LABELS_FOLDER = DATA_ROOT / "labels"

IMAGES_FOLDER.mkdir(parents=True, exist_ok=True)
LABELS_FOLDER.mkdir(parents=True, exist_ok=True)


# ============================================================
# FIND NEXT IMAGE NUMBER
# ============================================================

def get_next_number():
    number = 1

    while True:
        image_path = IMAGES_FOLDER / f"negative_image_{number}.jpg"
        label_path = LABELS_FOLDER / f"negative_image_{number}.txt"

        # If neither exists, this number is available
        if not image_path.exists() and not label_path.exists():
            return number

        number += 1


# ============================================================
# OPEN WEBCAM
# ============================================================

camera = cv2.VideoCapture(0)

if not camera.isOpened():
    print("ERROR: Could not open webcam.")
    raise SystemExit


print("=" * 50)
print("WEBCAM NEGATIVE DATA CAPTURE")
print("=" * 50)

print("\nPress S = Save negative image")
print("Press Q = Quit")

print("\nIMPORTANT:")
print("Only save images containing NO fruit.")


# ============================================================
# CAPTURE LOOP
# ============================================================

while True:

    success, frame = camera.read()

    if not success:
        print("ERROR: Could not read webcam frame.")
        break

    # --------------------------------------------------------
    # Text displayed on webcam
    # --------------------------------------------------------

    cv2.putText(
        frame,
        "NEGATIVE DATA CAPTURE",
        (10, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 255, 0),
        2
    )

    cv2.putText(
        frame,
        "S = Save | Q = Quit",
        (10, 65),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 255),
        2
    )

    cv2.imshow(
        "Webcam Negative Capture",
        frame
    )

    key = cv2.waitKey(1) & 0xFF


    # ========================================================
    # SAVE IMAGE + EMPTY LABEL
    # ========================================================

    if key == ord("s"):

        number = get_next_number()

        filename = f"negative_image_{number}"

        image_path = IMAGES_FOLDER / f"{filename}.jpg"
        label_path = LABELS_FOLDER / f"{filename}.txt"

        # Save image
        saved = cv2.imwrite(
            str(image_path),
            frame
        )

        if not saved:
            print("ERROR: Image could not be saved.")
            continue

        # Create EMPTY YOLO label
        label_path.write_text(
            "",
            encoding="utf-8"
        )

        print(
            f"Saved: {filename}.jpg "
            f"+ {filename}.txt"
        )


    # ========================================================
    # QUIT
    # ========================================================

    elif key == ord("q"):

        print("\nStopping webcam...")
        break


# ============================================================
# CLEANUP
# ============================================================

camera.release()
cv2.destroyAllWindows()

print("\nCapture finished.")

print(f"\nImages: {IMAGES_FOLDER}")
print(f"Labels: {LABELS_FOLDER}")