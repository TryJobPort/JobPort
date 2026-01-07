import React from "react";

export function SkeletonList({ count = 5 }) {
  return (
    <ul className="jp-list">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="jp-list-card">
          <div className="jp-skel-row">
            <div className="jp-skel jp-skel-line jp-skel-line--lg jp-skel-line--w60" />
            <div className="jp-skel jp-skel-line jp-skel-line--w80" />
            <div className="jp-skel jp-skel-line jp-skel-line--w40" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SkeletonTimeline({ count = 6 }) {
  return (
    <div className="jp-stack">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="jp-card">
          <div className="jp-skel-row">
            <div className="jp-skel jp-skel-line jp-skel-line--w60" />
            <div className="jp-skel jp-skel-line jp-skel-line--w80" />
          </div>
        </div>
      ))}
    </div>
  );
}
