// api/services/getSankeyFlow.js
const db = require("../db");

function tryParse(json) {
  try {
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

function bucket(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("offer")) return "Offer";
  if (s.includes("interview")) return "Interview";
  if (s.includes("denied") || s.includes("rejected") || s.includes("declined") || s.includes("closed")) return "Denied";
  return "Applied";
}

function k(source, target) {
  return `${source}→${target}`;
}

function getSankeyFlow(userId) {
  const rows = db
    .prepare(
      `
      SELECT
        e.application_id,
        e.created_at,
        e.event_type,
        e.payload,
        a.company,
        a.role
      FROM application_events e
      JOIN applications a
        ON a.id = e.application_id
       AND a.user_id = e.user_id
      WHERE e.user_id = ?
        AND (
          e.event_type IN ('email_status_promoted','status_signal_changed','status_changed')
          OR e.status_changed = 1
          OR json_extract(e.payload, '$.statusChanged') = 1
          OR json_extract(e.payload, '$.status_changed') = 1
          OR json_extract(e.payload, '$.nextStatus') IS NOT NULL
          OR json_extract(e.payload, '$.next_status') IS NOT NULL
          OR json_extract(e.payload, '$.next_status_signal') IS NOT NULL
        )
      ORDER BY datetime(e.created_at) DESC
      LIMIT 2500
      `
    )
    .all(String(userId));

  const nodes = ["Applied", "Interview", "Offer", "Denied"];
  const linkMap = new Map();

  for (const r of rows) {
    const p = tryParse(r.payload);

    const prevRaw = p.prevStatus || p.prev_status || p.prev_status_signal || p.prev_statusSignal || null;
    const nextRaw = p.nextStatus || p.next_status || p.next_status_signal || p.next_statusSignal || null;
    if (!prevRaw || !nextRaw) continue;

    const source = bucket(prevRaw);
    const target = bucket(nextRaw);
    if (source === target) continue;

    const key = k(source, target);
    if (!linkMap.has(key)) linkMap.set(key, { source, target, value: 0, examples: [] });

    const item = linkMap.get(key);
    item.value += 1;

    if (item.examples.length < 25) {
      item.examples.push({
        applicationId: r.application_id,
        company: r.company || "",
        role: r.role || "",
        occurredAt: r.created_at,
      });
    }
  }

  const links = Array.from(linkMap.values()).sort((a, b) => b.value - a.value);

  const examplesByLink = {};
  for (const l of links) {
    examplesByLink[k(l.source, l.target)] = l.examples;
    delete l.examples;
  }

  return { ok: true, nodes, links, examplesByLink };
}

module.exports = { getSankeyFlow };
