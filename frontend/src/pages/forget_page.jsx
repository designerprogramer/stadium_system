import { useNavigate } from "react-router-dom";
import { useState } from "react";
import API from "../lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await API.post("/forgot-password/", { email });
      navigate(
        `/verify-otp?purpose=forgot&email=${encodeURIComponent(email)}`,
        { replace: true }
      );
    } catch (apiError) {
      const apiData = apiError?.response?.data;
      const firstError = apiData
        ? Object.values(apiData).flat()[0]
        : "Unable to send OTP. Please try again.";
      setError(firstError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">

      <div className="w-full max-w-xl text-center">

        <h1 className="text-3xl font-semibold">Reset Password</h1>
        <p className="text-gray-500 mt-2">Enter your email to receive OTP</p>

        <form onSubmit={handleSubmit} className="mt-10 text-left">

          <label className="block mb-2 text-sm text-gray-700">Email Address</label>
          <input
            type="email"
            className="w-full rounded-xl border px-4 py-3"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />

          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

          <button
            disabled={loading}
            className="w-full mt-6 bg-[#3b71ca] text-white py-3.5 rounded-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>

        </form>
      </div>
    </div>
  );
}
