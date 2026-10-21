import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { NotificationsModal } from './NotificationsModal';
import { FruitBotWidget } from './FruitBotWidget';
import api from '../api/client';

export const Layout: React.FC = () => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotificationCount = async () => {
    try {
      const res = await api.get('/notifications?limit=1&unread=true');
      setUnreadCount(res.data.unread_count || 0);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onCountChange={(count) => setUnreadCount(count)}
      />

      {/* Floating Interactive FruitBot Assistant */}
      <FruitBotWidget />
    </div>
  );
};
