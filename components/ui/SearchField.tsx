"use client";

// Canonical search bar — a magnifier, the canonical agent-input-sm field, and an
// X clear button that shows once there's a query. Token-based (light + dark).
//
// This is the standalone search INPUT, extracted from the pattern duplicated in
// SearchTabsBar and ChainsWorkspace (2026-11-23). It owns only the bar; the
// caller owns the query state and renders whatever results it likes beneath —
// the bar is the same everywhere, the results differ per surface. See
// docs/reference/COMPONENT_LIBRARY_CATALOG.md.

import { MagnifyingGlass, X } from "@phosphor-icons/react";

export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  ariaLabel,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <MagnifyingGlass
        size={14}
        weight="regular"
        aria-hidden
        style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className="agent-input agent-input-sm"
        // Inline font-size beats the mobile ".agent-input {16px}" zoom-guard so
        // the field stays compact, matching the top-nav + list search bars.
        style={{ width: "100%", paddingLeft: 34, paddingRight: 34, fontSize: "var(--agent-text-body-sm)" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="agent-icon-btn agent-icon-btn-sm"
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}
