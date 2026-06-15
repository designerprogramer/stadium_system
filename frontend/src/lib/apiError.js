export function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data;
  const isProductionMissingApiUrl = !import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL;
  const requestUrl = error?.config ? `${error.config.baseURL || ''}${error.config.url || ''}` : null;

  if (typeof data === "string" && data.trim()) {
    const normalized = data.trim();
    if (normalized.startsWith("<!DOCTYPE html>") || normalized.toLowerCase().includes("<html")) {
      return requestUrl
        ? `Received HTML from ${requestUrl}. This usually means the API request was routed to the static frontend host instead of the backend. Check VITE_API_BASE_URL and rebuild.`
        : "Received an unexpected HTML response from the backend. Check VITE_API_BASE_URL and your build configuration.";
    }
    return normalized;
  }

  if (data && typeof data === "object") {
    const value = data.detail ?? data.error ?? Object.values(data).flat().find(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  if (error?.request && !error?.response) {
    if (isProductionMissingApiUrl) {
      return "Cannot reach the backend. Set VITE_API_BASE_URL in your frontend deploy environment and verify the backend is available.";
    }
    return "Cannot reach the backend. Please try again after the service restarts.";
  }

  return fallback;
}
