import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import API from "../lib/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    const storedEmail = localStorage.getItem("passwordResetEmail");
    const storedOtp = localStorage.getItem("passwordResetOtp");
    if (!storedEmail || !storedOtp) {
      navigate("/forgot-password", { replace: true });
      return;
    }
    setEmail(storedEmail);
    setOtp(storedOtp);
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (pass !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await API.post("/reset-password/", {
        email,
        otp,
        password: pass,
        confirm_password: confirm,
      });
      localStorage.removeItem("passwordResetEmail");
      localStorage.removeItem("passwordResetOtp");
      navigate("/login", { replace: true });
    } catch (apiError) {
      const apiData = apiError?.response?.data;
      const firstError = apiData
        ? Object.values(apiData).flat()[0]
        : "Unable to reset password. Please try again.";
      setError(firstError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">

      <div className="w-full max-w-xl text-center">

        <h1 className="text-3xl font-semibold">Set New Password</h1>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6 text-left">

          <div>
            <label className="block mb-2 text-sm text-gray-700">New Password</label>
            <input type="password" className="w-full rounded-xl border px-4 py-3" onChange={(e)=>setPass(e.target.value)}/>
          </div>

          <div>
            <label className="block mb-2 text-sm text-gray-700">Confirm Password</label>
            <input type="password" className="w-full rounded-xl border px-4 py-3" onChange={(e)=>setConfirm(e.target.value)}/>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            disabled={loading}
            className="w-full bg-[#3b71ca] text-white py-3.5 rounded-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>

        </form>
      </div>
    </div>
  );
}
