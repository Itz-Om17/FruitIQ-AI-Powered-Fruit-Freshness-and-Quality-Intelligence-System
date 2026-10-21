import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  History,
  Archive,
  Edit2,
  Trash2,
  TrendingDown,
  Check,
  X,
  FileSpreadsheet
} from 'lucide-react';
import api from '../api/client';
import { Batch, StockMovement } from '../types';
import { FreshnessBadge } from '../components/FreshnessBadge';
import { PriorityBadge } from '../components/PriorityBadge';

export const Inventory: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Add Batch Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBatch, setNewBatch] = useState({
    fruit_type: 'Apple',
    quantity: 100,
    unit: 'kg',
    supplier_name: '',
    purchase_cost: 0,
    storage_location: 'Cold Room A',
    notes: ''
  });

  // Stock Movement Modal
  const [selectedBatchForMovement, setSelectedBatchForMovement] = useState<Batch | null>(null);
  const [movementType, setMovementType] = useState<'sold' | 'spoiled' | 'incoming' | 'adjustment'>('sold');
  const [movementQty, setMovementQty] = useState<number>(10);
  const [movementReason, setMovementReason] = useState<string>('Standard dispatch sale');
  const [movementLoading, setMovementLoading] = useState<boolean>(false);

  // Batch Detail & Audit Drawer
  const [activeBatchDetail, setActiveBatchDetail] = useState<Batch | null>(null);
  const [movementsHistory, setMovementsHistory] = useState<StockMovement[]>([]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      let query = '/batches?limit=100';
      if (statusFilter) query += `&status=${statusFilter}`;
      if (priorityFilter) query += `&priority=${priorityFilter}`;
      const res = await api.get(query);
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [statusFilter, priorityFilter]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/batches', {
        fruit_type: newBatch.fruit_type,
        quantity: newBatch.quantity,
        unit: newBatch.unit,
        supplier: { name: newBatch.supplier_name },
        purchase_cost: { amount: newBatch.purchase_cost },
        storage_location: newBatch.storage_location,
        notes: newBatch.notes
      });
      setIsAddModalOpen(false);
      fetchBatches();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForMovement) return;
    try {
      setMovementLoading(true);
      await api.post(`/batches/${selectedBatchForMovement._id}/stock-movement`, {
        type: movementType,
        quantity: movementQty,
        reason: movementReason
      });
      setSelectedBatchForMovement(null);
      fetchBatches();
    } catch (err: any) {
      alert(`Movement failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setMovementLoading(false);
    }
  };

  const viewBatchDetail = async (batch: Batch) => {
    setActiveBatchDetail(batch);
    try {
      const res = await api.get(`/batches/${batch._id}/movements`);
      setMovementsHistory(res.data.movements || []);
    } catch (err) {
      console.error(err);
    }
  };

  const archiveBatch = async (id: string) => {
    if (!confirm('Are you sure you want to archive this batch?')) return;
    try {
      await api.post(`/batches/${id}/archive`);
      fetchBatches();
      if (activeBatchDetail?._id === id) setActiveBatchDetail(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.batch_code.toLowerCase().includes(search.toLowerCase()) ||
      b.fruit_type.toLowerCase().includes(search.toLowerCase()) ||
      b.storage_location?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventory Batches & Stock Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-tracked produce batches with shelf-life forecasts, spoilage logs, and verified stock movements
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Batch</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by batch code, fruit type, or storage location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="low_stock">Low Stock</option>
            <option value="expired">Expired</option>
            <option value="sold_out">Sold Out</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="sell_first">Sell First</option>
            <option value="monitor">Monitor</option>
            <option value="normal">Normal</option>
          </select>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Batch Code</th>
                <th className="px-5 py-3.5">Fruit Type</th>
                <th className="px-5 py-3.5">Remaining / Orig</th>
                <th className="px-5 py-3.5">Freshness Grade</th>
                <th className="px-5 py-3.5">Est. Shelf Life</th>
                <th className="px-5 py-3.5">Storage Location</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    Loading inventory records…
                  </td>
                </tr>
              ) : filteredBatches.length > 0 ? (
                filteredBatches.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-800">
                      <button
                        onClick={() => viewBatchDetail(b)}
                        className="text-emerald-700 hover:underline"
                      >
                        {b.batch_code}
                      </button>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 capitalize">{b.fruit_type}</td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-800">
                        {b.remaining_quantity !== undefined ? b.remaining_quantity : b.quantity}
                      </span>
                      <span className="text-slate-400 font-normal"> / {b.quantity} {b.unit}</span>
                      {b.spoiled_quantity > 0 && (
                        <div className="text-[10px] text-rose-500 font-medium">
                          {b.spoiled_quantity} {b.unit} spoiled
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <FreshnessBadge
                        state={b.freshness?.state}
                        score={b.freshness?.avg_freshness_pct}
                      />
                    </td>
                    <td className="px-5 py-4">
                      {b.remaining_shelf_life_days !== null && b.remaining_shelf_life_days !== undefined ? (
                        <div
                          className={`font-semibold ${
                            b.remaining_shelf_life_days <= 1
                              ? 'text-rose-600'
                              : b.remaining_shelf_life_days <= 3
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {b.remaining_shelf_life_days} days
                        </div>
                      ) : (
                        <span className="text-slate-400">Not inspected</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{b.storage_location || 'Warehouse'}</td>
                    <td className="px-5 py-4">
                      <PriorityBadge level={b.priority?.level} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedBatchForMovement(b)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          Record Stock
                        </button>
                        <button
                          onClick={() => viewBatchDetail(b)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                          title="View Audit Ledger"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {b.status !== 'archived' && (
                          <button
                            onClick={() => archiveBatch(b._id)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No matching inventory batches found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Batch Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateBatch}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Register New Produce Batch</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Fruit Variety</label>
                <select
                  value={newBatch.fruit_type}
                  onChange={(e) => setNewBatch({ ...newBatch, fruit_type: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="Apple">Apple</option>
                  <option value="Banana">Banana</option>
                  <option value="Mango">Mango</option>
                  <option value="Orange">Orange</option>
                  <option value="Tomato">Tomato</option>
                  <option value="Carrot">Carrot</option>
                  <option value="Cucumber">Cucumber</option>
                  <option value="Strawberry">Strawberry</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Quantity & Unit</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={newBatch.quantity}
                    onChange={(e) => setNewBatch({ ...newBatch, quantity: parseFloat(e.target.value) || 0 })}
                    className="flex-1 p-2.5 rounded-xl border border-slate-200"
                  />
                  <select
                    value={newBatch.unit}
                    onChange={(e) => setNewBatch({ ...newBatch, unit: e.target.value })}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="kg">kg</option>
                    <option value="crates">crates</option>
                    <option value="boxes">boxes</option>
                    <option value="pieces">pieces</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Supplier / Orchard</label>
                <input
                  type="text"
                  placeholder="e.g. GreenValley Farms"
                  value={newBatch.supplier_name}
                  onChange={(e) => setNewBatch({ ...newBatch, supplier_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Purchase Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={newBatch.purchase_cost}
                  onChange={(e) => setNewBatch({ ...newBatch, purchase_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Storage Location / Bay</label>
                <input
                  type="text"
                  placeholder="e.g. Cold Room 2 - Shelf B4"
                  value={newBatch.storage_location}
                  onChange={(e) => setNewBatch({ ...newBatch, storage_location: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Batch Notes</label>
                <textarea
                  rows={2}
                  placeholder="Arrival inspection observations, grade, temperature remarks…"
                  value={newBatch.notes}
                  onChange={(e) => setNewBatch({ ...newBatch, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
              >
                Create Batch Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Stock Movement Modal */}
      {selectedBatchForMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleRecordMovement}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Record Stock Operation</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {selectedBatchForMovement.batch_code} ({selectedBatchForMovement.fruit_type})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatchForMovement(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Operation Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'sold', label: 'Sale / Dispatch' },
                    { id: 'spoiled', label: 'Discard / Spoilage' },
                    { id: 'incoming', label: 'Restock / Incoming' },
                    { id: 'adjustment', label: 'Physical Count Audit' }
                  ].map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setMovementType(op.id as any)}
                      className={`p-2 rounded-xl font-bold border transition-all text-center ${
                        movementType === op.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Quantity ({selectedBatchForMovement.unit})
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={movementQty}
                  onChange={(e) => setMovementQty(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Operational Audit Reason</label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="e.g. Routine client dispatch invoice #940"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedBatchForMovement(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={movementLoading}
                className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
              >
                {movementLoading ? 'Recording…' : 'Commit Stock Movement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Batch Audit Trail Drawer */}
      {activeBatchDetail && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 p-6 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between border-b pb-4 border-slate-100">
            <div>
              <span className="font-mono text-xs font-bold text-emerald-700">
                {activeBatchDetail.batch_code}
              </span>
              <h3 className="text-lg font-bold text-slate-900 capitalize">
                {activeBatchDetail.fruit_type} Batch
              </h3>
            </div>
            <button
              onClick={() => setActiveBatchDetail(null)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Remaining Stock</span>
                <div className="text-base font-extrabold text-slate-800 mt-1">
                  {activeBatchDetail.remaining_quantity !== undefined
                    ? activeBatchDetail.remaining_quantity
                    : activeBatchDetail.quantity}{' '}
                  {activeBatchDetail.unit}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Shelf Life Outlook</span>
                <div className="text-base font-extrabold text-slate-800 mt-1">
                  {activeBatchDetail.remaining_shelf_life_days ?? 'N/A'} days
                </div>
              </div>
            </div>

            {/* Freshness & Priority Status */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Freshness Status:</span>
                <FreshnessBadge state={activeBatchDetail.freshness?.state} score={activeBatchDetail.freshness?.avg_freshness_pct} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Stock Priority:</span>
                <PriorityBadge level={activeBatchDetail.priority?.level} />
              </div>
              {activeBatchDetail.priority?.reason && (
                <p className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-200">
                  {activeBatchDetail.priority.reason}
                </p>
              )}
            </div>

            {/* Stock Movement Audit Log */}
            <div>
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                <span>Auditable Stock Movement Log</span>
              </h4>

              <div className="space-y-2">
                {movementsHistory.length > 0 ? (
                  movementsHistory.map((m) => (
                    <div key={m._id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="uppercase text-[10px] tracking-wider text-slate-600 font-bold">
                          {m.type}
                        </span>
                        <span
                          className={`font-mono ${
                            m.type === 'sold' || m.type === 'spoiled'
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {m.type === 'sold' || m.type === 'spoiled' ? '-' : '+'}
                          {m.quantity} {activeBatchDetail.unit}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{m.reason || 'No description provided'}</p>
                      <div className="text-[10px] text-slate-400">
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 italic">No movement logs recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
