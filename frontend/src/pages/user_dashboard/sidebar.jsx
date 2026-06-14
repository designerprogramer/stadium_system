import { NavLink } from "react-router-dom";
import { BadgeCheck, CalendarRange, Headphones, Home, ReceiptText } from "lucide-react";
import stadiumLogo from "../../assets/stadium_logo.png";

const navItems = [
  { to: "dashboard", icon: Home, label: "Dashboard" },
  { to: "events", icon: CalendarRange, label: "Events" },
  { to: "ticket", icon: BadgeCheck, label: "Passes" },
  { to: "history", icon: ReceiptText, label: "History" },
  { to: "chatbot", icon: Headphones, label: "Support" },
];

function navClass(isActive) {
  return isActive
    ? "icon-style group relative bg-sky-50 text-sky-600"
    : "icon-style group relative";
}

function Tooltip({ label }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
      {label}
    </span>
  );
}

export default function Sidebar() {
  return (
    <div className="flex h-screen w-20 flex-col items-center justify-between border-r border-slate-200 bg-white py-6">
      <div className="flex flex-col items-center gap-4">
        <img src={stadiumLogo} alt="Stadium logo" className="h-14 w-14 scale-[3] object-contain" />

        <nav className="mt-6 flex flex-col gap-3">
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
    </div>
  );
}
