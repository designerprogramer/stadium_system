import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, CalendarDays, CircleDollarSign, MapPin, QrCode, Ticket as TicketIcon, WalletCards } from "lucide-react";

import API from "../../lib/api";

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

  const summary = useMemo(
    () =>
      tickets.reduce(
        (totals, ticket) => {
          const status = getTicketStatus(ticket, pageLoadedAt);
          totals.total += 1;
          totals[status.key] += 1;
          return totals;
        },
        { total: 0, active: 0, used: 0, expired: 0, revoked: 0 }
      ),
    [tickets, pageLoadedAt]
  );

  const stats = [
    { label: "Total passes", value: summary.total, icon: WalletCards, tone: "bg-blue-50 text-blue-600" },
    { label: "Active passes", value: summary.active, icon: BadgeCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Used entries", value: summary.used, icon: TicketIcon, tone: "bg-violet-50 text-violet-600" },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg font-semibold text-slate-500">Loading passes...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      
      <section className="grid gap-6">
        <div id="passes" className="w-full rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">My Passes</h2>
              <p className="mt-1 text-sm text-slate-500">QR passes for your paid event tickets</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {summary.total} total
            </span>
          </div>

          {tickets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tickets.map((ticket) => {
                const status = getTicketStatus(ticket, pageLoadedAt);
                return <PassCard key={ticket.id} ticket={ticket} status={status} />;
              })}
            </div>
          )}
        </div>

        
      </section>
    </div>
  );
}

function PassCard({ ticket, status }) {
  return (
    <article className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/30 lg:grid-cols-[1.35fr_0.85fr] lg:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-slate-950">{ticket.event_details.title}</h3>
        </div>

        <div className="mt-3 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={15} />
            {new Date(ticket.event_details.date).toLocaleString()}
          </span>
        </div>
s
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoTile label="Seat type" value={ticket.seat_type} />
          <InfoTile label="Price" value={`$${Number(ticket.price || 0).toFixed(2)}`} icon={CircleDollarSign} />
        </div>

        <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
          {status.message}
        </p>
      </div>

      <div className={`mx-auto flex w-full flex-col items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white p-4 ${status.label === "Active" ? "" : "opacity-60"}`}>
        <QRCodeSVG value={ticket.qr_code_hash} size={170} level="M" marginSize={2} />
        <span className={`mt-4 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>
    </article>
  );
}

function InfoTile({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-950">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        {value}
      </p>
    </div>
  );
}

function GuideItem({ title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <BadgeCheck className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950">No passes found</h2>
      <p className="mt-2 text-sm text-slate-500">Purchased tickets will appear here after payment.</p>
      <Link to="/user/events" className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
        Find events
      </Link>
    </div>
  );
}

function getTicketStatus(ticket, now) {
  if (ticket.is_used) {
    return {
      key: "used",
      label: "Used",
      message: "This pass has already been scanned and cannot be reused.",
      className: "bg-amber-100 text-amber-800",
    };
  }
  if (new Date(ticket.event_details.date).getTime() <= now) {
    return {
      key: "expired",
      label: "Expired",
      message: "This event has ended. Staff will reject this QR pass.",
      className: "bg-slate-100 text-slate-700",
    };
  }
  if (ticket.event_details.status !== "approved") {
    return {
      key: "revoked",
      label: "Revoked",
      message: "This event is no longer approved. Staff will reject this QR pass.",
      className: "bg-rose-100 text-rose-800",
    };
  }
  return {
    key: "active",
    label: "Active",
    message: "Present this QR pass at the gate. A used pass cannot be reused.",
    className: "bg-emerald-100 text-emerald-800",
  };
}
