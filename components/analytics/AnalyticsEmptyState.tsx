"use client";

// Analytics onboarding empty state (agency users, no files yet). Mirrors the
// Completions / To-Do / Updates / All Files empty states: a rising-chart hero
// with the "Add your first sale" CTA, three info cards on what Analytics gives
// you, and a "View demo analytics" card.
//
// The demo-analytics card is BUILT BUT HIDDEN behind SHOW_DEMO_ANALYTICS: the
// demo files populate the pipeline, but "View demo analytics" should stand up
// the demo and land on Analytics-with-data (not a file), which is separate work.
// See docs/active/TODO.md.

import Link from "next/link";
import { Plus, Timer, TrendUp, Funnel, Eye } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";
import { useDemoExplore } from "@/components/transactions-v2/useDemoExplore";

const SHOW_DEMO_ANALYTICS = false;

export function AnalyticsEmptyState() {
  const { launch, node } = useDemoExplore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 240, padding: "30px 32px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        <HeroArt light="/analytics-hero.png" dark="/analytics-hero-dark.png" maxWidth="50%" maskStart="38%" />
        <div style={{ position: "relative", maxWidth: 460 }}>
          <Pill tone="brand" size="sm" style={{ marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            Your data starts here
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: 27, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            See what&apos;s really happening in your agency
          </p>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 380 }}>
            Add your sales and Sales Progressor starts turning every exchange, delay and fee into something you can measure.
          </p>
          <Link
            href="/agent/transactions/new"
            className="agent-btn agent-btn-primary agent-btn-md"
            style={{ textDecoration: "none", width: "fit-content" }}
          >
            <Plus size={16} weight="bold" />
            Add your first sale
          </Link>
        </div>
      </div>

      {/* What Analytics gives you */}
      <div className="setup-cards-3">
        <SetupCard
          tint="coral"
          icon={<Timer size={22} weight="regular" />}
          title="See which solicitors move fastest"
          desc="Compare the firms on your sales by how long they actually take to reach exchange."
        />
        <SetupCard
          tint="green"
          icon={<TrendUp size={22} weight="regular" />}
          title="Forecast your commission"
          desc="See the fees expected this month alongside the commission already secured at exchange."
        />
        <SetupCard
          tint="blue"
          icon={<Funnel size={22} weight="regular" />}
          title="Measure your conversion"
          desc="See how many agreed sales reach exchange and how long they actually take to get there."
        />
      </div>

      {/* View demo analytics — built, hidden until it lands on Analytics-with-data. */}
      {SHOW_DEMO_ANALYTICS && (
        <div className="agent-glass" style={{ padding: "16px 20px", borderRadius: "var(--agent-radius-lg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(var(--agent-coral-rgb),0.12)", color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Eye size={20} weight="regular" />
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Want to see Analytics with data?</p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Explore the demo to see what this page looks like once your pipeline gets moving.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => launch(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0,
              padding: "9px 16px", borderRadius: "var(--agent-radius-md, 10px)",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              color: "var(--agent-coral-deep)",
              background: "rgba(var(--agent-coral-rgb),0.12)",
              border: "1px solid rgba(var(--agent-coral-rgb),0.28)",
            }}
          >
            <Eye size={15} weight="bold" />
            View demo analytics
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4" y1="12" x2="19" y2="12" />
              <polyline points="13 6 19 12 13 18" />
            </svg>
          </button>
        </div>
      )}

      {node}
    </div>
  );
}
