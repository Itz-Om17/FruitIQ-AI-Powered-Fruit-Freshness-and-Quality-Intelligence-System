"""
Two-Stage Fruit Intelligence Engine:
Stage 1: YOLO11 Object Detection & Bulk Localization
Stage 2: Keras Multi-Head Freshness, Fruit Classification & Shelf-Life Inference
"""

import os
import time
import json
import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO
import tensorflow as tf

# ==============================================================================
# PATH CONFIGURATION
# ==============================================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "Models")

YOLO_MODELS = {
    "YOLO11 (Recommended - High Accuracy)": os.path.join(MODELS_DIR, "Yolo11.pt"),
    "YOLO26 (Alternative)": os.path.join(MODELS_DIR, "Yolo26.pt")
}

KERAS_FRESHNESS_MODEL_PATH = os.path.join(MODELS_DIR, "food_freshness_model.keras")
KERAS_FRESHNESS_META_PATH = os.path.join(MODELS_DIR, "food_freshness_meta.json")
KERAS_QUALITY_MODEL_PATH = os.path.join(MODELS_DIR, "fruit_classifier.keras")

# ==============================================================================
# SHELF LIFE & FRESHNESS CONFIGURATION
# ==============================================================================

# Average shelf life (days) of fresh fruits/vegetables at room temperature
AVG_SHELF_LIFE = {
    "apple": 30,
    "banana": 6,
    "orange": 21,
    "mango": 7,
    "tomato": 7,
    "potato": 60,
    "carrot": 28,
    "cucumber": 7,
    "capsicum": 10,
    "pepper": 10,
    "grape": 7,
    "strawberry": 5,
    "lemon": 21,
    "pomegranate": 60,
    "guava": 5,
    "papaya": 5,
    "pineapple": 5,
    "watermelon": 10,
    "okra": 5,
    "onion": 60
}
DEFAULT_SHELF_LIFE = 7

# Color palette for Fruit Classes
FRUIT_COLORS = {
    "apple": {"hex": "#EF4444", "rgb": (239, 68, 68), "bgr": (68, 68, 239), "emoji": "🍎", "name": "Apple"},
    "mango": {"hex": "#F59E0B", "rgb": (245, 158, 11), "bgr": (11, 158, 245), "emoji": "🥭", "name": "Mango"},
    "banana": {"hex": "#EAB308", "rgb": (234, 179, 8), "bgr": (8, 179, 234), "emoji": "🍌", "name": "Banana"},
    "orange": {"hex": "#F97316", "rgb": (249, 115, 22), "bgr": (22, 115, 249), "emoji": "🍊", "name": "Orange"}
}
DEFAULT_FRUIT_COLOR = {"hex": "#10B981", "rgb": (16, 185, 129), "bgr": (129, 185, 16), "emoji": "🍇", "name": "Fruit"}

# Color palette for Freshness Tiers
FRESHNESS_COLORS = {
    "FRESH": {"hex": "#22C55E", "rgb": (34, 197, 94), "bgr": (94, 197, 34), "badge": "Fresh 🟢"},
    "SEMI-FRESH": {"hex": "#F59E0B", "rgb": (245, 158, 11), "bgr": (11, 158, 245), "badge": "Semi-Fresh 🟡"},
    "ROTTEN": {"hex": "#EF4444", "rgb": (239, 68, 68), "bgr": (68, 68, 239), "badge": "Spoiled / Rotten 🔴"}
}


def get_fruit_info(fruit_name: str):
    name_lower = fruit_name.lower().strip()
    return FRUIT_COLORS.get(name_lower, DEFAULT_FRUIT_COLOR)


# ==============================================================================
# MODEL LOADERS
# ==============================================================================

def load_yolo(model_path: str):
    return YOLO(model_path)


def load_freshness_model(model_path: str = KERAS_FRESHNESS_MODEL_PATH, meta_path: str = KERAS_FRESHNESS_META_PATH):
    """
    Loads the Keras Food Freshness & Intelligence Model.
    Returns: (sub_model, class_list, input_size)
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Keras freshness model not found at {model_path}")

    model = tf.keras.models.load_model(model_path)

    foods = []
    img_size = 160
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            meta = json.load(f)
            foods = meta.get("foods", [])
            img_size = int(meta.get("img_size", 160))

    # Dual-output extraction: [food_probs, fresh_probs]
    pred_model = tf.keras.Model(
        model.input,
        [model.get_layer("food").output, model.get_layer("fresh").output]
    )
    return pred_model, foods, img_size


def load_quality_model(model_path: str = KERAS_QUALITY_MODEL_PATH):
    """Loads optional multi-head quality classifier (organic, shiny, darkspots)."""
    if os.path.exists(model_path):
        try:
            return tf.keras.models.load_model(model_path)
        except Exception:
            return None
    return None


# ==============================================================================
# STAGE 2: CROP PREPROCESSING & ANALYSIS
# ==============================================================================

def crop_and_pad_square(image_rgb: np.ndarray, box: list, target_size: int = 160, pad_ratio: float = 0.08):
    """
    Crops the fruit from the bounding box with padding, expands to square without distortion,
    and resizes to target_size. Returns (crop_rgb, crop_tensor).
    """
    h_img, w_img = image_rgb.shape[:2]
    x1, y1, x2, y2 = box

    px = int((x2 - x1) * pad_ratio)
    py = int((y2 - y1) * pad_ratio)
    x1_pad = max(0, x1 - px)
    y1_pad = max(0, y1 - py)
    x2_pad = min(w_img, x2 + px + 1)
    y2_pad = min(h_img, y2 + py + 1)

    crop = image_rgb[y1_pad:y2_pad, x1_pad:x2_pad]
    ch, cw = crop.shape[:2]
    side = max(ch, cw)

    # Pad to square using border replicate
    top_pad = (side - ch) // 2
    bottom_pad = side - ch - top_pad
    left_pad = (side - cw) // 2
    right_pad = side - cw - left_pad

    crop_sq = cv2.copyMakeBorder(
        crop, top_pad, bottom_pad, left_pad, right_pad, cv2.BORDER_REPLICATE
    )
    crop_resized = cv2.resize(crop_sq, (target_size, target_size))
    crop_tensor = np.expand_dims(crop_resized.astype("float32"), axis=0)

    return crop_resized, crop_tensor


def clean_food_name(raw_name: str) -> str:
    """Cleans names like 'freshbanana' -> 'Banana', 'rottenapple' -> 'Apple'."""
    raw = raw_name.lower().strip()
    if raw.startswith("fresh"):
        cleaned = raw[5:]
    elif raw.startswith("rotten"):
        cleaned = raw[6:]
    else:
        cleaned = raw

    name_map = {
        "apple": "Apple",
        "banana": "Banana",
        "mango": "Mango",
        "orange": "Orange",
        "tomato": "Tomato",
        "carrot": "Carrot",
        "cucumber": "Cucumber",
        "bellpepper": "Bell Pepper",
        "capsicum": "Capsicum",
        "capciscum": "Capsicum",
        "strawberry": "Strawberry",
        "potato": "Potato",
        "okra": "Okra",
        "okara": "Okra",
        "bittergroud": "Bitter Gourd"
    }
    return name_map.get(cleaned, cleaned.capitalize())


def estimate_shelf_life(fruit_type: str, p_fresh: float, state: str) -> int:
    """Calculates estimated remaining shelf life in days."""
    if state == "ROTTEN":
        return 0
    fruit_key = fruit_type.lower().strip()
    base_days = DEFAULT_SHELF_LIFE
    for k, d in AVG_SHELF_LIFE.items():
        if k in fruit_key:
            base_days = d
            break
    days_left = int(round(base_days * p_fresh))
    return max(0, days_left)


def analyze_single_fruit(
    crop_rgb: np.ndarray,
    freshness_model,
    foods: list,
    img_size: int,
    yolo_class: str,
    semi_margin: float = 0.30,
    quality_model=None
):
    """
    Stage 2 Inference: Takes a single fruit crop and runs the Keras model(s).
    """
    _, tensor_160 = crop_and_pad_square(crop_rgb, [0, 0, crop_rgb.shape[1], crop_rgb.shape[0]], target_size=img_size)

    # 1. Keras Freshness & Food Classification
    p_food, p_fresh = freshness_model(tensor_160, training=False)
    p_food_np = p_food.numpy()[0]
    p_fresh_np = p_fresh.numpy()[0]  # [p_rotten, p_fresh]

    best_food_idx = int(np.argmax(p_food_np))
    food_conf = float(p_food_np[best_food_idx])
    raw_food = foods[best_food_idx] if best_food_idx < len(foods) else "unknown"
    keras_fruit_name = clean_food_name(raw_food)

    p_rot = float(p_fresh_np[0])
    p_fr = float(p_fresh_np[1])
    freshness_score = float(p_fr * 100.0)

    # Freshness state classification
    if abs(p_fr - p_rot) < semi_margin:
        state = "SEMI-FRESH"
    elif p_fr > p_rot:
        state = "FRESH"
    else:
        state = "ROTTEN"

    # Shelf life calculation
    shelf_life_days = estimate_shelf_life(yolo_class or keras_fruit_name, p_fr, state)

    # 2. Optional Surface Quality Grading (MobileNetV2 multi-head)
    quality_data = None
    if quality_model is not None:
        try:
            crop_224 = cv2.resize(crop_rgb, (224, 224)).astype(np.float32) / 255.0
            t_224 = np.expand_dims(crop_224, axis=0)
            q_preds = quality_model(t_224, training=False)

            is_organic = float(q_preds["is_organic"].numpy()[0][0]) > 0.5
            qg_probs = q_preds["quality_grade"].numpy()[0]
            grade_map = {0: "Bad", 1: "Medium", 2: "Good"}
            grade = grade_map[int(np.argmax(qg_probs))]
            is_shiny = float(q_preds["shininess"].numpy()[0][0]) > 0.5
            has_darkspots = float(q_preds["darkspots"].numpy()[0][0]) > 0.5

            quality_data = {
                "quality_grade": grade,
                "is_organic": "Organic" if is_organic else "Standard",
                "is_shiny": is_shiny,
                "has_darkspots": has_darkspots
            }
        except Exception:
            pass

    return {
        "keras_fruit_name": keras_fruit_name,
        "keras_confidence": food_conf,
        "freshness_score": freshness_score,
        "freshness_state": state,
        "p_fresh": p_fr,
        "p_rotten": p_rot,
        "shelf_life_days": shelf_life_days,
        "quality_data": quality_data
    }


# ==============================================================================
# ANNOTATION & DRAWING
# ==============================================================================

def annotate_image_two_stage(
    image_rgb: np.ndarray,
    detections: list,
    box_thickness: int = 3,
    color_mode: str = "freshness",  # "freshness" or "fruit_class"
    show_labels: bool = True,
    show_shelf_life: bool = True
) -> np.ndarray:
    """
    Draws borders, fruit names, freshness badges, and shelf-life tags on the image.
    """
    img_draw = image_rgb.copy()
    h_img, w_img = img_draw.shape[:2]
    font_scale = max(0.42, min(w_img, h_img) / 1050.0)
    font_thick = max(1, int(box_thickness / 2))

    for det in detections:
        box = det["box"]
        x1, y1, x2, y2 = box
        yolo_fruit = det["fruit"]
        keras_fruit = det.get("keras_fruit_name", yolo_fruit)
        state = det.get("freshness_state", "FRESH")
        f_score = det.get("freshness_score", 95.0)
        days = det.get("shelf_life_days", 5)

        # Color selection
        if color_mode == "freshness":
            color = FRESHNESS_COLORS.get(state, FRESHNESS_COLORS["FRESH"])["rgb"]
        else:
            color = get_fruit_info(yolo_fruit)["rgb"]

        # 1. Subtle outline for high contrast
        cv2.rectangle(img_draw, (x1 - 1, y1 - 1), (x2 + 1, y2 + 1), (0, 0, 0), box_thickness + 2)
        cv2.rectangle(img_draw, (x1, y1), (x2, y2), color, box_thickness)

        # 2. Corner brackets
        corner_len = max(8, int(min(x2 - x1, y2 - y1) * 0.16))
        for (cx, cy, dx, dy) in [
            (x1, y1, corner_len, 0), (x1, y1, 0, corner_len),
            (x2, y1, -corner_len, 0), (x2, y1, 0, corner_len),
            (x1, y2, corner_len, 0), (x1, y2, 0, -corner_len),
            (x2, y2, -corner_len, 0), (x2, y2, 0, -corner_len)
        ]:
            cv2.line(img_draw, (cx, cy), (cx + dx, cy + dy), color, box_thickness + 2)

        # 3. Text Badges
        if show_labels:
            fruit_info = get_fruit_info(yolo_fruit)
            line1 = f"#{det['id']} {fruit_info['name']} • {state} ({f_score:.0f}%)"
            line2 = f"⏱ ~{days}d shelf life" if show_shelf_life and days is not None else ""

            # Measure text size
            (w1, h1), b1 = cv2.getTextSize(line1, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)
            w2, h2 = (0, 0)
            if line2:
                (w2, h2), _ = cv2.getTextSize(line2, cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.88, max(1, font_thick - 1))

            badge_w = max(w1, w2) + 14
            badge_h = h1 + (h2 + 8 if line2 else 0) + 10

            badge_y2 = y1 if y1 - badge_h >= 0 else y1 + badge_h
            badge_y1 = badge_y2 - badge_h
            badge_x1 = max(0, x1)
            badge_x2 = min(w_img, badge_x1 + badge_w)

            # Badge background
            cv2.rectangle(img_draw, (badge_x1, badge_y1), (badge_x2, badge_y2), (15, 23, 42), -1)
            cv2.rectangle(img_draw, (badge_x1, badge_y1), (badge_x2, badge_y2), color, 2)

            # Draw line 1
            cv2.putText(
                img_draw, line1, (badge_x1 + 6, badge_y1 + h1 + 4),
                cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), font_thick, cv2.LINE_AA
            )
            # Draw line 2 (shelf life)
            if line2:
                cv2.putText(
                    img_draw, line2, (badge_x1 + 6, badge_y1 + h1 + h2 + 8),
                    cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.88, color, max(1, font_thick - 1), cv2.LINE_AA
                )

    return img_draw


# ==============================================================================
# MAIN TWO-STAGE PIPELINE RUNNER
# ==============================================================================

def run_two_stage_detection(
    yolo_model: YOLO,
    freshness_model,
    foods: list,
    img_size_keras: int,
    image_input,
    conf_threshold: float = 0.35,
    iou_threshold: float = 0.45,
    img_size_yolo: int = 640,
    box_thickness: int = 3,
    color_mode: str = "freshness",
    show_labels: bool = True,
    show_shelf_life: bool = True,
    semi_margin: float = 0.30,
    quality_model=None
):
    """
    Executes the full two-stage pipeline:
    1. YOLO11 localizes each fruit in the bulk image.
    2. Keras model inspects each fruit crop for freshness, name, and shelf life.
    """
    t_start = time.perf_counter()

    # Preprocess image input
    if isinstance(image_input, Image.Image):
        pil_img = image_input.convert("RGB")
        img_rgb = np.array(pil_img)
        yolo_input = pil_img
    elif isinstance(image_input, np.ndarray):
        if len(image_input.shape) == 3 and image_input.shape[2] == 3:
            img_rgb = cv2.cvtColor(image_input, cv2.COLOR_BGR2RGB)
            yolo_input = image_input
        else:
            img_rgb = image_input
            yolo_input = image_input
    elif isinstance(image_input, str):
        pil_img = Image.open(image_input).convert("RGB")
        img_rgb = np.array(pil_img)
        yolo_input = pil_img
    else:
        raise TypeError("Unsupported image input type")

    # STAGE 1: YOLO Detection
    yolo_results = yolo_model(
        yolo_input,
        conf=conf_threshold,
        iou=iou_threshold,
        imgsz=img_size_yolo,
        verbose=False
    )
    yolo_res = yolo_results[0]
    t_yolo = (time.perf_counter() - t_start) * 1000.0

    detections = []
    counts = {"apple": 0, "mango": 0, "banana": 0, "orange": 0, "total": 0}
    freshness_stats = {"FRESH": 0, "SEMI-FRESH": 0, "ROTTEN": 0}
    freshness_scores = []

    # STAGE 2: Keras Inspection for each detected fruit
    if yolo_res.boxes is not None and len(yolo_res.boxes) > 0:
        for idx, box in enumerate(yolo_res.boxes):
            cls_id = int(box.cls[0].item())
            raw_yolo_name = yolo_model.names.get(cls_id, f"class_{cls_id}").lower()
            conf = float(box.conf[0].item())
            xyxy = box.xyxy[0].cpu().numpy().astype(int)
            x1, y1, x2, y2 = xyxy.tolist()

            # Ensure valid bounds
            h_img, w_img = img_rgb.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w_img, x2), min(h_img, y2)

            if (x2 - x1) < 10 or (y2 - y1) < 10:
                continue

            # Extract single fruit crop
            crop_rgb = img_rgb[y1:y2, x1:x2]

            # Run Keras Freshness & Food Identification
            crop_analysis = analyze_single_fruit(
                crop_rgb=crop_rgb,
                freshness_model=freshness_model,
                foods=foods,
                img_size=img_size_keras,
                yolo_class=raw_yolo_name,
                semi_margin=semi_margin,
                quality_model=quality_model
            )

            # Store detection record
            det_record = {
                "id": idx + 1,
                "fruit": raw_yolo_name,
                "confidence": conf,
                "box": [x1, y1, x2, y2],
                "width": x2 - x1,
                "height": y2 - y1,
                "area": (x2 - x1) * (y2 - y1),
                "crop_rgb": crop_rgb,
                **crop_analysis
            }
            detections.append(det_record)

            # Aggregate statistics
            if raw_yolo_name in counts:
                counts[raw_yolo_name] += 1
            else:
                counts[raw_yolo_name] = 1
            counts["total"] += 1

            st_state = crop_analysis["freshness_state"]
            freshness_stats[st_state] = freshness_stats.get(st_state, 0) + 1
            freshness_scores.append(crop_analysis["freshness_score"])

    # Draw Two-Stage Annotated Image
    annotated = annotate_image_two_stage(
        img_rgb,
        detections,
        box_thickness=box_thickness,
        color_mode=color_mode,
        show_labels=show_labels,
        show_shelf_life=show_shelf_life
    )

    t_total = (time.perf_counter() - t_start) * 1000.0
    avg_freshness = float(np.mean(freshness_scores)) if freshness_scores else 0.0

    return {
        "original_image": img_rgb,
        "annotated_image": annotated,
        "counts": counts,
        "freshness_stats": freshness_stats,
        "avg_freshness": avg_freshness,
        "detections": detections,
        "inference_time_ms": t_total,
        "yolo_time_ms": t_yolo,
        "raw_yolo_res": yolo_res
    }
