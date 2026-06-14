import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Mail, Pencil, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

import API from "../lib/api";

const roleStyles = {
  user: {
    label: "Customer",
    badge: "bg-blue-50 text-blue-700",
    avatar: "bg-sky-500 text-white",
    settingsPath: "/user/settings",
  },
  staff: {
    label: "Staff",
    badge: "bg-emerald-50 text-emerald-700",
    avatar: "bg-emerald-600 text-white",
    settingsPath: "/staff/settings",
  },
  admin: {
    label: "Admin",
    badge: "bg-slate-100 text-slate-800",
    avatar: "bg-slate-900 text-white",
    settingsPath: "/admin/settings",
  },
};

function mediaUrl(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const apiRoot = (API.defaults.baseURL || "").replace(/\/api\/?$/, "");
  return `${apiRoot}${value.startsWith("/") ? "" : "/"}${value}`;
}

function initialsFor(name) {
  return (
    name
      .split(/\s|_/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  );
}

function Avatar({ image, initials, style, size = "small" }) {
  const classes =
    size === "large"
      ? "h-20 w-20 text-3xl"
      : size === "button"
        ? "h-12 w-12 text-sm"
        : "h-9 w-9 text-sm";

  if (image) {
    return (
      <span className={`${classes} block overflow-hidden rounded-full`}>
        <img src={mediaUrl(image)} alt="" className="h-full w-full scale-125 object-cover" />
      </span>
    );
  }

  return (
    <span className={`flex ${classes} items-center justify-center rounded-full font-semibold ${style.avatar}`}>
      {initials}
    </span>
  );
}

export default function ProfileMenu({ user, fallbackName = "User", onLogout, compact = false, showDetails = true }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(user || {});

  useEffect(() => {
    setAccount(user || {});
  }, [user]);

  useEffect(() => {
    const handleProfileChanged = (event) => {
      if (event.detail?.user) {
        setAccount((current) => ({ ...current, ...event.detail.user }));
      }
    };

    window.addEventListener("profile:changed", handleProfileChanged);
    return () => window.removeEventListener("profile:changed", handleProfileChanged);
  }, []);

  const username = account?.username || fallbackName;
  const email = account?.email || "No email added";
  const displayName = `${account?.first_name || ""} ${account?.last_name || ""}`.trim() || username;
  const role = account?.role || "user";
  const style = roleStyles[role] || roleStyles.user;
  const initials = initialsFor(displayName);

  const handleEditProfile = () => {
    setOpen(false);
    navigate(style.settingsPath);
  };

  const handleLogout = () => {
    setOpen(false);
    onLogout();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center text-left shadow-sm transition hover:bg-slate-50 ${
          compact
            ? "h-12 w-12 justify-center overflow-hidden rounded-full border border-slate-200 bg-white p-0"
            : "gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
        }`}
        title={displayName}
      >
        <Avatar image={account?.profile_picture} initials={initials} style={style} size={compact ? "button" : "small"} />
        {!compact && (
          <>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-32 truncate text-sm font-semibold text-slate-900">{displayName}</span>
              <span className="block text-xs text-slate-500">{style.label}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && compact && (
        <div className="absolute right-0 z-30 mt-3 w-80 rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-950 shadow-xl">
          <span className="mx-auto block h-20 w-20">
            <Avatar image={account?.profile_picture} initials={initials} style={style} size="large" />
          </span>
          <p className="mt-5 truncate text-lg font-semibold">{displayName}</p>
          <p className="mx-auto mt-1 max-w-64 truncate text-sm leading-6 text-slate-500">{email}</p>
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={handleEditProfile}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              <Pencil className="h-4 w-4" />
              Edit profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {open && !compact && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <Avatar image={account?.profile_picture} initials={initials} style={style} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                  <Mail className="h-3.5 w-3.5" />
                  {email}
                </p>
              </div>
            </div>
          </div>

          {showDetails && (
            <div className="p-2">
              <div className="flex items-center justify-between rounded-xl px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  Role
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}>{style.label}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600">
                <UserRound className="h-4 w-4 text-slate-400" />
                Account session active
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={handleEditProfile}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
