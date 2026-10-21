import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  BarChart,
  Calendar,
  DollarSign,
  AlertTriangle,
  Boxes,
  History
} from 'lucide-react';
import api from '../api/client';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<string>('inventory');
  const [fruitType, setFruitType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [downloading, setDownloading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      let query = `/dashboard/reports?type=${reportType}`;
      if (fruitType) query += `&fruit_type=${fruitType}`;
      if (startDate) query += `&start_date=${startDate}`;
      if (endDate) query += `&end_date=${endDate}`;

      const res = await api.get(query);
      setPreviewData(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      setDownloading(true);
      let query = `/dashboard/reports?type=${reportType}&format=csv`;
      if (fruitType) query += `&fruit_type=${fruitType}`;
      if (startDate) query += `&start_date=${startDate}`;
      if (endDate) query += `&end_date=${endDate}`;

      const res = await api.get(query, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `freshtrack-${reportType}-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Produce Analytics & CSV Export</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate verifiable auditing reports for inventory stock, inspection accuracy, and financial spoilage loss
          </p>
        </div>

        <button
          onClick={handleDownloadCsv}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all self-start md:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'Exporting…' : 'Export CSV Dataset'}</span>
        </button>
      </div>

      {/* Query Filters Control Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
            >
              <option value="inventory">Active Inventory & Shelf-Life</option>
              <option value="inspections">Inspection Telemetry Log</option>
              <option value="spoilage">Recorded Spoilage & Discard Audit</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Fruit Variety Filter</label>
            <input
              type="text"
              placeholder="e.g. Apple, Banana (optional)"
              value={fruitType}
              onChange={(e) => setFruitType(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            Export format complies with ERP / WMS comma-separated standard
          </span>
          <button
            onClick={fetchReportData}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm transition-all"
          >
            {loading ? 'Querying Data…' : 'Generate Report Preview'}
          </button>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            Data Preview ({previewData.length} entries)
          </h3>
          {previewData.length > 0 && (
            <button
              onClick={handleDownloadCsv}
              className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Full CSV</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto max-h-96">
          {previewData.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  {Object.keys(previewData[0])
                    .filter((k) => !['_id', '__v', 'user', 'detections'].includes(k))
                    .slice(0, 7)
                    .map((col) => (
                      <th key={col} className="px-5 py-3">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {previewData.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {Object.keys(row)
                      .filter((k) => !['_id', '__v', 'user', 'detections'].includes(k))
                      .slice(0, 7)
                      .map((col) => (
                        <td key={col} className="px-5 py-3 text-slate-700 truncate max-w-xs">
                          {typeof row[col] === 'object'
                            ? JSON.stringify(row[col])
                            : String(row[col] ?? '')}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400">
              Click "Generate Report Preview" to execute the report query.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
