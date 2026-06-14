import { useEffect, useState } from "react";
import { CalendarCheck2, Loader2 } from "lucide-react";

import DashboardPageHeader from "../../components/DashboardPageHeader";
import API from "../../lib/api";

const EMPTY_FORM = {
  organizer_name: "",
  contact_phone: "",
  team1_name: "",
  team2_name: "",
  scheduled_at: "",
  amount_paid: "",
  payment_reference: "",
  notes: "",
};

function apiErrorMessage(error) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (!data || typeof data !== "object") return "Failed to register stadium booking.";

  const firstValue = Object.values(data)[0];
  if (Array.isArray(firstValue)) return firstValue[0];
  if (typeof firstValue === "string") return firstValue;
  return "Failed to register stadium booking.";
}

export default function ExternalBookings({ role }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadBookings = async () => {
    const response = await API.get("/events/external-bookings/");
    setBookings(response.data);
  };

  useEffect(() => {
    let active = true;
    API.get("/events/external-bookings/")
      .then((response) => {
        if (active) setBookings(response.data);
      })
      .catch(() => {
        if (active) setError("Failed to load stadium bookings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await API.post("/events/external-bookings/", {
        ...form,
        amount_paid: Number(form.amount_paid),
      });
      setForm(EMPTY_FORM);
      setMessage("Paid stadium booking registration completed.");
      await loadBookings();
    } catch (apiError) {
      setError(apiErrorMessage(apiError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow={`${role} shared feature`}
        title="External Stadium Bookings"
        description="Register paid stadium use for matches outside the Champions League."
        icon={CalendarCheck2}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Complete Registration</h2>
          <p className="mt-1 text-sm text-slate-500">Record the organizer, two names, schedule, and received payment.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Organizer name">
              <input name="organizer_name" value={form.organizer_name} onChange={handleChange} required className="input" />
            </Field>
            <Field label="Contact phone">
              <input name="contact_phone" value={form.contact_phone} onChange={handleChange} required className="input" />
            </Field>
            <Field label="First team / group name">
              <input name="team1_name" value={form.team1_name} onChange={handleChange} required className="input" />
            </Field>
            <Field label="Second team / group name">
              <input name="team2_name" value={form.team2_name} onChange={handleChange} required className="input" />
            </Field>
            <Field label="Booking date and time">
              <input type="datetime-local" name="scheduled_at" value={form.scheduled_at} onChange={handleChange} required className="input" />
            </Field>
            <Field label="Amount paid">
              <input type="number" min="0.01" step="0.01" name="amount_paid" value={form.amount_paid} onChange={handleChange} required className="input" />
            </Field>
            <Field label="Payment reference (optional)">
              <input name="payment_reference" value={form.payment_reference} onChange={handleChange} className="input" />
            </Field>
            <Field label="Notes (optional)">
              <input name="notes" value={form.notes} onChange={handleChange} className="input" />
            </Field>
          </div>

          <button type="submit" disabled={submitting} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
            Complete booking
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Registered Bookings</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading bookings...</p>
          ) : bookings.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No external stadium bookings yet.</p>
          ) : (
            <div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto pr-1">
              {bookings.map((booking) => (
                <article key={booking.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{booking.team1_name} vs {booking.team2_name}</h3>
                      <p className="text-xs text-slate-500">{new Date(booking.scheduled_at).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">PAID</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">Organizer: <strong>{booking.organizer_name}</strong> | {booking.contact_phone}</p>
                  <p className="mt-1 text-sm text-slate-700">Amount: <strong>${Number(booking.amount_paid).toFixed(2)}</strong></p>
                  {booking.payment_reference && <p className="mt-1 text-sm text-slate-600">Reference: {booking.payment_reference}</p>}
                  {booking.notes && <p className="mt-1 text-sm text-slate-600">Notes: {booking.notes}</p>}
                  <p className="mt-2 text-xs text-slate-500">Registered by {booking.created_by_details?.username}</p>
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
