// api/utils/inferStatusSignal.js

function toTextString(x) {
  if (typeof x === "string") return x;
  if (x == null) return "";
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function normalizeText(s) {
  return toTextString(s).replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Accepts either:
 *  - inferStatusSignal("text")
 *  - inferStatusSignal({ visibleText, url })
 */
function inferStatusSignal(input) {
  const isString = typeof input === "string";
  const visibleText = isString ? input : input?.visibleText;
  const url = isString ? "" : (input?.url || "");

  // DEV OVERRIDE:
  // Add ?jp_force_status=INTERVIEW (or any status) to the monitored URL
  // to force the inferred signal during local testing.
  try {
    if (url && String(url).includes("jp_force_status=")) {
      const u = new URL(url);
      const forced = u.searchParams.get("jp_force_status");
      if (forced) {
        return {
          signal: String(forced).trim(),
          confidence: 1.0,
          matched: ["dev_override"],
          reason: "dev_override",
        };
      }
    }
  } catch {}

  const normalizedText = normalizeText(visibleText);

  const rules = [
    { signal: "OFFER", patterns: ["we are excited to offer", "congratulations", "offer"] },
    { signal: "INTERVIEW", patterns: ["schedule an interview", "interview", "phone screen", "onsite", "on-site"] },
    { signal: "UNDER_REVIEW", patterns: ["under review", "in review", "reviewing your application"] },
    { signal: "SUBMITTED", patterns: ["application submitted", "thank you for applying", "received your application"] },
    { signal: "REJECTED", patterns: ["not selected", "not moving forward", "regret to inform", "unfortunately"] },
    { signal: "CLOSED", patterns: ["position closed", "role has been filled", "no longer accepting applications"] },
  ];

  for (const r of rules) {
    for (const p of r.patterns) {
      if (normalizedText.includes(p)) {
        return { signal: r.signal, confidence: 0.7, matched: [p] };
      }
    }
  }

  return { signal: "UNKNOWN", confidence: 0.2, matched: [] };
}

module.exports = { inferStatusSignal };
