# FreshTrack AI — Agent Context & Project Knowledge

> Comprehensive project state, architecture, model specifications, bug fixes, and development progress.

---

## 1. Project Overview & Location
- **Root Repository:** `c:\Users\deshp\OneDrive\Desktop\checking\Fruit-Detection-main\`
- **FreshTrack Platform Directory:** `freshtrack/`
- **Application Name:** FreshTrack AI
- **Remote Git Origin:** `https://github.com/Itz-Om17/FruitIQ-AI-Powered-Fruit-Freshness-and-Quality-Intelligence-System.git`
- **Purpose:** Intelligent fruit freshness grading, shelf-life estimation, and inventory management platform to minimize produce waste for wholesalers, retailers, and distributors.

---

## 2. The Two-Stage AI Model Pipeline (Preserved Existing Models)

### Model 1 — Fruit Object Detection (YOLO11)
- **Model File:** `Models/Yolo11.pt`
- **Framework:** Ultralytics YOLO (PyTorch)
- **Role in Workflow:** Stage 1 — Finds all individual fruits in bulk images (e.g., in crates or trays) and draws a bounding box `[x1, y1, x2, y2]` around each fruit.
- **Classes:** Apple, Mango, Banana, Orange.
- **Input Size:** 640px.

### Model 2 — Fruit Freshness & Shelf-Life Classifier (Keras)
- **Model File:** `Models/food_freshness_model.keras`
- **Metadata File:** `Models/food_freshness_meta.json` (26 food classes)
- **Framework:** TensorFlow / Keras (MobileNetV2 backbone)
- **Role in Workflow:** Stage 2 — Analyzes each fruit crop detected by Model 1.
- **Input:** 160×160 RGB image with 8% padding and replicate-border square padding.
- **Output:** 
  1. Food variety classification (26 classes: fresh/rotten variants of apple, banana, mango, orange, tomato, carrot, etc.)
  2. Freshness probabilities: `[P(rotten), P(fresh)]`
- **Freshness Classification Rule:**
  - `FRESH`: `P(fresh) - P(rotten) >= 0.30`
  - `SEMI-FRESH`: `|P(fresh) - P(rotten)| < 0.30`
  - `ROTTEN`: `P(rotten) - P(fresh) >= 0.30` (shelf life capped at 0 days)

---

## 3. Fuzzy Logic Systems Implementation

### A. Fuzzy Shelf-Life Inference (`freshtrack/inference/fuzzy_shelf_life.py`)
- **Fuzzy Inputs:**
  1. *Visual Freshness Membership:* Rotten (trapmf), Semi-Fresh (trimf), Fresh (trapmf) based on Keras $P(\text{fresh})$.
  2. *Storage Temperature Membership:* Cold (0°C–10°C), Ambient (10°C–25°C), Warm (22°C–45°C).
- **Inference & Defuzzification:** Sugeno-style weighted average calculates a continuous `ratio` (0.0 to 1.0) multiplied by fruit baseline days.
- **Physical Dynamics:** A semi-fresh apple in cold storage ($4^\circ\text{C}$) yields 21 days; at room temperature ($20^\circ\text{C}$) yields 15 days; in warm temperature ($32^\circ\text{C}$) decays to 8 days.

### B. Fuzzy Stock Prioritization (`freshtrack/backend/src/services/prioritizationService.js`)
- **Fuzzy Inputs:**
  1. *Remaining Shelf Life:* Critical ($\le 1.8$d), Short ($1.2 - 5$d), Medium ($4 - 12$d), Long ($>10$d).
  2. *Stock Volume at Risk:* Small ($<30\text{ kg}$), Moderate ($20 - 120\text{ kg}$), Bulk ($>100\text{ kg}$).
  3. *Freshness State:* Rotten, Semi-Fresh, Fresh.
- **Output:** Defuzzified continuous Urgency Score (0 to 100) mapped to action categories (`urgent`, `sell_first`, `monitor`, `normal`).


## 4. End-to-End System Architecture

```
[ React + Vite + TypeScript Frontend ] (Port 5173)
                 │
                 ▼  REST API with JWT Auth
[ Node.js + Express Backend ] (Port 5000) ─── [ MongoDB ] (Port 27017)
                 │
                 ▼  Multipart Image Streaming
[ Python FastAPI Inference Service ] (Port 8000)
                 │
        ┌────────┴────────┐
        ▼                 ▼
[ Stage 1: YOLO11 ]  [ Stage 2: Keras MobileNetV2 ]
```

### Component Details
1. **Inference Service (`freshtrack/inference/main.py`):**
   - Loads YOLO11 and Keras models at startup.
   - Accepts images via `POST /api/v1/inspect`.
   - Runs detection, crops fruits, performs batch classification, and returns unified JSON telemetry.
2. **Backend API (`freshtrack/backend`):**
   - Manages authentication, inventory batches, inspection records, stock ledger, and alerts.
   - Runs prioritization calculations and triggers deduplicated notifications.
   - Proxies scan requests to the Python inference service.
3. **Frontend Dashboard (`freshtrack/frontend`):**
   - Built with React, TypeScript, Tailwind CSS, Lucide icons, and Recharts.
   - Interactive bounding box canvas/SVG overlay, real-time metrics, stock ledger, and CSV exports.

---

## 5. Completed Development Phases

- [x] **Phase 1: Model Inspection & Preprocessing Contract** (Verified YOLO & Keras input/output requirements).
- [x] **Phase 2: FastAPI Inference Service** (Built two-stage pipeline on port 8000 with batch processing).
- [x] **Phase 3: Express Backend & Database** (MongoDB models, JWT auth, stock ledger, REST routes).
- [x] **Phase 4: React Frontend** (Dashboard, AI Scanner, Inventory, Prioritization, Reports, Settings, Login).
- [x] **Phase 5: Integration & Verification** (Connected frontend to backend proxy to Python microservice).
- [x] **Phase 6: Stock Prioritization & Alerts** (FEFO engine, automated alerts, CSV export).
- [x] **Phase 7: Testing & Fixes** (Automated unit tests passing 7/7, bug fixes, one-click launcher).
- [x] **Phase 8: FruitBot AI Assistant (Groq LLM & Live RAG)**:
  - Powered by Groq API (loaded securely via `GROQ_API_KEY` in `backend/.env`).
  - Model: `openai/gpt-oss-20b` with automated fallback to `openai/gpt-oss-120b`.
  - Live MongoDB RAG: Automatically embeds active batch counts, spoilage totals, urgency levels, and days remaining into prompt context.
  - Actionable Shelf-Life Extension: Provides warehouse-tailored agronomic guidance (cold vs chilling-sensitive temperature zones, ethylene segregation between apples/bananas and greens, relative humidity 90-95% to prevent shriveling, cross-ventilation, and immediate culling of bruised fruit to prevent spore transmission).

---

## 6. Bug Fixes & Technical Resolutions

1. **Mongoose v9 Pre-save Hook Error (`500 on /api/auth/register`):**
   - *Problem:* In modern Mongoose, `userSchema.pre('save', async function(next))` caused `TypeError: next is not a function`.
   - *Resolution:* Removed `next` parameter from async function in `User.js`.
2. **Variable Shadowing in Python Inference (`502 on /api/inspections/scan`):**
   - *Problem:* A redundant `import numpy as np` inside `inspect()` shadowed the global `np`, throwing `UnboundLocalError`.
   - *Resolution:* Cleaned imports and used primitive parameter defaults in FastAPI endpoint.
3. **Hot-Reloading in Windows Launcher:**
   - *Resolution:* Added `--reload` to Uvicorn and `node --watch` to Express in `start_freshtrack.bat` to ensure seamless live code reloading.
4. **404 Not Found on `/api/chatbot/query`:**
   - *Problem:* The Node process on port 5000 was started prior to adding the chatbot route, caching the old routing table in memory.
   - *Resolution:* Restarted the Node backend server; route `/api/chatbot/query` registered and operational.

---

## 7. Default Demo Credentials
- **Email:** `demo@freshtrack.ai`
- **Password:** `demo1234`
- **Quick Access:** Click "Instant 1-Click Demo Login" on the login screen.
