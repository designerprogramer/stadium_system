import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ReceiptText, WalletCards } from "lucide-react";
import DashboardPageHeader from "../../components/DashboardPageHeader";
import API from "../../lib/api";

export default function History() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await API.get("/events/my-tickets/");
        setTickets(response.data || []);
        setError("");
      } catch (err) {
        console.error("Failed to load booking history", err);
        setError("Unable to load booking history.");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const totalSpent = useMemo(
    () => tickets.reduce((sum, ticket) => sum + Number(ticket.price || 0), 0),
    [tickets]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardPageHeader
        eyebrow="Customer records"
        title="Booking History"
        description="Review your previous ticket purchases."
        icon={ReceiptText}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Summary label="Bookings" value={tickets.length} icon={ReceiptText} />
        <Summary label="Tickets" value={tickets.length} icon={WalletCards} />
        <Summary label="Total spent" value={`$${totalSpent.toFixed(2)}`} icon={CalendarDays} />
      </section>

      <section className="surface overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500">Loading history...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm font-semibold text-rose-600">{error}</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500">No booking history found.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-auto">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Event</th>
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Event date</th>
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Seat</th>
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Paid</th>
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Purchase date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-950">{ticket.event_details?.title || "Event"}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{formatDate(ticket.event_details?.date)}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{ticket.seat_type}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-950">
                    ${Number(ticket.price || 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{formatDate(ticket.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function Summary({ label, value, icon: Icon }) {
  return (
    <div className="surface flex items-center justify-between p-5">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      </div>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
}
