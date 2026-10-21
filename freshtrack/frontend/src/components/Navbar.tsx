import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Scan, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Props {
  onOpenNotifications: () => void;
  unreadCount: number;
}

export const Navbar: React.FC<Props> = ({ onOpenNotifications, unreadCount }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">
          Produce Intelligence & Quality Control
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Scan CTA */}
        <button
          onClick={() => navigate('/scanner')}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition-all shadow-emerald-600/20 active:scale-95"
        >
          <Scan className="w-4 h-4" />
          <span>New AI Scan</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden md:block text-left text-xs">
            <div className="font-semibold text-slate-800 leading-tight">{user?.name || 'Operator'}</div>
            <div className="text-[10px] text-slate-500 capitalize">{user?.role || 'user'}</div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-1"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
