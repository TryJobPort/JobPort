const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export async function apiFetch(path, opts = {}) {
  const base = "http://localhost:4000";
  const url = path.startsWith("http") ? path : `${base}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  if (opts.userId) headers["x-user-id"] = opts.userId;

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-json response
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

