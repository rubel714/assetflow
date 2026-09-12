import axios from "axios";
import { API_BASE } from "./apiBase";
import { getToken, clearAuth, getActingOrganization } from "./globalfunction";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const acting = getActingOrganization();
  const requestUrl = `${config.baseURL || ""}${config.url || ""}`;
  if (acting?.OrganizationId && !requestUrl.includes("/admin/organizations")) {
    config.headers["X-Organization-Id"] = String(acting.OrganizationId);
  }
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
