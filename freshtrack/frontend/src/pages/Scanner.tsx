import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Sliders,
  ChevronRight,
  PlusCircle,
  Link as LinkIcon,
  X,
  FileCheck2
} from 'lucide-react';
import api from '../api/client';
import { Detection, Batch } from '../types';
import { FreshnessBadge } from '../components/FreshnessBadge';

export const Scanner: React.FC = () => {
  // Input state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Settings state
  const [conf, setConf] = useState<number>(0.35);
  const [iou, setIou] = useState<number>(0.45);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Inspection result state
  const [loading, setLoading] = useState<boolean>(false);
  const [inspectionResult, setInspectionResult] = useState<any | null>(null);
  const [selectedDetectionId, setSelectedDetectionId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Commit Modal state
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [isCreatingNewBatch, setIsCreatingNewBatch] = useState(false);
  const [newBatchQuantity, setNewBatchQuantity] = useState<number>(50);
  const [newBatchUnit, setNewBatchUnit] = useState<string>('kg');
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);

  // Image dimension tracking for bounding box overlay
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [renderedDims, setRenderedDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setInspectionResult(null);
    setSelectedDetectionId(null);
    setErrorMsg(null);
    setCommitSuccess(null);
    stopCamera();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Camera handling
  const startCamera = async () => {
    try {
      setCameraActive(true);
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setErrorMsg('Could not access camera. Please check permissions or use image upload.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera_scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleFileSelect(file);
      }
    }, 'image/jpeg', 0.95);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const runInspection = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setErrorMsg(null);
    setInspectionResult(null);
    setSelectedDetectionId(null);
    setCommitSuccess(null);

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('conf', conf.toString());
    formData.append('iou', iou.toString());

    try {
      const res = await api.post('/inspections/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setInspectionResult(res.data.inspection);
      if (res.data.inspection?.detections?.length > 0) {
        setSelectedDetectionId(res.data.inspection.detections[0].detection_id);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message;
      setErrorMsg(`Inspection failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const openCommitModal = async () => {
    setIsCommitModalOpen(true);
    try {
      const res = await api.get('/batches?limit=50&status=active');
      setBatches(res.data.batches || []);
      if (res.data.batches?.length > 0) {
        setSelectedBatchId(res.data.batches[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommit = async () => {
    if (!inspectionResult) return;
    setCommitLoading(true);

    try {
      let targetBatchId = selectedBatchId;

      if (isCreatingNewBatch) {
        // Derive fruit type from primary detection
        const primaryFruit = inspectionResult.detections[0]?.keras_food_name ||
          inspectionResult.detections[0]?.yolo_class || 'Assorted Fruit';

        const batchRes = await api.post('/batches', {
          fruit_type: primaryFruit,
          quantity: newBatchQuantity,
          unit: newBatchUnit,
          notes: `Created from AI Scan ${inspectionResult.scan_id.slice(0, 8)}`
        });
        targetBatchId = batchRes.data.batch._id;
      }

      const res = await api.post(`/inspections/${inspectionResult._id}/commit`, {
        batch_id: targetBatchId
      });

      setCommitSuccess('Inspection successfully committed! Batch inventory and freshness priority updated.');
      setInspectionResult(res.data.inspection);
      setIsCommitModalOpen(false);
    } catch (err: any) {
      setErrorMsg(`Commit failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setCommitLoading(false);
    }
  };

  // Calculate box scaling
  const origW = inspectionResult?.image_size?.width || 1;
  const origH = inspectionResult?.image_size?.height || 1;
  const scaleX = renderedDims.width ? renderedDims.width / origW : 1;
  const scaleY = renderedDims.height ? renderedDims.height / origH : 1;

  const selectedDetection: Detection | undefined = inspectionResult?.detections?.find(
    (d: Detection) => d.detection_id === selectedDetectionId
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI Fruit Scanner & Freshness Inspector</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Two-stage intelligence: YOLO11 detects multiple individual fruits, Keras models freshness & shelf life
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              showSettings ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>AI Thresholds</span>
          </button>
        </div>
      </div>

      {/* Thresholds Drawer */}
      {showSettings && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <div className="flex justify-between font-semibold text-slate-700 mb-1">
              <span>YOLO Detection Confidence Threshold:</span>
              <span className="font-mono text-emerald-600">{Math.round(conf * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={conf}
              onChange={(e) => setConf(parseFloat(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Lower threshold detects more fruits in cluttered bins; higher reduces false positives.
            </p>
          </div>
          <div>
            <div className="flex justify-between font-semibold text-slate-700 mb-1">
              <span>IoU Overlap Suppression Threshold:</span>
              <span className="font-mono text-emerald-600">{Math.round(iou * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.8"
              step="0.05"
              value={iou}
              onChange={(e) => setIou(parseFloat(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Controls non-maximum suppression for overlapping fruit detections.
            </p>
          </div>
        </div>
      )}

      {/* Error or Success Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {commitSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{commitSuccess}</span>
          </div>
          <button onClick={() => setCommitSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Scanner Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input & Image Visualizer */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            {/* Input Switcher Bar */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Inspection Image Source</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    stopCamera();
                    document.getElementById('file-upload-input')?.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
                <input
                  id="file-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                {!cameraActive ? (
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Use Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </button>
                )}
              </div>
            </div>

            {/* Display Area */}
            {cameraActive ? (
              <div className="relative rounded-xl overflow-hidden bg-black flex flex-col items-center justify-center min-h-[360px]">
                <video ref={videoRef} autoPlay playsInline className="w-full h-auto max-h-[460px] object-contain" />
                <button
                  onClick={capturePhoto}
                  className="absolute bottom-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-xs shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture & Inspect</span>
                </button>
              </div>
            ) : previewUrl ? (
              <div
                className="relative rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center min-h-[380px]"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Inspection Target"
                  className="w-full h-auto max-h-[480px] object-contain block select-none"
                  onLoad={(e) => {
                    const target = e.currentTarget;
                    setRenderedDims({ width: target.clientWidth, height: target.clientHeight });
                  }}
                />

                {/* Interactive SVG Bounding Box Overlay */}
                {inspectionResult?.detections && renderedDims.width > 0 && (
                  <svg
                    className="absolute inset-0 pointer-events-none w-full h-full"
                    viewBox={`0 0 ${renderedDims.width} ${renderedDims.height}`}
                  >
                    {inspectionResult.detections.map((d: Detection) => {
                      const x1 = d.bounding_box.x1 * scaleX;
                      const y1 = d.bounding_box.y1 * scaleY;
                      const w = (d.bounding_box.x2 - d.bounding_box.x1) * scaleX;
                      const h = (d.bounding_box.y2 - d.bounding_box.y1) * scaleY;
                      const isSelected = d.detection_id === selectedDetectionId;

                      const boxColor =
                        d.freshness_state === 'FRESH'
                          ? '#10b981'
                          : d.freshness_state === 'SEMI-FRESH'
                          ? '#f59e0b'
                          : '#ef4444';

                      return (
                        <g key={d.detection_id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedDetectionId(d.detection_id)}>
                          <rect
                            x={x1}
                            y={y1}
                            width={w}
                            height={h}
                            fill={isSelected ? `${boxColor}33` : 'transparent'}
                            stroke={boxColor}
                            strokeWidth={isSelected ? 3 : 1.75}
                            rx={4}
                          />
                          <rect
                            x={x1}
                            y={Math.max(0, y1 - 18)}
                            width={Math.min(w, 85)}
                            height={18}
                            fill={boxColor}
                            rx={2}
                          />
                          <text
                            x={x1 + 4}
                            y={Math.max(12, y1 - 5)}
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            #{d.detection_id} {d.yolo_class}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}

                {loading && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    <p className="text-xs font-semibold">Running Two-Stage Neural Inspection…</p>
                    <div className="text-[10px] text-slate-300">
                      1. YOLO11 object localization → 2. Keras crop freshness scoring
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById('file-upload-input')?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-emerald-500 hover:bg-emerald-50/20 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[360px]"
              >
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Drop your produce image here, or browse</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Supports bulk crates, display trays, or single fruit pictures (JPEG, PNG, WebP up to 20MB)
                </p>
                <span className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm">
                  Select Image File
                </span>
              </div>
            )}

            {/* Run Button Action */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(0)} KB)` : 'No file selected'}
              </span>

              {selectedFile && !loading && (
                <button
                  onClick={runInspection}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Execute AI Inspection</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Inspection Results & Telemetry */}
        <div className="lg:col-span-5 space-y-4">
          {inspectionResult ? (
            <>
              {/* Summary Scorecard */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Inspection Overview</h3>
                    <p className="text-xs text-slate-400 font-mono">Scan ID: {inspectionResult.scan_id.slice(0, 8)}</p>
                  </div>
                  <button
                    onClick={openCommitModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>Commit to Batch</span>
                  </button>
                </div>

                {/* Score breakdown */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-lg font-extrabold text-slate-800">
                      {inspectionResult.summary?.total || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium uppercase">Fruits Found</div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="text-lg font-extrabold text-emerald-700">
                      {inspectionResult.summary?.fresh || 0}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-medium uppercase">Fresh</div>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-lg font-extrabold text-amber-700">
                      {inspectionResult.summary?.semi_fresh || 0}
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium uppercase">Semi</div>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="text-lg font-extrabold text-rose-700">
                      {inspectionResult.summary?.rotten || 0}
                    </div>
                    <div className="text-[10px] text-rose-700 font-medium uppercase">Rotten</div>
                  </div>
                </div>

                {/* Avg Freshness Score Progress */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-700">Batch Average Freshness:</span>
                    <span className="text-emerald-700 font-bold">
                      {inspectionResult.summary?.avg_freshness_pct || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${inspectionResult.summary?.avg_freshness_pct || 0}%` }}
                    />
                  </div>
                </div>

                {/* Latency benchmark */}
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
                  <span>YOLO: {inspectionResult.timing_ms?.yolo || 0}ms</span>
                  <span>Keras: {inspectionResult.timing_ms?.keras || 0}ms</span>
                  <span>Total: {inspectionResult.timing_ms?.total || 0}ms</span>
                </div>
              </div>

              {/* Selected Fruit Inspector Detail */}
              {selectedDetection ? (
                <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold">
                        #{selectedDetection.detection_id}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm capitalize">
                        {selectedDetection.keras_food_name || selectedDetection.yolo_class}
                      </h4>
                    </div>
                    <FreshnessBadge
                      state={selectedDetection.freshness_state}
                      score={selectedDetection.freshness_score_pct}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Classification Model</div>
                      <div className="font-bold text-slate-800 mt-0.5 capitalize">
                        {selectedDetection.keras_food_name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Conf: {(selectedDetection.keras_food_conf * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl">
                      <div className="text-[10px] text-emerald-800 uppercase font-semibold">Estimated Shelf Life</div>
                      <div className="font-bold text-emerald-900 text-base mt-0.5">
                        {selectedDetection.shelf_life_days} day(s)
                      </div>
                      <div className="text-[9px] text-emerald-700 italic">Heuristic estimate based on freshness</div>
                    </div>
                  </div>

                  {/* Probability balance */}
                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600">Fresh Probability P(fresh):</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        {(selectedDetection.p_fresh * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600">Rotten Probability P(rotten):</span>
                      <span className="font-mono font-semibold text-rose-700">
                        {(selectedDetection.p_rotten * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {selectedDetection.needs_manual_review && (
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 text-xs flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Low classification confidence. Operator physical inspection recommended.</span>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Detected Fruits List */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <h4 className="text-xs font-bold text-slate-700 mb-2">
                  All Detected Fruits ({inspectionResult.detections?.length || 0})
                </h4>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {inspectionResult.detections?.map((d: Detection) => (
                    <div
                      key={d.detection_id}
                      onClick={() => setSelectedDetectionId(d.detection_id)}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        selectedDetectionId === d.detection_id
                          ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/20'
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-slate-500">#{d.detection_id}</span>
                        <div>
                          <span className="font-semibold text-slate-800 capitalize">
                            {d.keras_food_name || d.yolo_class}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5">
                            YOLO: {(d.yolo_confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FreshnessBadge state={d.freshness_state} size="sm" />
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
              <HelpCircle className="w-12 h-12 text-slate-300 mb-2" />
              <h4 className="font-bold text-slate-700 text-sm">Ready for Produce Inspection</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Upload a fruit image or use the camera to detect items, grade freshness, and calculate shelf life.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Commit to Batch Modal */}
      {isCommitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Associate Inspection with Inventory</h3>
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNewBatch(false)}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                    !isCreatingNewBatch
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Existing Batch
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewBatch(true)}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                    isCreatingNewBatch
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Create New Batch
                </button>
              </div>

              {!isCreatingNewBatch ? (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Select Active Batch</label>
                  {batches.length > 0 ? (
                    <select
                      value={selectedBatchId}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                    >
                      {batches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.batch_code} — {b.fruit_type} ({b.remaining_quantity || b.quantity} {b.unit})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-400 italic">No existing active batches found. Create a new one.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Batch Stock Quantity</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={newBatchQuantity}
                        onChange={(e) => setNewBatchQuantity(parseFloat(e.target.value) || 0)}
                        className="flex-1 p-2.5 rounded-xl border border-slate-200 text-slate-800 font-semibold"
                      />
                      <select
                        value={newBatchUnit}
                        onChange={(e) => setNewBatchUnit(e.target.value)}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="kg">kg</option>
                        <option value="crates">crates</option>
                        <option value="boxes">boxes</option>
                        <option value="pieces">pieces</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={commitLoading || (!isCreatingNewBatch && !selectedBatchId)}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm"
              >
                {commitLoading ? 'Committing…' : 'Confirm & Commit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
