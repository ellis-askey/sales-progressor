"use client";
// Client-portal overlays for the /dev/sheets catalogue (completeness sweep,
// 2026-09-19 — Ellis: portal included, Command Centre excluded). Same contract
// as the other registries: REAL production components, demo tokens, handlers
// wired to ctx.onClose or noop.
//
// Caveat for reviewers: these render against the AGENT harness backdrop, not
// the portal's own light page — chrome and tokens are the components' own, so
// layout/copy/motion judge fine; overall page mood won't match the live
// portal exactly.
//
// NOT REGISTRABLE (inspect in situ): PortalDocumentsTab's lightbox,
// PortalBrokerCard + PortalExchangeDayCard popups, PortalFollowupButton's
// flow, PortalCustomizeOverview — all defined inline inside their cards/tabs
// with live portal data; no standalone overlay export to mount.

import type { SheetEntry } from "./types";
import { ADDRESS } from "./fixtures";

// ── Real components ──────────────────────────────────────────────────────────
import { PortalSheet } from "@/components/portal/PortalSheet";
import { PortalWelcomeSheet } from "@/components/portal/PortalWelcomeSheet";
import { PortalMenuDrawer } from "@/components/portal/PortalMenuDrawer";
import { PortalEditDrawer } from "@/components/portal/PortalEditDrawer";
import { PortalTaskPrompt } from "@/components/portal/PortalTaskPrompt";
import { PortalInstallPrompt } from "@/components/portal/PortalInstallPrompt";
import { PortalPushPrompt } from "@/components/portal/PortalPushPrompt";
import { PortalOnboardingToasts } from "@/components/portal/PortalOnboardingToasts";
import { ExchangeBanner, CompletionBanner } from "@/components/portal/ExchangeBanner";
import { SearchesUpload } from "@/components/portal/SearchesUpload";

const DEMO_TOKEN = "demo-portal-token-0000";

export const PORTAL_ENTRIES: SheetEntry[] = [
  {
    id: "portal-sheet",
    name: "Portal sheet (primitive)",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · every centred sheet",
    file: "components/portal/PortalSheet.tsx",
    componentName: "PortalSheet",
    note: "The portal's base sheet primitive with fixture content — the shell every portal sheet mounts in.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: (ctx) => (
      <PortalSheet open={ctx.open} onClose={ctx.onClose}>
        <div style={{ padding: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Sheet title</h2>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6 }}>
            Fixture body copy so the sheet has honest height. The close button and backdrop both dismiss.
          </p>
        </div>
      </PortalSheet>
    ),
  },
  {
    id: "portal-welcome-sheet",
    name: "Portal welcome sheet",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · first visit",
    file: "components/portal/PortalWelcomeSheet.tsx",
    componentName: "PortalWelcomeSheet",
    note: "Rendered in its preview mode (the same mode the director settings page uses) so it opens on demand and never persists a dismissal.",
    preview: "overlay",
    states: [
      { id: "vendor", label: "Seller" },
      { id: "purchaser", label: "Buyer" },
    ],
    render: (ctx) => (
      <PortalWelcomeSheet
        token={DEMO_TOKEN}
        side={ctx.stateId === "purchaser" ? "purchaser" : "vendor"}
        alreadySeen={false}
        previewMode
        previewOpen={ctx.open}
        onPreviewClose={ctx.onClose}
      />
    ),
  },
  {
    id: "portal-menu-drawer",
    name: "Portal menu drawer",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · header menu",
    file: "components/portal/PortalMenuDrawer.tsx",
    componentName: "PortalMenuDrawer",
    note: "Demo token: sections that fetch resolve to their loading / empty states — a valid thing to inspect.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: (ctx) => (
      <PortalMenuDrawer
        open={ctx.open}
        onClose={ctx.onClose}
        token={DEMO_TOKEN}
        contactName="Priya"
        contactRole="Seller"
      />
    ),
  },
  {
    id: "portal-edit-drawer",
    name: "Portal edit drawer",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · edit details / agent / solicitor",
    file: "components/portal/PortalEditDrawer.tsx",
    componentName: "PortalEditDrawer",
    note: "Save posts to a demo token and no-ops. States cover the main form kinds.",
    preview: "overlay",
    states: [
      { id: "details", label: "Your details" },
      { id: "solicitor", label: "Solicitor" },
      { id: "broker", label: "Broker" },
    ],
    render: (ctx) => (
      <PortalEditDrawer
        open={ctx.open}
        onClose={ctx.onClose}
        token={DEMO_TOKEN}
        config={
          ctx.stateId === "solicitor"
            ? { kind: "solicitor", mode: "edit", initial: { firmName: "Carter & Wells Solicitors", contactName: "Margaret Osei-Bonsu", email: "conveyancing@carterwells.co.uk", phone: "0113 496 0000" } }
            : ctx.stateId === "broker"
              ? { kind: "broker", mode: "add", initial: {} }
              : { kind: "details", mode: "edit", initial: { name: "Priya Chandrasekaran", email: "priya.c@gmail.com", phone: "07700 900111" } }
        }
      />
    ),
  },
  {
    id: "portal-task-prompt",
    name: "Portal task prompt",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · something-you-can-do card",
    file: "components/portal/PortalTaskPrompt.tsx",
    componentName: "PortalTaskPrompt",
    note: "The nudge card variants, per kind and side.",
    preview: "inline",
    states: [
      { id: "information", label: "Information forms" },
      { id: "stamp_duty", label: "Stamp duty" },
      { id: "costs", label: "Costs" },
    ],
    render: (ctx) => (
      <div style={{ maxWidth: 480 }}>
        <PortalTaskPrompt
          token={DEMO_TOKEN}
          side={ctx.stateId === "information" ? "vendor" : "purchaser"}
          prompt={(ctx.stateId as "information" | "stamp_duty" | "costs") ?? "information"}
        />
      </div>
    ),
  },
  {
    id: "portal-install-prompt",
    name: "Portal install prompt",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · add-to-home-screen nudge",
    file: "components/portal/PortalInstallPrompt.tsx",
    componentName: "PortalInstallPrompt",
    note: "Self-gating: it only shows on eligible mobile browsers that aren't already installed — on desktop it may correctly render nothing.",
    preview: "inline",
    states: [{ id: "default", label: "Default (self-gating)" }],
    render: () => <PortalInstallPrompt />,
  },
  {
    id: "portal-push-prompt",
    name: "Portal push prompt",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · enable notifications nudge",
    file: "components/portal/PortalPushPrompt.tsx",
    componentName: "PortalPushPrompt",
    note: "Self-gating on Notification API support + permission state; granting would subscribe against the demo token (no-op server side).",
    preview: "inline",
    states: [{ id: "default", label: "Default (self-gating)" }],
    render: () => <PortalPushPrompt token={DEMO_TOKEN} vapidPublicKey="demo-vapid-key" />,
  },
  {
    id: "portal-onboarding-toasts",
    name: "Portal onboarding toasts",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · contextual toast nudges",
    file: "components/portal/PortalOnboardingToasts.tsx",
    componentName: "PortalOnboardingToasts",
    note: "Fires its eligible nudge shortly after mount (localStorage-gated per token — reopen the state to replay).",
    preview: "inline",
    states: [
      { id: "fresh", label: "Fresh visit" },
      { id: "returning", label: "Returning, near exchange" },
    ],
    render: (ctx) => (
      <PortalOnboardingToasts
        token={`${DEMO_TOKEN}-${ctx.stateId}`}
        vapidPublicKey="demo-vapid-key"
        saleWord="sale"
        addressShort={ADDRESS.split(",")[0]}
        hasConfirmedStep={ctx.stateId === "returning"}
        isReturningVisit={ctx.stateId === "returning"}
        isNearExchange={ctx.stateId === "returning"}
        hasFreshUpdate={ctx.stateId === "fresh"}
      />
    ),
  },
  {
    id: "portal-exchange-banner",
    name: "Portal exchange banner",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · after exchange",
    file: "components/portal/ExchangeBanner.tsx",
    componentName: "ExchangeBanner",
    note: "Fires the real confetti on mount. Congratulations banner with the completion countdown.",
    preview: "inline",
    states: [{ id: "default", label: "Exchanged" }],
    render: () => (
      <div style={{ maxWidth: 560 }}>
        <ExchangeBanner token={DEMO_TOKEN} completionDate="2026-10-02" exchangeDate="2026-09-18" photoUrl={null} />
      </div>
    ),
  },
  {
    id: "portal-completion-banner",
    name: "Portal completion banner",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · after completion",
    file: "components/portal/ExchangeBanner.tsx",
    componentName: "CompletionBanner",
    note: "The keys-are-yours banner.",
    preview: "inline",
    states: [{ id: "default", label: "Completed" }],
    render: () => (
      <div style={{ maxWidth: 560 }}>
        <CompletionBanner token={DEMO_TOKEN} saleWord="purchase" completionDate="2026-09-18" photoUrl={null} />
      </div>
    ),
  },
  {
    id: "portal-searches-upload",
    name: "Portal searches upload",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · searches step upload",
    file: "components/portal/SearchesUpload.tsx",
    componentName: "SearchesUpload",
    note: "Upload control; picking a file posts to the demo token and surfaces the error state.",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <div style={{ maxWidth: 480 }}>
        <SearchesUpload token={DEMO_TOKEN} />
      </div>
    ),
  },
];
