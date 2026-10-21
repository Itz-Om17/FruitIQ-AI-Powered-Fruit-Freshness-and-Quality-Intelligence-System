# 🌿 FreshTrack AI — Intelligent Fruit Freshness & Inventory Management Platform

**FreshTrack AI** is an easy-to-use smart platform designed for fruit wholesalers, grocery retailers, and warehouse operators. It uses artificial intelligence (AI) and **Fuzzy Logic** to inspect fruit quality from photos, estimate how many days fruits will stay fresh, and prioritize which inventory batches to sell first to prevent food waste.

---

## 💡 How It Works (The 2 AI Models + Fuzzy Logic Explained Simply)

FreshTrack AI combines two neural networks with a practical Fuzzy Logic decision engine:

```
[ Your Fruit Image ]
        │
        ▼
┌────────────────────────────────────────────────────────┐
│  STEP 1: The Fruit Finder (YOLO11 CNN Model)           │
│  • Scans the entire picture (crates, trays, or boxes). │
│  • Spots every individual fruit.                       │
│  • Draws a neat box around each one.                   │
└────────────────────────────────────────────────────────┘
        │
        ▼ (Extracts each fruit crop)
┌────────────────────────────────────────────────────────┐
│  STEP 2: The Quality Checker (Keras MobileNetV2 CNN)   │
│  • Inspects visual features of each detected fruit.    │
│  • Classifies variety (Apple, Orange, Banana, etc.).   │
│  • Computes freshness probability: P(fresh) vs P(rotten)│
└────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────┐
│  STEP 3: The Fuzzy Logic Engine                        │
│  • Part A (Shelf-Life): Blends freshness + temperature │
│    to calculate realistic remaining days.              │
│  • Part B (Prioritization): Blends shelf life + volume │
│    into a 0–100 dispatch urgency score (FEFO).        │
└────────────────────────────────────────────────────────┘
        │
        ▼
[ Real-Time Dashboard & Stock Priority Action Queue ]
```

---

## 🧠 Where Fuzzy Logic is Applied

Unlike rigid mathematical equations, **Fuzzy Logic** mimics human reasoning (e.g. *"if fruit is moderately fresh AND storage is warm, shelf life decays rapidly"*).

### 1. Fuzzy Shelf-Life Estimation (Python Inference Service)
- **Fuzzy Inputs:**
  - **Visual Freshness:** *Rotten*, *Semi-Fresh*, *Fresh* (derived from the Keras CNN probability).
  - **Storage Temperature:** *Cold* ($0^\circ\text{C} - 10^\circ\text{C}$), *Room Temp* ($10^\circ\text{C} - 25^\circ\text{C}$), *Warm* ($>25^\circ\text{C}$).
- **How it works:**
  - A semi-fresh apple stored in cold refrigeration ($4^\circ\text{C}$) yields **21 days**.
  - The exact same semi-fresh apple kept in ambient room temp ($20^\circ\text{C}$) yields **15 days**.
  - If kept in warm temperature ($32^\circ\text{C}$), the fuzzy rules estimate **8 days**.
  - Rotten fruits are automatically set to **0 days**.

### 2. Fuzzy Stock Prioritization (Backend Inventory Service)
- **Fuzzy Inputs:**
  - **Days Remaining:** *Critical* ($\le 1$ day), *Short* ($1 - 4$ days), *Medium* ($4 - 10$ days), *Safe* ($>10$ days).
  - **Quantity at Risk:** *Small*, *Moderate*, *Bulk Stock* ($>100\text{ kg}$).
  - **Freshness Classification:** *Fresh*, *Semi-Fresh*, *Rotten*.
- **Fuzzy Output:** A continuous **Urgency Score (0 to 100)**:
  - **Score $\ge 92$:** **Urgent Action** (Emergency dispatch or physical quarantine).
  - **Score $72 - 91$:** **Sell / Distribute First** (Move before fresher batches).
  - **Score $50 - 71$:** **Monitor Closely** (Watch for rapid quality changes).
  - **Score $< 50$:** **Normal Priority** (Healthy stock with safe margin).

---

## 📋 The Simple 4-Step Daily Workflow

1. **Step 1: Take or Upload a Picture**
   - Open the **AI Fruit Scanner** on your phone, tablet, or PC.
   - Upload a photo or use your device camera to snap a picture of your fruit crate.
2. **Step 2: Instant AI & Fuzzy Inspection**
   - YOLO11 spots every fruit, Keras grades the freshness, and Fuzzy Logic calculates the estimated days remaining.
3. **Step 3: Link to Inventory**
   - With one click, save the inspection to an existing batch or create a new inventory batch.
4. **Step 4: Smart Stock Actions**
   - The platform tells you which batches to **sell first** (First-Expired, First-Out) and alerts you before items spoil.

---

## ✨ Main Features

- 📊 **Executive Dashboard:** Live metrics for total stock, active batches, upcoming expiration deadlines, and potential financial losses.
- 🔍 **AI Fruit Scanner:** Interactive visual overlay with green/amber/red bounding boxes, confidence scores, and crop inspector.
- 📦 **Inventory Management:** Full batch tracking with supplier history, storage location, arrival dates, and purchase costs.
- 📝 **Audit-Proof Stock Ledger:** Record sales dispatches, incoming shipments, discarded spoiled fruit, and physical count adjustments.
- 🤖 **FruitBot AI Assistant (Groq LLM):** Floating conversational chatbot powered by Groq's high-speed open-source GPT model (`openai/gpt-oss-20b`). Ask questions in plain English like *"What should I sell first?"*, *"Show batches expiring soon"*, or *"How do I extend banana & apple shelf life?"*, and FruitBot checks your live inventory and gives actionable agronomic storage guidance (temperature zones, ethylene separation, humidity, airflow, and culling).
- ⏱️ **First-Expired, First-Out (FEFO) Queue:** Automatically sorts batches by urgency so you know exactly what to sell today.
- 🔔 **Smart Alerts & Notifications:** Deduplicated warnings when produce is close to expiring or overdue for an inspection.
- 📈 **Reports & Excel/CSV Export:** Download full inventory and quality records anytime for your business spreadsheets.

---

## 🚀 How to Run the Application (1-Click Start)

### For Windows:
Double-click **`start_freshtrack.bat`** in the project folder.

This automatically starts all three services:
1. **AI Inference Service:** `http://localhost:8000` (FastAPI with `--reload`)
2. **Backend API:** `http://localhost:5000` (Node.js & MongoDB)
3. **Web Dashboard:** `http://localhost:5173` (React Vite)

### Logging In:
Open **`http://localhost:5173`** and click **"Instant 1-Click Demo Login"** (or use `demo@freshtrack.ai` / `demo1234`).
