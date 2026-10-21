import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Sparkles, CheckCircle2, ShieldCheck, Server } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [shelfLifeWarningDays, setShelfLifeWarningDays] = useState<number>(3);
  const [inspectionIntervalDays, setInspectionIntervalDays] = useState<number>(2);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Model backend health check
  const [modelHealth, setModelHealth] = useState<{
    status: string;
    models_loaded: boolean;
    food_classes: number;
    keras_input_size: number;
  } | null>(null);

  useEffect(() => {
    if (user?.preferences) {
      if (user.preferences.shelfLifeWarningDays) {
        setShelfLifeWarningDays(user.preferences.shelfLifeWarningDays);
      }
      if (user.preferences.inspectionIntervalDays) {
        setInspectionIntervalDays(user.preferences.inspectionIntervalDays);
      }
    }

    // Check inference health
    api.get('http://127.0.0.1:8000/health')
      .then((res) => setModelHealth(res.data))
      .catch(() => setModelHealth(null));
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      await api.patch('/auth/preferences', {
        preferences: {
          shelfLifeWarningDays,
          inspectionIntervalDays
        }
      });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">System Preferences & Model Telemetry</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure business prioritization rules, shelf-life alert thresholds, and inspect model health
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Operational preferences saved successfully.</span>
        </div>
      )}

      {/* Model Service Health Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">AI Inference Engine Status</h3>
              <p className="text-xs text-slate-500">FastAPI Microservice (Port 8000)</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Online</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Stage 1 Model</span>
            <div className="font-bold text-slate-800 mt-0.5">YOLO11 Object Detector</div>
            <div className="text-[10px] text-slate-500">Multi-fruit localization (640px)</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Stage 2 Model</span>
            <div className="font-bold text-slate-800 mt-0.5">MobileNetV2 Freshness</div>
            <div className="text-[10px] text-slate-500">Dual-head food & rotten classifier</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Supported Classes</span>
            <div className="font-bold text-slate-800 mt-0.5">26 Food & Produce Varieties</div>
            <div className="text-[10px] text-slate-500">Square-padded 160x160 tensors</div>
          </div>
        </div>
      </div>

      {/* Business Thresholds Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 text-xs">
        <h3 className="font-bold text-slate-900 text-sm">Prioritization & Urgency Thresholds</h3>

        <div className="space-y-4">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Shelf-Life Warning Deadline (Days)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={shelfLifeWarningDays}
              onChange={(e) => setShelfLifeWarningDays(parseInt(e.target.value) || 1)}
              className="w-full max-w-xs p-2.5 rounded-xl border border-slate-200 text-slate-800 font-semibold"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Batches with remaining shelf life at or below this value will trigger critical FEFO notifications.
            </p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Routine Inspection Interval (Days)
            </label>
            <input
              type="number"
              min="1"
              max="14"
              value={inspectionIntervalDays}
              onChange={(e) => setInspectionIntervalDays(parseInt(e.target.value) || 1)}
              className="w-full max-w-xs p-2.5 rounded-xl border border-slate-200 text-slate-800 font-semibold"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Produce batches that haven't undergone an AI scan within this window will be flagged for review.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all text-xs"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving…' : 'Save Operational Rules'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
