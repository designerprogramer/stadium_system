import { Navigate, Outlet } from "react-router-dom";
import { getCurrentUser, getDashboardPathForRole, isAuthenticated } from "../lib/auth";

export default function PublicRoute() {
  if (isAuthenticated()) {
    const user = getCurrentUser();
    return <Navigate to={getDashboardPathForRole(user?.role)} replace />;
  }

  return <Outlet />;
}
