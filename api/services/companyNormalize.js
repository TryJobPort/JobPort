// api/services/companyNormalize.js
//
// Phase 24.1 — Company normalization from inbound email
// Goal: avoid "Gmail" / "Email" as company; derive a reasonable company name.
//
// Strategy (conservative):
// 1) If sender is an ATS/vendor (greenhouse/lever/workday/etc), try extracting company from subject.
// 2) Otherwise derive from sender domain root (spotify.com -> Spotify).
// 3) Ignore free email providers (gmail/yahoo/outlook/etc) unless subject clearly indicates company.
// 4) Fall back to "Unknown".

const FREE_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "comcast.net",
]);

const ATS_DOMAINS = [
  "greenhouse.io",
  "mail.greenhouse.io",
  "boards.greenhouse.io",
  "lever.co",
  "hire.lever.co",
  "ashbyhq.com",
  "workday.com",
  "myworkday.com",
  "icims.com",
  "smartrecruiters.com",
  "jobvite.com",
  "successfactors.com",
  "oraclecloud.com",
  "taleo.net",
];

function cleanEmailAddress(from) {
  if (!from) return "";
  const s = String(from).trim();
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

function domainOf(email) {
  const at = String(email || "").lastIndexOf("@");
  if (at === -1) return "";
  return String(email).slice(at + 1).toLowerCase();
}

function rootDomain(domain) {
  // simple: take last 2 labels (spotify.com), handle co.uk-ish with a tiny heuristic
  const parts = String(domain || "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const last2 = parts.slice(-2).join(".");
  const last3 = parts.slice(-3).join(".");
  // crude public suffix handling
  if (last2 === "co.uk" || last2 === "com.au" || last2 === "co.nz") return last3;
  return last2;
}

function titleCaseCompany(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  // keep known casing for some brands if needed later; for now simple
  return v
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}

function looksLikeAtsDomain(domain) {
  const d = String(domain || "").toLowerCase();
  return ATS_DOMAINS.some((x) => d === x || d.endsWith("." + x));
}

function extractCompanyFromSubject(subject) {
  const s = String(subject || "").trim();

  // Common patterns:
  // "Interview for X at Spotify"
  // "Offer for Product Manager role — Spotify"
  // "Your application to Stripe"
  // "Application received: Notion"
  // "Spotify - Next steps"
  // "Re: [Spotify] ..."

  let m =
    s.match(/\bat\s+([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,4})\b/) ||
    s.match(/\bto\s+([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,4})\b/) ||
    s.match(/:\s*([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,4})\s*$/) ||
    s.match(/—\s*([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,4})\s*$/) ||
    s.match(/-\s*([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,4})\s*$/);

  if (!m) return "";

  const candidate = String(m[1] || "").trim();

  // reject generic words
  if (!candidate) return "";
  if (/^(gmail|google|email|notification|update)$/i.test(candidate)) return "";

  return candidate;
}

function companyFromDomain(domain) {
  const root = rootDomain(domain);
  if (!root) return "";
  const left = root.split(".")[0]; // spotify from spotify.com
  if (!left) return "";
  if (left.length <= 1) return "";
  if (left === "mail" || left === "notify" || left === "noreply") return "";
  return titleCaseCompany(left);
}

function normalizeCompanyFromEmail({ from_email, subject } = {}) {
  const from = cleanEmailAddress(from_email);
  const dom = domainOf(from);

  // If sender is ATS/vendor, subject tends to contain the actual company
  if (looksLikeAtsDomain(dom)) {
    const subCo = extractCompanyFromSubject(subject);
    if (subCo) return titleCaseCompany(subCo);
    // fallback: vendor name, not ideal but better than Gmail
    return titleCaseCompany(rootDomain(dom).split(".")[0] || "Unknown");
  }

  // If free provider, do not call company "Gmail"
  if (dom && FREE_PROVIDERS.has(dom)) {
    const subCo = extractCompanyFromSubject(subject);
    if (subCo) return titleCaseCompany(subCo);
    return "Unknown";
  }

  // Normal corporate domain
  const dco = companyFromDomain(dom);
  if (dco) return dco;

  // Subject fallback
  const subCo = extractCompanyFromSubject(subject);
  if (subCo) return titleCaseCompany(subCo);

  return "Unknown";
}

module.exports = {
  normalizeCompanyFromEmail,
  cleanEmailAddress,
  domainOf,
  rootDomain,
  extractCompanyFromSubject,
};
