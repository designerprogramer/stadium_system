import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";

import API from "../../lib/api";

function currency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function statusBadge(status) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

export default function Report() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const response = await API.get("/events/admin-report-stats/");
        setData(response.data);
      } catch (error) {
        console.error("Failed to load admin report", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Loading reports...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
        Unable to load report data.
      </div>
    );
  }

  const summary = data.summary;

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Admin Reports</p>
        <h2 className="mt-2 text-3xl font-black">Operational Intelligence</h2>
        <p className="mt-2 text-sm text-indigo-100">Clean report view for ticket performance and manual workflow monitoring.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Tickets (Month)</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary.tickets_this_month}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Revenue (Month)</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{currency(summary.revenue_this_month)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Check-ins</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary.checkins_this_month}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Pending Events</p>
          <p className="mt-2 text-2xl font-black text-amber-700">{summary.pending_events}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Pending Manual</p>
          <p className="mt-2 text-2xl font-black text-violet-700">{summary.pending_manual_requests}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Event Performance</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">Event</th>
                  <th className="pb-2 font-semibold">Tickets Sold</th>
                  <th className="pb-2 font-semibold">Check-ins</th>
                  <th className="pb-2 font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.event_performance.map((row) => (
                  <tr key={row.event_id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 font-semibold text-slate-800">{row.title}</td>
                    <td className="py-2 text-slate-600">{row.tickets_sold}</td>
                    <td className="py-2 text-slate-600">{row.checkins}</td>
                    <td className="py-2 font-semibold text-emerald-700">{currency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-indigo-700" />
            <h3 className="text-lg font-bold text-slate-900">Recent Manual Requests</h3>
          </div>

          <div className="space-y-3">
            {data.manual_requests.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                No manual ticket requests yet.
              </p>
            )}

            {data.manual_requests.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {item.target_full_name || item.target_user}
                        {item.target_username ? ` (@${item.target_username})` : ""}
                      </p>
                      <p className="text-xs text-slate-500">{item.event}</p>
                    </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${statusBadge(item.status)}`}>
                    {item.status === "rejected" ? "revoked" : item.status}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-600">Staff: {item.requester} | Seat: {item.seat_type}</p>
                <p className="mt-1 text-[11px] text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
