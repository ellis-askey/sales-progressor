"use client";

// Hub onboarding empty state for a progression-business OWNER with no files yet
// (docs/active/progression-businesses/10-signup-team-billing-spec.md, S7). A
// progressor's pipeline starts with a CLIENT, not a sale, so this points at
// adding the first client rather than "add your first sale". Mirrors the agency
// HubEmptyState structure (hero + what-happens-next) and reuses the same
// primitives; the copy and the CTA target are what differ.

import Link from "next/link";
import { Handshake, ListChecks, UsersThree } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";

export function ProgressionOwnerEmptyState() {
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
            New here?
          </Pill>
          <p style={{ margin: "0 0 10px", fontSize: 29, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            Your pipeline starts with your first client
          </p>
          <p style={{ margin: "0 0 24px", fontSize: 14.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 440 }}>
            Add an estate agent you progress sales for, then create their first sale. We&apos;ll start tracking what&apos;s happening, what&apos;s outstanding and what needs your attention.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/agent/clients"
              className="agent-btn agent-btn-primary agent-btn-md"
              style={{ textDecoration: "none" }}
            >
              <Handshake size={16} weight="bold" />
              Add your first client
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
            title="Add the agents you work for"
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
