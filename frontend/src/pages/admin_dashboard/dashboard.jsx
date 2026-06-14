import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, DollarSign, Minus, ShieldCheck, Ticket, TrendingDown, TrendingUp, Users } from "lucide-react";

import API from "../../lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/events/admin-dashboard-stats/")
      .then((response) => setStats(response.data))
      .catch((error) => console.error("Failed to load admin dashboard", error))
      .finally(() => setLoading(false));
  }, []);

  const revenueBars = useMemo(() => {
    const points = stats?.revenue_sparkline || [];
    const max = Math.max(...points.map((point) => Number(point.revenue || 0)), 1);
    return points.map((point) => ({
      ...point,
      height: Number(point.revenue || 0) > 0 ? Math.max(14, (Number(point.revenue || 0) / max) * 100) : 4,
    }));
  }, [stats]);

  const hasRecentRevenue = revenueBars.some((bar) => Number(bar.revenue) > 0);

  if (loading) return <div className="dashboard-panel p-8 text-center text-sm font-semibold text-slate-500">Loading admin dashboard...</div>;
  if (!stats) return <div className="dashboard-panel border-rose-200 p-6 text-sm font-semibold text-rose-700">Unable to load dashboard data.</div>;

  const metrics = [
    { label: "Total revenue", value: `$${Number(stats.total_revenue || 0).toFixed(2)}`, note: `${stats.tickets_sold} tickets`, trend: stats.trends?.revenue, icon: DollarSign, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Customers", value: stats.users_total, note: `${stats.staff_total} staff`, trend: stats.trends?.customers, icon: Users, tone: "text-blue-700 bg-blue-50" },
    { label: "Approved events", value: stats.events_approved, note: `${stats.events_pending} pending`, trend: stats.trends?.approved_events, icon: CheckCircle2, tone: "text-violet-700 bg-violet-50" },
    { label: "Manual requests", value: stats.manual_pending, note: "Awaiting review", trend: stats.trends?.manual_requests, icon: Ticket, tone: "text-amber-700 bg-amber-50" },
  ];

  const governance = [
    ["Total events", stats.events_total],
    ["Approved", stats.events_approved],
    ["Pending", stats.events_pending],
    ["Admin accounts", stats.admins_total],
  ];

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Control center</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Admin Dashboard</h1>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          <TrendingUp className="h-4 w-4 text-blue-600" /> Live overview
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, note, trend, icon: Icon, tone }) => (
          <article key={label} className="dashboard-panel p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500">{note}</p>
              <TrendBadge trend={trend} />
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <article className="dashboard-panel p-5">
          <div className="flex items-center justify-between">
            <div><h2 className="text-sm font-bold text-slate-900">Revenue Overview</h2><p className="mt-1 text-xs text-slate-500">{formatPeriod(stats.period)}</p></div>
            <TrendBadge trend={stats.trends?.revenue} />
          </div>
          <div className="mt-5 flex flex-wrap gap-5 border-b border-slate-100 pb-4">
            <ChartSummary label="Period revenue" value={`$${Number(stats.trends?.revenue?.current || 0).toFixed(2)}`} color="bg-blue-500" />
            <ChartSummary label="Tickets sold" value={Number(stats.trends?.tickets?.current || 0).toLocaleString()} color="bg-violet-500" />
            <ChartSummary label="Previous revenue" value={`$${Number(stats.trends?.revenue?.previous || 0).toFixed(2)}`} color="bg-slate-300" />
          </div>
          <div className="mt-6 flex h-52 items-end gap-3 border-b border-slate-200 px-2 pb-2">
            {revenueBars.map((bar) => (
              <div key={bar.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-500">${Number(bar.revenue).toFixed(0)}</span>
                <div className={`w-full max-w-12 rounded-t-md ${Number(bar.revenue) > 0 ? "bg-blue-500" : "bg-slate-200"}`} style={{ height: `${bar.height}%` }} />
                <span className="text-[10px] text-slate-400">{new Date(bar.day).toLocaleDateString(undefined, { weekday: "short" })}</span>
              </div>
            ))}
          </div>
          {!hasRecentRevenue && (
            <p className="mt-3 text-center text-xs font-semibold text-slate-500">No paid ticket revenue was recorded during this period.</p>
          )}
        </article>

        <article className="dashboard-panel p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-600" /><h2 className="text-sm font-bold text-slate-900">System Governance</h2></div>
          <div className="mt-5 space-y-1">
            {governance.map(([label, value], index) => {
              const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500"];
              const width = Math.max(3, (Number(value || 0) / Math.max(stats.events_total, stats.admins_total, 1)) * 100);
              return (
              <div key={label} className="border-b border-slate-100 py-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{label}</span>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${colors[index]}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            )})}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="dashboard-panel p-5">
          <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-bold text-slate-900">Review Queue</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QueueMetric label="Pending events" value={stats.events_pending} />
            <QueueMetric label="Manual tickets" value={stats.manual_pending} />
          </div>
        </article>
        <article className="dashboard-panel p-5">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-600" /><h2 className="text-sm font-bold text-slate-900">Account Distribution</h2></div>
          <div className="mt-5 flex items-end gap-4">
            <Distribution label="Customers" value={stats.users_total} total={stats.users_total + stats.staff_total + stats.admins_total} color="bg-blue-500" />
            <Distribution label="Staff" value={stats.staff_total} total={stats.users_total + stats.staff_total + stats.admins_total} color="bg-emerald-500" />
            <Distribution label="Admins" value={stats.admins_total} total={stats.users_total + stats.staff_total + stats.admins_total} color="bg-violet-500" />
          </div>
        </article>
      </section>
    </div>
  );
}

function QueueMetric({ label, value }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>;
}

function Distribution({ label, value, total, color }) {
  const height = Math.max(12, (Number(value || 0) / Math.max(total, 1)) * 120);
  return <div className="flex flex-1 flex-col items-center gap-2"><span className="text-xs font-bold text-slate-900">{value}</span><div className={`w-full max-w-16 rounded-t-md ${color}`} style={{ height }} /><span className="text-[11px] text-slate-500">{label}</span></div>;
}

function TrendBadge({ trend }) {
  const delta = Number(trend?.delta || 0);
  const isUp = delta > 0;
  const isDown = delta < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const percent = trend?.percent;
  const label = percent === null || percent === undefined ? (isUp ? "New" : "0%") : `${Math.abs(percent).toFixed(1)}%`;
  const tone = isUp ? "bg-emerald-50 text-emerald-700" : isDown ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500";
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${tone}`}><Icon className="h-3 w-3" />{label}</span>;
}

function ChartSummary({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-xs font-bold text-slate-900">{value}</span>
    </div>
  );
}

function formatPeriod(period) {
  if (!period?.current_start || !period?.current_end) return "Last seven days";
  const options = { month: "short", day: "numeric" };
  return `${new Date(period.current_start).toLocaleDateString([], options)} - ${new Date(period.current_end).toLocaleDateString([], options)}`;
}
