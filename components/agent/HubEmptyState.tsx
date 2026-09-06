"use client";

// Hub onboarding empty state (agency users, no sales yet). Mirrors the other
// empty states: a glass-house hero with two CTAs (add a sale / explore the demo),
// three "what happens next" info cards, and a "Continue setup" card that opens
// the Getting-started checklist. Replaces the old welcome-card + inline checklist.

import Link from "next/link";
import { Plus, FolderOpen, ListChecks, UsersThree, UserCircle, ArrowRight } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { SetupCard } from "@/components/agent/SetupCard";
import { GlassCard } from "@/components/glass/GlassCard";
import { HeroArt } from "@/components/agent/HeroArt";
import { useDemoExplore } from "@/components/transactions-v2/useDemoExplore";

export function HubEmptyState({ canCreateSale }: { userId: string; canCreateSale: boolean }) {
  const { launch, node } = useDemoExplore();

  return (
    <div className="agent-stagger" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 300, padding: "34px 36px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 50%, transparent 76%)",
        }}
      >
        <HeroArt light="/hub-hero.png" dark="/hub-hero-dark.png" maxWidth="48%" maskStart="40%" />
        <div style={{ position: "relative", maxWidth: 520 }}>
          <Pill tone="brand" size="sm" glass style={{ marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            New here?
          </Pill>
          <p style={{ margin: "0 0 10px", fontSize: 29, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            Your pipeline starts with one sale
          </p>
          <p style={{ margin: "0 0 24px", fontSize: 14.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 440 }}>
            Add your first sale and we&apos;ll start tracking what&apos;s happening, what&apos;s outstanding and what needs your attention.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {canCreateSale && (
              <Link
                href="/agent/transactions/new"
                className="agent-btn agent-btn-primary agent-btn-md"
                style={{ textDecoration: "none" }}
              >
                <Plus size={16} weight="bold" />
                Add your first sale
              </Link>
            )}
            <button
              type="button"
              onClick={() => launch()}
              className="agent-btn agent-btn-secondary agent-btn-md"
              style={{ gap: 8, color: "var(--agent-coral-deep)" }}
            >
              Explore a demo sale
              <ArrowRight size={15} weight="bold" className="agent-arrow-i" />
            </button>
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div>
        <p className="agent-eyebrow" style={{ marginBottom: 12 }}>What happens next</p>
        <div className="setup-cards-3">
          <SetupCard
            glassId="empty-hub-place"
            label="Hub empty · One place"
            tint="coral"
            icon={<FolderOpen size={20} weight="regular" />}
            title="Everything starts in one place"
            desc="Buyers, sellers, solicitors, milestones and documents stay attached to the file."
          />
          <SetupCard
            glassId="empty-hub-attention"
            label="Hub empty · Needs attention"
            tint="blue"
            icon={<ListChecks size={20} weight="regular" />}
            title="Know what needs attention"
            desc="See what's outstanding, what needs chasing and which sales are starting to drift."
          />
          <SetupCard
            glassId="empty-hub-picture"
            label="Hub empty · In the picture"
            tint="green"
            icon={<UsersThree size={20} weight="regular" />}
            title="Keep everyone in the picture"
            desc="Give clients live progress while updates and solicitor replies come back into the file."
          />
        </div>
      </div>

      {/* Finish setting up your workspace — opens the Getting-started checklist */}
      <GlassCard glassId="empty-hub-finish" label="Hub empty · Finish setup" style={{ padding: "16px 20px", borderRadius: "var(--agent-radius-lg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <UserCircle size={20} weight="regular" />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Finish setting up your workspace</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Add your details, personalise your agency and invite your team.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("sp_open_checklist"))}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0,
            padding: "9px 16px", borderRadius: "var(--agent-radius-md, 10px)",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            color: "var(--agent-coral-deep)",
            background: "rgba(var(--agent-coral-rgb),0.12)",
            border: "1px solid rgba(var(--agent-coral-rgb),0.28)",
          }}
        >
          Continue setup
          <ArrowRight size={15} weight="bold" className="agent-arrow-i" />
        </button>
      </GlassCard>

      {node}
    </div>
  );
}
