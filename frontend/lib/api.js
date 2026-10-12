import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
// Generous: the AI routes try two providers, each with a 30s cap, so a slow
// fallback can legitimately take ~60s.
const TIMEOUT_MS = 90_000;

/** Fetch with the auth token attached; throws on non-2xx. */
export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const jwt = token ?? (await getToken());

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const msg =
      e?.name === "TimeoutError"
        ? "Request timed out"
        : "Cannot reach the server";
    throw Object.assign(new Error(msg), { status: 0, cause: e });
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON — usually an HTML error page from a proxy.
      data = { error: text.slice(0, 200) };
    }
  }

  if (!res.ok) {
    throw Object.assign(new Error(data.error || res.statusText), {
      status: res.status,
    });
  }
  return data;
}
