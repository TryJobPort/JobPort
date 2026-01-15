"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import AppShell from "../../../components/AppShell";

const COLUMNS = ["Applied", "Interview", "Offer", "Denied"];
const LANE_PREVIEW_COUNT = 5;

// -----------------------------
// Helpers
// -----------------------------
function normalizeStatus(s) {
  const v = String(s || "").toLowerCase();
  if (v.includes("interview")) return "Interview";
  if (v.includes("offer")) return "Offer";
  if (v.includes("denied") || v.includes("rejected") || v.includes("declined") || v.includes("closed")) return "Denied";
  return "Applied";
}

function formatDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatWhenTz(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function confidenceMeta(score) {
  const n = Number(score || 0);
  if (n >= 80) return { label: "High", tone: "jp-conf jp-conf--high" };
  if (n >= 60) return { label: "Med", tone: "jp-conf jp-conf--med" };
  if (n >= 40) return { label: "Low", tone: "jp-conf jp-conf--low" };
  return null;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function anySelected(obj) {
  return Object.values(obj || {}).some(Boolean);
}

function meetingLabel(url) {
  if (!url) return "Join meeting";
  const u = String(url).toLowerCase();
  if (u.includes("meet.google.com")) return "Join Google Meet";
  if (u.includes("zoom.us")) return "Join Zoom";
  if (u.includes("teams.microsoft.com")) return "Join Teams";
  if (u.includes("webex.com")) return "Join Webex";
  if (u.includes("calendar.google.com")) return "Open Google Calendar";
  if (u.includes("outlook.office.com") || u.includes("outlook.live.com")) return "Open Outlook Calendar";
  return "Join meeting";
}

// Salary parsing (best-effort)
function normalizeMoney(s) {
  if (!s) return null;
  const raw = String(s).toLowerCase().replace(/\s/g, "");
  const isK = raw.endsWith("k");
  const digits = raw.replace(/[^0-9,]/g, "").replace(/,/g, "");
  const n = Number(digits || 0);
  if (!n) return null;
  return isK ? n * 1000 : n;
}

function parseSalaryAnnual(a) {
  const candidates = [a?.salary, a?.compensation, a?.pay, a?.role, a?.title]
    .map((x) => (x == null ? "" : String(x)))
    .filter(Boolean)
    .join(" ");

  if (!candidates) return null;

  // Range (use max)
  const range = candidates.match(/(\$?\s*\d[\d,]*\s*k?)\s*[-–]\s*(\$?\s*\d[\d,]*\s*k?)/i);
  if (range) {
    const lo = normalizeMoney(range[1]);
    const hi = normalizeMoney(range[2]);
    const v = Math.max(lo || 0, hi || 0);
    return v > 0 ? v : null;
  }

  // Single
  const single = candidates.match(/(\$?\s*\d[\d,]*\s*k?)/i);
  if (!single) return null;

  let v = normalizeMoney(single[1]);
  if (!v) return null;

  const isHourly = /\/\s*hr|per\s*hour|hourly|\/\s*h\b/i.test(candidates);
  if (isHourly) v = Math.round(v * 2080);

  return v;
}

// Work type detection (best-effort)
function detectWorkType(a) {
  const hay = [a?.work_type, a?.workType, a?.location_type, a?.locationType, a?.role, a?.title, a?.url]
    .map((x) => (x == null ? "" : String(x)))
    .join(" ")
    .toLowerCase();

  if (hay.includes("remote")) return "remote";
  if (hay.includes("hybrid")) return "hybrid";
  if (hay.includes("on-site") || hay.includes("onsite") || hay.includes("on site")) return "onsite";
  return "unspecified";
}

// Source detection (best-effort)
function detectSource(a) {
  const hay = [a?.source, a?.portal, a?.url]
    .map((x) => (x == null ? "" : String(x)))
    .join(" ")
    .toLowerCase();

  if (hay.includes("referral")) return "referral";
  if (hay.includes("recruit")) return "recruiter";
  if (hay.includes("linkedin")) return "linkedin";
  if (hay.includes("company")) return "company";
  if (hay) return "other";
  return "unspecified";
}

function ProLock({ children }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          className="jp-primary-btn"
          onClick={() => (window.location.href = "/plans")}
        >
          Upgrade to unlock
        </button>
      </div>
    </div>
  );
}

export default function FunnelPage() {
  const router = useRouter();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // Controls
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [expandedLane, setExpandedLane] = useState({
    Applied: false,
    Interview: false,
    Offer: false,
    Denied: false,
  });

  // Filters
  const [workType, setWorkType] = useState({ remote: false, hybrid: false, onsite: false });
  const [sources, setSources] = useState({
    referral: false,
    recruiter: false,
    linkedin: false,
    company: false,
    other: false,
  });

  const SAL_MIN = 50000;
  const SAL_MAX = 200000;

  const [salaryMin, setSalaryMin] = useState(0);
  const [includeSalaryUnspecified, setIncludeSalaryUnspecified] = useState(true);

  const localTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
    } catch {
      return "Local";
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/applications");
        setData(res);
      } catch (e) {
        setErr(e?.message || "Failed to load");
      }
    })();
  }, []);

  async function togglePin(appId, nextPinned) {
    // optimistic update
    setData((prev) => ({
      ...prev,
      applications: prev.applications.map((a) => (a.id === appId ? { ...a, pinned: nextPinned ? 1 : 0 } : a)),
    }));

    try {
      await apiFetch(`/applications/${appId}/pin`, {
        method: "POST",
        body: { pinned: nextPinned ? 1 : 0 },
      });
    } catch {
      // revert on failure
      setData((prev) => ({
        ...prev,
        applications: prev.applications.map((a) => (a.id === appId ? { ...a, pinned: nextPinned ? 0 : 1 } : a)),
      }));
    }
  }

  function passesFilters(a) {
    // Search (client-side)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay = `${a.company || ""} ${a.role || ""} ${a.portal || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    // Work type
    if (anySelected(workType)) {
      const wt = detectWorkType(a);
      const ok =
        (workType.remote && wt === "remote") ||
        (workType.hybrid && wt === "hybrid") ||
        (workType.onsite && wt === "onsite");
      if (!ok) return false;
    }

    // Source
    if (anySelected(sources)) {
      const s = detectSource(a);
      const ok =
        (sources.referral && s === "referral") ||
        (sources.recruiter && s === "recruiter") ||
        (sources.linkedin && s === "linkedin") ||
        (sources.company && s === "company") ||
        (sources.other && s === "other");
      if (!ok) return false;
    }

    // Salary
    if (salaryMin > 0) {
      const annual = parseSalaryAnnual(a);
      if (annual == null) return includeSalaryUnspecified;
      if (annual < salaryMin) return false;
    }

    return true;
  }

  const derived = useMemo(() => {
    const rawApps = data?.applications || [];
    const apps = rawApps.filter(passesFilters);

    // Bucket
    const buckets = Object.fromEntries(COLUMNS.map((c) => [c, []]));
    for (const a of apps) buckets[normalizeStatus(a.status)].push(a);

    // Sort: pinned first, then upcoming interview time, then updated desc, then created desc
    for (const col of COLUMNS) {
      buckets[col].sort((x, y) => {
        const xp = Number(x.pinned || 0);
        const yp = Number(y.pinned || 0);
        if (xp !== yp) return yp - xp;

        const xi = x.next_interview_at ? Date.parse(x.next_interview_at) : Infinity;
        const yi = y.next_interview_at ? Date.parse(y.next_interview_at) : Infinity;
        if (xi !== yi) return xi - yi;

        const xu = x.updated_at ? Date.parse(x.updated_at) : 0;
        const yu = y.updated_at ? Date.parse(y.updated_at) : 0;
        if (xu !== yu) return yu - xu;

        return Date.parse(y.created_at || 0) - Date.parse(x.created_at || 0);
      });
    }

    // Upcoming interviews list (below lanes)
   const now = Date.now();

// 1) Prefer interviews with a real future time
const upcomingByTime = apps
  .map((a) => ({ a, t: a.next_interview_at ? Date.parse(a.next_interview_at) : NaN }))
  .filter(({ t }) => Number.isFinite(t) && t > now)
  .sort((x, y) => x.t - y.t)
  .slice(0, 6)
  .map(({ a }) => a);

// 2) Fallback: Interview-stage items with a meeting link (time not detected yet)
const upcomingByLink = apps
  .filter((a) => normalizeStatus(a.status) === "Interview" && a.next_interview_link)
  .slice(0, 6);

const upcomingInterviews = upcomingByTime.length ? upcomingByTime : upcomingByLink;


    // Sankey-ish counts: inputs → outcomes (simple, reliable)
    const total = apps.length;
    const counts = {
      Applied: 0,
      Interview: 0,
      Offer: 0,
      Denied: 0,
    };
    for (const a of apps) counts[normalizeStatus(a.status)] += 1;

    return {
      buckets,
      totalShown: apps.length,
      totalAll: rawApps.length,
      upcomingInterviews,
      counts,
      total,
    };
  }, [data, workType, sources, salaryMin, includeSalaryUnspecified, searchQuery]);

  const byColumn = derived.buckets;
  const totalShown = derived.totalShown;
  const upcomingInterviews = derived.upcomingInterviews || [];
  const counts = derived.counts || { Applied: 0, Interview: 0, Offer: 0, Denied: 0 };
  const total = derived.total || 0;

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <AppShell
      active="applications"
      title="Dashboard"
      cta={
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button className="jp-upgrade" type="button">
            Upgrade to Pro
          </button>
          <Link href="/job-applications" style={{ fontSize: 14 }}>
            List view
          </Link>
        </div>
      }
    >
      <main style={{ padding: 28, maxWidth: 1200, margin: "0 auto" }}>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Your pipeline, built from inbox signals. Pin what matters and surface what’s next.
        </p>
        {err ? <p style={{ marginTop: 10, color: "crimson" }}>{err}</p> : null}

      <style jsx global>{`
        .jp-upgrade {
          border: 0;
          background: #0b57ff;
          color: #fff;
          font-weight: 800;
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
        }

        .jp-card {
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          padding: 12px;
          margin-bottom: 10px;
          cursor: pointer;
          background: #fff;
          box-shadow: 0 1px 0 rgba(0,0,0,0.02);
        }
        .jp-card:hover { border-color: rgba(0,0,0,0.14); }

        .jp-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }

        .jp-title { font-weight: 900; }
        .jp-sub { opacity: 0.8; font-size: 13px; margin-top: 2px; }
        .jp-meta { opacity: 0.6; font-size: 12px; margin-top: 8px; }

        .jp-meta--row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .jp-meta-text {
          flex: 1;
          min-width: 0;
        }

        .jp-conf {
          font-size: 11px;
          line-height: 1;
          padding: 6px 8px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.10);
          opacity: 0.9;
          user-select: none;
          white-space: nowrap;
        }
        .jp-conf--low { opacity: 0.75; }

        .jp-card--upcoming { border: 2px solid rgba(0,0,0,0.28); }
        .jp-upcoming {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 900;
          opacity: 0.9;
        }

        .jp-join {
          margin-left: 10px;
          font-weight: 900;
          text-decoration: underline;
          cursor: pointer;
          opacity: 0.9;
        }

        /* Pin control (icon-only, readable) */
        .jp-pin-radio {
          background: transparent;
          border-radius: 999px;
          padding: 2px 6px;
          font-size: 14px;
          cursor: pointer;
          opacity: 0.9;
          user-select: none;
          display: inline-flex;
          align-items: center;
        }
        .jp-pin-radio:hover { opacity: 1; }
        .jp-pin-radio--on { opacity: 1; }

        /* Filters anchor + drawer */
        .jp-controls-row {
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .jp-filters-anchor { position: relative; }

        .jp-iconbtn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.10);
          background: #fff;
          cursor: pointer;
          display: grid;
          place-items: center;
          box-shadow: 0 1px 0 rgba(0,0,0,0.02);
          color: rgba(0,0,0,0.85);
        }
        .jp-iconbtn:hover { border-color: rgba(0,0,0,0.16); }
        .jp-filtericon { display: block; }

        .jp-search {
          flex: 1;
          max-width: 520px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.10);
          padding: 0 12px;
          background: #fff;
          outline: none;
        }

        .jp-filters-panel {
          position: relative;
          margin-top: 10px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px;
          background: #fff;
          padding: 14px;
        }

        .jp-drawer-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .jp-muted { opacity: 0.6; font-size: 12px; }

        .jp-filter-row { margin-top: 12px; }
        .jp-filter-label { font-weight: 900; font-size: 12px; opacity: 0.9; margin-bottom: 8px; }

        .jp-chiprow { display: flex; flex-wrap: wrap; gap: 10px; }
        .jp-chip {
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          cursor: pointer;
          font-weight: 800;
          font-size: 13px;
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }
        .jp-chip:hover { border-color: rgba(11,87,255,0.35); }
        .jp-chip--on {
          border-color: rgba(11,87,255,0.55);
          background: rgba(11,87,255,0.10);
          color: rgba(11,87,255,1);
        }

        .jp-salary-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .jp-range { width: 240px; }

        /* Lanes */
        .jp-lanes {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .jp-lane {
          background: #fff;
          border-radius: 18px;
          padding: 14px;
          min-width: 0;
        }

        .jp-lane-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
          gap: 8px;
        }

        .jp-lane-actions {
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }

        .jp-linkbtn {
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
          opacity: 0.75;
        }
        .jp-linkbtn:hover { opacity: 1; text-decoration: underline; }

        .jp-lane-scroll {
          overflow-y: auto;
          padding-right: 4px;
        }

        /* Insights cards below lanes */
        .jp-section-title {
          margin-top: 22px;
          margin-bottom: 10px;
          font-weight: 900;
          font-size: 14px;
          opacity: 0.9;
        }

        .jp-insights {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 980px) {
          .jp-insights { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .jp-lanes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .jp-insights { grid-template-columns: 1fr; }
          .jp-lanes { grid-template-columns: 1fr; }
          .jp-search { max-width: 100%; }
        }

        .jp-insight-card {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          min-width: 0;
        }

        .jp-insight-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 10px;
        }

        .jp-badge {
          font-size: 11px;
          font-weight: 900;
          padding: 5px 8px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.10);
          opacity: 0.85;
          white-space: nowrap;
        }

        .jp-badge--pro {
          border-color: rgba(11,87,255,0.35);
          background: rgba(11,87,255,0.10);
          color: rgba(11,87,255,1);
          opacity: 1;
        }

        .jp-primary-btn {
          border: 0;
          background: #0b57ff;
          color: #fff;
          font-weight: 900;
          padding: 8px 10px;
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          white-space: nowrap;
        }

        .jp-minirow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          margin-top: 10px;
        }

        .jp-minirow:hover { border-color: rgba(0,0,0,0.14); }

        /* Mini “sankey” bars */
        .jp-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 10px;
        }
        .jp-bar {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .jp-bar-label {
          width: 70px;
          font-size: 12px;
          font-weight: 900;
          opacity: 0.85;
        }
        .jp-bar-track {
          flex: 1;
          height: 10px;
          border-radius: 999px;
          background: rgba(0,0,0,0.06);
          overflow: hidden;
        }
        .jp-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: rgba(11,87,255,0.55);
        }
        .jp-bar-val {
          width: 26px;
          text-align: right;
          font-size: 12px;
          font-weight: 900;
          opacity: 0.7;
        }

        .jp-cta {
          border: 0;
          background: #0b57ff;
          color: #fff;
          font-weight: 900;
          padding: 8px 10px;
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          white-space: nowrap;
          font-size: 12px;
        }
        .jp-cta:hover { filter: brightness(0.97); }

      `}</style>

      {/* Controls row: filters + search */}
      <div className="jp-controls-row">
        <div className="jp-filters-anchor">
          <button className="jp-iconbtn" type="button" title="Filters" onClick={() => setFiltersOpen((v) => !v)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="jp-filtericon">
              <path d="M4 6h10M18 6h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 12h6M14 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
              <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>

          {filtersOpen ? (
            <div className="jp-filters-panel">
              <div className="jp-drawer-title">
                <strong>Filters</strong>
                <span className="jp-muted">{totalShown} shown</span>
              </div>

              {/* Work Type */}
              <div className="jp-filter-row">
                <div className="jp-filter-label">Work type</div>
                <div className="jp-chiprow">
                  <button
                    type="button"
                    className={`jp-chip${workType.remote ? " jp-chip--on" : ""}`}
                    onClick={() => setWorkType((p) => ({ ...p, remote: !p.remote }))}
                    title="Remote"
                  >
                    <span aria-hidden>🏠</span> Remote
                  </button>

                  <button
                    type="button"
                    className={`jp-chip${workType.hybrid ? " jp-chip--on" : ""}`}
                    onClick={() => setWorkType((p) => ({ ...p, hybrid: !p.hybrid }))}
                    title="Hybrid"
                  >
                    <span aria-hidden>🏠↻🏢</span> Hybrid
                  </button>

                  <button
                    type="button"
                    className={`jp-chip${workType.onsite ? " jp-chip--on" : ""}`}
                    onClick={() => setWorkType((p) => ({ ...p, onsite: !p.onsite }))}
                    title="On-site"
                  >
                    <span aria-hidden>🏢</span> On-site
                  </button>
                </div>
              </div>

              {/* Salary */}
              <div className="jp-filter-row">
                <div className="jp-filter-label">Salary (/year)</div>
                <div className="jp-salary-row">
                  <input
                    className="jp-range"
                    type="range"
                    min={SAL_MIN}
                    max={SAL_MAX}
                    step={5000}
                    value={salaryMin === 0 ? SAL_MIN : salaryMin}
                    onChange={(e) => {
                      const v = Number(e.target.value || SAL_MIN);
                      setSalaryMin(v <= SAL_MIN ? 0 : clamp(v, SAL_MIN, SAL_MAX));
                    }}
                  />
                  <span className="jp-muted">
                    Min:{" "}
                    {salaryMin === 0
                      ? "Any"
                      : `$${salaryMin.toLocaleString()}${salaryMin >= SAL_MAX ? "+" : ""}`}
                  </span>

                  <button
                    type="button"
                    className={`jp-chip${includeSalaryUnspecified ? " jp-chip--on" : ""}`}
                    onClick={() => setIncludeSalaryUnspecified((v) => !v)}
                    title="Include / exclude jobs with no salary detected"
                  >
                    Include unspecified
                  </button>
                </div>
              </div>

              {/* Source */}
              <div className="jp-filter-row">
                <div className="jp-filter-label">Source</div>
                <div className="jp-chiprow">
                  {[
                    ["referral", "Referral"],
                    ["recruiter", "Recruiter"],
                    ["linkedin", "LinkedIn"],
                    ["company", "Company site"],
                    ["other", "Other"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`jp-chip${sources[key] ? " jp-chip--on" : ""}`}
                      onClick={() => setSources((p) => ({ ...p, [key]: !p[key] }))}
                      title={label}
                    >
                      <span aria-hidden>{sources[key] ? "◉" : "○"}</span> {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <input
          className="jp-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search company, role, portal…"
          aria-label="Search job applications"
        />
      </div>

      {/* LANES (top of page) */}
      {data?.applications?.length > 0 ? (
        <section className="jp-lanes">
          {COLUMNS.map((col) => (
            <div key={col} className="jp-lane">
              <div className="jp-lane-head">
                <strong>{col}</strong>

                <div className="jp-lane-actions">
                  <span style={{ opacity: 0.6 }}>{byColumn[col].length}</span>
                  {byColumn[col].length > LANE_PREVIEW_COUNT ? (
                    <button
                      type="button"
                      className="jp-linkbtn"
                      onClick={() => setExpandedLane((p) => ({ ...p, [col]: !p[col] }))}
                      title={expandedLane[col] ? "Collapse" : "Expand"}
                    >
                      {expandedLane[col] ? "Collapse" : "Expand"}
                    </button>
                  ) : null}
                </div>
              </div>

              {(() => {
                const items = byColumn[col] || [];
                const pinned = items.filter((a) => Number(a.pinned || 0));
                const unpinned = items.filter((a) => !Number(a.pinned || 0));

                const renderCard = (a) => {
                  const conf = confidenceMeta(a.confidence_score);

                  const statusLine =
                    col === "Interview"
                      ? a.next_interview_at
                        ? `Interview scheduled · ${formatDay(a.next_interview_at)}`
                        : `Last update · ${formatDay(a.updated_at)}`
                      : col === "Offer"
                      ? `Offer received · ${formatDay(a.updated_at)}`
                      : col === "Denied"
                      ? `Application closed · ${formatDay(a.updated_at)}`
                      : `Last update · ${formatDay(a.updated_at)}`;

                  return (
                    <div
                      key={a.id}
                      className={`jp-card${col === "Interview" && a.next_interview_at ? " jp-card--upcoming" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/job-applications/${a.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") router.push(`/job-applications/${a.id}`);
                      }}
                    >
                      <div className="jp-row">
                        <div>
                          <div className="jp-title">{a.company || "—"}</div>
                          <div className="jp-sub">{a.role || "—"}</div>

                          {a.next_interview_at ? (
                            <div className="jp-upcoming">Upcoming interview · {formatWhen(a.next_interview_at)}</div>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          {/* icon-only pin (your preference) */}
                          <span
                            className={`jp-pin-radio${a.pinned ? " jp-pin-radio--on" : ""}`}
                            title={a.pinned ? "Unpin" : "Pin"}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(a.id, !a.pinned);
                            }}
                          >
                            <span aria-hidden>{a.pinned ? "📌" : "⚪"}</span>
                          </span>

                          {conf ? <div className={conf.tone}>{conf.label}</div> : null}
                        </div>
                      </div>

                      <div className="jp-meta jp-meta--row">
                        <span className="jp-meta-text">{statusLine}</span>

                        {a.next_interview_link ? (
                          <button
                            type="button"
                            className="jp-cta"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(a.next_interview_link, "_blank", "noopener,noreferrer");
                            }}
                            title={meetingLabel(a.next_interview_link)}
                          >
                            Join
                          </button>
                        ) : null}
                      </div>

                    </div>
                  );
                };

                // Apply “preview 5” behavior with internal scroll.
                // We keep pinned-first ordering, but the lane preview should not explode height.
                const ordered = [...pinned, ...(pinned.length && unpinned.length ? [{ __divider: true }] : []), ...unpinned];
                const compact = !expandedLane[col];
                const display = compact ? ordered.slice(0, LANE_PREVIEW_COUNT) : ordered;

                const laneMaxHeight = compact ? 520 : undefined;

                return (
                  <div className="jp-lane-scroll" style={{ maxHeight: laneMaxHeight }}>
                    {display.map((item, idx) => {
                      if (item && item.__divider) {
                        return (
                          <div
                            key={`div-${col}-${idx}`}
                            style={{ height: 10, borderTop: "1px solid rgba(0,0,0,0.06)", margin: "10px 0" }}
                          />
                        );
                      }
                      return renderCard(item);
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
        </section>
      ) : null}

      {/* Below-the-fold cards */}
      <div className="jp-section-title">Insights</div>

      <section className="jp-insights">
        {/* 1) Upcoming Interviews */}
        <div className="jp-insight-card">
          <div className="jp-insight-head">
            <div>
              <div style={{ fontWeight: 900 }}>Upcoming interviews</div>
              <div className="jp-muted">Times shown in {localTz}</div>
            </div>
            <span className="jp-badge">{upcomingInterviews.length}</span>
          </div>

          {upcomingInterviews.length ? (
            <>
              {upcomingInterviews.slice(0, 3).map((a) => (
                <div key={a.id} className="jp-minirow">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.company || "—"}
                    </div>
                    <div className="jp-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.role || "—"}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
                      {a.next_interview_at ? formatWhenTz(a.next_interview_at) : "Time not detected yet"}
                    </div>
                  </div>

                  {a.next_interview_link ? (
                    <a
                      className="jp-primary-btn"
                      href={a.next_interview_link}
                      target="_blank"
                      rel="noreferrer"
                      title={meetingLabel(a.next_interview_link)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Join
                    </a>
                  ) : (
                    <button
                      className="jp-primary-btn"
                      type="button"
                      onClick={() => router.push(`/job-applications/${a.id}`)}
                      title="View job application"
                    >
                      View
                    </button>
                  )}
                </div>
              ))}

              {upcomingInterviews.length > 3 ? (
                <button
                  type="button"
                  className="jp-linkbtn"
                  onClick={() => router.push("/job-applications?stage=Interview")}
                  style={{ marginTop: 10 }}
                >
                  View all interview-stage job applications
                </button>
              ) : null}
            </>
          ) : (
            <div className="jp-muted">No upcoming interviews detected yet.</div>
          )}
        </div>

        {/* 2) Sankey (counts-only, clean) */}
        <div className="jp-insight-card">
            <div className="jp-insight-head">
              <div>
                <div style={{ fontWeight: 900 }}>Job search flow</div>
                <div className="jp-muted">Inputs → outcomes (counts)</div>
              </div>
              <span className="jp-badge">{total}</span>
            </div>
          <div className="jp-muted">Total job applications shown: <strong>{total}</strong></div>

          <div className="jp-bars">
            {[
              ["Applied", counts.Applied],
              ["Interview", counts.Interview],
              ["Offer", counts.Offer],
              ["Denied", counts.Denied],
            ].map(([label, value]) => {
              const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0;
              return (
                <div key={label} className="jp-bar">
                  <div className="jp-bar-label">{label}</div>
                  <div className="jp-bar-track" title={`${pct}%`}>
                    <div className="jp-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="jp-bar-val">{value}</div>
                </div>
              );
            })}
          </div>

          <div className="jp-muted" style={{ marginTop: 10 }}>
            This will become a full Sankey card (read-only) once we add reply/interview/offer signal breakdowns.
          </div>
        </div>

        {/* 3) Follow-Up Radar */}
        <div className="jp-insight-card">
            <div className="jp-insight-head">
              <div style={{ fontWeight: 900 }}>Follow-Up Radar</div>
              <span className="jp-badge jp-badge--pro">Pro</span>
            </div>
            <div className="jp-muted">
              Surface job applications that likely need a follow-up—without nagging or task spam.
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
              • Days since last contact<br />
              • No reply after last outbound message<br />
              • One-click jump to the most recent email thread
            </div>
        </div>

        {/* 4) Interview Stage Timeline */}
        <div className="jp-insight-card">
          <div className="jp-insight-head">
            <div style={{ fontWeight: 900 }}>Interview Stage Timeline</div>
            <span className="jp-badge jp-badge--pro">Pro</span>
          </div>
          <div className="jp-muted">
            Make stalled or fast-moving interview processes obvious at a glance.
          </div>
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            • Applied → Screen → Loop → Final → Offer<br />
            • Duration between stages<br />
            • Flags on unusually long gaps
          </div>
        </div>

        {/* 5) Company Re-Engagement Signals */}
        <div className="jp-insight-card">
          <div className="jp-insight-head">
            <div style={{ fontWeight: 900 }}>Company Re-Engagement</div>
            <span className="jp-badge jp-badge--pro">Pro</span>
          </div>
          <div className="jp-muted">
            Highlight when a previously quiet company shows renewed interest.
          </div>
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            • New email after inactivity<br />
            • Calendar change / new meeting scheduled<br />
            • “Back in motion” indicator
          </div>
        </div>

        {/* 6) Search Velocity Meter */}
        <div className="jp-insight-card">
          <div className="jp-insight-head">
            <div style={{ fontWeight: 900 }}>Search Velocity Meter</div>
            <span className="jp-badge jp-badge--pro">Pro</span>
          </div>
          <div className="jp-muted">
            Momentum over the last 14 / 30 days—without judgment.
          </div>
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            • Inputs: job applications submitted<br />
            • Outputs: replies, interviews<br />
            • Directional indicator: ↑ ↓ →
          </div>
        </div>
      </section>
    </main>
  </AppShell>
);
}

