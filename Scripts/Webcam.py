import os
import sys
import cv2
import numpy as np
from ultralytics import YOLO

# Ensure the project root is in sys.path so detector.py can be imported
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from detector import (
    load_yolo,
    load_freshness_model,
    run_two_stage_detection,
    YOLO_MODELS,
    KERAS_FRESHNESS_MODEL_PATH,
    KERAS_FRESHNESS_META_PATH,
    FRESHNESS_COLORS
)

# ============================================================
# MODELS
# ============================================================

print("=" * 60)
print("  FruitVision AI — Two-Stage Webcam Detection")
print("  Stage 1: YOLO11 Fruit Localization")
print("  Stage 2: Keras Freshness & Shelf-Life Intelligence")
print("=" * 60)

print("\nLoading YOLO11 model...")
yolo_model = load_yolo(YOLO_MODELS["YOLO11 (Recommended - High Accuracy)"])
print("✓ YOLO11 loaded")

print("Loading Keras Freshness Model...")
freshness_model, foods_meta, keras_img_size = load_freshness_model(
    KERAS_FRESHNESS_MODEL_PATH, KERAS_FRESHNESS_META_PATH
)
print("✓ Keras freshness model loaded")

# ============================================================
# SETTINGS
# ============================================================

CAMERA_ID = 0
CONFIDENCE = 0.35
IOU_THRESHOLD = 0.45
IMAGE_SIZE = 640
SEMI_MARGIN = 0.30

CAMERA_WIDTH = 1280
CAMERA_HEIGHT = 720

WINDOW_NAME = "FruitVision AI — Two-Stage Freshness Detection"

# ============================================================
# OPEN CAMERA
# ============================================================

cap = cv2.VideoCapture(CAMERA_ID)

if not cap.isOpened():
    print("ERROR: Could not open webcam.")
    raise SystemExit

cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
cap.set(cv2.CAP_PROP_FPS, 60)

actual_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
actual_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
actual_fps = cap.get(cv2.CAP_PROP_FPS)

print(f"\nCamera: {actual_width} x {actual_height} @ {actual_fps:.1f} FPS")
print("\nControls:")
print("  Q = Quit")
print("  F = Toggle Fullscreen")
print()

# ============================================================
# FULLSCREEN WINDOW
# ============================================================

cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
cv2.setWindowProperty(WINDOW_NAME, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
fullscreen = True

# ============================================================
# FPS TRACKING
# ============================================================

import time
prev_time = time.time()
fps_display = 0.0

# ============================================================
# MAIN LOOP
# ============================================================

while True:

    success, frame_bgr = cap.read()

    if not success:
        print("ERROR: Could not read webcam frame.")
        break

    # =========================================================
    # TWO-STAGE PIPELINE
    #   Stage 1: YOLO11 detects each individual fruit in frame
    #   Stage 2: Keras analyzes each single fruit crop for
    #            freshness score, food name & shelf life
    # =========================================================

    result = run_two_stage_detection(
        yolo_model=yolo_model,
        freshness_model=freshness_model,
        foods=foods_meta,
        img_size_keras=keras_img_size,
        image_input=frame_bgr,
        conf_threshold=CONFIDENCE,
        iou_threshold=IOU_THRESHOLD,
        img_size_yolo=IMAGE_SIZE,
        box_thickness=3,
        color_mode="freshness",
        show_labels=True,
        show_shelf_life=True,
        semi_margin=SEMI_MARGIN
    )

    # annotated_image is RGB — convert to BGR for OpenCV display
    annotated_bgr = cv2.cvtColor(result["annotated_image"], cv2.COLOR_RGB2BGR)

    counts = result["counts"]
    fresh_stats = result["freshness_stats"]
    avg_freshness = result["avg_freshness"]

    # =========================================================
    # CALCULATE DISPLAY FPS
    # =========================================================

    current_time = time.time()
    elapsed = current_time - prev_time
    if elapsed > 0:
        fps_display = 0.85 * fps_display + 0.15 * (1.0 / elapsed)
    prev_time = current_time

    # =========================================================
    # OVERLAY: FRESHNESS & COUNT PANEL
    # =========================================================

    if counts["total"] > 0:

        # --- PANEL BACKGROUND ---
        lines = [
            ("FruitVision AI — Two-Stage", (200, 200, 200)),
            (f"FPS: {fps_display:.1f}", (180, 180, 180)),
            (f"Fruits Detected: {counts['total']}", (255, 255, 255)),
            (f"Fresh:     {fresh_stats['FRESH']}", (34, 197, 94)),
            (f"Semi-Fresh:{fresh_stats['SEMI-FRESH']}", (245, 158, 11)),
            (f"Rotten:    {fresh_stats['ROTTEN']}", (239, 68, 68)),
            (f"Avg Freshness: {avg_freshness:.1f}%",
             (34, 197, 94) if avg_freshness >= 70 else
             ((245, 158, 11) if avg_freshness >= 45 else (239, 68, 68)))
        ]

        panel_h = 22 + len(lines) * 34
        panel_w = 320
        overlay = annotated_bgr.copy()
        cv2.rectangle(overlay, (14, 14), (14 + panel_w, 14 + panel_h), (8, 14, 28), -1)
        cv2.rectangle(overlay, (14, 14), (14 + panel_w, 14 + panel_h), (34, 197, 94), 2)
        annotated_bgr = cv2.addWeighted(overlay, 0.75, annotated_bgr, 0.25, 0)

        y = 42
        for text, color in lines:
            # BGR conversion (cv2 uses BGR)
            bgr_color = (int(color[2]), int(color[1]), int(color[0]))
            cv2.putText(
                annotated_bgr, text,
                (24, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.58,
                bgr_color, 2, cv2.LINE_AA
            )
            y += 34

    # =========================================================
    # SHOW FRAME
    # =========================================================

    cv2.imshow(WINDOW_NAME, annotated_bgr)

    # =========================================================
    # KEYBOARD
    # =========================================================

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):
        break

    elif key == ord("f"):
        fullscreen = not fullscreen
        if fullscreen:
            cv2.setWindowProperty(
                WINDOW_NAME, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN
            )
        else:
            cv2.setWindowProperty(
                WINDOW_NAME, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_NORMAL
            )
            cv2.resizeWindow(WINDOW_NAME, 1280, 720)

# ============================================================
# CLEANUP
# ============================================================

cap.release()
cv2.destroyAllWindows()

print()
print("Webcam stopped.")