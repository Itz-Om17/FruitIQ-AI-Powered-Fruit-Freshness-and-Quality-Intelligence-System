@echo off
title FreshTrack AI - Fruit Freshness & Inventory Management Platform
echo ===================================================================
echo     🌿 FreshTrack AI - Multi-Model Fruit Inspection Platform
echo ===================================================================
echo.
echo [1/3] Starting FastAPI Inference Service (Port 8000)...
start "FreshTrack AI - Inference (Port 8000)" cmd /k "cd freshtrack\inference && python -m uvicorn main:app --port 8000 --reload"

echo [2/3] Starting Node.js Express Backend (Port 5000)...
start "FreshTrack AI - Backend (Port 5000)" cmd /k "cd freshtrack\backend && npm start"

echo [3/3] Starting React Vite Frontend (Port 5173)...
start "FreshTrack AI - Frontend (Port 5173)" cmd /k "cd freshtrack\frontend && npm run dev"

echo.
echo ===================================================================
echo  All 3 services are launching:
echo    - FastAPI Inference: http://localhost:8000/docs
echo    - Express API:       http://localhost:5000/api/health
echo    - React Dashboard:   http://localhost:5173
echo ===================================================================
pause
