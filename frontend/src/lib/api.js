import axios from "axios";
import { clearAuthSession, getAccessToken, getRefreshToken, updateAccessToken } from "./auth";

const defaultProductionApiUrl = "https://stadium-api-vrlb.onrender.com/api";
const baseURL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:8000/api" : defaultProductionApiUrl);

if (!import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL) {
  console.warn(
    "VITE_API_BASE_URL is not set in production. Falling back to " +
    `${defaultProductionApiUrl}. Set VITE_API_BASE_URL in your deploy environment ` +
    "and redeploy to make this explicit."
  );
}

const API = axios.create({ baseURL });
let refreshPromise = null;

if (!import.meta.env.DEV) {
  console.debug("API baseURL:", baseURL, "VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);
}

API.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const refreshToken = getRefreshToken();

    if (error?.response?.status === 401 && refreshToken && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        refreshPromise ||= axios
          .post(`${baseURL}/refresh/`, { refresh: refreshToken })
          .finally(() => {
            refreshPromise = null;
          });
        const response = await refreshPromise;
        updateAccessToken(response.data.access);
        originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
        return API(originalRequest);
      } catch {
        clearAuthSession();
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
    } else if (error?.response?.status === 401) {
      clearAuthSession();
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    return Promise.reject(error);
  }
);

export default API;
