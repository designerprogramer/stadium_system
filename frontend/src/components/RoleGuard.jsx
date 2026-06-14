import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentUser, getLoginPathForRole, isAuthenticated } from "../lib/auth";

export default function RoleGuard({ allowedRoles }) {
  const [, setAuthVersion] = useState(0);

  useEffect(() => {
    const handleExpired = () => setAuthVersion((current) => current + 1);
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to={getLoginPathForRole(allowedRoles[0])} replace />;
  }

  const user = getCurrentUser();
  if (!user) {
    return <Navigate to={getLoginPathForRole(allowedRoles[0])} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getLoginPathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
