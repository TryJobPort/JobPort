function scoreMatch({ email, app }) {
  let score = 0;
  const reasons = [];

  const company = app.company ? String(app.company).toLowerCase() : "";
  const portal = app.portal ? String(app.portal).toLowerCase() : "";
  const role = app.role ? String(app.role).toLowerCase() : "";

  const subj = email.normalized_subject ? String(email.normalized_subject).toLowerCase() : "";
  const body = email.text_body ? String(email.text_body).toLowerCase() : "";
  const from = email.normalized_from ? String(email.normalized_from).toLowerCase() : "";

  // Subject signals
  if (subj) {
    if (company && subj.includes(company)) {
      score += 40; reasons.push("subject:company");
    }
    if (portal && subj.includes(portal)) {
      score += 25; reasons.push("subject:portal");
    }
    if (role && subj.includes(role)) {
      score += 15; reasons.push("subject:role");
    }
  }

  // Body signals
  if (body) {
    if (company && body.includes(company)) {
      score += 20; reasons.push("body:company");
    }
    if (role && body.includes(role)) {
      score += 20; reasons.push("body:role");
    }
    if (portal && body.includes(portal)) {
      score += 10; reasons.push("body:portal");
    }
  }

  // From-domain heuristic
  if (from && portal) {
    const domain = from.split("@")[1] || "";
    if (domain && domain.includes(portal)) {
      score += 15; reasons.push("from:portal-domain");
    }
  }

  return { score, reasons };
}

function matchEmailToApplications({ email, applications, limit = 5 }) {
  const results = applications.map((app) => {
    const { score, reasons } = scoreMatch({ email, app });
    return {
      applicationId: app.id,
      company: app.company,
      role: app.role,
      portal: app.portal,
      score,
      reasons,
    };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function getTopCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return candidates[0];
}

function confidenceForScore(score) {
  if (!score || score <= 0) return "none";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

module.exports = {
  matchEmailToApplications,
  getTopCandidate,
  confidenceForScore,
};
