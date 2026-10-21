import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Scan,
  Boxes,
  ClockAlert,
  History,
  BarChart3,
  Settings,
  Sparkles,
  Leaf
} from 'lucide-react';

interface Props {
  collapsed?: boolean;
}

export const Sidebar: React.FC<Props> = () => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/scanner', label: 'AI Fruit Scanner', icon: Scan, badge: 'AI Models' },
    { to: '/inventory', label: 'Inventory Batches', icon: Boxes },
    { to: '/prioritization', label: 'Stock Prioritization', icon: ClockAlert },
    { to: '/inspections', label: 'Inspection History', icon: History },
    { to: '/reports', label: 'Reports & Export', icon: BarChart3 },
    { to: '/settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80 bg-slate-950/40">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30">
          <Leaf className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-tight text-white">FreshTrack</span>
            <span className="text-xs font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              AI
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Fruit Intelligence Platform</p>
        </div>
      </div>

      {/* Model Status Card */}
      <div className="p-4 mx-3 my-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs">
        <div className="flex items-center justify-between text-slate-400 font-semibold mb-2 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            AI Pipeline Engine
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
        <div className="space-y-1 text-[11px] text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Stage 1:</span>
            <span className="font-mono text-emerald-300">YOLO11 Bulk</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Stage 2:</span>
            <span className="font-mono text-teal-300">Keras Freshness</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 bg-slate-950/20">
        <p className="font-medium text-slate-300">Produce Warehouse v1.0</p>
        <p className="text-[10px]">Zero food waste operations</p>
      </div>
    </aside>
  );
};
