"use client";

import { useState } from "react";

export default function PremiumFlowCard({ isPro = false, onUpgrade }) {
  const [open, setOpen] = useState(false);

  return (
    <section
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        background: "#fff",
        marginBottom: 18,
      }}
    >
      {/* Header row (always visible) */}
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>
            How JobPort works
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Current Free plan shows results. Go Pro to unlock Premium features.
          </div>
        </div>

        <button
          className="jp-btn jp-btn--ghost"
          onClick={() => setOpen((v) => !v)}
          style={{ whiteSpace: "nowrap" }}
        >
          {open ? "Hide flow" : "View flow"}
          {!isPro ? " 🔒" : ""}
        </button>
      </div>

      {/* Expandable content */}
      {open ? (
        <div
          style={{
            borderTop: "1px solid rgba(0,0,0,0.06)",
            padding: 16,
            background: "rgba(0,0,0,0.015)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 12,
              filter: !isPro ? "blur(5px)" : "none",
              opacity: !isPro ? 0.75 : 1,
              pointerEvents: !isPro ? "none" : "auto",
            }}
          >
            {[
              "Connect inbox",
              "Scan signals",
              "Attach to jobs",
              "Detect changes",
              "Monitor pipeline",
            ].map((label, i) => (
              <div
                key={label}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {i + 1}. {label}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  Automatic — no manual tracking required.
                </div>
              </div>
            ))}
          </div>

          {!isPro ? (
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px dashed rgba(0,0,0,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Premium unlocks the full-resolution flow and deeper insights.
              </div>

              <button
                className="jp-btn jp-btn--primary"
                onClick={onUpgrade}
              >
                Upgrade — $7.99/mo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
