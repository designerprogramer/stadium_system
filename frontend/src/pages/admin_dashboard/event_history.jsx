import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";

import DashboardPageHeader from "../../components/DashboardPageHeader";
import API from "../../lib/api";

function currency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function EventHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/events/event-history/")
      .then((response) => setData(response.data))
      .catch(() => setError("Failed to load event history."))
      .finally(() => setLoading(false));
  }, []);

  const summary = data?.summary;

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Records"
        title="Complete Event History"
        description="Past event records with attendance, tickets sold, revenue, and used or unused ticket reporting."
        icon={History}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading event history...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Events" value={summary?.events} />
            <Metric label="Attendance" value={summary?.attendance_count} />
            <Metric label="Tickets Sold" value={summary?.tickets_sold} />
            <Metric label="Unused Tickets" value={summary?.unused_tickets} />
            <Metric label="Revenue" value={currency(summary?.revenue)} accent="text-emerald-700" />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Past Event Records</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-2 font-semibold">Event</th>
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Attendance</th>
                    <th className="pb-2 font-semibold">Sold</th>
                    <th className="pb-2 font-semibold">Used</th>
                    <th className="pb-2 font-semibold">Unused</th>
                    <th className="pb-2 font-semibold">Revenue</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.records?.map((record) => (
                    <tr key={record.event_id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 font-semibold text-slate-800">{record.title}</td>
                      <td className="py-3 text-slate-600">{new Date(record.date).toLocaleString()}</td>
                      <td className="py-3 text-slate-600">{record.attendance_count}</td>
                      <td className="py-3 text-slate-600">{record.tickets_sold}</td>
                      <td className="py-3 text-emerald-700">{record.used_tickets}</td>
                      <td className="py-3 text-amber-700">{record.unused_tickets}</td>
                      <td className="py-3 font-semibold text-emerald-700">{currency(record.revenue)}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">{record.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data?.records?.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No event records yet.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, accent = "text-slate-900" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value ?? 0}</p>
    </div>
  );
}
