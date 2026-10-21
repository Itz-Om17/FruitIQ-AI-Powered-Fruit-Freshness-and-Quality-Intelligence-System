# FreshTrack AI — Agent Context & Project Knowledge

> Auto-updated by the development agent. Captures architecture decisions, model contracts, and project state.

## 1. Project Location
- **Root:** `c:\Users\deshp\OneDrive\Desktop\checking\Fruit-Detection-main\`
- **FreshTrack App:** `freshtrack/` subdirectory

## 2. AI Models (DO NOT RETRAIN)

### Model 1 — YOLO11 Fruit Object Detector
- **Path:** `Models/Yolo11.pt`
- **Framework:** Ultralytics YOLO (PyTorch)
- **Input:** PIL Image or BGR numpy array
- **Output:** Bounding boxes `[x1, y1, x2, y2]`, class IDs, confidence scores
- **Classes:** `{0: 'apple', 1: 'mango', 2: 'banana', 3: 'orange'}`
- **Trained input size:** 640px
- **Role:** Stage 1 — localize each individual fruit in a bulk image

### Model 2 — Keras Food Freshness & Shelf-Life Classifier
- **Path:** `Models/food_freshness_model.keras`
- **Metadata:** `Models/food_freshness_meta.json`
- **Framework:** TensorFlow/Keras (MobileNetV2 backbone)
- **Input:** `(batch, 160, 160, 3)` float32 RGB, values 0-255 (model has internal Rescaling layer)
- **Output heads:**
  - `food` -> `(batch, 26)` softmax — food type classification
  - `fresh` -> `(batch, 2)` — `[P(rotten), P(fresh)]`
- **26 Food classes:** freshapple, freshbanana, freshbellpepper, freshbittergroud, freshcapciscum, freshcarrot, freshcucumber, freshmango, freshokara, freshorange, freshpotato, freshstrawberry, freshtomato, rottenapple, rottenbanana, rottenbellpepper, rottenbittergroud, rottencapsicum, rottencarrot, rottencucumber, rottenmango, rottenokra, rottenorange, rottenpotato, rottenstrawberry, rottentomato
- **Preprocessing:** Crop with 8% padding, pad to square via BORDER_REPLICATE, resize to 160x160
- **Role:** Stage 2 — classify freshness, estimate shelf life for each detected fruit crop

### Two-Stage Pipeline
1. YOLO11 detects all fruit bounding boxes in bulk image
2. Each box is cropped, square-padded, resized to 160x160
3. Keras model classifies food type + freshness probability per crop
4. Freshness state: FRESH (P_fresh - P_rotten >= 0.30), SEMI-FRESH (margin < 0.30), ROTTEN (P_rotten > P_fresh by >= 0.30)
5. Shelf life: avg_shelf_days x P(fresh), capped at 0 for ROTTEN

## 3. Shelf-Life Lookup Table (heuristic, not model-predicted)
| Fruit | Avg Days |
|-------|----------|
| Apple | 30 |
| Banana | 6 |
| Orange | 21 |
| Mango | 7 |
| Default | 7 |

## 4. Architecture
- freshtrack/inference/ — Python FastAPI (port 8000)
- freshtrack/backend/ — Node.js Express (port 5000)
- freshtrack/frontend/ — React + Vite + TypeScript (port 5173)
- freshtrack/uploads/ — Local image storage

## 5. Environment
- Node.js: v24.19.0
- MongoDB: v8.3.8 (local)
- Python: 3.12.10
- TensorFlow: 2.21.0

## 6. Ports
| Service | Port |
|---------|------|
| FastAPI Inference | 8000 |
| Express Backend | 5000 |
| React Frontend (Vite) | 5173 |
| MongoDB | 27017 |

## 7. Build Progress
- [x] Phase 1: Model inspection and contract documentation
- [x] Phase 2: FastAPI inference service
- [ ] Phase 3: Express backend, MongoDB schemas, auth, inventory APIs
- [ ] Phase 4: React frontend (dashboard, scanner, inventory, reports)
- [ ] Phase 5: End-to-end integration and validation
- [ ] Phase 6: Prioritization, notifications, analytics, CSV export
- [ ] Phase 7: Testing, security, deployment docs

## 8. Key Design Decisions
- YOLO11 is Stage 1 (bulk detection), Keras is Stage 2 (per-fruit freshness)
- Inference service is separate from Express backend (FastAPI on port 8000)
- Backend proxies scan requests to inference service
- Frontend never talks to inference service directly
- Shelf life is a heuristic estimate, clearly labeled as such
- Inspections create historical records, never overwrite previous predictions
- Stock quantities only change via explicit user-confirmed operations
