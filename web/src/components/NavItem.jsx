"use client";

import React from "react";

export default function NavItem({ label, state = "default", onClick }) {
  const isActive = state === "active";

  return (
    <button
      type="button"
      className="jp-navitem"
      data-state={isActive ? "active" : "default"}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      onClick={onClick}
    >
      <span className="jp-navitem__label">{label}</span>
    </button>
  );
}
