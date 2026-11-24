"use client";

// All Files onboarding empty state (agency users, no files yet). Mirrors the
// Completions / To-Do / Updates empty states: a glass-house hero with the
// primary "Add your first sale" CTA, three info cards on what the list gives
// you, and a real "Explore demo sale" card that reuses the shared demo flow.

import Link from "next/link";
import { Plus, ShieldWarning, ListChecks, CalendarCheck, Eye } from "@phosphor-icons/react";
import { SetupCard } from "@/components/agent/SetupCard";
import { PromoCard, PromoArrow } from "@/components/agent/PromoCard";
import { HeroArt } from "@/components/agent/HeroArt";
import { useDemoExplore } from "@/components/transactions-v2/useDemoExplore";

// `audience` picks the copy + primary CTA. A progression-business owner starts
// with a CLIENT (their sales hang off clients they add), so their hero points
// at /agent/clients; an agency starts with a sale. Everything else is shared.
export function AllFilesEmptyState({ audience = "agency", hasClients = false }: { audience?: "agency" | "progressor"; hasClients?: boolean }) {
  const { launch, node } = useDemoExplore();
  const isProg = audience === "progressor";
  // A progressor who's already added a client now needs a SALE, not a client
  // (critique #188), so the hero flips to "Add a sale".
  const progNeedsSale = isProg && hasClients;
  const ctaHref = !isProg || progNeedsSale ? "/agent/transactions/new" : "/agent/clients";
  const ctaLabel = !isProg ? "Add your first sale" : progNeedsSale ? "Add a sale" : "Add your first client";

  return (
    <div className="agent-bloom-stagger agent-canon-cta" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
          <p style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            Your pipeline starts here
          </p>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 400 }}>
            {!isProg
              ? "Add your first sale and keep everything together, from offer accepted through to completion."
              : progNeedsSale
                ? "Create a sale for one of your clients and keep everything together, from offer accepted through to completion."
                : "Add your first client, then create a sale to track everything from offer accepted through to completion."}
          </p>
          <Link
            href={ctaHref}
            className="agent-btn agent-btn-primary agent-btn-md"
            style={{ textDecoration: "none", width: "fit-content" }}
          >
            <Plus size={16} weight="bold" />
            {ctaLabel}
          </Link>
        </div>
      </div>

      {/* What the list gives you */}
      <div className="setup-cards-3">
        <SetupCard
          glassId="empty-allfiles-risk"
          label="All Files empty · At-risk sales"
          tint="coral"
          icon={<ShieldWarning size={20} weight="regular" />}
          title="Spot at-risk sales early"
          desc="See which sales are starting to drift, with live risk indicators that help you act before problems escalate."
        />
        <SetupCard
          glassId="empty-allfiles-next"
          label="All Files empty · Next step"
          tint="blue"
          icon={<ListChecks size={20} weight="regular" />}
          title="See each sale's next step"
          desc="Know what needs to happen next, directly from your Files list, without opening every sale."
        />
        <SetupCard
          glassId="empty-allfiles-exchange"
          label="All Files empty · Exchanging when"
          tint="green"
          icon={<CalendarCheck size={20} weight="regular" />}
          title="Know what's exchanging when"
          desc="See target exchange dates and filter sales expected this week or month."
        />
      </div>

      {/* Explore demo sale — real, reuses the shared flow. Agency only: the demo
          action needs an agencyId, which a progression-business owner/member
          (agencyId null) doesn't have — getOrCreateDemoSaleAction throws "Demo
          files are for agency accounts", and the whole demo-sale mechanism
          (lib/services/demo-sale.ts) is agency-keyed, with no business
          equivalent. We deliberately do NOT force-show it for external users:
          the button would throw on click. So the external "fully progressed
          sale" copy has nowhere to render and the card stays agency-only.
          FLAGGED (product decision for the founder): either build a
          progression-business demo path (a demo file tied to a client agency, or
          a business-scoped sample), or accept that external users have no demo
          card on All Files. Until one is chosen, agency copy only. */}
      {!isProg && (
      <PromoCard
        glassId="empty-allfiles-demo"
        label="All Files empty · Demo card"
        icon={<Eye size={20} weight="fill" />}
        title="See what a sale looks like"
        body="Explore an example property file with milestones, contacts and activity already in place."
        cta={
          <button
            type="button"
            onClick={() => launch(true)}
            className="agent-btn agent-btn-primary agent-btn-sm"
            style={{ gap: 8 }}
          >
            Explore demo sale
            <PromoArrow />
          </button>
        }
      />
      )}

      {node}
    </div>
  );
}
