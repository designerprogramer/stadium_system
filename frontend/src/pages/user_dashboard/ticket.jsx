import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, CalendarDays, CircleDollarSign, QrCode, ShieldAlert } from "lucide-react";

import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

export default function Ticket() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageLoadedAt] = useState(() => Date.now());

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await API.get("/events/my-tickets/");
        setTickets(response.data);
      } catch (err) {
        console.error("Failed to load tickets", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardPageHeader
        eyebrow="Customer passes"
        title="My Passes"
        description="Keep your event QR passes ready for entry."
        icon={QrCode}
      />

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="font-medium">Do not share your QR code. Staff will scan it at the gate.</p>
      </div>

      {loading ? (
        <div className="surface p-8 text-center text-sm font-semibold text-slate-500">Loading passes...</div>
      ) : tickets.length === 0 ? (
        <div className="surface p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <BadgeCheck className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-950">No passes found</h2>
          <p className="mt-2 text-sm text-slate-500">Purchased tickets will appear here after payment.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {tickets.map((ticket) => {
            const status = getTicketStatus(ticket, pageLoadedAt);

            return (
            <article key={ticket.id} className="surface overflow-hidden">
              <div className="border-b border-slate-200 bg-blue-600 p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-blue-100">Event pass</p>
                    <h2 className="mt-1 truncate text-xl font-bold">{ticket.event_details.title}</h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-blue-50">
                      <CalendarDays className="h-4 w-4" />
                      {new Date(ticket.event_details.date).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 p-5 sm:grid-cols-[190px_1fr] sm:items-center">
                <div className={`mx-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${status.label === "Active" ? "" : "opacity-45"}`}>
                  <QRCodeSVG value={ticket.qr_code_hash} size={220} level="M" marginSize={2} />
                </div>

                <div className="space-y-3">
                  <InfoRow label="Seat type" value={ticket.seat_type} />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Price</p>
                    <p className="mt-1 flex items-center gap-1 text-xl font-bold text-slate-950">
                      <CircleDollarSign className="h-5 w-5 text-slate-400" />
                      {ticket.price}
                    </p>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    {status.message}
                  </p>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getTicketStatus(ticket, now) {
  if (ticket.is_used) {
    return {
      label: "Used",
      message: "This pass has already been scanned and cannot be reused.",
      className: "bg-amber-100 text-amber-800",
    };
  }
  if (new Date(ticket.event_details.date).getTime() <= now) {
    return {
      label: "Expired",
      message: "This event has ended. Staff will reject this QR pass.",
      className: "bg-slate-100 text-slate-700",
    };
  }
  if (ticket.event_details.status !== "approved") {
    return {
      label: "Revoked",
      message: "This event is no longer approved. Staff will reject this QR pass.",
      className: "bg-rose-100 text-rose-800",
    };
  }
  return {
    label: "Active",
    message: "Present this QR pass at the gate. A used pass cannot be reused.",
    className: "bg-emerald-100 text-emerald-800",
  };
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
