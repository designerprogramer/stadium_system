import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import API from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiError";
import { getCurrentUser } from "../../lib/auth";
import DashboardPageHeader from "../../components/DashboardPageHeader";

const BASE_FORM = {
  title: "",
  description: "",
  date: "",
  location: "",
  team1_name: "",
  team2_name: "",
};

function statusStyle(status) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function formatEventDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function StaffEvents() {
  const currentUser = getCurrentUser();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [isSportEvent, setIsSportEvent] = useState(false);
  const [form, setForm] = useState(BASE_FORM);

  const [image, setImage] = useState(null);
  const [team1Logo, setTeam1Logo] = useState(null);
  const [team2Logo, setTeam2Logo] = useState(null);

  const myEvents = useMemo(
    () => events.filter((event) => event.created_by_details?.id === currentUser?.id),
    [events, currentUser?.id]
  );

  const loadEvents = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const response = await API.get("/events/");
      setEvents(response.data);
    } catch (apiError) {
      setError("Failed to load events.");
      console.error(apiError);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadEvents(true);
    const intervalId = setInterval(() => {
      loadEvents(false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setIsSportEvent(false);
    setForm(BASE_FORM);
    setImage(null);
    setTeam1Logo(null);
    setTeam2Logo(null);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toFormData = () => {
    const data = new FormData();

    data.append("description", form.description);
    data.append("date", form.date);
    data.append("location", form.location);
    data.append("is_sport_event", isSportEvent ? "true" : "false");

    if (isSportEvent) {
      data.append("title", `${form.team1_name} VS ${form.team2_name}`.trim());
      data.append("team1_name", form.team1_name);
      data.append("team2_name", form.team2_name);
      if (team1Logo) data.append("team1_logo", team1Logo);
      if (team2Logo) data.append("team2_logo", team2Logo);
    } else {
      data.append("title", form.title);
      if (image) data.append("image", image);
      data.append("team1_name", "");
      data.append("team2_name", "");
    }

    return data;
  };

  const submitEvent = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const payload = toFormData();
      if (editingId) {
        await API.patch(`/events/${editingId}/`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Event updated. It is now pending admin review.");
      } else {
        await API.post("/events/", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Event created successfully.");
      }

      resetForm();
      await loadEvents(false);
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Unable to save event."));
      console.error(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setIsSportEvent(Boolean(item.is_sport_event));
    setForm({
      title: item.title || "",
      description: item.description || "",
      date: toDateInput(item.date),
      location: item.location || "",
      team1_name: item.team1_name || "",
      team2_name: item.team2_name || "",
    });
    setImage(null);
    setTeam1Logo(null);
    setTeam2Logo(null);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeEvent = async (eventId) => {
    if (!window.confirm("Delete this event? This cannot be undone.")) {
      return;
    }

    try {
      await API.delete(`/events/${eventId}/`);
      setMessage("Event deleted successfully.");
      await loadEvents(false);
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Failed to delete event."));
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Staff events"
        title="Create And Manage Your Events"
        description="You can edit or delete only the events you created. Admin can manage all events."
        icon={CalendarClock}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}

      <form onSubmit={submitEvent} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-slate-900">{editingId ? "Edit Event" : "Create Event"}</h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
              Cancel edit
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsSportEvent(false)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              !isSportEvent
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Normal Event
          </button>
          <button
            type="button"
            onClick={() => setIsSportEvent(true)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              isSportEvent
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Sport Event
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {!isSportEvent ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Event title</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleInputChange}
                  required={!isSportEvent}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Event image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold"
                />
              </div>
            </>
          ) : (
            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Team 1 name</label>
                <input
                  name="team1_name"
                  value={form.team1_name}
                  onChange={handleInputChange}
                  required={isSportEvent}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-700"
                />
                <label className="mb-1 mt-3 block text-sm font-semibold text-slate-700">Team 1 logo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setTeam1Logo(event.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Team 2 name</label>
                <input
                  name="team2_name"
                  value={form.team2_name}
                  onChange={handleInputChange}
                  required={isSportEvent}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-700"
                />
                <label className="mb-1 mt-3 block text-sm font-semibold text-slate-700">Team 2 logo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setTeam2Logo(event.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleInputChange}
              rows={4}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-700"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Date and time</label>
              <input
                type="datetime-local"
                name="date"
                value={form.date}
                onChange={handleInputChange}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleInputChange}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-700"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {editingId ? "Save changes" : "Create event"}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900">My Events</h3>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading events...</p>
        ) : myEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">You have not created any events yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {myEvents.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{item.title}</h4>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                      <CalendarClock className="h-4 w-4" />
                      {formatEventDate(item.date)} | {item.location}
                    </div>
                  </div>

                  <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusStyle(item.status)}`}>
                    {item.status === "rejected" ? "revoked" : item.status}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-700">{item.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => removeEvent(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
