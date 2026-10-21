import cv2
from pathlib import Path
import shutil

# ============================================================
# SETTINGS
# ============================================================

# Main working folder for mango images
MANGO_FOLDER = Path(
    r"D:\Fruit Detection\webcam_mango\images"
)

# Backup folder
BACKUP_FOLDER = Path(
    r"D:\Fruit Detection\mango_backup"
)

# Create folders automatically
MANGO_FOLDER.mkdir(parents=True, exist_ok=True)
BACKUP_FOLDER.mkdir(parents=True, exist_ok=True)


# ============================================================
# FIND NEXT IMAGE NUMBER
# ============================================================

def get_next_number():
    number = 1

    while True:
        main_image = (
            MANGO_FOLDER / f"mango_image_{number}.jpg"
        )

        backup_image = (
            BACKUP_FOLDER / f"mango_image_{number}.jpg"
        )

        # Use the number only if it does not already exist
        if not main_image.exists() and not backup_image.exists():
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
print("MANGO WEBCAM DATA CAPTURE")
print("=" * 50)

print()
print("Press S = Save mango image")
print("Press Q = Quit")

print()
print("Try different mango conditions:")
print("- Mango in hand")
print("- Mango close to camera")
print("- Mango far from camera")
print("- Mango partially covered")
print("- Mango at different angles")
print("- Mango with your face visible")
print("- Mango in front of sofa/background")
print("- Different lighting")


# ============================================================
# CAPTURE LOOP
# ============================================================

while True:

    success, frame = camera.read()

    if not success:
        print("ERROR: Could not read webcam frame.")
        break

    # --------------------------------------------------------
    # Display instructions
    # --------------------------------------------------------

    cv2.putText(
        frame,
        "MANGO DATA CAPTURE",
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
        "Mango Webcam Capture",
        frame
    )

    key = cv2.waitKey(1) & 0xFF


    # ========================================================
    # SAVE IMAGE
    # ========================================================

    if key == ord("s"):

        number = get_next_number()

        filename = f"mango_image_{number}.jpg"

        main_path = MANGO_FOLDER / filename
        backup_path = BACKUP_FOLDER / filename

        # Save main image
        saved = cv2.imwrite(
            str(main_path),
            frame
        )

        if not saved:
            print("ERROR: Could not save image.")
            continue

        # Copy same image to backup folder
        shutil.copy2(
            main_path,
            backup_path
        )

        print(
            f"Saved: {filename}"
        )

        print(
            f"Backup: {backup_path}"
        )


    # ========================================================
    # QUIT
    # ========================================================

    elif key == ord("q"):

        print()
        print("Stopping webcam...")
        break


# ============================================================
# CLEANUP
# ============================================================

camera.release()
cv2.destroyAllWindows()

print()
print("=" * 50)
print("CAPTURE FINISHED")
print("=" * 50)

print()
print("Main mango images:")
print(MANGO_FOLDER)

print()
print("Backup mango images:")
print(BACKUP_FOLDER)