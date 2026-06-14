import { useEffect, useMemo, useState } from "react";
import { DollarSign, Loader2, PieChart, Ticket, TrendingUp } from "lucide-react";

import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

function currency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function RevenueLine({ data }) {
  if (!data?.length) {
    return <div className="h-56 rounded-xl bg-slate-100" />;
  }

  const width = 640;
  const height = 220;
  const values = data.map((item) => Number(item.revenue || 0));
  const maxValue = Math.max(...values, 1);

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * width;
      const y = height - (value / maxValue) * (height - 20);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full rounded-xl bg-slate-50 p-3">
      <defs>
        <linearGradient id="finance-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="#0ea5e9" strokeWidth="3" points={points} />
    </svg>
  );
}

export default function AdminFinance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await API.get("/events/admin-financial-stats/");
        setData(response.data);
      } catch (error) {
        console.error("Failed to load finance stats", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const seatMax = useMemo(() => {
    if (!data?.revenue_by_seat?.length) return 1;
    return Math.max(...data.revenue_by_seat.map((item) => Number(item.revenue || 0)), 1);
  }, [data]);

  const monthMax = useMemo(() => {
    if (!data?.monthly_revenue?.length) return 1;
    return Math.max(...data.monthly_revenue.map((item) => Number(item.revenue || 0)), 1);
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Loading financial analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
        Unable to load financial analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Finance"
        title="Revenue Analytics"
        description="Live ticket sales insights for admin decisions."
        icon={DollarSign}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Revenue</span>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900">{currency(data.total_revenue)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tickets Sold</span>
            <Ticket className="h-5 w-5 text-blue-700" />
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900">{data.total_tickets}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average Ticket</span>
            <TrendingUp className="h-5 w-5 text-violet-700" />
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900">{currency(data.average_ticket_price)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Daily Revenue (14 Days)</h3>
          <RevenueLine data={data.revenue_by_day} />
          <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[11px] text-slate-500">
            {data.revenue_by_day.map((item) => (
              <span key={item.date}>{new Date(item.date).toLocaleDateString(undefined, { day: "2-digit" })}</span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-cyan-700" />
            <h3 className="text-lg font-bold text-slate-900">Revenue By Seat</h3>
          </div>

          <div className="space-y-4">
            {data.revenue_by_seat.map((item) => {
              const width = Math.max((Number(item.revenue || 0) / seatMax) * 100, 3);
              return (
                <div key={item.seat_type}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{item.seat_type}</span>
                    <span className="text-slate-500">{currency(item.revenue)} | {item.tickets} tickets</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Monthly Revenue</h3>
          <div className="mt-4 space-y-3">
            {data.monthly_revenue.map((item) => {
              const width = Math.max((Number(item.revenue || 0) / monthMax) * 100, 4);
              return (
                <div key={item.month}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{item.month}</span>
                    <span className="text-slate-500">{currency(item.revenue)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Top Events By Revenue</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">Event</th>
                  <th className="pb-2 font-semibold">Tickets</th>
                  <th className="pb-2 font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.top_events.map((item) => (
                  <tr key={item.event_id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 font-semibold text-slate-800">{item.title}</td>
                    <td className="py-2 text-slate-600">{item.tickets}</td>
                    <td className="py-2 font-semibold text-emerald-700">{currency(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
