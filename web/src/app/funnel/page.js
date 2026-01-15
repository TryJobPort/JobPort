"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

const COLUMNS = ["Applied", "Interview", "Offer", "Denied"];

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase();
  if (v.includes("interview")) return "Interview";
  if (v.includes("offer")) return "Offer";
  if (v.includes("denied") || v.includes("rejected") || v.includes("declined")) return "Denied";
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
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function confidenceMeta(score) {
  const n = Number(score || 0);
  if (n >= 80) return { label: "High", tone: "jp-conf jp-conf--high" };
  if (n >= 60) return { label: "Med", tone: "jp-conf jp-conf--med" };
  if (n >= 40) return { label: "Low", tone: "jp-conf jp-conf--low" };
  return null;
}

export default function FunnelPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

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
      applications: prev.applications.map((a) =>
        a.id === appId ? { ...a, pinned: nextPinned ? 1 : 0 } : a
      ),
    }));

    try {
      await apiFetch(`/applications/${appId}/pin`, {
        method: "POST",
        body: { pinned: nextPinned },
      });
    } catch {
      // revert on failure
      setData((prev) => ({
        ...prev,
        applications: prev.applications.map((a) =>
          a.id === appId ? { ...a, pinned: nextPinned ? 0 : 1 } : a
        ),
      }));
    }
  }

  const byColumn = useMemo(() => {
    const apps = data?.applications || [];
    const buckets = Object.fromEntries(COLUMNS.map((c) => [c, []]));

    for (const a of apps) {
      buckets[normalizeStatus(a.status)].push(a);
    }

    for (const col of COLUMNS) {
      buckets[col].sort((x, y) => {
        // 1) pinned first
        const xp = Number(x.pinned || 0);
        const yp = Number(y.pinned || 0);
        if (xp !== yp) return yp - xp;

        // 2) upcoming interview
        const xi = x.next_interview_at ? Date.parse(x.next_interview_at) : Infinity;
        const yi = y.next_interview_at ? Date.parse(y.next_interview_at) : Infinity;
        if (xi !== yi) return xi - yi;

        // 3) last updated
        const xu = x.updated_at ? Date.parse(x.updated_at) : 0;
        const yu = y.updated_at ? Date.parse(y.updated_at) : 0;
        if (xu !== yu) return yu - xu;

        // 4) created
        return Date.parse(y.created_at || 0) - Date.parse(x.created_at || 0);
      });
    }

    return buckets;
  }, [data]);

  return (
    <main style={{ padding: 28, maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>Your job pipeline</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            What moved, what’s next, and what needs attention.
          </p>
          {err && <p style={{ marginTop: 10, color: "crimson" }}>{err}</p>}
        </div>
        <Link href="/job-applications">List view</Link>
      </header>

      <style jsx global>{`
        .jp-card {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 14px;
          padding: 12px;
          margin-bottom: 10px;
          cursor: pointer;
          background: #fff;
        }
        .jp-card--upcoming {
          border: 2px solid rgba(0, 0, 0, 0.28);
        }
        .jp-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .jp-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .jp-pin {
          cursor: pointer;
          opacity: 0.6;
          user-select: none;
        }
        .jp-pin--on {
          opacity: 1;
        }
        .jp-title {
          font-weight: 800;
        }
        .jp-sub {
          opacity: 0.8;
          font-size: 13px;
          margin-top: 2px;
        }
        .jp-upcoming {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 800;
        }
        .jp-meta {
          font-size: 12px;
          opacity: 0.6;
          margin-top: 8px;
        }
        .jp-conf {
          font-size: 11px;
          padding: 6px 8px;
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          white-space: nowrap;
        }
      `}</style>

      {data?.applications?.length > 0 && (
        <section
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {COLUMNS.map((col) => (
            <div key={col} style={{ background: "#fff", borderRadius: 18, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <strong>{col}</strong>
                <span style={{ opacity: 0.6 }}>{byColumn[col].length}</span>
              </div>

              {byColumn[col].map((a) => {
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
                    className={`jp-card${
                      col === "Interview" && a.next_interview_at ? " jp-card--upcoming" : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/job-applications/${a.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/job-applications/${a.id}`);
                    }}
                  >
                    <div className="jp-row">
                      <div>
                        <div className="jp-title">{a.company || "—"}</div>
                        <div className="jp-sub">{a.role || "—"}</div>
                        {col === "Interview" && a.next_interview_at && (
                          <div className="jp-upcoming">
                            Upcoming interview · {formatWhen(a.next_interview_at)}
                          </div>
                        )}
                      </div>

                      <div className="jp-actions">
                        <span
                          className={`jp-pin${a.pinned ? " jp-pin--on" : ""}`}
                          title={a.pinned ? "Unpin" : "Pin"}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(a.id, !a.pinned);
                          }}
                        >
                          {a.pinned ? "📌" : "📍"}
                        </span>
                        {conf && <div className={conf.tone}>{conf.label}</div>}
                      </div>
                    </div>

                    <div className="jp-meta">{statusLine}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
