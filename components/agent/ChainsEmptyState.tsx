"use client";

// Chains onboarding empty state. Mirrors RemindersEmptyState / the Completions /
// To-Do / Updates heroes: a glass-house hero with the page's hero art, a primary
// CTA, and three info cards on what the page gives you. Shown when a
// self-progressing agency has no chains yet (critique #298 — the page is
// surfaced with this empty state rather than hidden from the nav).

import Link from "next/link";
import { Plus, LinkSimple, MagnifyingGlass, ChatCircleDots } from "@phosphor-icons/react";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";

export function ChainsEmptyState() {
  return (
    <div className="agent-bloom-stagger agent-canon-cta" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 210, padding: "28px 30px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        <HeroArt light="/chains-hero.png" dark="/chains-hero-dark.png" maxWidth="46%" maskStart="42%" />
        <div style={{ position: "relative", maxWidth: 480 }}>
          <p style={{ margin: "0 0 8px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
            See the bigger picture
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 400 }}>
            Follow the whole chain, not just your sale. See how every link is progressing and spot anything that could delay exchange.
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
          glassId="empty-chains-links"
          label="Chains empty · Every link"
          tint="coral"
          icon={<LinkSimple size={20} weight="regular" />}
          title="Every link in view"
          desc="See the properties above and below your sale, and how each one is progressing."
        />
        <SetupCard
          glassId="empty-chains-blocker"
          label="Chains empty · Spot delays"
          tint="blue"
          icon={<MagnifyingGlass size={20} weight="regular" />}
          title="Spot what's holding things up"
          desc="Find delays across the chain, so you know where to focus your attention."
        />
        <SetupCard
          glassId="empty-chains-loop"
          label="Chains empty · Keep in the loop"
          tint="green"
          icon={<ChatCircleDots size={20} weight="regular" />}
          title="Keep everyone in the loop"
          desc="Share progress with the people involved, so everyone knows where things stand."
        />
      </div>
    </div>
  );
}
