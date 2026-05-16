"use client";

import { useState } from "react";
import { MagnifyingGlass, Receipt, Leaf, HouseLine, Clock } from "@phosphor-icons/react";
import type { IntelState } from "@/lib/hooks/usePropertyIntel";

type Props = {
  onSearch: (postcode: string) => void;
  onSearchImmediate: (postcode: string) => void;
  state: IntelState;
  onRetry: () => void;
};

function isLikelyPostcode(v: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i.test(v.trim());
}

function normalisePostcode(v: string): string {
  return v.trim().toUpperCase().replace(/\s+/, " ");
}

function SkeletonBlock({ height, delay = 0, width = "100%" }: { height: number; delay?: number; width?: string }) {
  return (
    <div style={{
      height,
      width,
      borderRadius: 8,
      background: "rgba(15,23,42,0.08)",
      animation: `agent-skeleton-pulse 1.5s ease-in-out ${delay}s infinite`,
    }} />
  );
}

export function ResearchPanel({ onSearch, onSearchImmediate, state, onRetry }: Props) {
  const [query, setQuery] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase();
    setQuery(v);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && isLikelyPostcode(query)) {
      onSearchImmediate(normalisePostcode(query));
    }
  }

  // Loading state — show skeletons
  if (state === "loading") {
    return (
      <div className="agent-glass-subtle" style={{ padding: "20px", borderRadius: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <MagnifyingGlass size={14} weight="bold" color="var(--agent-text-muted)" />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--agent-text-muted)" }}>
            Property Research
          </p>
        </div>
        <SkeletonBlock height={38} delay={0} />
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} height={60} delay={i * 0.08} />
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <SkeletonBlock height={50} delay={0.32} />
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="agent-glass-subtle" style={{ padding: "20px", borderRadius: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <MagnifyingGlass size={14} weight="bold" color="var(--agent-text-muted)" />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--agent-text-muted)" }}>
            Property Research
          </p>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--agent-text-tertiary)", lineHeight: 1.5 }}>
          We couldn&apos;t find data for this address. The form still works as normal.
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "var(--agent-coral-deep)",
            fontWeight: 600, padding: 0,
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // Idle state — search field + explainer
  const canSearch = isLikelyPostcode(query);

  return (
    <div className="agent-glass-subtle" style={{ padding: "20px", borderRadius: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <MagnifyingGlass size={14} weight="bold" color="var(--agent-text-muted)" />
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--agent-text-muted)" }}>
          Property Research
        </p>
      </div>

      {/* Search field */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <input
          className="agent-input"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter postcode — e.g. BS6 7TH"
          maxLength={8}
          style={{ paddingLeft: 36, height: 38, fontSize: 14 }}
          aria-label="Property postcode lookup"
        />
        <MagnifyingGlass
          size={14}
          weight="bold"
          color="var(--nv2-text-ghost)"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        />
        {canSearch && (
          <button
            type="button"
            onClick={() => onSearchImmediate(normalisePostcode(query))}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "var(--agent-coral-deep)", border: "none", borderRadius: 6,
              color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", cursor: "pointer",
            }}
          >
            Look up
          </button>
        )}
      </div>

      {/* Explainer */}
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.6 }}>
        Look up any property to see sale history, EPC rating, and more — before filling in the form.
      </p>

      {/* You can check list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { icon: <Receipt size={12} weight="bold" />, label: "Last sold price & date" },
          { icon: <Leaf size={12} weight="bold" />, label: "EPC energy rating" },
          { icon: <HouseLine size={12} weight="bold" />, label: "Freehold or leasehold" },
          { icon: <Clock size={12} weight="bold" />, label: "Full sale price history" },
        ].map(({ icon, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--agent-text-muted)", flexShrink: 0, display: "flex" }}>{icon}</span>
            <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Source attribution */}
      <p style={{ margin: "16px 0 0", fontSize: 10, color: "var(--agent-text-muted)", opacity: 0.65 }}>
        Sources: HM Land Registry · EPC Register
      </p>
    </div>
  );
}
