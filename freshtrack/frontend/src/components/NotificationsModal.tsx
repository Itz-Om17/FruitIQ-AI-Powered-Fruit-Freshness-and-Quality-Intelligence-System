import React, { useEffect, useState } from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import api from '../api/client';
import { NotificationItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export const NotificationsModal: React.FC<Props> = ({ isOpen, onClose, onCountChange }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications?limit=50');
      setNotifications(res.data.notifications || []);
      if (onCountChange) {
        onCountChange(res.data.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      if (onCountChange) onCountChange(0);
    } catch (err) {
      console.error(err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      const unread = notifications.filter((n) => n._id !== id && !n.read).length;
      if (onCountChange) onCountChange(unread);
    } catch (err) {
      console.error(err);
    }
  };

  const resolve = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/resolve`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, resolved: true, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Operational Alerts & Notifications</h2>
              <p className="text-xs text-slate-500">Urgent batch deadlines, spoilage, and inspection requests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-2 bg-slate-50 flex justify-between items-center text-xs border-b border-slate-100">
          <span className="text-slate-500 font-medium">
            {notifications.filter((n) => !n.read).length} unread alerts
          </span>
          <button
            onClick={markAllRead}
            className="text-emerald-700 hover:text-emerald-800 font-semibold hover:underline"
          >
            Mark all as read
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading alerts…</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2 opacity-60" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-slate-400">No active operational alerts for your inventory.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const icon =
                n.severity === 'critical' ? (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : n.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                );

              return (
                <div
                  key={n._id}
                  className={`p-3.5 rounded-xl border text-sm transition-all ${
                    !n.read
                      ? 'bg-slate-50/80 border-slate-200 shadow-sm'
                      : 'bg-white border-slate-100 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-slate-900 text-xs truncate">{n.title}</h4>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(n.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>

                      <div className="mt-2.5 flex items-center justify-end gap-3 text-xs">
                        {!n.read && (
                          <button
                            onClick={() => markRead(n._id)}
                            className="text-slate-500 hover:text-slate-700 text-[11px]"
                          >
                            Mark read
                          </button>
                        )}
                        {!n.resolved && (
                          <button
                            onClick={() => resolve(n._id)}
                            className="text-emerald-700 hover:text-emerald-800 font-semibold text-[11px]"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
