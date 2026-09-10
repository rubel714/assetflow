const USER_KEY = "userinfo";
const TOKEN_KEY = "token";

export function saveAuth(info, token) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(info));
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else if (info?.token) {
      localStorage.setItem(TOKEN_KEY, info.token);
    }
  } catch (e) {
    console.warn("Could not persist auth to localStorage", e);
  }
}

export function patchSavedUser(partial) {
  const current = getSavedUser();
  if (!current) return null;
  const next = { ...current, ...partial };
  saveAuth(next);
  try {
    window.dispatchEvent(new Event("assetflow-auth-updated"));
  } catch (e) {
    /* ignore */
  }
  return next;
}

export function getSavedUser() {
  try {
    const s = localStorage.getItem(USER_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || getSavedUser()?.token || null;
  } catch (e) {
    return null;
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn("Could not clear auth from localStorage", e);
  }
}

export function hasPermission(user, key) {
  if (user?.permissions?.includes(key)) return true;
  const role = user?.Role;
  if (role === "organization_admin" || role === "admin") return true;
  if (role === "asset_manager") {
    return [
      "users.read",
      "setup.manage",
      "assets.read",
      "assets.manage",
      "assets.assign",
      "assets.accept",
      "maintenance.request",
      "maintenance.manage",
      "reports.export",
      "dashboard.read",
    ].includes(key);
  }
  if (role === "employee") {
    return ["assets.read", "assets.accept", "maintenance.request", "dashboard.read"].includes(key);
  }
  return false;
}

export function roleLabel(role) {
  const labels = {
    organization_admin: "Organization Admin",
    asset_manager: "Asset Manager",
    employee: "Employee",
    admin: "Admin",
  };
  return labels[role] || role || "Member";
}

export function getSavedTheme() {
  try {
    const theme = localStorage.getItem("theme");
    return theme === "light" || theme === "dark" ? theme : "light";
  } catch (e) {
    return "light";
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {
    console.warn("Could not persist theme to localStorage", e);
  }
}
