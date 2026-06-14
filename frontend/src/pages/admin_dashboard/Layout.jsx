import { useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import ProfileMenu from "../../components/ProfileMenu";
import NotificationMenu from "../../components/NotificationMenu";
import DashboardBrand from "../../components/DashboardBrand";
import Sidebar from "./sidebar";
import { clearAuthSession, getCurrentUser } from "../../lib/auth";

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/admin_login", { replace: true });
  };

  const openLogoutConfirm = () => {
    setConfirmOpen(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-stadium-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-40 flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-3 py-4 backdrop-blur-xl sm:px-6">
          <DashboardBrand workspace="Admin" />

          <div className="flex items-center gap-3">
            <NotificationMenu allPath="/admin/notifications" />
            <ProfileMenu user={user} fallbackName="Admin" onLogout={openLogoutConfirm} compact showDetails={false} />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>

        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-semibold">Confirm Logout</h2>
              <p className="mt-2 text-sm text-gray-600">Are you sure you want to logout?</p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  No
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
