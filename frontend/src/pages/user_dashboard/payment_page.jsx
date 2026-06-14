import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CreditCard, XCircle } from "lucide-react";
import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const CheckoutForm = ({ ticketId, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        await API.post("/events/confirm-ticket/", { ticket_id: ticketId });
        onSuccess();
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to confirm ticket with server.");
        setProcessing(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && <div className="text-red-500 text-sm mt-2 font-medium">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {processing ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
};

export default function PaymentPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [seatType, setSeatType] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [ticketId, setTicketId] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageLoadedAt] = useState(() => Date.now());

  useEffect(() => {
    const loadEvent = async () => {
      setEventLoading(true);
      setError("");
      try {
        const response = await API.get(`/events/${eventId}/`);
        setEvent(response.data);
      } catch (apiError) {
        console.error(apiError);
        setError("Unable to load event details.");
      } finally {
        setEventLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const eventExpired = event ? new Date(event.date).getTime() <= pageLoadedAt : false;
  const hasPurchased = Boolean(event?.has_purchased);

  const handleSeatSelection = async (type) => {
    if (!stripePromise) {
      setError("Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY and restart the frontend.");
      return;
    }

    setSeatType(type);
    setLoading(true);
    try {
      const response = await API.post("/events/create-payment-intent/", {
        event_id: eventId,
        seat_type: type
      });
      if (response.data.alreadyPaid) {
        setTicketId(response.data.ticket_id);
        setShowPopup(true);
        return;
      }
      setClientSecret(response.data.clientSecret);
      setTicketId(response.data.ticket_id);
    } catch (err) {
      console.error(err);
      setSeatType("");
      setError(err?.response?.data?.error || "Failed to initialize payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setShowPopup(true);
  };

  const changeSeatType = async () => {
    if (ticketId) {
      try {
        await API.post("/events/cancel-payment-intent/", { ticket_id: ticketId });
      } catch (apiError) {
        setError(apiError?.response?.data?.error || "Unable to cancel the current payment attempt.");
        return;
      }
    }
    setClientSecret("");
    setTicketId(null);
    setSeatType("");
  };

  const closePopup = () => {
    setShowPopup(false);
    navigate("/user/ticket");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardPageHeader
        eyebrow="Checkout"
        title="Complete Payment"
        description="Choose a seat type and complete secure payment for your ticket."
        icon={CreditCard}
      />

      <div className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        {eventLoading ? (
          <p className="text-center text-sm font-semibold text-slate-500">Loading event...</p>
        ) : error ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
            <button
              type="button"
              onClick={() => navigate("/user/events")}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to events
            </button>
          </div>
        ) : hasPurchased ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CreditCard className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-950">You bought this ticket</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              You already have a pass for this event. Open your passes page to view the QR code.
            </p>
            <button
              type="button"
              onClick={() => navigate("/user/ticket")}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View my pass
            </button>
          </div>
        ) : eventExpired ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <XCircle className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-950">Event expired</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ticket sales are closed because this event time has passed.
            </p>
            <button
              type="button"
              onClick={() => navigate("/user/events")}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to events
            </button>
          </div>
        ) : !clientSecret ? (
          <div>
            <h2 className="text-lg font-bold text-gray-700 mb-4">Select Seat Type</h2>
            <div className="space-y-4">
              <button 
                onClick={() => handleSeatSelection("VIP")}
                disabled={loading}
                className="w-full border-2 border-blue-100 p-4 rounded-xl flex justify-between items-center hover:border-blue-500 transition-colors bg-blue-50/30"
              >
                <div className="text-left">
                  <div className="font-black text-gray-900 text-lg">VIP Seat</div>
                  <div className="text-sm text-gray-500 font-medium">Premium view & access</div>
                </div>
                <div className="font-black text-blue-600 text-2xl">$3</div>
              </button>

              <button 
                onClick={() => handleSeatSelection("Normal")}
                disabled={loading}
                className="w-full border-2 border-gray-100 p-4 rounded-xl flex justify-between items-center hover:border-gray-300 transition-colors bg-gray-50/50"
              >
                <div className="text-left">
                  <div className="font-black text-gray-900 text-lg">Normal Seat</div>
                  <div className="text-sm text-gray-500 font-medium">Standard stadium seating</div>
                </div>
                <div className="font-black text-gray-600 text-2xl">$1</div>
              </button>
            </div>
            {loading && <p className="mt-4 text-center text-gray-500 font-medium">Initializing secure payment...</p>}
          </div>
        ) : (
          <div>
            <div className="bg-gray-50 p-4 rounded-xl mb-6">
              <div className="flex justify-between text-gray-600 mb-2">
                <span>Selected Seat</span>
                <span className="font-bold text-gray-900">{seatType}</span>
              </div>
              <div className="flex justify-between text-gray-600 border-t border-gray-200 pt-2">
                <span>Total Amount</span>
                <span className="font-black text-blue-600 text-xl">${seatType === 'VIP' ? '3.00' : '1.00'}</span>
              </div>
            </div>

            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm ticketId={ticketId} onSuccess={handleSuccess} />
            </Elements>
            
            <button 
              onClick={changeSeatType}
              className="mt-4 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors w-full text-center"
            >
              Change Seat Type
            </button>
          </div>
        )}
      </div>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-sm w-full p-8 rounded-3xl text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Success!</h3>
            <p className="text-gray-600 font-medium leading-relaxed mb-6">
              Payment successful. Your QR pass is ready in My Passes. Do not share the QR code with anyone.
            </p>
            <button 
              onClick={closePopup}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              Go to My Tickets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
