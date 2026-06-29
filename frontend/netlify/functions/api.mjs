const DEFAULT_BACKEND_ORIGIN = `https://${["stadium-api-vrlb", "onrender", "com"].join(".")}`;
const BACKEND_ORIGIN = (process.env.BACKEND_API_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/+$/, "");
const FUNCTION_PREFIX = "/.netlify/functions/api";

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function getBackendPath(event) {
  const rawPath = event.rawUrl
    ? new URL(event.rawUrl).pathname
    : event.path || FUNCTION_PREFIX;
  const suffix = rawPath.startsWith(FUNCTION_PREFIX)
    ? rawPath.slice(FUNCTION_PREFIX.length)
    : rawPath;

  return `/api${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

function getHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !hopByHopHeaders.has(key.toLowerCase()))
  );
}

function getResponseHeaders(headers) {
  return Object.fromEntries(
    Array.from(headers.entries()).filter(([key]) => !hopByHopHeaders.has(key.toLowerCase()))
  );
}

export async function handler(event) {
  const backendPath = getBackendPath(event);
  const query = event.rawQuery ? `?${event.rawQuery}` : "";
  const targetUrl = `${BACKEND_ORIGIN}${backendPath}${query}`;
  const method = event.httpMethod || "GET";
  const hasRequestBody = !["GET", "HEAD"].includes(method.toUpperCase());

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: getHeaders(event.headers),
      body: hasRequestBody && event.body
        ? event.isBase64Encoded
          ? Buffer.from(event.body, "base64")
          : event.body
        : undefined,
    });

    return {
      statusCode: response.status,
      headers: getResponseHeaders(response.headers),
      body: await response.text(),
    };
  } catch (error) {
    console.error("Netlify API proxy failed", { targetUrl, error });
    return {
      statusCode: 502,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        detail: "The API proxy could not reach the backend. Please try again.",
      }),
    };
  }
}
