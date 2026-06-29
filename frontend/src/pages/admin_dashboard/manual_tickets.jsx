import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import API from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiError";
import DashboardPageHeader from "../../components/DashboardPageHeader";

function statusClass(status) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

export default function AdminManualTickets() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRequests = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await API.get("/events/manual-ticket-requests/");
      setRequests(response.data);
    } catch (apiError) {
      if (showLoader) {
        setError("Failed to load manual ticket requests.");
      }
      console.error(apiError);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadRequests(true);

    const intervalId = setInterval(() => {
      loadRequests(false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const reviewRequest = async (id, status) => {
    setProcessingId(id);
    setError("");
    setMessage("");

    try {
      await API.patch(`/events/manual-ticket-requests/${id}/review/`, {
        status,
        admin_note: notes[id] || "",
      });
      setMessage(`Request ${status === "approved" ? "approved" : "revoked"}.`);
      await loadRequests(false);
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Failed to review manual ticket request."));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Admin approval"
        title="Manual Ticket Requests"
        description="Review and approve or revoke staff-submitted free ticket requests."
        icon={CheckCircle2}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="text-center text-slate-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-500">No manual ticket requests found.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {request.target_full_name} (@{request.target_username}) | {request.seat_type}
                    </h3>
                    <p className="text-sm text-slate-500">Event: {request.event_details?.title}</p>
                    <p className="text-xs text-slate-500">
                      Requested by {request.requester_details?.username} on {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>

                  <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusClass(request.status)}`}>
                    {request.status === "rejected" ? "revoked" : request.status}
                  </span>
                </div>

                {request.reason && <p className="mt-2 text-sm text-slate-700">Reason: {request.reason}</p>}
                {request.admin_note && <p className="mt-1 text-sm text-slate-600">Admin note: {request.admin_note}</p>}

                {request.status === "pending" && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={notes[request.id] || ""}
                      onChange={(event) =>
                        setNotes((prev) => ({
                          ...prev,
                          [request.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Optional admin note"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => reviewRequest(request.id, "approved")}
                        disabled={processingId === request.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                      >
                        {processingId === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() => reviewRequest(request.id, "rejected")}
                        disabled={processingId === request.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-400"
                      >
                        {processingId === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Revoke
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
