"""
FreshTrack AI — Python FastAPI Inference Service
Two-Stage Pipeline:
  Stage 1: YOLO11 bulk fruit detection & bounding-box extraction
  Stage 2: Keras MobileNetV2 per-fruit freshness, shelf-life & food classification
"""
import os
import sys
import io
import json
import time
import uuid
import logging
from pathlib import Path
from typing import Optional, List

import cv2
import numpy as np
from PIL import Image

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# -------------------------------------------------------------------
# PATHS  (inference/ lives inside freshtrack/, models in ../../Models)
# -------------------------------------------------------------------
SERVICE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SERVICE_DIR.parent.parent          # Fruit-Detection-main/
MODELS_DIR = PROJECT_ROOT / "Models"

YOLO_MODEL_PATH   = MODELS_DIR / "Yolo11.pt"
KERAS_MODEL_PATH  = MODELS_DIR / "food_freshness_model.keras"
KERAS_META_PATH   = MODELS_DIR / "food_freshness_meta.json"

# -------------------------------------------------------------------
# LOGGING
# -------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("freshtrack-inference")

# -------------------------------------------------------------------
# GLOBAL MODEL REFERENCES  (loaded once at startup)
# -------------------------------------------------------------------
yolo_model          = None
keras_pred_model    = None
foods_list: List[str] = []
keras_img_size: int = 160

# -------------------------------------------------------------------
# SHELF LIFE TABLE
# -------------------------------------------------------------------
AVG_SHELF_LIFE = {
    "apple": 30, "banana": 6, "orange": 21, "mango": 7, "tomato": 7,
    "potato": 60, "carrot": 28, "cucumber": 7, "capsicum": 10, "pepper": 10,
    "grape": 7, "strawberry": 5, "lemon": 21, "okra": 5, "onion": 60,
    "bellpepper": 10, "bittergroud": 5
}
DEFAULT_SHELF_LIFE = 7

# -------------------------------------------------------------------
# FASTAPI APP
# -------------------------------------------------------------------
app = FastAPI(
    title="FreshTrack AI — Inference Service",
    description="Two-stage fruit detection & freshness grading API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# STARTUP / SHUTDOWN
# -------------------------------------------------------------------
@app.on_event("startup")
async def load_models():
    global yolo_model, keras_pred_model, foods_list, keras_img_size
    import tensorflow as tf
    from ultralytics import YOLO

    log.info("Loading YOLO11 model…")
    if not YOLO_MODEL_PATH.exists():
        raise RuntimeError(f"YOLO model not found at {YOLO_MODEL_PATH}")
    yolo_model = YOLO(str(YOLO_MODEL_PATH))
    log.info("✓ YOLO11 loaded")

    log.info("Loading Keras freshness model…")
    if not KERAS_MODEL_PATH.exists():
        raise RuntimeError(f"Keras model not found at {KERAS_MODEL_PATH}")
    base_model = tf.keras.models.load_model(str(KERAS_MODEL_PATH))
    keras_pred_model = tf.keras.Model(
        base_model.input,
        [base_model.get_layer("food").output, base_model.get_layer("fresh").output]
    )
    if KERAS_META_PATH.exists():
        with open(KERAS_META_PATH) as f:
            meta = json.load(f)
        foods_list = meta.get("foods", [])
        keras_img_size = int(meta.get("img_size", 160))
    log.info(f"✓ Keras model loaded ({len(foods_list)} food classes, {keras_img_size}px input)")

# -------------------------------------------------------------------
# HELPER UTILITIES
# -------------------------------------------------------------------
def clean_food_name(raw: str) -> str:
    raw = raw.lower().strip()
    for prefix in ("fresh", "rotten"):
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
            break
    name_map = {
        "apple": "Apple", "banana": "Banana", "mango": "Mango", "orange": "Orange",
        "tomato": "Tomato", "carrot": "Carrot", "cucumber": "Cucumber",
        "bellpepper": "Bell Pepper", "capsicum": "Capsicum", "capciscum": "Capsicum",
        "strawberry": "Strawberry", "potato": "Potato", "okra": "Okra",
        "okara": "Okra", "bittergroud": "Bitter Gourd"
    }
    return name_map.get(raw, raw.capitalize())


def estimate_shelf_life(fruit_type: str, p_fresh: float, state: str) -> Optional[int]:
    if state == "ROTTEN":
        return 0
    key = fruit_type.lower()
    base = DEFAULT_SHELF_LIFE
    for k, d in AVG_SHELF_LIFE.items():
        if k in key:
            base = d
            break
    return max(0, int(round(base * p_fresh)))


def square_crop(rgb: np.ndarray, box: list, target: int, pad: float = 0.08) -> np.ndarray:
    H, W = rgb.shape[:2]
    x1, y1, x2, y2 = box
    px, py = int((x2 - x1) * pad), int((y2 - y1) * pad)
    x1 = max(0, x1 - px); y1 = max(0, y1 - py)
    x2 = min(W, x2 + px + 1); y2 = min(H, y2 + py + 1)
    crop = rgb[y1:y2, x1:x2]
    ch, cw = crop.shape[:2]
    side = max(ch, cw)
    top = (side - ch) // 2; bot = side - ch - top
    left = (side - cw) // 2; right = side - cw - left
    sq = cv2.copyMakeBorder(crop, top, bot, left, right, cv2.BORDER_REPLICATE)
    return cv2.resize(sq, (target, target)).astype("float32")


def freshness_state(p_fr: float, p_rot: float, semi_margin: float = 0.30) -> str:
    if abs(p_fr - p_rot) < semi_margin:
        return "SEMI-FRESH"
    return "FRESH" if p_fr > p_rot else "ROTTEN"

# -------------------------------------------------------------------
# ENDPOINTS
# -------------------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": yolo_model is not None and keras_pred_model is not None,
        "food_classes": len(foods_list),
        "keras_input_size": keras_img_size
    }


@app.post("/api/v1/inspect")
async def inspect(
    file: UploadFile = File(...),
    conf: float = Query(0.35, ge=0.05, le=0.95),
    iou: float = Query(0.45, ge=0.05, le=0.95),
    semi_margin: float = Query(0.30, ge=0.05, le=0.60),
    batch_size: int = Query(16, ge=1, le=64)
):
    """
    Full two-stage inference:
    1. YOLO11 detects individual fruits in the uploaded image.
    2. Keras model grades each detected fruit crop for freshness & shelf life.
    Returns structured JSON with all detections and aggregate statistics.
    """
    if yolo_model is None or keras_pred_model is None:
        raise HTTPException(503, "Models not yet loaded. Retry in a moment.")

    # Validate & decode image
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(400, f"Unsupported file type '{file.content_type}'. Use JPEG, PNG or WebP.")

    raw = await file.read()
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(413, "Image too large. Max 20 MB.")

    try:
        pil = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Could not decode image.")

    img_rgb = np.array(pil)
    H, W = img_rgb.shape[:2]

    t0 = time.perf_counter()

    # ── Stage 1: YOLO detection ─────────────────────────────────────
    yolo_results = yolo_model(pil, conf=conf, iou=iou, imgsz=640, verbose=False)
    yolo_res = yolo_results[0]
    t_yolo = (time.perf_counter() - t0) * 1000.0

    detections = []
    if yolo_res.boxes is None or len(yolo_res.boxes) == 0:
        return JSONResponse({
            "scan_id": str(uuid.uuid4()),
            "status": "no_detections",
            "image_size": {"width": W, "height": H},
            "timing_ms": {"yolo": round(t_yolo, 1), "keras": 0, "total": round(t_yolo, 1)},
            "detections": [],
            "summary": {"total": 0, "fresh": 0, "semi_fresh": 0, "rotten": 0, "avg_freshness_pct": 0}
        })

    # Collect valid boxes
    raw_boxes = []
    for box in yolo_res.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(W, x2), min(H, y2)
        if (x2 - x1) < 10 or (y2 - y1) < 10:
            continue
        cls_id = int(box.cls[0].item())
        raw_boxes.append({
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "yolo_class": yolo_model.names.get(cls_id, "fruit").lower(),
            "yolo_conf": round(float(box.conf[0].item()), 4)
        })

    # ── Stage 2: Keras batch inference ──────────────────────────────
    t_keras_start = time.perf_counter()
    import numpy as np

    # Build crop batch (process in sub-batches to limit memory)
    all_keras_preds = []
    crops = [square_crop(img_rgb, [b["x1"], b["y1"], b["x2"], b["y2"]], keras_img_size) for b in raw_boxes]

    for i in range(0, len(crops), batch_size):
        sub = np.stack(crops[i:i + batch_size])          # (N,H,W,3) float32 0-255
        pf_batch, pfr_batch = keras_pred_model(sub, training=False)
        pf_np   = pf_batch.numpy()
        pfr_np  = pfr_batch.numpy()
        for j in range(len(sub)):
            food_idx = int(np.argmax(pf_np[j]))
            food_raw = foods_list[food_idx] if food_idx < len(foods_list) else "unknown"
            p_rot, p_fr = float(pfr_np[j][0]), float(pfr_np[j][1])
            state = freshness_state(p_fr, p_rot, semi_margin)
            yolo_cls = raw_boxes[i + j]["yolo_class"]
            days = estimate_shelf_life(yolo_cls, p_fr, state)
            all_keras_preds.append({
                "keras_food_raw": food_raw,
                "keras_food_name": clean_food_name(food_raw),
                "keras_food_conf": round(float(pf_np[j][food_idx]), 4),
                "p_fresh": round(p_fr, 4),
                "p_rotten": round(p_rot, 4),
                "freshness_score_pct": round(p_fr * 100, 1),
                "freshness_state": state,
                "shelf_life_days": days
            })

    t_keras = (time.perf_counter() - t_keras_start) * 1000.0
    t_total = (time.perf_counter() - t0) * 1000.0

    # Merge
    fresh_count = semi_count = rotten_count = 0
    freshness_scores = []
    for idx, (b, kp) in enumerate(zip(raw_boxes, all_keras_preds)):
        state = kp["freshness_state"]
        if state == "FRESH": fresh_count += 1
        elif state == "SEMI-FRESH": semi_count += 1
        else: rotten_count += 1
        freshness_scores.append(kp["freshness_score_pct"])
        detections.append({
            "detection_id": idx + 1,
            "bounding_box": {"x1": b["x1"], "y1": b["y1"], "x2": b["x2"], "y2": b["y2"]},
            "yolo_class": b["yolo_class"],
            "yolo_confidence": b["yolo_conf"],
            **kp
        })

    avg_freshness = round(float(np.mean(freshness_scores)), 1) if freshness_scores else 0.0

    return JSONResponse({
        "scan_id": str(uuid.uuid4()),
        "status": "ok",
        "image_size": {"width": W, "height": H},
        "timing_ms": {
            "yolo": round(t_yolo, 1),
            "keras": round(t_keras, 1),
            "total": round(t_total, 1)
        },
        "detections": detections,
        "summary": {
            "total": len(detections),
            "fresh": fresh_count,
            "semi_fresh": semi_count,
            "rotten": rotten_count,
            "avg_freshness_pct": avg_freshness
        }
    })


@app.get("/api/v1/classes")
async def get_classes():
    """Return all food classes known to the Keras model."""
    return {"classes": foods_list, "count": len(foods_list)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
