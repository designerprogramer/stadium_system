import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, CalendarDays, Clock3, MapPin, ReceiptText, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

import API from "../../lib/api";

export default function Dashboard() {
  const [dashboard, setDashboard] = useState({
    tickets_count: 0,
    attended_events: 0,
    upcoming_events: [],
    recent_bookings: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await API.get("/dashboard/");
        setDashboard(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg font-semibold text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Active passes",
      value: dashboard.tickets_count,
      icon: BadgeCheck,
      tone: "bg-blue-50 text-blue-600",
    },
    {
      label: "Upcoming events",
      value: dashboard.upcoming_events.length,
      icon: CalendarDays,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      label: "Used entries",
      value: dashboard.attended_events,
      icon: ReceiptText,
      tone: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="relative overflow-hidden rounded-3xl bg-blue-600 p-7 text-white shadow-sm">
          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-medium text-blue-100">Customer workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Ready for your next stadium visit.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50">
              Browse approved events, keep your QR passes ready, and follow your recent ticket activity from one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/user/events" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                Find events
              </Link>
              <Link to="/user/ticket" className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                View passes
              </Link>
            </div>
          </div>
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/20" />
          <div className="absolute bottom-5 right-7 hidden rounded-2xl bg-white/12 p-4 backdrop-blur md:block">
            <WalletCards className="h-8 w-8 text-white" />
            <p className="mt-3 text-2xl font-bold">{dashboard.tickets_count}</p>
            <p className="text-xs text-blue-100">passes active</p>
          </div>
        </div>

        <aside className="surface p-5">
          <p className="text-sm font-semibold text-slate-500">Quick summary</p>
          <div className="mt-4 space-y-3">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-medium text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-xl font-bold text-slate-950">{item.value}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="surface p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Upcoming Events</h2>
              <p className="mt-1 text-sm text-slate-500">Latest approved events for booking</p>
            </div>
            <Link to="/user/events" className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">
              View all
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="space-y-3">
            {dashboard.upcoming_events.length === 0 ? (
              <EmptyState text="No upcoming events yet." />
            ) : (
              dashboard.upcoming_events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/30">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">{event.name}</h3>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays size={15} />
                          {event.date}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock3 size={15} />
                          {event.time}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin size={15} />
                          {event.location}
                        </span>
                      </div>
                    </div>
                    <Link to="/user/events" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                      Book
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="surface p-5">
          <h2 className="text-xl font-bold text-slate-950">Recent Bookings</h2>
          <p className="mt-1 text-sm text-slate-500">Latest ticket activity</p>

          <div className="mt-5 space-y-3">
            {dashboard.recent_bookings.length === 0 ? (
              <EmptyState text="No recent bookings yet." />
            ) : (
              dashboard.recent_bookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="min-w-0 truncate font-semibold text-slate-900">{booking.event}</h3>
                    <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {booking.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{booking.date}</p>
                  <p className="mt-1 text-sm text-slate-600">{booking.tickets} pass</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center text-sm font-medium text-slate-500">
      {text}
    </div>
  );
}
