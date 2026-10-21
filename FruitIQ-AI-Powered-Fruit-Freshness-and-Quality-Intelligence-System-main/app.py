"""
Food Freshness Detector - Multi-fruit Streamlit app
Modes: Upload image | Camera photo | Live video (webcam)

Each fruit in the picture is found separately, then gets its own
food type, freshness state and estimated shelf life.

Run:  streamlit run app.py
Needs in the same folder:
    food_freshness_model.keras
    food_freshness_meta.json
"""
import json
from functools import lru_cache

import av
import cv2
import numpy as np
import pandas as pd
import streamlit as st
import tensorflow as tf
from PIL import Image
from streamlit_webrtc import RTCConfiguration, VideoProcessorBase, webrtc_streamer

MODEL_PATH = "food_freshness_model.keras"
META_PATH = "food_freshness_meta.json"

# Average shelf life (days) of a FRESH item - rough estimates, EDIT THESE.
AVG_SHELF_LIFE = {
    "apple": 30, "banana": 6, "orange": 21, "mango": 7, "tomato": 7,
    "potato": 60, "carrot": 28, "cucumber": 7, "capsicum": 10, "pepper": 10,
    "grape": 7, "strawberry": 5, "lemon": 21, "pomegranate": 60,
    "guava": 5, "papaya": 5, "pineapple": 5, "watermelon": 10,
    "okra": 5, "bitter": 5, "gourd": 7, "onion": 60,
}
DEFAULT_SHELF_LIFE = 7
ZERO_DAYS_IF_ROTTEN = True
MAX_FRUITS = 12          # safety cap per image

DEFAULT_CFG = {
    "semi_margin": 0.30,   # |P(fresh)-P(rotten)| below this = semi-fresh
    "conf_min": 0.50,      # below this food = "Unknown food"
    "min_area": 0.004,     # min fruit size as fraction of the image
    "bg_sens": 1.00,       # background threshold multiplier
    "split": True,         # split touching fruits
    "hide_unknown": True,  # hide low-confidence regions (likely not fruit)
}
STATE_COLOR = {"FRESH": (0, 200, 0), "SEMI-FRESH": (255, 165, 0),
               "ROTTEN": (220, 0, 0), "UNKNOWN": (150, 150, 150)}

RTC_CFG = RTCConfiguration(
    {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]})


# ------------------------------------------------------------------ MODEL
@lru_cache(maxsize=1)
def load_assets():
    model = tf.keras.models.load_model(MODEL_PATH)
    meta = json.load(open(META_PATH))
    # Two-output model: [food probs, fresh probs]. Input = raw 0-255 RGB
    # (the model contains its own Rescaling layer).
    pred = tf.keras.Model(
        model.input,
        [model.get_layer("food").output, model.get_layer("fresh").output])
    return pred, meta["foods"], int(meta.get("img_size", 160))


def shelf_life_for(food):
    low = food.lower()
    for key, days in AVG_SHELF_LIFE.items():
        if key in low:
            return days
    return DEFAULT_SHELF_LIFE


# ------------------------------------------------------- FRUIT LOCALISATION
def find_regions(rgb, min_area=0.004, bg_sens=1.0, split=True):
    """Find candidate fruit boxes (x1,y1,x2,y2) by separating the objects from
    the background (colour distance from the border colour + watershed).
    Works best on a plain/uniform background."""
    H, W = rgb.shape[:2]
    sc = 640 / max(H, W) if max(H, W) > 640 else 1.0
    small = cv2.resize(rgb, (int(W * sc), int(H * sc))) if sc != 1.0 else rgb.copy()
    sh, sw = small.shape[:2]

    # background colour = median of a thin border strip (in Lab space)
    lab = cv2.cvtColor(small, cv2.COLOR_RGB2LAB).astype(np.float32)
    b = max(3, int(min(sh, sw) * 0.04))
    border = np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3),
                             lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(lab - bg, axis=2)
    d8 = np.clip(dist * 255.0 / max(dist.max(), 1e-6), 0, 255).astype(np.uint8)
    d8 = cv2.GaussianBlur(d8, (5, 5), 0)
    t, _ = cv2.threshold(d8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask = (d8 > t * bg_sens).astype(np.uint8)

    # clean up + fill holes
    k = max(3, int(min(sh, sw) / 80)) | 1
    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kern)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kern)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask = np.zeros_like(mask)
    cv2.drawContours(mask, cnts, -1, 1, thickness=cv2.FILLED)

    n, cc = cv2.connectedComponents(mask)
    min_px = min_area * sh * sw

    if split:
        # one marker per "blob core" (distance-transform peaks) -> watershed
        markers = np.zeros((sh, sw), np.int32)
        kcount = 0
        for i in range(1, n):
            comp = (cc == i).astype(np.uint8)
            if comp.sum() < min_px:
                continue
            dt = cv2.distanceTransform(comp, cv2.DIST_L2, 5)
            fg = (dt > 0.55 * dt.max()).astype(np.uint8)
            m, lab_fg = cv2.connectedComponents(fg)
            for j in range(1, m):
                kcount += 1
                markers[lab_fg == j] = kcount
        if kcount == 0:
            return []
        markers[mask == 0] = kcount + 1
        cv2.watershed(cv2.cvtColor(small, cv2.COLOR_RGB2BGR), markers)
        labels, ids = markers, range(1, kcount + 1)
    else:
        labels, ids = cc, range(1, n)

    boxes = []
    for i in ids:
        m = (labels == i).astype(np.uint8)
        if m.sum() < min_px or m.sum() > 0.92 * sh * sw:
            continue
        x, y, w, h = cv2.boundingRect(m)
        boxes.append((int(x / sc), int(y / sc),
                      int(min(W - 1, (x + w) / sc)), int(min(H - 1, (y + h) / sc))))
    return boxes[:MAX_FRUITS]


def crop_square(rgb, box, S, pad=0.08):
    """Crop box (+padding), pad to a square (no distortion), resize to SxS."""
    H, W = rgb.shape[:2]
    x1, y1, x2, y2 = box
    px, py = int((x2 - x1) * pad), int((y2 - y1) * pad)
    x1, y1 = max(0, x1 - px), max(0, y1 - py)
    x2, y2 = min(W, x2 + px + 1), min(H, y2 + py + 1)
    c = rgb[y1:y2, x1:x2]
    ch, cw = c.shape[:2]
    side = max(ch, cw)
    c = cv2.copyMakeBorder(c, (side - ch) // 2, side - ch - (side - ch) // 2,
                           (side - cw) // 2, side - cw - (side - cw) // 2,
                           cv2.BORDER_REPLICATE)
    return cv2.resize(c, (S, S)).astype("float32")


# ---------------------------------------------------------------- ANALYSIS
def analyze(rgb, semi_margin=0.30, conf_min=0.50, min_area=0.004,
            bg_sens=1.0, split=True, hide_unknown=True):
    """Returns a list of dicts, one per detected fruit."""
    pred, foods, S = load_assets()
    H, W = rgb.shape[:2]

    boxes = find_regions(rgb, min_area, bg_sens, split)
    if not boxes:                                   # fallback: whole image
        boxes = [(0, 0, W - 1, H - 1)]

    batch = np.stack([crop_square(rgb, b, S) for b in boxes])
    p_food, p_fresh = pred(batch, training=False)
    p_food, p_fresh = p_food.numpy(), p_fresh.numpy()

    results = []
    for box, pf, pfr in zip(boxes, p_food, p_fresh):
        ci = int(np.argmax(pf))
        conf = float(pf[ci])
        p_rot, p_fr = float(pfr[0]), float(pfr[1])      # [rotten, fresh]
        known = conf >= conf_min
        if not known and hide_unknown:
            continue
        food = foods[ci] if known else "Unknown food"

        if not known:
            state = "UNKNOWN"
        elif abs(p_fr - p_rot) < semi_margin:
            state = "SEMI-FRESH"
        else:
            state = "FRESH" if p_fr > p_rot else "ROTTEN"

        avg_life = days = None
        if known:
            avg_life = shelf_life_for(food)
            days = 0 if (state == "ROTTEN" and ZERO_DAYS_IF_ROTTEN) \
                else int(round(avg_life * p_fr))

        results.append({"food": food, "food_conf": conf, "state": state,
                        "p_fresh": p_fr, "p_rotten": p_rot,
                        "avg_life": avg_life, "days": days, "box": box})

    # number fruits left-to-right, top-to-bottom
    results.sort(key=lambda r: (r["box"][1] // max(1, H // 4), r["box"][0]))
    for i, r in enumerate(results, 1):
        r["id"] = i
    return results


def draw(rgb, results):
    """Colour-coded box + label for every fruit."""
    img = rgb.copy()
    H, W = img.shape[:2]
    scale = max(0.45, W / 1100)
    thick = 2 if scale >= 0.8 else 1
    for r in results:
        x1, y1, x2, y2 = r["box"]
        col = STATE_COLOR[r["state"]]
        cv2.rectangle(img, (x1, y1), (x2, y2), col, max(2, thick + 1))

        life = f"~{r['days']}d left" if r["days"] is not None else "n/a"
        lines = [f"#{r['id']} {r['food']} {r['food_conf']*100:.0f}%",
                 f"{r['state']} | {life}"]
        sizes = [cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, scale, thick)[0]
                 for t in lines]
        lh = max(s[1] for s in sizes) + 8
        bw, bh = max(s[0] for s in sizes) + 10, lh * len(lines) + 4
        top = y1 - bh if y1 - bh >= 0 else y1
        left = min(x1, max(0, W - bw))
        cv2.rectangle(img, (left, top), (left + bw, top + bh), (0, 0, 0), -1)
        for i, t in enumerate(lines):
            cv2.putText(img, t, (left + 5, top + lh * (i + 1)),
                        cv2.FONT_HERSHEY_SIMPLEX, scale, col, thick, cv2.LINE_AA)
    return img


# --------------------------------------------------------------------- UI
st.set_page_config(page_title="Food Freshness Detector", page_icon="🍎",
                   layout="wide")
st.title("🍎 Food Freshness Detector")
st.caption("Finds every fruit/vegetable in the picture and estimates each one's "
           "freshness (fresh / semi-fresh / rotten) and shelf life "
           "(avg life x freshness probability - a heuristic).")

with st.sidebar:
    st.header("Settings")
    cfg = {
        "semi_margin": st.slider("Semi-fresh margin", 0.05, 0.60,
                                 DEFAULT_CFG["semi_margin"], 0.05,
                                 help="|P(fresh) - P(rotten)| below this = semi-fresh"),
        "conf_min": st.slider("Min food confidence", 0.10, 0.95,
                              DEFAULT_CFG["conf_min"], 0.05,
                              help="Below this the region is 'Unknown food'"),
        "min_area": st.slider("Min fruit size (% of image)", 0.1, 5.0,
                              DEFAULT_CFG["min_area"] * 100, 0.1,
                              help="Ignore detected blobs smaller than this") / 100,
        "bg_sens": st.slider("Background sensitivity", 0.5, 1.5,
                             DEFAULT_CFG["bg_sens"], 0.05,
                             help="Higher = stricter separation from the "
                                  "background (fewer false regions)"),
        "split": st.checkbox("Split touching fruits", DEFAULT_CFG["split"]),
        "hide_unknown": st.checkbox("Hide unrecognised regions",
                                    DEFAULT_CFG["hide_unknown"]),
    }
    with st.expander("Average shelf life (days)"):
        st.json(AVG_SHELF_LIFE)

try:
    load_assets()
except Exception as e:
    st.error(f"Could not load model files: {e}\n\nPut `{MODEL_PATH}` and "
             f"`{META_PATH}` in the same folder as app.py.")
    st.stop()


def show_result(rgb):
    results = analyze(rgb, **cfg)
    c1, c2 = st.columns([3, 2])
    c1.image(draw(rgb, results), use_container_width=True)
    with c2:
        if not results:
            st.warning("No fruit recognised. Try a plainer background, or "
                       "lower 'Min food confidence' / 'Min fruit size'.")
            return
        n_f = sum(r["state"] == "FRESH" for r in results)
        n_s = sum(r["state"] == "SEMI-FRESH" for r in results)
        n_r = sum(r["state"] == "ROTTEN" for r in results)
        st.subheader(f"{len(results)} item(s) found")
        st.markdown(f"🟢 {n_f} fresh  |  🟡 {n_s} semi-fresh  |  🔴 {n_r} rotten")

        icon = {"FRESH": "🟢", "SEMI-FRESH": "🟡", "ROTTEN": "🔴", "UNKNOWN": "⚪"}
        rows = [{"#": r["id"], "Food": r["food"],
                 "Food conf %": round(r["food_conf"] * 100, 1),
                 "State": f"{icon[r['state']]} {r['state']}",
                 "Fresh %": round(r["p_fresh"] * 100, 1),
                 "Shelf life (days)": r["days"] if r["days"] is not None else "n/a"}
                for r in results]
        st.dataframe(pd.DataFrame(rows), hide_index=True, use_container_width=True)

    # per-fruit crops
    with st.expander("Individual fruit crops", expanded=False):
        cols = st.columns(min(4, len(results)))
        for i, r in enumerate(results):
            x1, y1, x2, y2 = r["box"]
            with cols[i % len(cols)]:
                st.image(rgb[y1:y2 + 1, x1:x2 + 1],
                         caption=f"#{r['id']} {r['food']} - {r['state']}",
                         use_container_width=True)


mode = st.radio("Input", ["Upload image", "Camera photo", "Live video"],
                horizontal=True)

if mode == "Upload image":
    up = st.file_uploader("Upload a fruit/vegetable photo",
                          type=["jpg", "jpeg", "png", "webp"])
    if up:
        show_result(np.array(Image.open(up).convert("RGB")))

elif mode == "Camera photo":
    shot = st.camera_input("Take a photo")
    if shot:
        show_result(np.array(Image.open(shot).convert("RGB")))

else:
    class Processor(VideoProcessorBase):
        def __init__(self):
            self.cfg = dict(DEFAULT_CFG)
            self.n = 0
            self.last = []

        def recv(self, frame):
            rgb = frame.to_ndarray(format="rgb24")
            self.n += 1
            if self.n % 5 == 1:                    # analyse every 5th frame
                self.last = analyze(rgb, **self.cfg)
            return av.VideoFrame.from_ndarray(draw(rgb, self.last), format="rgb24")

    ctx = webrtc_streamer(
        key="live", video_processor_factory=Processor,
        rtc_configuration=RTC_CFG,
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True)
    if ctx.video_processor:
        ctx.video_processor.cfg = cfg
    st.caption("Click START and allow camera access. Place several fruits in "
               "view against a plain background, with a little space between them.")