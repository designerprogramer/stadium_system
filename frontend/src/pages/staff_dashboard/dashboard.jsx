import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  DollarSign,
  Download,
  Filter,
  Info,
  Minus,
  QrCode,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import API from "../../lib/api";

export default function StaffDashboard() {
  const [stats, setStats] = useState({
    total_revenue: 0,
    total_tickets: 0,
    upcoming_events: 0,
    recent_tickets: [],
    trends: {},
    daily_activity: [],
    monthly_revenue: [],
    period: {},
  });

  const [access, setAccess] = useState({
    allowed: false,
    message: "",
    active_duties: [],
  });

  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const [statsResponse, accessResponse, dutiesResponse] = await Promise.all([
        API.get("/events/staff-stats/"),
        API.get("/events/ticket-scan-access/"),
        API.get("/staff-duties/", { params: { upcoming: true } }),
      ]);

      setStats(statsResponse.data);
      setAccess(accessResponse.data);
      setDuties(dutiesResponse.data || []);
    } catch (error) {
      console.error("Failed to load staff dashboard", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();

    const intervalId = setInterval(loadDashboard, 5000);
    window.addEventListener("focus", loadDashboard);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", loadDashboard);
    };
  }, [loadDashboard]);

  const money = (value) => `$ ${Number(value || 0).toFixed(2)}`;

  const recentTickets = useMemo(() => stats.recent_tickets || [], [stats.recent_tickets]);

  const salesBars = useMemo(() => {
    const activity = stats.daily_activity || [];
    const values = activity.map((item) => Number(item.tickets || 0));

    const max = Math.max(...values, 1);

    return values.map((value, index) => ({
      value,
      label: new Date(activity[index].date).toLocaleDateString([], { weekday: "short" }),
      height: Math.max(22, (value / max) * 120),
      active: value === max && value > 0,
    }));
  }, [stats.daily_activity]);

  const overviewMonths = useMemo(() => {
    const months = stats.monthly_revenue || [];
    const max = Math.max(...months.map((item) => Number(item.revenue || 0)), 1);
    return months.map((item) => {
      const value = Number(item.revenue || 0);
      return {
        month: new Date(`${item.month}-01T00:00:00`).toLocaleDateString([], { month: "short" }),
        value,
        height: Math.max(40, (value / max) * 135),
      };
    });
  }, [stats.monthly_revenue]);

  const metrics = [
    {
      label: "Total Revenue",
      value: money(stats.total_revenue),
      trend: stats.trends?.revenue,
      icon: DollarSign,
    },
    {
      label: "Tickets Sold",
      value: Number(stats.total_tickets || 0).toLocaleString(),
      trend: stats.trends?.tickets,
      icon: Ticket,
    },
    {
      label: "Upcoming Events",
      value: Number(stats.upcoming_events || 0).toLocaleString(),
      trend: stats.trends?.events,
      icon: CalendarDays,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <p className="text-sm font-semibold text-slate-500">Loading staff dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Staff sales, duties, and scanner access overview.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <CalendarDays className="h-4 w-4" />
              {formatPeriod(stats.period)}
            </button>

            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              Monthly
              <ChevronDown className="h-4 w-4" />
            </button>

            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <Filter className="h-4 w-4" />
              Filter
            </button>

            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Top metrics */}
        <section className="grid gap-4 md:grid-cols-3">
          {metrics.map(({ label, value, trend, icon: Icon }) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-slate-700">{label}</p>
                </div>
                <Info className="h-4 w-4 text-slate-400" />
              </div>

              <div className="mt-4 flex items-end gap-3">
                <p className="text-2xl font-bold tracking-tight text-slate-950">{value}</p>
                <TrendBadge trend={trend} />
              </div>
            </article>
          ))}
        </section>

        {/* Main charts */}
        <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          {/* Sales Overview */}
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-bold text-slate-900">Sales Overview</h2>
                </div>

                <div className="mt-4 flex items-end gap-3">
                  <p className="text-2xl font-bold text-slate-950">{money(stats.total_revenue)}</p>
                  <TrendBadge trend={stats.trends?.revenue} />
                  <span className="pb-1 text-xs font-medium text-slate-500">
                    {formatDelta(stats.trends?.revenue, money)} vs previous 7 days
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
                  Filter
                </button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
                  Sort
                </button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
                  ...
                </button>
              </div>
            </div>

            <div className="mt-8 flex h-56 items-end justify-between gap-8 px-4">
              {overviewMonths.map((item) => (
                <div key={item.month} className="flex flex-1 flex-col items-center">
                  <p className="mb-3 text-xs font-bold text-slate-700">{money(item.value)}</p>

                  <div className="w-full max-w-[110px] rounded-t-xl bg-indigo-600" style={{ height: `${item.height}px` }} />

                  <p className="mt-4 text-xs font-semibold text-slate-500">{item.month}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-center text-[11px] font-semibold text-slate-500">Total revenue by month</p>
          </article>

          {/* Active Duties */}
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-900">Total Duties</h2>
              </div>

              <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
                Weekly
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <p className="text-2xl font-bold text-slate-950">{duties.length}</p>
              <TrendBadge trend={stats.trends?.duties} />
              <span className="pb-1 text-xs text-slate-500">active duty records</span>
            </div>

            <div className="mt-8 flex h-48 items-end justify-between gap-3">
              {salesBars.length ? (
                salesBars.map((bar) => (
                  <div key={bar.label} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className={`w-full rounded-t-lg ${
                        bar.active
                          ? "bg-gradient-to-t from-indigo-600 to-violet-400"
                          : "bg-slate-100"
                      }`}
                      style={{ height: `${bar.height}px` }}
                    />
                    <span
                      className={`text-[11px] font-semibold ${
                        bar.active ? "text-slate-950" : "text-slate-400"
                      }`}
                    >
                      {bar.label}
                    </span>
                  </div>
                ))
              ) : (
                <p className="m-auto text-sm text-slate-400">No activity yet</p>
              )}
            </div>
          </article>
        </section>

        {/* Bottom section */}
        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          {/* Scanner access */}
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-900">Operational Access</h2>
              </div>

              <span
                className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                  access.allowed
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {access.allowed ? "Enabled" : "Required"}
              </span>
            </div>

            <div
              className={`mt-5 rounded-2xl border p-4 ${
                access.allowed
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-amber-100 bg-amber-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    access.allowed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {access.allowed ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Clock3 className="h-5 w-5" />
                  )}
                </span>

                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {access.allowed ? "Scanner enabled" : "Scanner duty required"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {access.message || "No access message available."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {duties.slice(0, 4).map((duty) => (
                <div
                  key={duty.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">{duty.title}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {duty.event_title || "General duty"}
                    </p>
                  </div>

                  <span className="text-[11px] font-bold text-slate-500">
                    {duty.ends_at
                      ? new Date(duty.ends_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </span>
                </div>
              ))}

              {!duties.length && (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                  No active duties found
                </p>
              )}
            </div>
          </article>

          {/* Recent ticket sales */}
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Recent Ticket Sales</h2>
                <p className="mt-1 text-xs text-slate-500">Latest tickets purchased by customers</p>
              </div>

              <span className="text-xs font-semibold text-indigo-600">
                {recentTickets.length} Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-bold">Ticket</th>
                    <th className="px-5 py-3 font-bold">Customer</th>
                    <th className="px-5 py-3 font-bold">Event</th>
                    <th className="px-5 py-3 font-bold">Amount</th>
                    <th className="px-5 py-3 font-bold">Time</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {recentTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-bold text-slate-900">#{ticket.id}</td>
                      <td className="px-5 py-4 text-slate-600">{ticket.user}</td>
                      <td className="px-5 py-4 text-slate-600">{ticket.event}</td>
                      <td className="px-5 py-4 font-bold text-emerald-600">
                        {money(ticket.price)}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {ticket.date ? new Date(ticket.date).toLocaleString() : "N/A"}
                      </td>
                    </tr>
                  ))}

                  {!recentTickets.length && (
                    <tr>
                      <td colSpan="5" className="px-5 py-10 text-center text-sm text-slate-400">
                        No ticket sales yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

function TrendBadge({ trend }) {
  const delta = Number(trend?.delta || 0);
  const percent = trend?.percent;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const Icon = isDown ? TrendingDown : isUp ? TrendingUp : Minus;
  const label = percent === null || percent === undefined
    ? (isUp ? "New" : "0%")
    : `${Math.abs(percent).toFixed(1)}%`;
  const tone = isUp
    ? "bg-emerald-50 text-emerald-600"
    : isDown
      ? "bg-rose-50 text-rose-600"
      : "bg-slate-100 text-slate-500";

  return (
    <span className={`mb-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${tone}`}>
      {label}
      <Icon className="h-3 w-3" />
    </span>
  );
}

function formatDelta(trend, money) {
  const delta = Number(trend?.delta || 0);
  if (!delta) return "No change";
  return `${delta > 0 ? "+" : "-"} ${money(Math.abs(delta))}`;
}

function formatPeriod(period) {
  if (!period?.current_start || !period?.current_end) return "Last 7 days";
  const options = { month: "short", day: "numeric" };
  return `${new Date(period.current_start).toLocaleDateString([], options)} - ${new Date(period.current_end).toLocaleDateString([], options)}`;
}
