import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Scan,
  Calendar,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
  X
} from 'lucide-react';
import api from '../api/client';
import { Inspection, Detection } from '../types';
import { FreshnessBadge } from '../components/FreshnessBadge';

export const Inspections: React.FC = () => {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inspections?limit=50');
      setInspections(res.data.inspections || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inspection History & AI Records</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all bulk fruit image inspections, object detections, and freshness grades
          </p>
        </div>

        <button
          onClick={() => navigate('/scanner')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all self-start md:self-auto"
        >
          <Scan className="w-4 h-4" />
          <span>New Inspection Scan</span>
        </button>
      </div>

      {/* Inspections Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Scan ID</th>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Fruits Detected</th>
                <th className="px-6 py-3.5">Freshness Distribution</th>
                <th className="px-6 py-3.5">Average Freshness</th>
                <th className="px-6 py-3.5">Inventory Link</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Loading inspection records…
                  </td>
                </tr>
              ) : inspections.length > 0 ? (
                inspections.map((ins) => (
                  <tr key={ins._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">
                      {ins.scan_id ? ins.scan_id.slice(0, 8) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(ins.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {ins.summary?.total || 0} fruit(s)
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ins.summary?.fresh || 0} F
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          {ins.summary?.semi_fresh || 0} S
                        </span>
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          {ins.summary?.rotten || 0} R
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {ins.summary?.avg_freshness_pct || 0}%
                        </span>
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${ins.summary?.avg_freshness_pct || 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {ins.batch ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{ins.batch.batch_code || 'Committed'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedInspection(ins)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors"
                      >
                        Inspect Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No inspections recorded yet. Run a scan to generate records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Details Modal */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Inspection Telemetry</h3>
                <p className="text-[11px] text-slate-500 font-mono">ID: {selectedInspection.scan_id}</p>
              </div>
              <button
                onClick={() => setSelectedInspection(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Fruits</span>
                <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                  {selectedInspection.summary?.total || 0}
                </div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <span className="text-[10px] text-emerald-700 font-semibold uppercase">Average Freshness</span>
                <div className="text-lg font-extrabold text-emerald-800 mt-0.5">
                  {selectedInspection.summary?.avg_freshness_pct || 0}%
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Pipeline Time</span>
                <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                  {selectedInspection.timing_ms?.total || 0} ms
                </div>
              </div>
            </div>

            {/* Detections List */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">Detected Produce Crops</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedInspection.detections?.map((d: Detection) => (
                  <div
                    key={d.detection_id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-600 mr-2">#{d.detection_id}</span>
                      <span className="font-bold text-slate-900 capitalize mr-2">
                        {d.keras_food_name || d.yolo_class}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Shelf Life: <strong>{d.shelf_life_days} days</strong>
                      </span>
                    </div>
                    <FreshnessBadge state={d.freshness_state} score={d.freshness_score_pct} size="sm" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedInspection(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
