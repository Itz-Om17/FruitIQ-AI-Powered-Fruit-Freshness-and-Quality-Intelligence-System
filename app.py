"""
🍎 FruitVision AI • Multi-Fruit Detection, Freshness Grading & Shelf-Life Intelligence
Two-Stage Architecture:
  Stage 1: YOLO11 Object Detection & Bulk Fruit Localization
  Stage 2: Keras Multi-Head Intelligence for Single-Fruit Freshness & Shelf-Life Estimation
"""

import os
import io
import time
import tempfile
import cv2
import torch
import numpy as np
import pandas as pd
import tensorflow as tf
from PIL import Image
import streamlit as st

from detector import (
    YOLO_MODELS,
    FRUIT_COLORS,
    FRESHNESS_COLORS,
    KERAS_FRESHNESS_MODEL_PATH,
    KERAS_FRESHNESS_META_PATH,
    KERAS_QUALITY_MODEL_PATH,
    load_yolo,
    load_freshness_model,
    load_quality_model,
    run_two_stage_detection,
    get_fruit_info
)

# ==============================================================================
# 1. PAGE CONFIGURATION & THEME STYLING
# ==============================================================================

st.set_page_config(
    page_title="FruitVision AI • Two-Stage Fruit Detection & Freshness Grader",
    page_icon="🍎",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for modern dark-mode aesthetic with vibrant fruit & freshness accents
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', sans-serif;
    }

    .block-container {
        padding-top: 1.6rem;
        padding-bottom: 2.5rem;
    }

    /* Hero Banner */
    .hero-container {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.08) 50%, rgba(245, 158, 11, 0.08) 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 22px 28px;
        margin-bottom: 22px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    }
    .hero-title {
        font-size: 2.1rem;
        font-weight: 800;
        background: linear-gradient(90deg, #10B981 0%, #38BDF8 40%, #F59E0B 80%, #EF4444 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .hero-subtitle {
        font-size: 0.95rem;
        color: #94A3B8;
        margin-bottom: 12px;
        line-height: 1.45;
    }

    /* Pipeline Step Badges */
    .pipeline-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.78rem;
        font-weight: 700;
        margin-right: 8px;
        margin-bottom: 4px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #E2E8F0;
    }
    .pipeline-badge.stage1 {
        border-left: 3px solid #38BDF8;
        background: rgba(56, 189, 248, 0.08);
    }
    .pipeline-badge.stage2 {
        border-left: 3px solid #10B981;
        background: rgba(16, 185, 129, 0.08);
    }

    /* Metric KPI Grid */
    .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
    }
    .metric-card {
        background: rgba(22, 27, 34, 0.7);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 14px 10px;
        text-align: center;
        transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .metric-card:hover {
        transform: translateY(-2px);
    }
    .metric-card.total {
        border-left: 4px solid #3B82F6;
        box-shadow: 0 4px 14px rgba(59, 130, 246, 0.15);
    }
    .metric-card.fresh {
        border-left: 4px solid #22C55E;
        box-shadow: 0 4px 14px rgba(34, 197, 94, 0.15);
    }
    .metric-card.semi {
        border-left: 4px solid #F59E0B;
        box-shadow: 0 4px 14px rgba(245, 158, 11, 0.15);
    }
    .metric-card.rotten {
        border-left: 4px solid #EF4444;
        box-shadow: 0 4px 14px rgba(239, 68, 68, 0.15);
    }
    .metric-card.score {
        border-left: 4px solid #8B5CF6;
        box-shadow: 0 4px 14px rgba(139, 92, 246, 0.15);
    }
    .metric-value {
        font-size: 1.7rem;
        font-weight: 800;
        color: #FFFFFF;
        line-height: 1.1;
    }
    .metric-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #94A3B8;
        margin-top: 4px;
    }

    /* Fruit Crop Inspection Card */
    .fruit-crop-card {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 12px;
    }

    /* Freshness Status Pills */
    .badge-fresh {
        background: rgba(34, 197, 94, 0.2);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.4);
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.75rem;
    }
    .badge-semi {
        background: rgba(245, 158, 11, 0.2);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.4);
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.75rem;
    }
    .badge-rotten {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.4);
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.75rem;
    }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# 2. MODEL CACHING & INITIALIZATION
# ==============================================================================

@st.cache_resource(show_spinner="Loading YOLO Object Detector...")
def get_cached_yolo(model_path: str):
    return load_yolo(model_path)


@st.cache_resource(show_spinner="Loading Keras Fruit Freshness & Intelligence Model...")
def get_cached_freshness_model():
    return load_freshness_model(KERAS_FRESHNESS_MODEL_PATH, KERAS_FRESHNESS_META_PATH)


@st.cache_resource(show_spinner="Loading Surface Quality Model...")
def get_cached_quality_model():
    return load_quality_model(KERAS_QUALITY_MODEL_PATH)


# ==============================================================================
# 3. SIDEBAR CONTROLS & SETTINGS
# ==============================================================================

with st.sidebar:
    st.markdown("### ⚙️ Pipeline Configuration")

    # 1. Stage 1 YOLO Model Selector
    st.markdown("#### 🎯 Stage 1: Bulk Detection Model")
    yolo_choice = st.selectbox(
        "YOLO Model (Fruit Localization)",
        options=list(YOLO_MODELS.keys()),
        index=0,
        help="Locates single fruits inside bulk piles/shelves."
    )
    current_yolo_path = YOLO_MODELS[yolo_choice]

    st.markdown(f"""
    <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid #38BDF8; border-radius: 8px; padding: 7px 10px; margin-bottom: 12px;">
        <span style="color: #38BDF8; font-weight: 700; font-size: 0.8rem;">● YOLO Stage 1:</span>
        <span style="color: #E2E8F0; font-size: 0.78rem;"> {os.path.basename(current_yolo_path)}</span>
    </div>
    """, unsafe_allow_html=True)

    # 2. Stage 2 Keras Model Indicator
    st.markdown("#### 🔬 Stage 2: Keras Freshness & Intelligence")
    st.markdown(f"""
    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10B981; border-radius: 8px; padding: 7px 10px; margin-bottom: 12px;">
        <span style="color: #10B981; font-weight: 700; font-size: 0.8rem;">● Keras Stage 2:</span>
        <span style="color: #E2E8F0; font-size: 0.78rem;"> {os.path.basename(KERAS_FRESHNESS_MODEL_PATH)}</span><br>
        <span style="color: #94A3B8; font-size: 0.72rem;">26 Food Classes • Freshness & Shelf Life</span>
    </div>
    """, unsafe_allow_html=True)

    # 3. Freshness & Detection Parameters
    st.markdown("#### 🎚️ Detection & Freshness Parameters")
    conf_thresh = st.slider("YOLO Confidence", min_value=0.10, max_value=0.95, value=0.35, step=0.05)
    iou_thresh = st.slider("NMS IoU Threshold", min_value=0.10, max_value=0.95, value=0.45, step=0.05)
    semi_margin = st.slider("Semi-Fresh Margin", min_value=0.10, max_value=0.60, value=0.30, step=0.05,
                            help="|P(fresh) - P(rotten)| below this margin is classified as Semi-Fresh.")

    # 4. Visualization Settings
    st.markdown("#### 🎨 Bounding Box Styling")
    color_mode = st.radio(
        "Box Border Color Mode:",
        options=["Freshness Status (Green/Amber/Red)", "Fruit Type (Red/Gold/Yellow/Orange)"],
        index=0
    )
    color_mode_key = "freshness" if "Freshness" in color_mode else "fruit_class"
    box_thickness = st.slider("Border Thickness", min_value=1, max_value=6, value=3)
    show_labels = st.checkbox("Show Name & Freshness Score", value=True)
    show_shelf_life = st.checkbox("Show Shelf Life Tag (~Days Left)", value=True)

    st.divider()

    # Hardware Info
    cuda_available = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if cuda_available else "CPU"
    st.markdown(f"""
    <div style="font-size: 0.75rem; color: #718096;">
        <b>Acceleration:</b> {'⚡ GPU (' + device_name + ')' if cuda_available else '💻 ' + device_name}<br>
        <b>TensorFlow:</b> {tf.__version__}<br>
        <b>PyTorch:</b> {torch.__version__}
    </div>
    """, unsafe_allow_html=True)


# Load models
try:
    with st.spinner("Initializing YOLO & Keras Intelligence Engines..."):
        yolo_model = get_cached_yolo(current_yolo_path)
        freshness_model, foods_meta, keras_img_size = get_cached_freshness_model()
        quality_model = get_cached_quality_model()
except Exception as e:
    st.error(f"Error loading models: {e}")
    st.stop()


# ==============================================================================
# 4. HERO BANNER
# ==============================================================================

st.markdown("""
<div class="hero-container">
    <div class="hero-title">
        <span>🍎 FruitVision AI</span>
    </div>
    <p class="hero-subtitle">
        <b>Two-Stage Fruit Intelligence Engine:</b> YOLO11 detects and isolates every individual fruit in bulk piles or streams,
        and the Keras Deep Intelligence Model grades each fruit's <b>freshness score (0–100%)</b>, <b>freshness tier (Fresh/Semi/Rotten)</b>,
        <b>verified food category</b>, and <b>estimated shelf life</b>.
    </p>
    <div>
        <span class="pipeline-badge stage1">🎯 Stage 1: YOLO11 Fruit Localization</span>
        <span class="pipeline-badge stage2">🔬 Stage 2: Keras Freshness & Quality Intelligence</span>
        <span class="pipeline-badge stage2">⏱ Remaining Shelf Life Estimation</span>
    </div>
</div>
""", unsafe_allow_html=True)


# ==============================================================================
# 5. NAVIGATION TABS
# ==============================================================================

tab_images, tab_camera, tab_video, tab_arch = st.tabs([
    "📸 Bulk Image Analysis & Freshness",
    "📹 Live Camera & Dashcam Feed",
    "🎬 Video File Processing",
    "📊 Two-Stage Architecture & Insights"
])


# ==============================================================================
# TAB 1: BULK IMAGE ANALYSIS & FRESHNESS
# ==============================================================================
with tab_images:
    st.markdown("### 📥 Bulk Fruit Detection & Freshness Grading")
    st.markdown(
        "Upload images containing bulk fruits (baskets, crates, shelves, or piles), "
        "or select a pre-loaded bulk sample to run the complete two-stage detection and freshness analysis."
    )

    sample_images = {
        "— Select a Bulk Sample Image —": None,
        "🍊 Bulk Fresh Oranges (18 Oranges) [from FruitIQ]": "FruitIQ-AI-Powered-Fruit-Freshness-and-Quality-Intelligence-System-main/bulk fresh_orange image.jpg",
        "🍌 Banana Cluster (7 Bananas in Bunch)": "Data/Final_data/test/images/banana-176.jpg",
        "🥭 Mango Harvest (10 Mangos in Pile)": "Data/Final_data/test/images/mango-173.jpg",
        "🍎 Apple Basket (5 Apples)": "Data/Final_data/test/images/apple-162.jpg",
        "🥗 Mixed Fruit Plate (Apple + Banana + Orange)": "Data/Final_data/test/images/mixed-38.jpg",
        "🥗 Mixed Fruit Plate (Apple + Mango)": "Data/Final_data/test/images/mixed-39.jpg",
        "🍊 Oranges in Hand": "Data/Collected_Data/R.jpg"
    }

    col_upload, col_sample = st.columns([3, 2])
    with col_upload:
        uploaded_files = st.file_uploader(
            "Upload Bulk Fruit Images",
            type=["jpg", "jpeg", "png", "webp", "avif"],
            accept_multiple_files=True
        )
    with col_sample:
        selected_sample_label = st.selectbox(
            "🌟 Or Quick-Test with Built-in Bulk Sample",
            options=list(sample_images.keys()),
            index=1  # Default to Bulk Fresh Oranges
        )
        sample_path = sample_images[selected_sample_label]

    images_to_process = []
    if uploaded_files:
        for uf in uploaded_files:
            try:
                pil_img = Image.open(uf).convert("RGB")
                images_to_process.append((uf.name, pil_img))
            except Exception as e:
                st.warning(f"Could not read `{uf.name}`: {e}")
    elif sample_path and os.path.exists(sample_path):
        try:
            pil_img = Image.open(sample_path).convert("RGB")
            images_to_process.append((os.path.basename(sample_path), pil_img))
        except Exception as e:
            st.error(f"Could not read sample image at `{sample_path}`: {e}")

    if images_to_process:
        if len(images_to_process) > 1:
            st.markdown(f"#### 📦 Uploaded Batch ({len(images_to_process)} Images)")
            img_names = [name for name, _ in images_to_process]
            selected_idx = st.selectbox(
                "Select image from batch:",
                options=range(len(img_names)),
                format_func=lambda i: f"#{i+1}: {img_names[i]}"
            )
            active_name, active_image = images_to_process[selected_idx]
        else:
            active_name, active_image = images_to_process[0]

        # Run Two-Stage Pipeline
        with st.spinner(f"Running Two-Stage Analysis on {active_name}..."):
            res = run_two_stage_detection(
                yolo_model=yolo_model,
                freshness_model=freshness_model,
                foods=foods_meta,
                img_size_keras=keras_img_size,
                image_input=active_image,
                conf_threshold=conf_thresh,
                iou_threshold=iou_thresh,
                box_thickness=box_thickness,
                color_mode=color_mode_key,
                show_labels=show_labels,
                show_shelf_life=show_shelf_life,
                semi_margin=semi_margin,
                quality_model=quality_model
            )

        counts = res["counts"]
        fresh_stats = res["freshness_stats"]
        avg_freshness = res["avg_freshness"]
        detections = res["detections"]
        annotated_img = res["annotated_image"]

        # Display Top KPIs
        score_color = "#22C55E" if avg_freshness >= 70 else ("#F59E0B" if avg_freshness >= 45 else "#EF4444")
        st.markdown(f"""
        <div class="metric-grid">
            <div class="metric-card total">
                <div class="metric-value">{counts['total']}</div>
                <div class="metric-label">📦 Total Fruits Found</div>
            </div>
            <div class="metric-card score">
                <div class="metric-value" style="color: {score_color};">{avg_freshness:.1f}%</div>
                <div class="metric-label">✨ Avg Freshness</div>
            </div>
            <div class="metric-card fresh">
                <div class="metric-value">{fresh_stats['FRESH']}</div>
                <div class="metric-label">🟢 Fresh Items</div>
            </div>
            <div class="metric-card semi">
                <div class="metric-value">{fresh_stats['SEMI-FRESH']}</div>
                <div class="metric-label">🟡 Semi-Fresh</div>
            </div>
            <div class="metric-card rotten">
                <div class="metric-value">{fresh_stats['ROTTEN']}</div>
                <div class="metric-label">🔴 Spoiled / Rotten</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        st.caption(
            f"⚡ Total Two-Stage Latency: **{res['inference_time_ms']:.1f} ms** "
            f"(YOLO: {res['yolo_time_ms']:.1f} ms + Keras Batch Inference: {res['inference_time_ms'] - res['yolo_time_ms']:.1f} ms) • "
            f"Resolution: **{active_image.width} × {active_image.height} px**"
        )

        # Annotated Image vs Original Image
        col_img_ann, col_img_orig = st.columns(2)
        with col_img_ann:
            st.markdown(f"**🎯 Two-Stage Detection Output ({counts['total']} fruits isolated & graded)**")
            st.image(annotated_img, caption="Bordered with Freshness Tiers & Shelf Life", use_container_width=True)

            buf = io.BytesIO()
            Image.fromarray(annotated_img).save(buf, format="PNG")
            st.download_button(
                label="📥 Download Annotated Image (PNG)",
                data=buf.getvalue(),
                file_name=f"graded_{active_name}.png",
                mime="image/png",
                use_container_width=True
            )

        with col_img_orig:
            st.markdown("**🖼️ Original Bulk Image**")
            st.image(active_image, caption=active_name, use_container_width=True)

        # Fruit Crops & Detailed Intelligence Gallery
        if detections:
            st.markdown("#### 🔬 Single-Fruit Freshness & Shelf-Life Breakdown")
            st.markdown("Each individual fruit crop detected by YOLO11 analyzed by the Keras intelligence model:")

            with st.expander("🔍 Inspect Each Single Fruit Crop (Thumbnails & Attributes)", expanded=True):
                # Render cards in rows of 3
                cols = st.columns(min(3, len(detections)))
                for idx, det in enumerate(detections):
                    col = cols[idx % len(cols)]
                    with col:
                        badge_cls = "badge-fresh" if det["freshness_state"] == "FRESH" else (
                            "badge-semi" if det["freshness_state"] == "SEMI-FRESH" else "badge-rotten"
                        )
                        st.markdown(f"""
                        <div class="fruit-crop-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <b>Fruit #{det['id']}: {det['keras_fruit_name']}</b>
                                <span class="{badge_cls}">{det['freshness_state']}</span>
                            </div>
                        """, unsafe_allow_html=True)
                        st.image(det["crop_rgb"], width=130)
                        st.progress(min(1.0, det["freshness_score"] / 100.0))
                        st.markdown(f"""
                            <div style="font-size: 0.82rem; color: #CBD5E1;">
                                • <b>Freshness:</b> {det['freshness_score']:.1f}%<br>
                                • <b>Shelf Life:</b> ~{det['shelf_life_days']} days left<br>
                                • <b>YOLO Detected:</b> {det['fruit'].title()} ({det['confidence']*100:.0f}%)<br>
                                • <b>Bounding Box:</b> {det['box']}
                            </div>
                        </div>
                        """, unsafe_allow_html=True)

            # Detailed Table
            st.markdown("#### 📋 Full Detection & Freshness Report")
            df_det = []
            for d in detections:
                df_det.append({
                    "#": d["id"],
                    "Fruit Name": d["keras_fruit_name"],
                    "YOLO Class": d["fruit"].title(),
                    "Freshness State": d["freshness_state"],
                    "Freshness Score": f"{d['freshness_score']:.1f}%",
                    "Est. Shelf Life": f"~{d['shelf_life_days']} days",
                    "P(Fresh)": f"{d['p_fresh']*100:.1f}%",
                    "P(Rotten)": f"{d['p_rotten']*100:.1f}%",
                    "YOLO Conf": f"{d['confidence']*100:.1f}%",
                    "BBox [x1,y1,x2,y2]": str(d["box"])
                })
            df = pd.DataFrame(df_det)
            st.dataframe(df, use_container_width=True, hide_index=True)

            csv_data = df.to_csv(index=False).encode("utf-8")
            st.download_button(
                label="📊 Download Complete Freshness Report (CSV)",
                data=csv_data,
                file_name=f"freshness_report_{active_name}.csv",
                mime="text/csv"
            )
        else:
            st.info("No fruits detected above confidence threshold. Try lowering the YOLO Confidence in the sidebar.")
    else:
        st.info("👆 Upload bulk fruit images or choose a sample image above to start.")


# ==============================================================================
# TAB 2: LIVE CAMERA & DASHCAM STREAM
# ==============================================================================
with tab_camera:
    st.markdown("### 📹 Real-Time Live Camera & Dashcam Feed")
    st.markdown(
        "Run the Two-Stage Detection and Freshness Grading engine live using your **webcam** "
        "or a **live dashcam / IP camera stream** (RTSP/HTTP)."
    )

    cam_mode = st.radio(
        "Camera Mode",
        options=["🎥 Continuous Live Video Stream (Webcam / Dashcam)", "📸 Browser Webcam Snapshot"],
        horizontal=True
    )

    if cam_mode == "🎥 Continuous Live Video Stream (Webcam / Dashcam)":
        c1, c2 = st.columns([2, 1])
        with c1:
            source_type = st.selectbox(
                "Select Video Source",
                options=[
                    "Local Webcam 0 (Default)",
                    "Local Webcam 1 (External Camera)",
                    "Live Dashcam / RTSP / Stream URL",
                    "Included Demo Video (Demo/Fruit-Detection.mp4)"
                ]
            )
            if source_type == "Local Webcam 0 (Default)":
                cam_source = 0
            elif source_type == "Local Webcam 1 (External Camera)":
                cam_source = 1
            elif source_type == "Included Demo Video (Demo/Fruit-Detection.mp4)":
                cam_source = os.path.join("Demo", "Fruit-Detection.mp4")
            else:
                cam_source = st.text_input("Enter Dashcam / RTSP URL:", value="rtsp://192.168.1.100:554/stream")

        with c2:
            st.markdown("#### Stream Controls")
            stream_active = st.toggle("🔴 Activate Live Stream", value=False, key="stream_toggle_2stage")
            max_frames = st.slider("Frame Cap", min_value=100, max_value=2000, value=600, step=50)

        metrics_ph = st.empty()
        feed_ph = st.empty()
        status_ph = st.empty()

        if stream_active:
            status_ph.info(f"Connecting to: `{cam_source}`...")
            cap = cv2.VideoCapture(cam_source)
            if not cap.isOpened():
                status_ph.error(f"Could not open `{cam_source}`.")
            else:
                if isinstance(cam_source, int):
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

                status_ph.success("🟢 Live Feed Active — Analyzing fruits & freshness in real-time.")
                frame_count = 0
                prev_time = time.time()
                fps = 0.0

                try:
                    while stream_active and frame_count < max_frames:
                        ret, frame_bgr = cap.read()
                        if not ret:
                            status_ph.warning("Stream ended or frame could not be read.")
                            break

                        frame_count += 1
                        current_time = time.time()
                        time_diff = current_time - prev_time
                        if time_diff > 0:
                            fps = 0.9 * fps + 0.1 * (1.0 / time_diff) if fps > 0 else 1.0 / time_diff
                        prev_time = current_time

                        # Run Two-Stage Detection
                        res = run_two_stage_detection(
                            yolo_model=yolo_model,
                            freshness_model=freshness_model,
                            foods=foods_meta,
                            img_size_keras=keras_img_size,
                            image_input=frame_bgr,
                            conf_threshold=conf_thresh,
                            iou_threshold=iou_thresh,
                            box_thickness=box_thickness,
                            color_mode=color_mode_key,
                            show_labels=show_labels,
                            show_shelf_life=show_shelf_life,
                            semi_margin=semi_margin
                        )

                        counts = res["counts"]
                        fresh_stats = res["freshness_stats"]
                        annotated = res["annotated_image"]

                        # Overlay HUD
                        hud_text = f"FPS: {fps:.1f} | Fruits: {counts['total']} | Fresh: {fresh_stats['FRESH']} | Semi: {fresh_stats['SEMI-FRESH']} | Rotten: {fresh_stats['ROTTEN']}"
                        cv2.rectangle(annotated, (10, 10), (min(620, annotated.shape[1] - 10), 45), (15, 23, 42), -1)
                        cv2.rectangle(annotated, (10, 10), (min(620, annotated.shape[1] - 10), 45), (34, 197, 94), 1)
                        cv2.putText(annotated, hud_text, (20, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)

                        # Update metrics
                        metrics_ph.markdown(f"""
                        <div class="metric-grid">
                            <div class="metric-card total"><div class="metric-value">{counts['total']}</div><div class="metric-label">📦 Total Fruits</div></div>
                            <div class="metric-card fresh"><div class="metric-value">{fresh_stats['FRESH']}</div><div class="metric-label">🟢 Fresh</div></div>
                            <div class="metric-card semi"><div class="metric-value">{fresh_stats['SEMI-FRESH']}</div><div class="metric-label">🟡 Semi-Fresh</div></div>
                            <div class="metric-card rotten"><div class="metric-value">{fresh_stats['ROTTEN']}</div><div class="metric-label">🔴 Rotten</div></div>
                        </div>
                        """, unsafe_allow_html=True)

                        feed_ph.image(annotated, channels="RGB", caption=f"Live Feed • Frame #{frame_count} • {fps:.1f} FPS", use_container_width=True)
                        time.sleep(0.01)
                finally:
                    cap.release()
                    status_ph.info("⏹️ Camera released.")
        else:
            status_ph.info("Toggle 'Activate Live Stream' above to start.")

    else:
        # Snapshot Mode
        st.markdown("#### 📸 Browser Webcam Snapshot")
        cam_pic = st.camera_input("Capture Fruit Image")
        if cam_pic:
            pil_img = Image.open(cam_pic).convert("RGB")
            with st.spinner("Analyzing snapshot..."):
                res = run_two_stage_detection(
                    yolo_model=yolo_model,
                    freshness_model=freshness_model,
                    foods=foods_meta,
                    img_size_keras=keras_img_size,
                    image_input=pil_img,
                    conf_threshold=conf_thresh,
                    iou_threshold=iou_thresh,
                    box_thickness=box_thickness,
                    color_mode=color_mode_key,
                    show_labels=show_labels,
                    show_shelf_life=show_shelf_life,
                    semi_margin=semi_margin
                )

            counts = res["counts"]
            fresh_stats = res["freshness_stats"]
            annotated = res["annotated_image"]

            st.markdown(f"""
            <div class="metric-grid">
                <div class="metric-card total"><div class="metric-value">{counts['total']}</div><div class="metric-label">📦 Total Fruits</div></div>
                <div class="metric-card score"><div class="metric-value">{res['avg_freshness']:.1f}%</div><div class="metric-label">✨ Avg Freshness</div></div>
                <div class="metric-card fresh"><div class="metric-value">{fresh_stats['FRESH']}</div><div class="metric-label">🟢 Fresh</div></div>
                <div class="metric-card semi"><div class="metric-value">{fresh_stats['SEMI-FRESH']}</div><div class="metric-label">🟡 Semi-Fresh</div></div>
                <div class="metric-card rotten"><div class="metric-value">{fresh_stats['ROTTEN']}</div><div class="metric-label">🔴 Rotten</div></div>
            </div>
            """, unsafe_allow_html=True)

            c1, c2 = st.columns(2)
            with c1:
                st.image(annotated, caption="Graded Snapshot", use_container_width=True)
            with c2:
                st.image(pil_img, caption="Original Snapshot", use_container_width=True)


# ==============================================================================
# TAB 3: VIDEO FILE PROCESSING
# ==============================================================================
with tab_video:
    st.markdown("### 🎬 Video File Detection & Freshness Tracking")
    vid_choice = st.radio("Video Source", options=["Included Demo Video (Demo/Fruit-Detection.mp4)", "Upload Custom Video"], horizontal=True)

    video_path = None
    if vid_choice == "Included Demo Video (Demo/Fruit-Detection.mp4)":
        p = os.path.join("Demo", "Fruit-Detection.mp4")
        if os.path.exists(p):
            video_path = p
            st.video(p)
    else:
        uv = st.file_uploader("Upload Video (.mp4, .mov, .avi)", type=["mp4", "mov", "avi"])
        if uv:
            tf_v = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
            tf_v.write(uv.read())
            video_path = tf_v.name
            st.video(video_path)

    if video_path:
        stride = st.slider("Process Every Nth Frame", min_value=1, max_value=10, value=2)
        max_f = st.slider("Max Frames", min_value=50, max_value=400, value=120, step=20)

        if st.button("🚀 Analyze Video Freshness"):
            cap = cv2.VideoCapture(video_path)
            pb = st.progress(0)
            txt = st.empty()
            prev_ph = st.empty()

            processed = 0
            peak_fruits = 0
            start_t = time.time()

            try:
                while cap.isOpened() and processed < max_f:
                    ret, frame = cap.read()
                    if not ret:
                        break

                    if int(cap.get(cv2.CAP_PROP_POS_FRAMES)) % stride != 0:
                        continue

                    res = run_two_stage_detection(
                        yolo_model=yolo_model,
                        freshness_model=freshness_model,
                        foods=foods_meta,
                        img_size_keras=keras_img_size,
                        image_input=frame,
                        conf_threshold=conf_thresh,
                        iou_threshold=iou_thresh,
                        box_thickness=box_thickness,
                        color_mode=color_mode_key
                    )

                    counts = res["counts"]
                    if counts["total"] > peak_fruits:
                        peak_fruits = counts["total"]

                    processed += 1
                    pb.progress(min(1.0, processed / max_f))
                    txt.text(f"Processed frame {processed}/{max_f} (Peak Fruits: {peak_fruits})...")

                    if processed % 5 == 0:
                        prev_ph.image(res["annotated_image"], caption=f"Frame #{processed}", use_container_width=True)

                total_time = time.time() - start_t
                txt.success(f"Video analysis complete! {processed} frames in {total_time:.1f}s ({processed/total_time:.1f} FPS).")
            finally:
                cap.release()


# ==============================================================================
# TAB 4: TWO-STAGE ARCHITECTURE & BENCHMARKS
# ==============================================================================
with tab_arch:
    st.markdown("### 📊 Two-Stage Architecture & Model Intelligence")
    st.markdown(r"""
    #### 🔄 How the Two-Stage Pipeline Works:
    1. **Stage 1 (YOLO11 Object Localization)**:
       - Processes the entire bulk fruit image or real-time camera frame.
       - Accurately detects each fruit boundary $[x_1, y_1, x_2, y_2]$ with high precision ($89.5\%$ mAP@50-95).
    2. **Single Fruit Crop & Square Normalization**:
       - Extracts each fruit's bounding box with proportional padding.
       - Expands to a square with edge reflection (preventing distortion) and resizes to $160 \times 160 \times 3$.
    3. **Stage 2 (Keras MobileNetV2 Freshness & Shelf-Life Inference)**:
       - Sends each single fruit image into the dual-head Keras model (`Models/food_freshness_model.keras`).
       - Head A (`food`): Verifies specific fruit category across 26 food types.
       - Head B (`fresh`): Computes exact $P(\text{fresh})$ vs $P(\text{rotten})$ probability distributions.
       - Heuristic Engine: Computes remaining shelf life in days using base degradation rates.
    """)

    st.markdown("#### 🏆 YOLO Model Benchmark (Held-out Test Set)")
    benchmarks_df = pd.DataFrame([
        {"Model": "🏆 YOLO11n (Selected)", "Precision": 0.8950, "Recall": 0.9091, "mAP@50": 0.9466, "mAP@50-95": 0.8788, "Class Rank": "#1 Overall"},
        {"Model": "YOLO26n", "Precision": 0.8503, "Recall": 0.9198, "mAP@50": 0.9218, "mAP@50-95": 0.8400, "Class Rank": "#2 Overall"}
    ])
    st.table(benchmarks_df)

    run_dir = os.path.join("runs", "yolo11n")
    if os.path.exists(run_dir):
        g1, g2 = st.columns(2)
        with g1:
            p_res = os.path.join(run_dir, "results.png")
            if os.path.exists(p_res):
                st.image(p_res, caption="YOLO11n Training Curves", use_container_width=True)
        with g2:
            p_pr = os.path.join(run_dir, "BoxPR_curve.png")
            if os.path.exists(p_pr):
                st.image(p_pr, caption="Precision-Recall Curve", use_container_width=True)
