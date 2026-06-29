import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageLoadedAt] = useState(() => Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await API.get("/events/");
        setEvents(response.data);
      } catch (err) {
        console.error("Failed to load events", err);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardPageHeader
        eyebrow="Tickets"
        title="Upcoming Events"
        description="Select an event and continue to secure checkout."
        icon={Ticket}
      />

      {loading ? (
        <div className="surface p-8 text-center text-sm font-semibold text-slate-500">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="surface p-8 text-center text-sm font-semibold text-slate-500">
          No upcoming events available at the moment.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {events.map((event) => {
            const eventDate = new Date(event.date);
            const isExpired = eventDate.getTime() <= pageLoadedAt;
            const hasPurchased = Boolean(event.has_purchased);
            const dateStr = eventDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
            const timeStr = eventDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

            return (
              <article key={event.id} className="border-b border-slate-200 last:border-b-0 transition hover:bg-slate-50">
                <div className="grid items-center gap-4 p-4 md:grid-cols-[1fr_150px_auto] md:px-6">
                  <div className="min-w-0">
                    {event.is_sport_event ? (
                      <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] items-center gap-3 md:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)]">
                        <TeamInline logo={event.team1_logo} name={event.team1_name} align="right" />
                        <div className="text-center">
                          <p className={`text-2xl font-semibold tabular-nums md:text-3xl ${isExpired ? "text-slate-500" : "text-emerald-700"}`}>
                            {isExpired ? dateStr : timeStr}
                          </p>
                          {!isExpired && <p className="mt-1 text-[11px] font-semibold uppercase text-slate-400">{dateStr}</p>}
                        </div>
                        <TeamInline logo={event.team2_logo} name={event.team2_name} />
                      </div>
                    ) : (
                      <div className="grid items-center gap-4 md:grid-cols-[1fr_110px]">
                        <div className="flex min-w-0 items-center gap-3">
                        {event.image && (
                          <img src={event.image} alt={event.title} className="h-12 w-12 rounded-full border border-slate-200 object-cover" />
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-slate-950">{event.title}</h3>
                          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                            <MapPin className="h-4 w-4" />
                            {event.location || "Stadium venue"}
                          </p>
                        </div>
                        </div>
                        <div className="text-left md:text-center">
                          <p className={`text-2xl font-semibold tabular-nums ${isExpired ? "text-slate-500" : "text-emerald-700"}`}>
                            {isExpired ? dateStr : timeStr}
                          </p>
                          {!isExpired && <p className="mt-1 text-[11px] font-semibold uppercase text-slate-400">{dateStr}</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="hidden items-center justify-center gap-2 text-sm font-semibold text-slate-500 md:flex">
                    <CalendarDays className="h-4 w-4" />
                    {isExpired ? dateStr : `${dateStr} ${timeStr}`}
                  </div>

                  <div className="flex items-center justify-end">
                    {hasPurchased ? (
                      <span className="inline-flex items-center justify-center rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                        You bought
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">
                        Expired
                      </span>
                    ) : (
                      <button
                        onClick={() => navigate(`/user/payment/${event.id}`)}
                        className="btn-primary whitespace-nowrap md:w-auto"
                      >
                        Buy Ticket
                      </button>
                    )}
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

function TeamInline({ logo, name, align = "left" }) {
  const reverse = align === "right";

  return (
    <div className={`flex min-w-0 items-center gap-2 ${reverse ? "justify-end text-right" : "justify-start text-left"}`}>
      {reverse && <span className="truncate text-sm font-semibold text-slate-950 md:text-lg">{name}</span>}
      {logo ? (
        <img src={logo} alt={name} className="h-8 w-8 shrink-0 object-contain md:h-10 md:w-10" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 md:h-10 md:w-10">
          {name?.slice(0, 1) || "?"}
        </div>
      )}
      {!reverse && <span className="truncate text-sm font-semibold text-slate-950 md:text-lg">{name}</span>}
    </div>
  );
}
