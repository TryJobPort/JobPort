function normalizeAddress(val) {
  if (!val) return null;
  return String(val).trim().toLowerCase();
}

function normalizeSubject(val) {
  if (!val) return null;
  return String(val)
    .replace(/^(re|fw|fwd):\s*/i, "")
    .trim()
    .toLowerCase();
}

function extractBodies(raw) {
  // raw may already be stringified JSON or plain text
  if (!raw) return { text: null, html: null };

  // Heuristic only — no provider-specific logic yet
  if (raw.includes("<html") || raw.includes("<body")) {
    return { text: null, html: raw };
  }

  return { text: raw, html: null };
}

function normalizeEmail(row) {
  const { text, html } = extractBodies(row.raw_body);

  return {
    normalized_from: normalizeAddress(row.from_email),
    normalized_to: normalizeAddress(row.to_email),
    normalized_subject: normalizeSubject(row.subject),
    text_body: text,
    html_body: html,
  };
}

module.exports = { normalizeEmail };
