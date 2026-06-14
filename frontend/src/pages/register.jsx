import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Mail, Phone, UserRound, LockKeyhole } from "lucide-react";
import API from "../lib/api";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    phone: "",
    email: "",
    username: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) =>
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await API.post("/register/", {
        username: form.username,
        email: form.email,
        password: form.password,
      });

      navigate(
        `/verify-otp?purpose=register&email=${encodeURIComponent(form.email)}&sent=1`,
        { replace: true }
      );
    } catch (apiError) {
      const apiData = apiError?.response?.data;
      const firstError = apiData
        ? Object.values(apiData).flat()[0]
        : "Unable to reach the registration service. Please try again.";
      setError(firstError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stadium-50 px-5 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="surface w-full max-w-2xl p-6 sm:p-8">
          <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">Customer access</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
            Create your account
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Join the stadium system to manage your bookings and profile.
          </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Phone className="h-4 w-4 text-slate-400" />
                  Phone Number
                </label>
                <input
                  name="phone"
                  placeholder="0612xxxxxx"
                  className="input"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="example@email.com"
                  className="input"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                <UserRound className="h-4 w-4 text-slate-400" />
                Username
              </label>
              <input
                name="username"
                placeholder="Choose a username"
                className="input"
                value={form.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="********"
                  className="input"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirm"
                  placeholder="********"
                  className="input"
                  value={form.confirm}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                Registration failed: {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <p className="text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link to="/login" className="font-bold text-cyan-700">
                Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
