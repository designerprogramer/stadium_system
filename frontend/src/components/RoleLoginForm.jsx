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

        <section className="relative hidden h-full overflow-hidden bg-blue-600 px-10 py-12 text-white lg:block">
          <div className="relative z-10 mx-auto max-w-lg text-center">
            <h2 className="text-3xl font-light leading-tight tracking-wide">
              The easiest way to manage your stadium operation
            </h2>
            <div className="mt-6 flex justify-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-white" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            </div>
          </div>

          <div className="absolute bottom-8 left-10 right-[-56px] h-[430px] max-h-[58vh] rotate-3 rounded-[1.5rem] bg-white p-4 text-slate-950 shadow-2xl">
            <div className="grid h-full grid-cols-[170px_1fr] overflow-hidden rounded-[1.25rem] border border-blue-100 bg-white">
              <aside className="border-r border-slate-100 bg-slate-50 p-5">
                <div className="mb-8 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Ticket className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold">Stadium</span>
                </div>
                <MockNav icon={BarChart3} label="Dashboard" active />
                <MockNav icon={Ticket} label="Tickets" />
                <MockNav icon={Users} label="Users" />
                <MockNav icon={CalendarDays} label="Events" />
                <MockNav icon={Settings} label="Settings" />
              </aside>

              <div className="overflow-hidden p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Overview</p>
                    <h3 className="text-2xl font-bold">Dashboard</h3>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.tone}`}>
                    <RoleIcon className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <MockStat label="Tickets sold" value="6,025" />
                  <MockStat label="Revenue" value="$38,500" />
                </div>

                <div className="mt-5 rounded-2xl border border-slate-100 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <p className="font-semibold">Gate activity</p>
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">Live</span>
                  </div>
                  <div className="flex h-24 items-end gap-3">
                    {[45, 68, 38, 84, 52, 76, 60].map((height, index) => (
                      <span
                        key={index}
                        className="flex-1 rounded-t-xl bg-blue-100"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <MockMini label="Staff" value="18" />
                  <MockMini label="Events" value="12" />
                  <MockMini label="Support" value="24" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MockNav({ icon: Icon, label, active = false }) {
  return (
    <div className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${active ? "bg-blue-50 text-blue-600" : "text-slate-500"}`}>
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

function MockStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-semibold text-blue-600">+12.4%</p>
    </div>
  );
}

function MockMini({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
