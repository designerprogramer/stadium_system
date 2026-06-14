import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";

import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

const EMPTY_FORM = {
  target_full_name: "",
  target_username: "",
  event: "",
  seat_type: "Normal",
  reason: "",
};

function statusBadge(status) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

export default function NonBuyTicket() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [pageLoadedAt] = useState(() => Date.now());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const approvedEvents = useMemo(
    () => events.filter((event) => event.status === "approved" && new Date(event.date).getTime() > pageLoadedAt),
    [events, pageLoadedAt]
  );

  const loadEvents = useCallback(async () => {
    const response = await API.get("/events/");
    setEvents(response.data);
  }, []);

  const loadRequests = useCallback(async () => {
    const response = await API.get("/events/manual-ticket-requests/");
    setRequests(response.data);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadEvents(), loadRequests()]);
    } catch (apiError) {
      setError("Failed to load manual ticket data.");
      console.error(apiError);
    } finally {
      setLoading(false);
    }
  }, [loadEvents, loadRequests]);

  useEffect(() => {
    loadData();

    const intervalId = setInterval(async () => {
      try {
        await loadRequests();
      } catch (apiError) {
        console.error("Auto-refresh failed", apiError);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [loadData, loadRequests]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      await API.post("/events/manual-ticket-requests/", {
        target_full_name: form.target_full_name,
        target_username: form.target_username,
        event: Number(form.event),
        seat_type: form.seat_type,
        reason: form.reason,
      });

      setForm(EMPTY_FORM);
      setMessage("Manual free-ticket request submitted to admin.");
      await loadRequests();
    } catch (apiError) {
      const detail = apiError?.response?.data;
      setError(
        detail?.detail ||
          detail?.target_username?.[0] ||
          detail?.target_full_name?.[0] ||
          detail?.non_field_errors?.[0] ||
          "Failed to submit request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Staff action"
        title="Free Ticket Requests"
        description="Enter full name and username, choose event and seat type, then send for admin approval."
        icon={Send}
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Create Request</h2>
          <p className="mt-1 text-sm text-slate-500">Free ticket will be issued only when admin approves.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Full name</label>
              <input
                name="target_full_name"
                value={form.target_full_name}
                onChange={handleChange}
                required
                placeholder="Enter full name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Username</label>
              <input
                name="target_username"
                value={form.target_username}
                onChange={handleChange}
                required
                placeholder="Enter existing username"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Event</label>
              <select
                name="event"
                value={form.event}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-700"
              >
                <option value="">Select an approved event</option>
                {approvedEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} | {new Date(event.date).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Seat type</label>
              <select
                name="seat_type"
                value={form.seat_type}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-700"
              >
                <option value="Normal">Normal</option>
                <option value="VIP">VIP</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Reason (optional)</label>
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows={4}
                placeholder="Reason for free ticket"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to admin
          </button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">My Request History</h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading requests...</p>
          ) : requests.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No free-ticket requests yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {requests.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {item.target_full_name} (@{item.target_username})
                      </p>
                      <p className="text-xs text-slate-500">{item.event_details?.title}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusBadge(item.status)}`}>
                      {item.status === "rejected" ? "revoked" : item.status}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-700">
                    Seat: <span className="font-semibold">{item.seat_type}</span>
                  </p>

                  {item.reason && <p className="mt-1 text-sm text-slate-600">Reason: {item.reason}</p>}
                  {item.admin_note && <p className="mt-1 text-sm text-slate-600">Admin note: {item.admin_note}</p>}

                  <p className="mt-2 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
