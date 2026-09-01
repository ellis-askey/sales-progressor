"use client";

// All Files onboarding empty state (agency users, no files yet). Mirrors the
// Completions / To-Do / Updates empty states: a glass-house hero with the
// primary "Add your first sale" CTA, three info cards on what the list gives
// you, and a real "Explore demo sale" card that reuses the shared demo flow.

import Link from "next/link";
import { Plus, ShieldWarning, ListChecks, CalendarCheck, Eye } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { SetupCard } from "@/components/agent/SetupCard";
import { GlassCard } from "@/components/glass/GlassCard";
import { HeroArt } from "@/components/agent/HeroArt";
import { useDemoExplore } from "@/components/transactions-v2/useDemoExplore";

export function AllFilesEmptyState() {
  const { launch, node } = useDemoExplore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 210, padding: "30px 32px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        <HeroArt light="/demo-hero-bg.png" dark="/demo-hero-bg-dark.png" maxWidth="44%" maskStart="42%" />
        <div style={{ position: "relative", maxWidth: 520 }}>
          <Pill tone="brand" size="sm" glass style={{ marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            No files yet
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: 27, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            Your pipeline starts here
          </p>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 400 }}>
            Add your first sale and we&apos;ll keep everything around it together, from offer agreed through to completion.
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

      {/* What the list gives you */}
      <div className="setup-cards-3">
        <SetupCard
          glassId="empty-allfiles-risk"
          label="All Files empty · At-risk sales"
          tint="coral"
          icon={<ShieldWarning size={22} weight="regular" />}
          title="Spot at-risk sales early"
          desc="Every sale gets a live risk read, so the ones drifting towards falling through stand out before it's too late."
        />
        <SetupCard
          glassId="empty-allfiles-next"
          label="All Files empty · Next step"
          tint="blue"
          icon={<ListChecks size={22} weight="regular" />}
          title="See each sale's next step"
          desc="Each file shows the exact next thing to do to move it forward, so you can work your list without opening a single one."
        />
        <SetupCard
          glassId="empty-allfiles-exchange"
          label="All Files empty · Exchanging when"
          tint="green"
          icon={<CalendarCheck size={22} weight="regular" />}
          title="Know what's exchanging when"
          desc="See every sale's target exchange date and filter to what's landing this week or this month."
        />
      </div>

      {/* Explore demo sale — real, reuses the shared flow */}
      <GlassCard glassId="empty-allfiles-demo" label="All Files empty · Demo card" style={{ padding: "16px 20px", borderRadius: "var(--agent-radius-lg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Eye size={20} weight="regular" />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Want to see a finished example first?</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Explore a sample sale with progress, contacts and activity already added.</p>
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
          Explore demo sale
          <svg className="agent-arrow-i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="4" y1="12" x2="19" y2="12" />
            <polyline points="13 6 19 12 13 18" />
          </svg>
        </button>
      </GlassCard>

      {node}
    </div>
  );
}
