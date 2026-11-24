"use client";

import { useState } from "react";
import { Receipt, Leaf, HouseLine, Clock } from "@/components/icons/ph";
import { SearchField } from "@/components/arc/search-field/search-field";
import "@/components/arc/cookie-consent/scope.css";
import { useCardSurface } from "@/lib/glass/use-card-surface";
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
      background: "var(--nv2-skeleton)",
      animation: `agent-skeleton-pulse 1.5s ease-in-out ${delay}s infinite`,
    }} />
  );
}

export function ResearchPanel({ onSearch, onSearchImmediate, state, onRetry }: Props) {
  const [query, setQuery] = useState("");
  const { surfaceClass, tag } = useCardSurface("new-sale-research", "New sale · Property research", "agent-glass-subtle");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && isLikelyPostcode(query)) {
      onSearchImmediate(normalisePostcode(query));
    }
  }

  // Loading state — show skeletons
  if (state === "loading") {
    return (
      <div className={surfaceClass} {...tag} style={{ padding: "20px", borderRadius: 16 }}>
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
      <div className={surfaceClass} {...tag} style={{ padding: "20px", borderRadius: 16 }}>
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
    <div className={surfaceClass} {...tag} style={{ padding: "20px", borderRadius: 16 }}>
      {/* Search field — the canonical SearchField in its lookup mode (search icon
          + Enter-or-tap "Look up" submit). Arc tokens mapped to the agent input so
          the footprint and treatment match the rest of the form. The visible label
          is kept for screen readers and hidden from sight (the panel has no header). */}
      <div
        className="arc-scope sp-lookup-field"
        style={{
          marginBottom: 14,
          ["--control-height-md"]: "38px",
          ["--radius-control"]: "var(--agent-radius-md)",
          ["--text-field"]: "var(--agent-text-body)",
          ["--surface"]: "rgba(255,255,255,0.52)",
          ["--border-strong"]: "var(--agent-border-default)",
          ["--foreground"]: "var(--agent-text-primary)",
          ["--text-muted"]: "var(--agent-text-muted)",
          ["--sf-focus"]: "var(--agent-coral-deep)",
          ["--sf-submit-bg"]: "var(--agent-coral-deep)",
          ["--sf-submit-fg"]: "#fff",
        } as React.CSSProperties}
      >
        <style>{".sp-lookup-field label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}"}</style>
        <SearchField
          label="Property postcode"
          value={query}
          onValueChange={(v) => setQuery(v.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="Enter postcode (e.g. BS6 7TH)"
          maxLength={8}
          autoCapitalize="characters"
          aria-label="Property postcode lookup"
          onSubmit={() => onSearchImmediate(normalisePostcode(query))}
          submitLabel="Look up"
          submitEnabled={canSearch}
        />
      </div>

      {/* Explainer */}
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.6 }}>
        Look up any property to see sale history, EPC rating, and more before filling in the form.
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
