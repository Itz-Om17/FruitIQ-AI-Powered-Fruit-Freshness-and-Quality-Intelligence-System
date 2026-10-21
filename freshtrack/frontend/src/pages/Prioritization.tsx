import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClockAlert,
  AlertOctagon,
  TrendingDown,
  Info,
  ShieldAlert,
  ArrowRight,
  Scan,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import api from '../api/client';
import { Batch, PriorityLevel } from '../types';
import { FreshnessBadge } from '../components/FreshnessBadge';
import { PriorityBadge } from '../components/PriorityBadge';

export const Prioritization: React.FC = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  const fetchPriorityBatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/batches?limit=100&status=active&sort=priority');
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPriorityBatches();
  }, []);

  const counts: Record<string, number> = {
    all: batches.length,
    urgent: batches.filter((b) => b.priority?.level === 'urgent').length,
    sell_first: batches.filter((b) => b.priority?.level === 'sell_first').length,
    monitor: batches.filter((b) => b.priority?.level === 'monitor').length,
    manual_review: batches.filter((b) => b.priority?.level === 'manual_review').length,
    normal: batches.filter((b) => b.priority?.level === 'normal').length
  };

  const filtered = activeTab === 'all'
    ? batches
    : batches.filter((b) => b.priority?.level === activeTab);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-100 text-amber-800">
              <ClockAlert className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Smart Stock Prioritization Engine
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">First-Expired, First-Out (FEFO) Dispatch Queue</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent algorithmic prioritization factoring remaining shelf-life days, volume at risk, and inspection age
          </p>
        </div>

        <button
          onClick={fetchPriorityBatches}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Recalculate Priorities</span>
        </button>
      </div>

      {/* Food Safety & Heuristic Disclaimer */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <p className="font-bold">Algorithmic Guidance Disclaimer</p>
          <p className="text-[11px] text-amber-800">
            Shelf-life calculations are heuristic prognostic models based on visual AI freshness grading and standard cold-storage norms.
            Prioritizing a batch for early sale or rotation does not automatically certify food safety. Always conduct mandatory physical sensory verification before consumer dispatch.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-xs font-semibold">
        {[
          { key: 'all', label: 'All Active Stock' },
          { key: 'urgent', label: 'Urgent Action', color: 'text-red-700' },
          { key: 'sell_first', label: 'Sell / Distribute First', color: 'text-amber-700' },
          { key: 'monitor', label: 'Monitor Closely', color: 'text-blue-700' },
          { key: 'manual_review', label: 'Manual Review', color: 'text-purple-700' },
          { key: 'normal', label: 'Normal Priority', color: 'text-emerald-700' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.key ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {counts[tab.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Prioritized Batches Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            Evaluating priority rules across inventory…
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((b) => {
            const isUrgent = b.priority?.level === 'urgent';
            const isSellFirst = b.priority?.level === 'sell_first';

            return (
              <div
                key={b._id}
                className={`p-5 rounded-2xl bg-white border transition-all shadow-sm space-y-3.5 ${
                  isUrgent
                    ? 'border-red-200 ring-1 ring-red-500/20'
                    : isSellFirst
                    ? 'border-amber-200 ring-1 ring-amber-500/20'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Top Row: Code & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-500">{b.batch_code}</span>
                    <h3 className="text-base font-bold text-slate-900 capitalize mt-0.5">
                      {b.fruit_type}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <PriorityBadge level={b.priority?.level} score={b.priority?.score} showScore />
                    <FreshnessBadge
                      state={b.freshness?.state}
                      score={b.freshness?.avg_freshness_pct}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Metrics ribbon */}
                <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Remaining</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {b.remaining_quantity !== undefined ? b.remaining_quantity : b.quantity} {b.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Shelf-Life</div>
                    <div
                      className={`font-bold mt-0.5 ${
                        b.remaining_shelf_life_days != null && b.remaining_shelf_life_days <= 1
                          ? 'text-red-600'
                          : b.remaining_shelf_life_days != null && b.remaining_shelf_life_days <= 3
                          ? 'text-amber-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      {b.remaining_shelf_life_days != null ? `${b.remaining_shelf_life_days} days` : 'Pending'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Storage Location</div>
                    <div className="font-semibold text-slate-700 mt-0.5 truncate max-w-[100px] mx-auto">
                      {b.storage_location || 'Warehouse'}
                    </div>
                  </div>
                </div>

                {/* Justification Box */}
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    System Prioritization Rationale
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    "{b.priority?.reason || 'Standard storage protocol. Shelf-life stability confirmed.'}"
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Last evaluated: {b.priority?.last_calculated ? new Date(b.priority.last_calculated).toLocaleDateString() : 'Today'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate('/scanner')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors text-[11px]"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>Re-Scan Produce</span>
                    </button>
                    <button
                      onClick={() => navigate('/inventory')}
                      className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold text-[11px]"
                    >
                      <span>Manage Batch</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            No batches found in the "{activeTab}" category.
          </div>
        )}
      </div>
    </div>
  );
};
