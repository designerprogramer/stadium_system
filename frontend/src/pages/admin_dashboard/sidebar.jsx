import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  History,
  Home,
  MessageSquare,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";
import stadiumLogo from "../../assets/stadium_logo.png";

const navItems = [
  { to: "dashboard", icon: Home, label: "Dashboard" },
  { to: "finance", icon: BarChart3, label: "Finance" },
  { to: "events", icon: Calendar, label: "Events" },
  { to: "schedule", icon: CalendarClock, label: "Calendar" },
  { to: "external-bookings", icon: CalendarCheck2, label: "Stadium Bookings" },
  { to: "event-history", icon: History, label: "Event History" },
  { to: "manual-tickets", icon: Ticket, label: "Manual Tickets" },
  { to: "staff-management", icon: UserCog, label: "Staff" },
  { to: "users", icon: Users, label: "Users" },
  { to: "support", icon: MessageSquare, label: "Support" },
];

function navClass(isActive) {
  return isActive
    ? "group relative flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 transition"
    : "group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-sky-50 hover:text-sky-600";
}

function Tooltip({ label }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
      {label}
    </span>
  );
}

export default function AdminSidebar() {
  return (
    <aside className="flex h-screen w-20 flex-col items-center justify-between border-r border-slate-200 bg-white/95 py-4 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-2">
        <img src={stadiumLogo} alt="Stadium logo" className="h-14 w-14 scale-[3] object-contain" />

        <nav className="mt-2 flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
                <span className="relative">
                  <Icon size={21} strokeWidth={1.9} />
                </span>
                <Tooltip label={item.label} />
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
