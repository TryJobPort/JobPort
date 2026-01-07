const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

/**
 * apiFetch
 * - Uses cookie-based auth by default (credentials: include)
 * - Optionally supports legacy x-user-id header when userId is provided
 */
export async function apiFetch(path, { method = "GET", body, userId } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (userId) headers["x-user-id"] = userId;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include", // ✅ REQUIRED for jp_session cookie auth
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
