import { useEffect, useState } from "react";
import { CalendarCheck2, CheckCircle2, ClipboardCheck, DollarSign, Loader2, Ticket } from "lucide-react";

import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

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
      <div className="dashboard-panel p-8 text-center text-slate-500">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Loading reports...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard-panel border-rose-200 p-6 text-sm font-semibold text-rose-700">
        Unable to load report data.
      </div>
    );
  }

  const summary = data.summary;

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Admin Reports"
        title="Operational Reports"
        description="Ticket performance, manual requests, check-ins, and external stadium booking income."
        icon={ClipboardCheck}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric label="Tickets (Month)" value={summary.tickets_this_month} icon={Ticket} tone="text-blue-700 bg-blue-50" />
        <Metric
          label="Revenue (Month)"
          value={currency(summary.revenue_this_month)}
          note={`Tickets ${currency(summary.ticket_revenue_this_month)} + Bookings ${currency(summary.external_revenue_this_month)}`}
          icon={DollarSign}
          tone="text-emerald-700 bg-emerald-50"
        />
        <Metric label="External Bookings" value={summary.external_bookings_this_month || 0} icon={CalendarCheck2} tone="text-cyan-700 bg-cyan-50" />
        <Metric label="Check-ins" value={summary.checkins_this_month} icon={CheckCircle2} tone="text-violet-700 bg-violet-50" />
        <Metric label="Pending Events" value={summary.pending_events} accent="text-amber-700" icon={ClipboardCheck} tone="text-amber-700 bg-amber-50" />
        <Metric label="Pending Manual" value={summary.pending_manual_requests} accent="text-violet-700" icon={Ticket} tone="text-violet-700 bg-violet-50" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="dashboard-panel p-6">
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

        <section className="dashboard-panel p-6">
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
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
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

      <section className="dashboard-panel p-6">
        <h3 className="text-lg font-bold text-slate-900">External Stadium Booking Income</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 font-semibold">Booking</th>
                <th className="pb-2 font-semibold">Organizer</th>
                <th className="pb-2 font-semibold">Scheduled</th>
                <th className="pb-2 font-semibold">Reference</th>
                <th className="pb-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data.external_bookings || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-slate-500">
                    No paid external stadium bookings this month.
                  </td>
                </tr>
              ) : (
                data.external_bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 font-semibold text-slate-800">{booking.title}</td>
                    <td className="py-2 text-slate-600">{booking.organizer_name}</td>
                    <td className="py-2 text-slate-600">{new Date(booking.scheduled_at).toLocaleString()}</td>
                    <td className="py-2 text-slate-600">{booking.payment_reference || "N/A"}</td>
                    <td className="py-2 font-semibold text-emerald-700">{currency(booking.amount_paid)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, note, accent = "text-slate-900", icon: Icon, tone = "text-slate-700 bg-slate-50" }) {
  return (
    <article className="dashboard-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={`mt-3 text-2xl font-bold ${accent}`}>{value ?? 0}</p>
      {note && <p className="mt-2 text-[11px] leading-5 text-slate-500">{note}</p>}
    </article>
  );
}
