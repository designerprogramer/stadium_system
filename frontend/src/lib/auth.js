const AUTH_STORAGE_KEY = "stadium_auth";

export const USER_ROLES = {
  USER: "user",
  STAFF: "staff",
  ADMIN: "admin",
};

const ROLE_DASHBOARD_MAP = {
  [USER_ROLES.USER]: "/user",
  [USER_ROLES.STAFF]: "/staff",
  [USER_ROLES.ADMIN]: "/admin",
};

const ROLE_LOGIN_MAP = {
  [USER_ROLES.USER]: "/login",
  [USER_ROLES.STAFF]: "/staff_login",
  [USER_ROLES.ADMIN]: "/admin_login",
};

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getAuthSession() {
  return safeParse(sessionStorage.getItem(AUTH_STORAGE_KEY));
}

export function saveAuthSession(session) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function updateAccessToken(access) {
  const session = getAuthSession();
  if (!session) return;
  saveAuthSession({ ...session, access });
}

export function getRefreshToken() {
  return getAuthSession()?.refresh ?? null;
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem("user");
}

export function getCurrentUser() {
  const session = getAuthSession();
  return session?.user ?? null;
}

export function getAccessToken() {
  const session = getAuthSession();
  return session?.access ?? null;
}

export function isAuthenticated() {
  const session = getAuthSession();
  return Boolean(session?.access && session?.user?.role);
}

export function getDashboardPathForRole(role) {
  return ROLE_DASHBOARD_MAP[role] ?? ROLE_LOGIN_MAP[USER_ROLES.USER];
}

export function getLoginPathForRole(role) {
  return ROLE_LOGIN_MAP[role] ?? ROLE_LOGIN_MAP[USER_ROLES.USER];
}

export function getDefaultAppPath() {
  const user = getCurrentUser();
  if (!user) {
    return ROLE_LOGIN_MAP[USER_ROLES.USER];
  }
  return getDashboardPathForRole(user.role);
}
