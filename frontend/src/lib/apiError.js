export function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    const value = data.detail ?? data.error ?? Object.values(data).flat().find(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  if (error?.request && !error?.response) {
    return "Cannot reach the backend. Please try again after the service restarts.";
  }

  return fallback;
}
