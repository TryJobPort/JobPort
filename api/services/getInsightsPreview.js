// api/services/getInsightsPreview.js
const db = require("../db");
const { getSankeyFlow } = require("./getSankeyFlow");

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function getInsightsPreview(userId) {
  const uid = String(userId);

  // Status counts (cheap, deterministic)
  const rows = db
    .prepare(
      `
      SELECT
        status,
        COUNT(1) AS c
      FROM applications
      WHERE user_id = ?
      GROUP BY status
      `
    )
    .all(uid);

  const counts = { Applied: 0, Interview: 0, Offer: 0, Denied: 0, total: 0 };
  for (const r of rows) {
    const s = String(r.status || "Applied");
    const c = num(r.c);
    counts.total += c;
    if (/offer/i.test(s)) counts.Offer += c;
    else if (/interview/i.test(s)) counts.Interview += c;
    else if (/denied|rejected|declined|closed/i.test(s)) counts.Denied += c;
    else counts.Applied += c;
  }

  // Upcoming interviews
  const upcomingInterviews = db
    .prepare(
      `
      SELECT COUNT(1) AS c
      FROM applications
      WHERE user_id = ?
        AND next_interview_at IS NOT NULL
        AND datetime(next_interview_at) >= datetime('now')
      `
    )
    .get(uid);

  // Follow-up due (simple: no bearing in 7+ days, still in play)
  const followupDue = db
    .prepare(
      `
      SELECT COUNT(1) AS c
      FROM applications
      WHERE user_id = ?
        AND (status IS NULL OR status NOT IN ('Offer','Denied'))
        AND (
          datetime(COALESCE(last_bearing_at, updated_at, created_at)) < datetime('now','-7 days')
        )
      `
    )
    .get(uid);

  // Velocity (30d)
  const vApps = db
    .prepare(
      `
      SELECT COUNT(1) AS c
      FROM applications
      WHERE user_id = ?
        AND datetime(created_at) >= datetime('now','-30 days')
      `
    )
    .get(uid);

  const vInterviews = db
    .prepare(
      `
      SELECT COUNT(1) AS c
      FROM applications
      WHERE user_id = ?
        AND next_interview_at IS NOT NULL
        AND datetime(next_interview_at) >= datetime('now','-30 days')
      `
    )
    .get(uid);

  const vOffers = db
    .prepare(
      `
      SELECT COUNT(1) AS c
      FROM applications
      WHERE user_id = ?
        AND status = 'Offer'
        AND datetime(updated_at) >= datetime('now','-30 days')
      `
    )
    .get(uid);

  // Sankey (small preview only)
  const sankey = getSankeyFlow(uid);
  const links = Array.isArray(sankey?.links) ? sankey.links : [];
  const totalTransitions = links.reduce((sum, l) => sum + num(l.value), 0);
  const topLink = links[0] || null;

  return {
    ok: true,
    counts: {
      ...counts,
      upcomingInterviews: num(upcomingInterviews?.c),
    },
    proPreview: {
      followup: {
        due: num(followupDue?.c),
        windowDays: 7,
      },
      velocity30d: {
        applications: num(vApps?.c),
        interviews: num(vInterviews?.c),
        offers: num(vOffers?.c),
        windowDays: 30,
      },
      sankey: {
        totalTransitions,
        topLink: topLink
          ? { source: topLink.source, target: topLink.target, value: num(topLink.value) }
          : null,
      },
    },
  };
}

module.exports = { getInsightsPreview };
