import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, XCircle } from "lucide-react";

import DashboardPageHeader from "../../components/DashboardPageHeader";
import API from "../../lib/api";

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const SEAT_CONFIG = {
  VIP: { count: 25, price: "3.00", label: "25 kursi oo VIP ah" },
  Normal: { count: 50, price: "1.00", label: "50 kursi oo caadi ah" },
};

function CheckoutForm({ ticketId, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || processing) return;

    setProcessing(true);
    setError("");

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message || "Payment failed.");
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      try {
        await API.post("/events/confirm-ticket/", { ticket_id: ticketId });
        onSuccess();
      } catch (apiError) {
        setError(apiError?.response?.data?.error || "Failed to confirm ticket with server.");
        setProcessing(false);
      }
      return;
    }

    setError(`Payment status is ${paymentIntent?.status || "unknown"}.`);
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full rounded-xl bg-blue-600 py-4 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {processing ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [pageLoadedAt] = useState(() => Date.now());
  const [error, setError] = useState("");

  const [chosenSeatType, setChosenSeatType] = useState("");
  const [bookedSeats, setBookedSeats] = useState([]);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState("");
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const [clientSecret, setClientSecret] = useState("");
  const [ticketId, setTicketId] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

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
  const selectedConfig = chosenSeatType ? SEAT_CONFIG[chosenSeatType] : null;

  const bookedSeatCount = useMemo(() => {
    if (!chosenSeatType) return 0;
    return bookedSeats.filter((seat) => seat.seat_type === chosenSeatType && seat.section === 1).length;
  }, [bookedSeats, chosenSeatType]);

  const occupiedSeats = useMemo(() => {
    return new Set(
      bookedSeats
        .filter((seat) => seat.seat_type === chosenSeatType && seat.section === 1)
        .map((seat) => Number(seat.seat_number))
    );
  }, [bookedSeats, chosenSeatType]);

  const loadBookedSeats = async () => {
    setLoadingSeats(true);
    setError("");
    try {
      const response = await API.get(`/events/${eventId}/booked-seats/`);
      setBookedSeats(response.data);
    } catch (apiError) {
      console.error(apiError);
      setError("Waa la soo rari waayay macluumaadka kuraasta.");
    } finally {
      setLoadingSeats(false);
    }
  };

  const selectSeatType = (type) => {
    setChosenSeatType(type);
    setSelectedSeatNumber("");
    setClientSecret("");
    setTicketId(null);
    loadBookedSeats();
  };

  const startPayment = async () => {
    if (!stripePromise) {
      setError("Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY and restart the frontend.");
      return;
    }
    if (!chosenSeatType || !selectedSeatNumber) return;

    setLoadingPayment(true);
    setError("");
    try {
      const response = await API.post("/events/create-payment-intent/", {
        event_id: eventId,
        seat_type: chosenSeatType,
        section: 1,
        seat_number: Number(selectedSeatNumber),
      });

      if (response.data.alreadyPaid) {
        setTicketId(response.data.ticket_id);
        setShowPopup(true);
        return;
      }

      setClientSecret(response.data.clientSecret);
      setTicketId(response.data.ticket_id);
    } catch (apiError) {
      console.error(apiError);
      setError(apiError?.response?.data?.error || "Failed to initialize payment.");
    } finally {
      setLoadingPayment(false);
    }
  };

  const changeSeat = async () => {
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
    setSelectedSeatNumber("");
    await loadBookedSeats();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardPageHeader
        eyebrow="Checkout"
        title="Complete Payment"
        description="Dooro nooca kursiga iyo lambarka kursiga, kadib dhameystir lacag bixinta."
        icon={CreditCard}
      />

      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        {eventLoading ? (
          <p className="text-center text-sm font-semibold text-slate-500">Loading event...</p>
        ) : error ? (
          <ErrorState message={error} onBack={() => navigate("/user/events")} />
        ) : eventExpired ? (
          <ExpiredState onBack={() => navigate("/user/events")} />
        ) : !chosenSeatType ? (
          <div>
            <h2 className="mb-4 text-lg font-bold text-gray-700">Dooro nooca kursiga</h2>
            <div className="space-y-4">
              {Object.entries(SEAT_CONFIG).map(([type, config]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => selectSeatType(type)}
                  className="flex w-full items-center justify-between rounded-xl border-2 border-gray-100 bg-gray-50/50 p-4 text-left transition-colors hover:border-sky-400"
                >
                  <div>
                    <div className="text-lg font-black text-gray-900">{type} Seat</div>
                    <div className="text-sm font-medium text-gray-500">{config.label}</div>
                  </div>
                  <div className="text-2xl font-black text-blue-600">${config.price}</div>
                </button>
              ))}
            </div>
          </div>
        ) : !clientSecret ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold uppercase tracking-wide text-gray-800">
                Doorashada kursiga {chosenSeatType}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setChosenSeatType("");
                  setSelectedSeatNumber("");
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Beddel nooca
              </button>
            </div>

            {loadingSeats ? (
              <p className="text-center text-sm font-semibold text-slate-500">Soo raraya macluumaadka kuraasta...</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Dooro lambarka kursiga</p>
                  <p className="text-xs font-semibold text-slate-500">
                    {bookedSeatCount}/{selectedConfig.count} xiran
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <LegendSwatch className="border border-slate-200 bg-white" label="La heli karo" />
                  <LegendSwatch className="bg-sky-600" label="La doortay" />
                  <LegendSwatch className="border border-rose-200 bg-rose-100" label="Xiran" />
                </div>

                <div className="grid max-h-[430px] grid-cols-6 gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-1.5 sm:grid-cols-10 md:grid-cols-12">
                  {Array.from({ length: selectedConfig.count }, (_, index) => {
                    const seatNumber = index + 1;
                    const isOccupied = occupiedSeats.has(seatNumber);
                    const isSelected = Number(selectedSeatNumber) === seatNumber;

                    return (
                      <button
                        key={seatNumber}
                        type="button"
                        disabled={isOccupied}
                        onClick={() => setSelectedSeatNumber(String(seatNumber))}
                        className={`h-10 rounded-lg border text-xs font-extrabold transition ${
                          isOccupied
                            ? "cursor-not-allowed border-rose-200 bg-rose-100 text-rose-400"
                            : isSelected
                              ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {seatNumber}
                      </button>
                    );
                  })}
                </div>

                {selectedSeatNumber && (
                  <button
                    type="button"
                    onClick={startPayment}
                    disabled={loadingPayment}
                    className="w-full rounded-xl bg-sky-600 py-3.5 font-bold text-white transition hover:bg-sky-700 disabled:bg-slate-400"
                  >
                    {loadingPayment ? "Diyaarinaya lacag bixinta..." : `U gudbi lacag bixinta ($${selectedConfig.price})`}
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-6 rounded-xl bg-gray-50 p-4">
              <div className="mb-2 flex justify-between text-gray-600">
                <span>Kursiga</span>
                <span className="font-bold text-gray-900">
                  {chosenSeatType} | Seat {selectedSeatNumber}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-gray-600">
                <span>Total Amount</span>
                <span className="text-xl font-black text-blue-600">${selectedConfig.price}</span>
              </div>
            </div>

            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm ticketId={ticketId} onSuccess={() => setShowPopup(true)} />
            </Elements>

            <button
              type="button"
              onClick={changeSeat}
              className="mt-4 w-full text-center text-sm font-bold text-gray-500 transition-colors hover:text-gray-800"
            >
              Beddel kursiga
            </button>
          </div>
        )}
      </div>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-2xl font-black text-gray-900">Guul!</h3>
            <p className="mb-6 font-medium leading-relaxed text-gray-600">
              Lacag bixintu waa guuleysatay. Tigidhkaaga QR-ka wuxuu ku diyaarsan yahay My Tickets.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowPopup(false);
                navigate("/user/ticket");
              }}
              className="w-full rounded-xl bg-gray-900 py-3 font-bold text-white transition-colors hover:bg-gray-800"
            >
              Tag tigidhadaada
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendSwatch({ className, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3.5 w-3.5 rounded ${className}`} />
      {label}
    </div>
  );
}

function ErrorState({ message, onBack }) {
  return (
    <div className="space-y-4 text-center">
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        {message}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Kusoo laabo dhacdooyinka
      </button>
    </div>
  );
}

function ExpiredState({ onBack }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <XCircle className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-950">Dhacdadu way dhacday</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Tigidhada lama iibin karo sababtoo ah waqtigii dhacdada waa la dhaafay.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Kusoo laabo dhacdooyinka
      </button>
    </div>
  );
}
