import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import API from "../lib/api";
import { getApiErrorMessage } from "../lib/apiError";

export default function VerifyOTP() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purpose = searchParams.get("purpose");
  const email = searchParams.get("email");
  const otpSent = searchParams.get("sent") === "1";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!showSuccess || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const confetti = Array.from({ length: 70 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      r: 4 + Math.random() * 6,
      dx: (Math.random() - 0.5) * 2,
      dy: 2 + Math.random() * 3,
      color: `hsl(${Math.random() * 360}, 100%, 70%)`,
    }));

    const resizeCanvas = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };

    let frameId;
    const draw = () => {
      context.clearRect(0, 0, width, height);
      confetti.forEach((item) => {
        context.fillStyle = item.color;
        context.fillRect(item.x, item.y, item.r, item.r * 2);
        item.x += item.dx;
        item.y += item.dy;

        if (item.y > height) {
          item.y = -item.r * 2;
          item.x = Math.random() * width;
        }
        if (item.x > width) item.x = 0;
        if (item.x < 0) item.x = width;
      });
      frameId = requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resizeCanvas);
    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(frameId);
    };
  }, [showSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !purpose) {
      setError("Invalid verification flow. Please start again.");
      return;
    }

    setLoading(true);
    try {
      if (purpose === "register") {
        await API.post("/verify-register-otp/", {
          email,
          otp,
        });
        setShowSuccess(true);
      } else if (purpose === "forgot") {
        await API.post("/verify-password-otp/", {
          email,
          otp,
        });
        localStorage.setItem("passwordResetEmail", email);
        localStorage.setItem("passwordResetOtp", otp);
        navigate("/reset-password", { replace: true });
      } else {
        setError("Invalid OTP purpose.");
      }
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "OTP verification failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[32px] bg-white p-8 text-center shadow-2xl">
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          <div className="relative z-10">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#3b71ca]/10 text-5xl">
              🎉
            </div>
            <h1 className="text-3xl font-semibold text-gray-900">OTP Verified!</h1>
            <p className="mx-auto mt-4 max-w-xl text-gray-600">
              Your email has been confirmed and your account is now active. You can now log in.
            </p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-8 inline-flex rounded-xl bg-[#3b71ca] px-8 py-3.5 text-white transition hover:scale-[0.99] hover:opacity-95"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">

      <div className="w-full max-w-xl text-center">

        <h1 className="text-3xl font-semibold">Verify OTP</h1>
        <p className="text-gray-500 mt-2">Enter the 6-digit code sent to your email</p>
        {purpose === "register" && otpSent && (
          <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Registration started successfully. Check {email} for the OTP. Your account becomes active after verification.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-10 text-left">

          <input
            className="w-full text-center tracking-widest text-lg rounded-xl border px-4 py-3"
            placeholder="------"
            onChange={(e)=>setOtp(e.target.value)}
          />

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          <button
            disabled={loading}
            className="w-full mt-6 bg-[#3b71ca] text-white py-3.5 rounded-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>

        </form>
      </div>
    </div>
  );
}
