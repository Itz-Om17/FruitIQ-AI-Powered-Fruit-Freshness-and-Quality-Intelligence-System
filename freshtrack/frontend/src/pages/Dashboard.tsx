import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Weight,
  Scan,
  AlertTriangle,
  Clock,
  Trash2,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import api from '../api/client';
import { DashboardMetrics } from '../types';
import { FreshnessBadge } from '../components/FreshnessBadge';
import { PriorityBadge } from '../components/PriorityBadge';

const FRESHNESS_COLORS: Record<string, string> = {
  FRESH: '#10b981',
  'SEMI-FRESH': '#f59e0b',
  ROTTEN: '#ef4444',
  NOT_INSPECTED: '#8b5cf6',
  UNKNOWN: '#94a3b8'
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<{
    metrics: DashboardMetrics;
    fruit_distribution: { name: string; quantity: number }[];
    freshness_distribution: { state: string; count: number }[];
    priority_stock: any[];
    recent_inspections: any[];
    spoilage_trend: { date: string; quantity: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm font-medium">Loading inventory and analytics…</p>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    total_batches: 0,
    active_batches: 0,
    total_quantity: 0,
    total_inspections: 0,
    urgent_batches: 0,
    expiring_batches: 0,
    total_spoiled: 0,
    value_at_risk: 0,
    unread_notifications: 0
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Live Inventory Telemetry</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Produce Operations Center</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time batch freshness inspection, AI shelf-life prognosis, and food waste mitigation
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => navigate('/scanner')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Scan className="w-4 h-4" />
            <span>Launch Bulk Fruit Scanner</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Active Batches */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Batches</span>
            <Boxes className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{metrics.active_batches}</div>
          <div className="text-[11px] text-slate-500 mt-1">{metrics.total_batches} total recorded</div>
        </div>

        {/* Total Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Stock</span>
            <Weight className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{metrics.total_quantity}</div>
          <div className="text-[11px] text-slate-500 mt-1">Available units / kg</div>
        </div>

        {/* Inspected Fruits */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">AI Inspections</span>
            <Scan className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{metrics.total_inspections}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Two-stage verified</div>
        </div>

        {/* Urgent Batches */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Urgent Batches</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600">{metrics.urgent_batches}</div>
          <div className="text-[11px] text-rose-500 font-medium mt-1">Immediate action needed</div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Expiring ≤3 Days</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-600">{metrics.expiring_batches}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">Approaching shelf life</div>
        </div>

        {/* Total Spoiled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Recorded Spoilage</span>
            <Trash2 className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{metrics.total_spoiled}</div>
          <div className="text-[11px] text-slate-500 mt-1">Units lost / discarded</div>
        </div>

        {/* Value at Risk */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Value at Risk</span>
            <DollarSign className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            ₹{metrics.value_at_risk.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Estimated cost basis</div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory by Fruit Type */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Stock Distribution by Fruit</h3>
            <span className="text-xs text-slate-400">Remaining Units</span>
          </div>
          <div className="h-64">
            {data?.fruit_distribution && data.fruit_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.fruit_distribution}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="quantity" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No active inventory data available.
              </div>
            )}
          </div>
        </div>

        {/* Freshness Classification Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Freshness Category Breakdown</h3>
            <span className="text-xs text-slate-400">Batch Health</span>
          </div>
          <div className="h-64 flex flex-col justify-center">
            {data?.freshness_distribution && data.freshness_distribution.some(f => f.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.freshness_distribution.filter(f => f.count > 0)}
                    dataKey="count"
                    nameKey="state"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={3}
                  >
                    {data.freshness_distribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={FRESHNESS_COLORS[entry.state] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No freshness records yet. Run an inspection scan!
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 text-[11px] text-slate-600 mt-2">
              {data?.freshness_distribution.map((f) => (
                <div key={f.state} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: FRESHNESS_COLORS[f.state] || '#94a3b8' }}
                  />
                  <span>
                    {f.state}: <strong>{f.count}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Spoilage Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Spoilage Trend (Last 30 Days)</h3>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-64">
            {data?.spoilage_trend && data.spoilage_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.spoilage_trend}>
                  <defs>
                    <linearGradient id="spoilageGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="quantity"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#spoilageGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-slate-400">
                <ShieldCheck className="w-10 h-10 text-emerald-500 mb-2 opacity-60" />
                <p className="font-medium text-slate-600">Zero recorded spoilage</p>
                <p>No discard events have been recorded in the past 30 days.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Priority Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Priority Stock & Action Queue</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Batches prioritized by remaining shelf life, freshness degradation, and stock volume
            </p>
          </div>
          <button
            onClick={() => navigate('/prioritization')}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <span>View Full Queue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">Batch Code</th>
                <th className="px-6 py-3.5">Fruit Type</th>
                <th className="px-6 py-3.5">Quantity</th>
                <th className="px-6 py-3.5">Freshness</th>
                <th className="px-6 py-3.5">Remaining Shelf Life</th>
                <th className="px-6 py-3.5">Priority Level</th>
                <th className="px-6 py-3.5">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.priority_stock && data.priority_stock.length > 0 ? (
                data.priority_stock.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-slate-800">{b.batch_code}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 capitalize">{b.fruit_type}</td>
                    <td className="px-6 py-4 text-slate-700">
                      {b.quantity} {b.unit || 'kg'}
                    </td>
                    <td className="px-6 py-4">
                      <FreshnessBadge state={b.freshness_state} score={b.avg_freshness_pct} />
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {b.remaining_shelf_life_days !== null && b.remaining_shelf_life_days !== undefined ? (
                        <span
                          className={
                            b.remaining_shelf_life_days <= 1
                              ? 'text-rose-600 font-bold'
                              : b.remaining_shelf_life_days <= 3
                              ? 'text-amber-600 font-semibold'
                              : 'text-emerald-600'
                          }
                        >
                          {b.remaining_shelf_life_days} day(s)
                        </span>
                      ) : (
                        <span className="text-slate-400">Needs Inspection</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <PriorityBadge level={b.priority?.level} score={b.priority?.score} />
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs max-w-xs truncate" title={b.priority?.reason}>
                      {b.priority?.reason || 'Standard storage protocol'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No active priority items. Create inventory batches or run inspection scans to populate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Inspections Preview */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent AI Scans & Inspections</h3>
            <p className="text-xs text-slate-500">Latest bulk inspections analyzed via YOLO11 and Keras</p>
          </div>
          <button
            onClick={() => navigate('/inspections')}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <span>All Inspections</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.recent_inspections && data.recent_inspections.length > 0 ? (
            data.recent_inspections.map((scan) => (
              <div
                key={scan._id}
                onClick={() => navigate(`/inspections`)}
                className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer bg-slate-50/50"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-mono text-[11px] text-slate-600 truncate max-w-[150px]">
                    {scan.scan_id}
                  </span>
                  <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                    <Scan className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800">
                      {scan.summary?.total || 0} Fruit(s) Detected
                    </div>
                    <div className="text-xs text-slate-500">
                      Avg Freshness: <strong>{scan.summary?.avg_freshness_pct || 0}%</strong>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {scan.summary?.fresh || 0} Fresh
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    {scan.summary?.semi_fresh || 0} Semi
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    {scan.summary?.rotten || 0} Rotten
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-slate-400 text-xs">
              No scans conducted yet. Launch the Fruit Scanner to perform your first AI inspection.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
