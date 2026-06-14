import { useEffect, useState } from "react";
import { Calendar, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

const BASE_FORM = {
  title: "",
  description: "",
  date: "",
  location: "",
  status: "approved",
  team1_name: "",
  team2_name: "",
};

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

function statusStyle(status) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(BASE_FORM);
  const [isSportEvent, setIsSportEvent] = useState(false);
  const [image, setImage] = useState(null);
  const [team1Logo, setTeam1Logo] = useState(null);
  const [team2Logo, setTeam2Logo] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  const clearForm = () => {
    setEditingId(null);
    setForm(BASE_FORM);
    setIsSportEvent(false);
    setImage(null);
    setTeam1Logo(null);
    setTeam2Logo(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const buildFormData = () => {
    const payload = new FormData();

    payload.append("description", form.description);
    payload.append("date", form.date);
    payload.append("location", form.location);
    payload.append("status", form.status);
    payload.append("is_sport_event", isSportEvent ? "true" : "false");

    if (isSportEvent) {
      payload.append("title", `${form.team1_name} VS ${form.team2_name}`.trim());
      payload.append("team1_name", form.team1_name);
      payload.append("team2_name", form.team2_name);
      if (team1Logo) payload.append("team1_logo", team1Logo);
      if (team2Logo) payload.append("team2_logo", team2Logo);
    } else {
      payload.append("title", form.title);
      payload.append("team1_name", "");
      payload.append("team2_name", "");
      if (image) payload.append("image", image);
    }

    return payload;
  };

  const submitEvent = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = buildFormData();
      if (editingId) {
        await API.patch(`/events/${editingId}/`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Event updated successfully.");
      } else {
        await API.post("/events/", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessage("Event created successfully.");
      }

      clearForm();
      await loadEvents(false);
    } catch (apiError) {
      const detail = apiError?.response?.data;
      setError(detail?.detail || "Failed to save event.");
    } finally {
      setSaving(false);
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
      status: item.status || "pending",
      team1_name: item.team1_name || "",
      team2_name: item.team2_name || "",
    });
    setImage(null);
    setTeam1Logo(null);
    setTeam2Logo(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this event?")) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await API.delete(`/events/${id}/`);
      setMessage("Event deleted.");
      await loadEvents(false);
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || "Failed to delete event.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await API.patch(`/events/${id}/update-status/`, { status });
      setMessage(`Event ${status}.`);
      await loadEvents(false);
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Admin events"
        title="Event Management Center"
        description="Create, edit, approve, reject, and delete all events from one page."
        icon={Calendar}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}

      <form onSubmit={submitEvent} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-slate-900">{editingId ? "Edit Event" : "Create Event"}</h3>
          {editingId && (
            <button
              type="button"
              onClick={clearForm}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsSportEvent(false)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              !isSportEvent ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
            }`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => setIsSportEvent(true)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              isSportEvent ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
            }`}
          >
            Sport
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {!isSportEvent ? (
            <>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required={!isSportEvent}
                placeholder="Event title"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setImage(event.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
              />
            </>
          ) : (
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <input
                  name="team1_name"
                  value={form.team1_name}
                  onChange={handleChange}
                  required={isSportEvent}
                  placeholder="Team 1"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setTeam1Logo(event.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
                />
              </div>
              <div className="space-y-2">
                <input
                  name="team2_name"
                  value={form.team2_name}
                  onChange={handleChange}
                  required={isSportEvent}
                  placeholder="Team 2"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setTeam2Logo(event.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
                />
              </div>
            </div>
          )}

          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            required
            placeholder="Description"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />

          <div className="grid gap-4 md:grid-cols-3">
            <input
              type="datetime-local"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
            />
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              required
              placeholder="Location"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
            />
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
            >
              <option value="approved">approved</option>
              <option value="pending">pending</option>
              <option value="rejected">revoked</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {editingId ? "Save event" : "Add event"}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">All Events</h3>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No events found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">Event</th>
                  <th className="pb-2 font-semibold">Creator</th>
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2">
                      <p className="font-semibold text-slate-800">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.location}</p>
                    </td>
                    <td className="py-2 text-slate-600">{item.created_by_details?.username || "Unknown"}</td>
                    <td className="py-2 text-slate-600">{formatEventDate(item.date)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusStyle(item.status)}`}>
                        {item.status === "rejected" ? "revoked" : item.status}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvent(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(item.id, "approved")}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(item.id, "rejected")}
                          className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
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
