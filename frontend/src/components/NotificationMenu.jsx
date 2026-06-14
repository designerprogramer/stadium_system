import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, MailOpen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../lib/api";

const PREVIEW_LIMIT = 3;

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function unreadCount(items) {
  return items.filter((item) => !item.is_read).length;
}

function syncUnreadCount(nextNotifications) {
  window.dispatchEvent(
    new CustomEvent("notifications:changed", {
      detail: { unreadCount: unreadCount(nextNotifications) },
    })
  );
}

export default function NotificationMenu({ allPath = "notifications" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const visibleNotifications = useMemo(
    () => notifications.slice(0, PREVIEW_LIMIT),
    [notifications]
  );
  const hiddenCount = Math.max(notifications.length - PREVIEW_LIMIT, 0);
  const unread = useMemo(() => unreadCount(notifications), [notifications]);
  const unreadLabel = unread > 99 ? "99+" : `${unread}`;

  const loadNotifications = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await API.get("/notifications/");
      const nextNotifications = response.data || [];
      setNotifications(nextNotifications);
      syncUnreadCount(nextNotifications);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadNotifications(false);

    const handleNotificationsChanged = (event) => {
      if (typeof event.detail?.unreadCount !== "number") {
        loadNotifications(false);
      }
    };

    window.addEventListener("notifications:changed", handleNotificationsChanged);
    const intervalId = setInterval(() => loadNotifications(false), 5000);

    return () => {
      window.removeEventListener("notifications:changed", handleNotificationsChanged);
      clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const markRead = async (items) => {
    const unreadItems = items.filter((item) => !item.is_read);
    if (unreadItems.length === 0) {
      return;
    }

    const unreadIds = new Set(unreadItems.map((item) => item.id));
    const nextNotifications = notifications.map((item) =>
      unreadIds.has(item.id) ? { ...item, is_read: true } : item
    );
    setNotifications(nextNotifications);
    syncUnreadCount(nextNotifications);

    try {
      await Promise.all(
        unreadItems.map((item) => API.patch(`/notifications/${item.id}/mark-read/`))
      );
    } catch (error) {
      console.error("Failed to mark notifications as read", error);
      loadNotifications(false);
      window.dispatchEvent(new CustomEvent("notifications:changed"));
    }
  };

  const toggleOpen = () => {
    setOpen((current) => !current);
    if (!open) {
      loadNotifications(true);
    }
  };

  const openAll = async () => {
    await markRead(notifications);
    setOpen(false);
    navigate(allPath, { state: { from: location.pathname } });
  };

  const openOne = async (notification) => {
    await markRead([notification]);
    setOpen(false);
    navigate(allPath, { state: { from: location.pathname } });
  };

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {unreadLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[100] mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-950">Notifications</p>
              <p className="text-xs text-slate-500">{unread} unread messages</p>
            </div>
            <button
              type="button"
              onClick={openAll}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
            >
              See all
            </button>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Loading messages...
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MailOpen className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-800">No notifications</p>
              <p className="mt-1 text-xs text-slate-500">New messages will appear here.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {visibleNotifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openOne(item)}
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${
                    item.is_read ? "bg-white" : "bg-blue-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatTime(item.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                    {item.message}
                  </p>
                </button>
              ))}
            </div>
          )}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={openAll}
              className="block w-full border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              {hiddenCount} more hidden. See all notifications
            </button>
          )}
        </div>
      )}
    </div>
  );
}
