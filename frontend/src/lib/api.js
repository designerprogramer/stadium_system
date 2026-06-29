import axios from "axios";
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
} from "./auth";

const configuredBaseURL = import.meta.env.VITE_API_BASE_URL;
const productionFallbackBaseURL = `https://${["stadium-api-vrlb", "onrender", "com"].join(".")}/api`;

const baseURL = import.meta.env.DEV
  ? configuredBaseURL || "http://127.0.0.1:8000/api"
  : configuredBaseURL || productionFallbackBaseURL;

if (!baseURL) {
  console.error("VITE_API_BASE_URL is not set.");
}

const API = axios.create({ baseURL });
let refreshPromise = null;

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

    if (
      error?.response?.status === 401 &&
      refreshToken &&
      originalRequest &&
      !originalRequest._retry
    ) {
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
