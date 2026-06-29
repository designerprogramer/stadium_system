import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  QrCode,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
} from "lucide-react";
import API from "../lib/api";
import { getDashboardPathForRole, saveAuthSession } from "../lib/auth";
import securityIllustration from "../assets/security_illustration.png";

const roleMeta = {
  Customer: {
    icon: Ticket,
    tone: "bg-blue-50 text-blue-600",
    summary: "Browse events, buy tickets, and manage your matchday access.",
  },
  Staff: {
    icon: QrCode,
    tone: "bg-emerald-50 text-emerald-600",
    summary: "Validate tickets, review event activity, and reply to assigned support.",
  },
  Admin: {
    icon: ShieldCheck,
    tone: "bg-slate-100 text-slate-800",
    summary: "Manage users, events, finance, reports, and system-wide support.",
  },
};

export default function RoleLoginForm({ roleName, loginEndpoint, accentClass }) {
  const navigate = useNavigate();
  const meta = roleMeta[roleName] || roleMeta.Customer;
  const RoleIcon = meta.icon;
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await API.post(loginEndpoint, form);
      saveAuthSession({
        access: data.access,
        refresh: data.refresh,
        user: data.user,
      });
      navigate(getDashboardPathForRole(data.user?.role), { replace: true });
    } catch (apiError) {
      const message = apiError?.response?.data?.detail
        || (apiError?.request
          ? "Cannot reach the backend. Check the Netlify API URL and Render CORS settings."
          : "Login failed. Check your details.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[57%_43%] lg:overflow-hidden">
        <section className="flex min-h-screen flex-col px-5 py-5 sm:px-10 lg:min-h-0 lg:px-14">
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[460px]">
              <Link
                to="/"
                className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back home
              </Link>

              <div className="mb-7">
                <p className="text-sm font-semibold text-blue-600">{roleName} Portal</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Get Started Now</h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Please enter your information to access your {roleName.toLowerCase()} account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">Username</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="username"
                      placeholder="Enter your username"
                      className="input pl-11"
                      value={form.username}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">Password</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter your password"
                      className="input px-11"
                      value={form.password}
                      onChange={handleChange}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                    Forgot password?
                  </Link>
                </div>

                {error && <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

                <button className={`btn-primary h-12 ${accentClass || ""}`} disabled={loading}>
                  <LogIn className="h-4 w-4" />
                  {loading ? "Signing in..." : "Login"}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400">© 2026. All Rights Reserved.</p>
        </section>

        <section className="relative hidden h-full p-5 lg:block bg-slate-50">
          <div className="h-full w-full overflow-hidden rounded-3xl shadow-sm border border-slate-100">
            <img
              src={securityIllustration}
              alt="Stadium Security Control"
              className="h-full w-full object-cover object-center"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

