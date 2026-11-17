"use client";

// Auto emails onboarding empty state. Mirrors RemindersEmptyState / the
// Completions / To-Do / Updates heroes: a glass-house hero with the page's hero
// art, a primary CTA, and three info cards on what the page gives you. Shown when
// a self-progressing agency has no automated emails yet (critique #298 — the
// page is surfaced with this empty state rather than hidden from the nav).

import Link from "next/link";
import { Plus, Envelope, PaperPlaneTilt, ChartBar } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";

export function AutoEmailsEmptyState() {
  return (
    <div className="agent-bloom-stagger" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 210, padding: "28px 30px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        <HeroArt light="/auto-emails-hero.png" dark="/auto-emails-hero-dark.png" maxWidth="46%" maskStart="42%" />
        <div style={{ position: "relative", maxWidth: 480 }}>
          <Pill tone="brand" size="sm" glass style={{ marginBottom: 12, letterSpacing: "0.02em", fontWeight: 700 }}>
            No automated emails yet
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
            Client updates, taken care of
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 400 }}>
            From milestones to reminders, we&apos;ll keep your clients updated automatically, so you can spend less time chasing and more time moving sales forward.
          </p>
          <Link
            href="/agent/transactions/new"
            className="agent-btn agent-btn-primary agent-btn-md"
            style={{ textDecoration: "none", width: "fit-content" }}
          >
            <Plus size={16} weight="bold" />
            Add a new sale
          </Link>
        </div>
      </div>

      <div className="setup-cards-3">
        <SetupCard
          glassId="empty-autoemails-milestones"
          label="Auto emails empty · Every milestone"
          tint="coral"
          icon={<Envelope size={20} weight="regular" />}
          title="Every milestone, covered"
          desc="Send branded updates as each sale progresses, keeping clients informed from instruction to completion."
        />
        <SetupCard
          glassId="empty-autoemails-chasing"
          label="Auto emails empty · Chasing"
          tint="blue"
          icon={<PaperPlaneTilt size={20} weight="regular" />}
          title="Chasing, without the hassle"
          desc="Automatically follow up on overdue updates, on your schedule and on your behalf."
        />
        <SetupCard
          glassId="empty-autoemails-status"
          label="Auto emails empty · Who's up to date"
          tint="green"
          icon={<ChartBar size={20} weight="regular" />}
          title="Know who's up to date"
          desc="See what's been sent, opened and replied to, all in one place."
        />
      </div>
    </div>
  );
}
