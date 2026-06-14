import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle,
  Info,
  MailOpen,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";
import { getCurrentUser, getDashboardPathForRole } from "../../lib/auth";

const TYPE_STYLES = {
  success: {
    container: "border-emerald-200 bg-emerald-50/60",
    badge: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle,
    iconColor: "text-emerald-600",
  },
  reminder: {
    container: "border-sky-200 bg-sky-50/60",
    badge: "bg-sky-100 text-sky-700",
    icon: CalendarClock,
    iconColor: "text-sky-600",
  },
  warning: {
    container: "border-amber-200 bg-amber-50/60",
    badge: "bg-amber-100 text-amber-700",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
  },
  info: {
    container: "border-slate-200 bg-slate-50/70",
    badge: "bg-slate-100 text-slate-700",
    icon: Info,
    iconColor: "text-slate-600",
  },
};

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const loadNotifications = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const response = await API.get("/notifications/");
      setNotifications(response.data);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadNotifications(true);

    const intervalId = setInterval(() => {
      loadNotifications(false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const updateUnreadCount = (nextNotifications) => {
    const unreadCount = nextNotifications.filter((item) => !item.is_read).length;
    window.dispatchEvent(new CustomEvent("notifications:changed", { detail: { unreadCount } }));
  };

  const markOneRead = async (id) => {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || notification.is_read) {
      return;
    }

    const nextNotifications = notifications.map((item) =>
      item.id === id ? { ...item, is_read: true } : item
    );
    setNotifications(nextNotifications);
    updateUnreadCount(nextNotifications);

    try {
      await API.patch(`/notifications/${id}/mark-read/`);
    } catch (error) {
      console.error("Failed to mark notification as read", error);
      loadNotifications(false);
      window.dispatchEvent(new CustomEvent("notifications:changed"));
    }
  };

  const handleNotificationKeyDown = (event, id) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      markOneRead(id);
    }
  };

  const goBack = () => {
    const from = location.state?.from;
    if (typeof from === "string" && from.startsWith("/")) {
      navigate(from);
      return;
    }
    navigate(getDashboardPathForRole(getCurrentUser()?.role));
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <DashboardPageHeader
        eyebrow="Inbox"
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}.`
            : "Everything is up to date."
        }
        icon={MailOpen}
      />

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">
          Total: {notifications.length} | Unread: {unreadCount}
        </div>
        <span className="text-xs font-semibold text-slate-500">Click a notification to read it</span>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-800">No notifications yet</p>
          <p className="mt-2 text-sm text-slate-500">Important updates will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((item) => {
            const style = TYPE_STYLES[item.type] || TYPE_STYLES.info;
            const Icon = style.icon;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => markOneRead(item.id)}
                onKeyDown={(event) => handleNotificationKeyDown(event, item.id)}
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  item.is_read ? "border-slate-200 bg-white" : style.container
                } ${item.is_read ? "" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"}`}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <Icon className={`h-5 w-5 ${style.iconColor}`} />
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                      <span className="text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.message}</p>

                    <div className="mt-4 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${style.badge}`}>
                        {item.type}
                      </span>

                      <span className={`text-xs font-semibold ${item.is_read ? "text-slate-400" : "text-blue-700"}`}>
                        {item.is_read ? "Read" : "Unread"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
