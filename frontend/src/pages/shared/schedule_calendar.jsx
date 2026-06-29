import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Search } from "lucide-react";

import DashboardPageHeader from "../../components/DashboardPageHeader";
import API from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiError";

function formatDate(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString();
}

function toAvailabilityIso(value) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function typeBadge(type) {
  if (type === "event") return "bg-blue-100 text-blue-700";
  if (type === "external_booking") return "bg-emerald-100 text-emerald-700";
  return "bg-violet-100 text-violet-700";
}

export default function ScheduleCalendar({ role }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availabilityTime, setAvailabilityTime] = useState("");
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    API.get("/events/calendar/")
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch(() => {
        if (active) setError("Failed to load calendar.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!data?.items) return [];
    return data.items.reduce((acc, item) => {
      const day = new Date(item.starts_at).toLocaleDateString();
      const group = acc.find((entry) => entry.day === day);
      if (group) {
        group.items.push(item);
      } else {
        acc.push({ day, items: [item] });
      }
      return acc;
    }, []);
  }, [data]);

  const checkAvailability = async (event) => {
    event.preventDefault();
    if (!availabilityTime) return;

    setChecking(true);
    setAvailability(null);
    setError("");
    try {
      const response = await API.get("/events/stadium-availability/", {
        params: { scheduled_at: toAvailabilityIso(availabilityTime) },
      });
      setAvailability(response.data);
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Failed to check availability."));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow={`${role} schedule`}
        title="Schedule And Stadium Calendar"
        description="View official events, paid stadium bookings, and staff duties in one calendar."
        icon={CalendarClock}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Stadium Availability</h2>
        <p className="mt-1 text-sm text-slate-500">Checks for event and booking clashes within the protected stadium slot.</p>
        <form onSubmit={checkAvailability} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="datetime-local"
            value={availabilityTime}
            onChange={(event) => setAvailabilityTime(event.target.value)}
            className="input"
            required
          />
          <button type="submit" disabled={checking} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Check
          </button>
        </form>

        {availability && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${availability.available ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <p className="font-bold">{availability.available ? "Available" : "Not available"}</p>
            <p>Protected slot: {availability.slot_hours} hours.</p>
            {availability.clashes?.map((clash) => (
              <p key={`${clash.type}-${clash.id}`} className="mt-1">
                Clash: {clash.title} at {formatDate(clash.scheduled_at)}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Calendar</h2>
        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading calendar...</p>
        ) : grouped.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No schedule entries yet.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {grouped.map((group) => (
              <div key={group.day}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{group.day}</p>
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-slate-900">{item.title}</h3>
                          <p className="text-sm text-slate-600">{formatDate(item.starts_at)} to {formatDate(item.ends_at)}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.location || "Main stadium"} | Owner: {item.owner}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${typeBadge(item.type)}`}>{item.type.replace("_", " ")}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
