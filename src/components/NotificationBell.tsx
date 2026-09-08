import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, GitFork, Heart, Download, Loader2 } from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  AppNotification,
} from '../lib/notifications';
import { useAuth } from '../contexts/AuthContext';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Poll for the unread count so the badge stays current even if the user
  // never opens the dropdown — simple and reliable, no realtime subscription
  // to manage/clean up. 45s is frequent enough to feel current without
  // hammering the DB.
  useEffect(() => {
    if (!user) return;
    fetchUnreadCount().then(setUnreadCount);
    const interval = setInterval(() => {
      fetchUnreadCount().then(setUnreadCount);
    }, 45000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      setLoading(true);
      const data = await fetchNotifications();
      setNotifications(data);
      setLoading(false);
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read) {
      markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (n.artworkId) navigate(`/art/${n.artworkId}`);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-900/5 transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Notifications</span>
            {notifications.some((n) => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <p className="text-xs font-semibold text-slate-400 text-center py-10 px-4">
                No notifications yet — you'll see it here when someone remixes your work.
              </p>
            )}

            {!loading &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${
                    !n.read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      n.type === 'favorite' ? 'bg-red-100' : n.type === 'download' ? 'bg-emerald-100' : 'bg-indigo-100'
                    }`}
                  >
                    {n.type === 'favorite' ? (
                      <Heart className="w-3.5 h-3.5 text-red-500" fill="currentColor" />
                    ) : n.type === 'download' ? (
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <GitFork className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs leading-snug ${!n.read ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
