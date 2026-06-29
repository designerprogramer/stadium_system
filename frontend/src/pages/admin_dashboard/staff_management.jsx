import { useEffect, useState } from "react";
import { Clock3, Loader2, ShieldCheck, Trash2, UserCog } from "lucide-react";

import DashboardPageHeader from "../../components/DashboardPageHeader";
import API from "../../lib/api";

function createEmptyDuty() {
  const startsAt = new Date();
  startsAt.setSeconds(0, 0);
  const endsAt = new Date(startsAt.getTime() + (8 * 60 * 60 * 1000));

  return {
    staff: "",
    event: "",
    duty_type: "ticket_scanning",
    title: "",
    starts_at: toLocalDateTimeInput(startsAt),
    ends_at: toLocalDateTimeInput(endsAt),
    location: "",
    notes: "",
    can_scan_tickets: true,
    can_assign_manual_tickets: false,
    can_manage_bookings: false,
    can_manage_events: false,
  };
}

const dutyTypes = [
  ["ticket_scanning", "Ticket Scanning"],
  ["gate_control", "Gate Control"],
  ["crowd_support", "Crowd Support"],
  ["field_support", "Field Support"],
  ["customer_support", "Customer Support"],
  ["security", "Security"],
  ["maintenance", "Maintenance"],
];

function getApiError(error, fallback) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const value = Object.values(data)[0];
    if (Array.isArray(value)) return value[0];
    if (typeof value === "string") return value;
  }
  return fallback;
}

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [events, setEvents] = useState([]);
  const [duties, setDuties] = useState([]);
  const [form, setForm] = useState(createEmptyDuty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffResponse, eventResponse, dutyResponse] = await Promise.all([
        API.get("/admin/users/", { params: { role: "staff" } }),
        API.get("/events/"),
        API.get("/staff-duties/"),
      ]);
      setStaff(staffResponse.data);
      setEvents(eventResponse.data.filter((item) => item.status !== "rejected"));
      setDuties(dutyResponse.data);
    } catch {
      setError("Failed to load staff management data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const createDuty = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const selectedStaff = Number(form.staff);
    const startsAt = new Date(form.starts_at);
    const endsAt = new Date(form.ends_at);

    // Look for conflicting overlapping duties
    const conflictingDuties = duties.filter((d) => 
      Number(d.staff) === selectedStaff &&
      new Date(d.starts_at) < endsAt &&
      new Date(d.ends_at) > startsAt
    );

    if (conflictingDuties.length > 0) {
      const confirmRemove = window.confirm(
        `Shaqaalahani wuxuu horey u lahaa shaqo kale waqtigan. Ma rabtaa in laga saaro shaqadii hore si loo siiyo shaqadan cusub?\n\nThis staff member already has a duty in this time window. Do you want to remove the existing duty to assign this new one?`
      );
      if (!confirmRemove) {
        setSaving(false);
        return;
      }

      try {
        // Delete all conflicting duties in real-time
        for (const conf of conflictingDuties) {
          await API.delete(`/staff-duties/${conf.id}/`);
        }
      } catch (err) {
        console.error(err);
        setError("Ku guuldareystay in laga saaro shaqadii hore.");
        setSaving(false);
        return;
      }
    }

    const payload = {
      ...form,
      staff: selectedStaff,
      event: form.event ? Number(form.event) : null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    };

    try {
      await API.post("/staff-duties/", payload);
      setForm(createEmptyDuty());
      setMessage("Staff duty assignment created.");
      await loadData();
    } catch (apiError) {
      setError(getApiError(apiError, "Failed to create staff duty."));
    } finally {
      setSaving(false);
    }
  };

  const startDutyNow = async (duty) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await API.patch(`/staff-duties/${duty.id}/`, { starts_at: new Date().toISOString() });
      setMessage(`${duty.title} is active now.`);
      await loadData();
    } catch (apiError) {
      setError(getApiError(apiError, "Failed to start duty."));
    } finally {
      setSaving(false);
    }
  };

  const deleteDuty = async (id) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await API.delete(`/staff-duties/${id}/`);
      setMessage("Staff duty removed.");
      await loadData();
    } catch (apiError) {
      setError(getApiError(apiError, "Failed to remove duty."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Staff operations"
        title="Complete Staff Management"
        description="Assign duties, maintain schedules, and control operational permissions for staff members."
        icon={UserCog}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <form onSubmit={createDuty} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Assign Staff Duty</h2>
          <p className="mt-1 text-sm text-slate-500">Create a duty schedule and choose exactly what this assignment permits.</p>

          <div className="mt-5 grid gap-4">
            <Field label="Staff member">
              <select name="staff" value={form.staff} onChange={handleChange} required className="input">
                <option value="">Select staff</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>{member.username}</option>
                ))}
              </select>
            </Field>
            <Field label="Related event (optional)">
              <select name="event" value={form.event} onChange={handleChange} className="input">
                <option value="">No event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Duty type">
              <select name="duty_type" value={form.duty_type} onChange={handleChange} className="input">
                {dutyTypes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Duty title">
              <input name="title" value={form.title} onChange={handleChange} required className="input" placeholder="Main gate ticket validation" />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Starts at">
                <input type="datetime-local" name="starts_at" value={form.starts_at} onChange={handleChange} required className="input" />
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, starts_at: toLocalDateTimeInput(new Date()) }))}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  Start now
                </button>
              </Field>
              <Field label="Ends at">
                <input type="datetime-local" name="ends_at" value={form.ends_at} onChange={handleChange} required className="input" />
              </Field>
            </div>
            <Field label="Location">
              <input name="location" value={form.location} onChange={handleChange} className="input" placeholder="Gate A" />
            </Field>
            <Field label="Notes">
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className="input" />
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-700" />
                <p className="text-sm font-bold text-slate-800">Permission Control</p>
              </div>
              <Permission name="can_scan_tickets" checked={form.can_scan_tickets} onChange={handleChange} label="Scan tickets" />
              <Permission name="can_assign_manual_tickets" checked={form.can_assign_manual_tickets} onChange={handleChange} label="Request manual tickets" />
              <Permission name="can_manage_bookings" checked={form.can_manage_bookings} onChange={handleChange} label="Manage stadium bookings" />
              <Permission name="can_manage_events" checked={form.can_manage_events} onChange={handleChange} label="Manage events" />
            </div>
          </div>

          <button type="submit" disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
            Create assignment
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Staff Schedule</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading staff schedule...</p>
          ) : duties.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No duty assignments yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {duties.map((duty) => (
                <article key={duty.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{duty.title}</h3>
                      <p className="text-sm text-slate-600">{duty.staff_details?.username} | {duty.event_title || "General duty"}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(duty.starts_at).toLocaleString()} to {new Date(duty.ends_at).toLocaleString()}</p>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${dutyStatus(duty).className}`}>
                        {dutyStatus(duty).label}
                      </span>
                      <p className="mt-2 text-xs text-slate-600">
                        Permissions: {[
                          duty.can_scan_tickets && "scan",
                          duty.can_assign_manual_tickets && "manual tickets",
                          duty.can_manage_bookings && "bookings",
                          duty.can_manage_events && "events",
                        ].filter(Boolean).join(", ") || "none"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dutyStatus(duty).label === "Upcoming" && (
                        <button
                          type="button"
                          onClick={() => startDutyNow(duty)}
                          disabled={saving}
                          title="Start duty now"
                          className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Clock3 className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => deleteDuty(duty.id)} disabled={saving} title="Remove duty" className="rounded-lg border border-rose-200 p-2 text-rose-700 hover:bg-rose-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Permission({ name, checked, onChange, label }) {
  return (
    <label className="mb-2 flex items-center gap-2 text-sm text-slate-700 last:mb-0">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function dutyStatus(duty) {
  const now = Date.now();
  const startsAt = new Date(duty.starts_at).getTime();
  const endsAt = new Date(duty.ends_at).getTime();
  if (startsAt > now) return { label: "Upcoming", className: "bg-blue-100 text-blue-700" };
  if (endsAt < now) return { label: "Ended", className: "bg-slate-200 text-slate-600" };
  return { label: "Active", className: "bg-emerald-100 text-emerald-700" };
}

function toLocalDateTimeInput(date) {
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
}
