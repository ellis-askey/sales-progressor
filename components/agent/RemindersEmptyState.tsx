"use client";

// Reminders (work-queue) onboarding empty state. Mirrors AllFilesEmptyState /
// the Completions / To-Do / Updates heroes: a glass-house hero with the page's
// hero art, a primary CTA, and three info cards on what the page gives you.
//
// Only the EXTERNAL progression business reaches this: an agency agent is gated
// out of Reminders until they have an active self-progressed sale
// (agencyUserHasSelfManagedFiles), at which point the list is non-empty. So the
// copy is progressor-facing. Owner with no clients -> add a client; owner/member
// whose business has clients -> add a sale; a team member with no clients can do
// neither, so no CTA.

import Link from "next/link";
import { Plus, Bell, UsersThree, ShieldWarning } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";

export function RemindersEmptyState({ isOwner, hasClients }: { isOwner: boolean; hasClients: boolean }) {
  const cta = hasClients
    ? { label: "Add a new sale", href: "/agent/transactions/new" }
    : isOwner
      ? { label: "Add your first client", href: "/agent/clients" }
      : null;

  const subtext = hasClients
    ? "As your clients' sales progress, we'll surface every chase and follow-up here, so nothing slips through."
    : isOwner
      ? "Add your first client and create their sales, and we'll surface every chase and follow-up across your book, so nothing slips through."
      : "Chases and follow-ups across your business's sales will appear here as they progress.";

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
        <HeroArt light="/reminders-hero.png" dark="/reminders-hero-dark.png" maxWidth="44%" maskStart="42%" />
        <div style={{ position: "relative", maxWidth: 520 }}>
          <Pill tone="brand" size="sm" glass style={{ marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            No reminders yet
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: 27, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            Your chases will land here
          </p>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 400 }}>
            {subtext}
          </p>
          {cta && (
            <Link
              href={cta.href}
              className="agent-btn agent-btn-primary agent-btn-md"
              style={{ textDecoration: "none", width: "fit-content" }}
            >
              <Plus size={16} weight="bold" />
              {cta.label}
            </Link>
          )}
        </div>
      </div>

      {/* What the Reminders page gives you */}
      <div className="setup-cards-3">
        <SetupCard
          glassId="empty-reminders-chase"
          label="Reminders empty · Auto chases"
          tint="coral"
          icon={<Bell size={20} weight="regular" />}
          title="Chases surface automatically"
          desc="As each sale moves, we flag the next thing to chase and when, so you never have to go looking."
        />
        <SetupCard
          glassId="empty-reminders-who"
          label="Reminders empty · Who to nudge"
          tint="blue"
          icon={<UsersThree size={20} weight="regular" />}
          title="Know who to nudge"
          desc="We point to exactly who's holding things up, the solicitor or the other side, so you chase the right person first."
        />
        <SetupCard
          glassId="empty-reminders-cold"
          label="Reminders empty · Nothing goes cold"
          tint="green"
          icon={<ShieldWarning size={20} weight="regular" />}
          title="Nothing goes cold"
          desc="Overdue and due-today chases sit front and centre, so a quiet sale never slips off your radar."
        />
      </div>
    </div>
  );
}
