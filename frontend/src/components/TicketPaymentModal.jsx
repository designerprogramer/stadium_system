// components/TicketPaymentModal.jsx
import { useState } from "react";

export default function TicketPaymentModal({ event, onClose, onPaymentSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onPaymentSuccess();
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden" />
        
        <h3 className="text-2xl font-black mb-2 text-gray-800">Confirm Booking</h3>
        <p className="text-gray-500 mb-6 font-medium">{event.name}</p>
        
        <div className="bg-gray-50 rounded-2xl p-4 mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Ticket Price</span>
            <span className="font-bold text-gray-900">${event.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-black text-blue-600 text-xl">${event.price.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onClose}
            className="py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={isProcessing}
            className="bg-blue-600 py-4 rounded-2xl font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center"
          >
            {isProcessing ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : "Pay Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
