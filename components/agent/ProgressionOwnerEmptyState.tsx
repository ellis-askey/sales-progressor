"use client";

// Hub onboarding empty state for a progression-business OWNER with no files yet
// (docs/active/progression-businesses/10-signup-team-billing-spec.md, S7). A
// progressor's pipeline starts with a CLIENT, not a sale, so this points at
// adding the first client rather than "add your first sale". Mirrors the agency
// HubEmptyState structure (hero + what-happens-next) and reuses the same
// primitives; the copy and the CTA target are what differ.

import Link from "next/link";
import { Handshake, ListChecks, UsersThree, Plus } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";
import type { BusinessClientStage } from "@/lib/services/progression-clients";

export function ProgressionOwnerEmptyState({ stage }: { stage: BusinessClientStage }) {
  // Three onboarding stages (critique #188):
  //  - no clients yet            -> add your first client
  //  - client(s) added, no sales -> add their first sale (you can start before
  //                                 their agent accepts the invite)
  const hasClients = stage.total > 0;
  const who = stage.sampleName ?? "your client";

  const pillText = hasClients ? "Next step" : "New here?";
  const heroTitle = hasClients ? "Now add their first sale" : "Your pipeline starts with your first client";
  const heroSub = hasClients
    ? stage.pending > 0
      ? `You've added ${who}. You can start progressing their sales now; they don't need to accept their invite first. We'll track what's happening, what's outstanding and what needs your attention.`
      : `Add a sale for ${who} and run it through to completion. We'll track what's happening, what's outstanding and what needs your attention.`
    : "Add an estate agent you work with, then create their first sale. We'll start tracking what's happening, what's outstanding and what needs your attention.";
  const ctaHref = hasClients ? "/agent/transactions/new" : "/agent/clients";
  const ctaLabel = hasClients ? "Add a sale" : "Add your first client";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
            {pillText}
          </Pill>
          <p style={{ margin: "0 0 10px", fontSize: 29, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            {heroTitle}
          </p>
          <p style={{ margin: "0 0 24px", fontSize: 14.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 460 }}>
            {heroSub}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href={ctaHref}
              className="agent-btn agent-btn-primary agent-btn-md"
              style={{ textDecoration: "none" }}
            >
              {hasClients ? <Plus size={16} weight="bold" /> : <Handshake size={16} weight="bold" />}
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div>
        <p className="agent-eyebrow" style={{ marginBottom: 12 }}>What happens next</p>
        <div className="setup-cards-3">
          <SetupCard
            glassId="empty-hub-prog-clients"
            label="Hub empty · Your clients"
            tint="coral"
            icon={<Handshake size={20} weight="regular" />}
            title="Add the agents you work with"
            desc="Each agent gets their own login and sees only their own sales. You see your whole book across every client."
          />
          <SetupCard
            glassId="empty-hub-prog-sales"
            label="Hub empty · Progress sales"
            tint="blue"
            icon={<ListChecks size={20} weight="regular" />}
            title="Create and progress their sales"
            desc="Add a sale for a client and run it through to completion, with milestones, chasing and documents in one place."
          />
          <SetupCard
            glassId="empty-hub-prog-picture"
            label="Hub empty · In the picture"
            tint="green"
            icon={<UsersThree size={20} weight="regular" />}
            title="Keep everyone in the picture"
            desc="Buyers and sellers see you as their point of contact, with live progress the whole way through."
          />
        </div>
      </div>
    </div>
  );
}
