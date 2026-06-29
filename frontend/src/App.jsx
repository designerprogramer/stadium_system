import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PublicRoute from "./components/PublicRoute";
import RoleGuard from "./components/RoleGuard";
import { USER_ROLES } from "./lib/auth";

const LandingPage = lazy(() => import("./pages/landing"));
const UserLogin = lazy(() => import("./pages/user_login"));
const StaffLogin = lazy(() => import("./pages/staff_dashboard/login"));
const TicketPaymentModal = lazy(() => import("./components/TicketPaymentModal"));
const AdminLogin = lazy(() => import("./pages/admin_login"));
const Register = lazy(() => import("./pages/register"));
const ForgotPassword = lazy(() => import("./pages/forget_page"));
const VerifyOTP = lazy(() => import("./pages/otp_verfication"));
const ResetPassword = lazy(() => import("./pages/reset_page"));
const UserLayout = lazy(() => import("./pages/user_dashboard/Layout"));
const UserDashboard = lazy(() => import("./pages/user_dashboard/dashboard"));
const UserEvents = lazy(() => import("./pages/user_dashboard/events"));
const UserHistory = lazy(() => import("./pages/user_dashboard/history"));
const Notification = lazy(() => import("./pages/user_dashboard/notification"));
const UserSettings = lazy(() => import("./pages/user_dashboard/settings"));
const Chatbot = lazy(() => import("./pages/user_dashboard/chatbot"));
const UserTicket = lazy(() => import("./pages/user_dashboard/ticket"));
const PaymentPage = lazy(() => import("./pages/user_dashboard/payment_page"));
const StaffLayout = lazy(() => import("./pages/staff_dashboard/Layout"));
const StaffDashboard = lazy(() => import("./pages/staff_dashboard/dashboard"));
const NonBuyTicket = lazy(() => import("./pages/staff_dashboard/non_buy_ticket"));
const TicketChecking = lazy(() => import("./pages/staff_dashboard/ticket_checking"));
const StaffNotification = lazy(() => import("./pages/staff_dashboard/notification"));
const StaffSettings = lazy(() => import("./pages/staff_dashboard/settings"));
const StaffSupport = lazy(() => import("./pages/staff_dashboard/support"));
const StaffEvents = lazy(() => import("./pages/staff_dashboard/events"));
const AdminLayout = lazy(() => import("./pages/admin_dashboard/Layout"));
const AdminDashboard = lazy(() => import("./pages/admin_dashboard/dashboard"));
const AdminEvents = lazy(() => import("./pages/admin_dashboard/events"));
const AdminFinance = lazy(() => import("./pages/admin_dashboard/finance"));
const AdminReport = lazy(() => import("./pages/admin_dashboard/report"));
const AdminEventHistory = lazy(() => import("./pages/admin_dashboard/event_history"));
const AdminManualTickets = lazy(() => import("./pages/admin_dashboard/manual_tickets"));
const AdminStaffManagement = lazy(() => import("./pages/admin_dashboard/staff_management"));
const AdminUsers = lazy(() => import("./pages/admin_dashboard/users"));
const AdminNotification = lazy(() => import("./pages/admin_dashboard/notification"));
const AdminSettings = lazy(() => import("./pages/admin_dashboard/settings"));
const AdminSupport = lazy(() => import("./pages/admin_dashboard/support"));
const ExternalBookings = lazy(() => import("./pages/shared/external_bookings"));
const ScheduleCalendar = lazy(() => import("./pages/shared/schedule_calendar"));
const TeamChat = lazy(() => import("./pages/shared/team_chat"));
const NotFound = lazy(() => import("./pages/not_found"));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<PublicRoute />}>
        <Route path="/login" element={<UserLogin />} />
        <Route path="/staff_login" element={<StaffLogin />} />
        <Route path="/admin_login" element={<AdminLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route element={<RoleGuard allowedRoles={[USER_ROLES.USER]} />}>
        <Route path="/user" element={<UserLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboard />} />
          <Route path="events" element={<UserEvents />} />
          <Route path="history" element={<UserHistory />} />
          <Route path="ticket" element={<UserTicket />} />
          <Route path="chatbot" element={<Chatbot />} />
          <Route path="notification" element={<Notification />} />
          <Route path="settings" element={<UserSettings />} />
          <Route path="ticket-payment" element={<TicketPaymentModal />} />
          <Route path="payment/:eventId" element={<PaymentPage />} />
        </Route>
      </Route>

      <Route element={<RoleGuard allowedRoles={[USER_ROLES.STAFF]} />}>
        <Route path="/staff" element={<StaffLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="ticket-checking" element={<TicketChecking />} />
          
          <Route path="events" element={<StaffEvents />} />
          <Route path="schedule" element={<ScheduleCalendar role="Staff" />} />
          <Route path="external-bookings" element={<ExternalBookings role="Staff" />} />
          <Route path="non-buy-tickets" element={<NonBuyTicket />} />
          <Route path="support" element={<StaffSupport />} />
          <Route path="team-chat" element={<TeamChat />} />
          <Route path="notifications" element={<StaffNotification />} />
          <Route path="settings" element={<StaffSettings />} />
        </Route>
      </Route>

      <Route element={<RoleGuard allowedRoles={[USER_ROLES.ADMIN]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="report" element={<AdminReport />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="schedule" element={<ScheduleCalendar role="Admin" />} />
          <Route path="external-bookings" element={<ExternalBookings role="Admin" />} />
          <Route path="event-history" element={<AdminEventHistory />} />
          <Route path="manual-tickets" element={<AdminManualTickets />} />
          <Route path="staff-management" element={<AdminStaffManagement />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="team-chat" element={<TeamChat />} />
          <Route path="notifications" element={<AdminNotification />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
    </Suspense>
  );
}

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">
      Loading...
    </div>
  );
}

export default App;
