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
// NOT REGISTRABLE (inspect in situ): PortalDocumentsTab's overlays (a 3-dot
// options popover menu, self-owned, plus an add-document bottom sheet in
// PortalSheet chrome), PortalBrokerCard + PortalExchangeDayCard popups,
// PortalFollowupButton's flow, PortalCustomizeOverview — all defined inline
// inside their cards/tabs with live portal data; no standalone overlay export
// to mount.
// Also in-situ only (2026-10-20 solicitor/advisor sweep):
//   - SolicitorWelcome (app/s/[token]/SolicitorWelcome.tsx) — self-mounts
//     behind a one-shot localStorage flag ("sol_welcome_seen") with no
//     preview/open prop; in the harness it would show once per device, write
//     the flag on dismiss, then render null forever. Judge on a real first
//     visit (or clear the flag by hand).
//   - SolicitorPortalShell's MenuSheet (app/s/[token]/SolicitorPortalShell.tsx)
//     — a private inner component of the full-page solicitor chrome (sticky
//     header + bottom nav + welcome + auto-refresh); no standalone export, and
//     mounting it means mounting the whole page shell.

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
import { PortalThingsToConfirm, type PortalCheckpoint } from "@/components/portal/PortalThingsToConfirm";
import { PortalReadOnlyProvider } from "@/components/portal/PortalReadOnlyProvider";
import { OpenUpdatesCard } from "@/app/s/[token]/OpenUpdatesCard";
import { AdvisorMortgageSteps } from "@/app/a/[token]/AdvisorMortgageSteps";
import type { AdvisorStep } from "@/lib/advisor-confirm/portal-data";

const DEMO_TOKEN = "demo-portal-token-0000";

// ── Fixtures for the confirm-style cards ─────────────────────────────────────

// Things-to-confirm checkpoints, one of each row kind (open / waiting / done).
const CONFIRM_ITEMS_MIXED: PortalCheckpoint[] = [
  { id: "demo-cp-1", label: "Draft contract received", targetDate: "2026-10-28", mineDone: false, mineDate: null, isComplete: false, isBoth: true },
  { id: "demo-cp-2", label: "Replies to enquiries provided", targetDate: null, mineDone: false, mineDate: null, isComplete: false, isBoth: false },
  { id: "demo-cp-3", label: "Searches ordered", targetDate: "2026-10-20", mineDone: true, mineDate: "2026-10-12", isComplete: false, isBoth: true },
  { id: "demo-cp-4", label: "Memorandum of sale received", targetDate: null, mineDone: true, mineDate: "2026-10-02", isComplete: true, isBoth: true },
];
const CONFIRM_ITEMS_OPEN: PortalCheckpoint[] = [
  { id: "demo-cp-5", label: "Welcome pack returned to your solicitor", targetDate: "2026-10-24", mineDone: false, mineDate: null, isComplete: false, isBoth: false },
  { id: "demo-cp-6", label: "Mortgage application submitted", targetDate: null, mineDone: false, mineDate: null, isComplete: false, isBoth: false },
];

// Solicitor open-updates steps. PM13 exercises the "Searches expected back"
// date wording; "Searches ordered" exercises the "Mark as done" button label.
const SOLICITOR_STEPS = [
  { id: "demo-sol-pm13", code: "PM13", label: "Search results received", expectedDate: "2026-11-03" },
  { id: "demo-sol-vm12", code: "VM12", label: "Replies to enquiries sent", expectedDate: null },
  { id: "demo-sol-pm8", code: "PM8", label: "Searches ordered", expectedDate: "2026-10-27" },
];
const SOLICITOR_STEPS_SINGLE = [SOLICITOR_STEPS[0]];

// Advisor mortgage steps: one fixture per current step so both confirm-sheet
// shapes (PM6 valuation fields, PM11 offer-expiry field) are reachable.
const ADVISOR_STEPS_VALUATION: AdvisorStep[] = [
  { id: "demo-adv-pm5", code: "PM5", label: "Mortgage application submitted", status: "complete", date: "2026-10-06" },
  { id: "demo-adv-pm6", code: "PM6", label: "Lender valuation booked", status: "current", date: "2026-10-24" },
  { id: "demo-adv-pm11", code: "PM11", label: "Mortgage offer received", status: "upcoming", date: null },
];
const ADVISOR_STEPS_OFFER: AdvisorStep[] = [
  { id: "demo-adv-pm5", code: "PM5", label: "Mortgage application submitted", status: "complete", date: "2026-10-06" },
  { id: "demo-adv-pm6", code: "PM6", label: "Lender valuation booked", status: "complete", date: "2026-10-24" },
  { id: "demo-adv-pm11", code: "PM11", label: "Mortgage offer received", status: "current", date: null },
];

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
  {
    id: "portal-things-to-confirm",
    name: "Portal things to confirm",
    type: "portal",
    area: "Client portal",
    usedIn: "Portal · overview, things-to-confirm card",
    file: "components/portal/PortalThingsToConfirm.tsx",
    componentName: "PortalThingsToConfirm",
    note: "Confirm opens the real PortalSheet confirm step. Wrapped in the read-only agent-view provider, so Yes, confirm dismisses without posting; the confetti fires only on a real confirm, judge that in situ.",
    preview: "inline",
    states: [
      { id: "mixed", label: "Open, waiting and done", hint: "one row of each kind: open with and without a date, waiting on the other side, confirmed" },
      { id: "all-open", label: "All open" },
    ],
    render: (ctx) => (
      <PortalReadOnlyProvider readOnly>
        <div style={{ maxWidth: 480 }}>
          <PortalThingsToConfirm
            token={DEMO_TOKEN}
            otherName="the buyer"
            items={ctx.stateId === "all-open" ? CONFIRM_ITEMS_OPEN : CONFIRM_ITEMS_MIXED}
          />
        </div>
      </PortalReadOnlyProvider>
    ),
  },
  {
    id: "portal-solicitor-open-updates",
    name: "Solicitor open updates",
    type: "portal",
    area: "Solicitor portal",
    usedIn: "Solicitor portal · overview, open updates card",
    file: "app/s/[token]/OpenUpdatesCard.tsx",
    componentName: "OpenUpdatesCard",
    note: "Mark as received / done and Send update post to the demo token and surface the card's real inline error state (no backend). The add-update bottom sheet portals to .portal-scope, falling back to document.body in the harness, so it still mounts over the page.",
    preview: "inline",
    states: [
      { id: "several", label: "Three open updates", hint: "PM13 shows the searches-expected-back date wording; Searches ordered shows the Mark as done label" },
      { id: "single", label: "Single update" },
    ],
    render: (ctx) => (
      <div style={{ maxWidth: 480 }}>
        <OpenUpdatesCard token={DEMO_TOKEN} steps={ctx.stateId === "single" ? SOLICITOR_STEPS_SINGLE : SOLICITOR_STEPS} />
      </div>
    ),
  },
  {
    id: "portal-advisor-mortgage-steps",
    name: "Advisor mortgage steps",
    type: "portal",
    area: "Advisor portal",
    usedIn: "Advisor portal · mortgage steps card",
    file: "app/a/[token]/AdvisorMortgageSteps.tsx",
    componentName: "AdvisorMortgageSteps",
    note: "The current step's primary button opens the inline confirm bottom sheet (PM6: valuation date, desktop toggle, valuer firm; PM11: offer expiry); Add a note opens the note variant. Cancel and the backdrop close locally; saves post to the demo token and surface the real error state (no backend).",
    preview: "inline",
    states: [
      { id: "valuation", label: "Valuation current", hint: "PM6 confirm sheet with the date, desktop toggle and valuer fields" },
      { id: "offer", label: "Offer current", hint: "PM11 confirm sheet with the offer-expiry field" },
    ],
    render: (ctx) => (
      <div style={{ maxWidth: 480 }}>
        <AdvisorMortgageSteps token={DEMO_TOKEN} steps={ctx.stateId === "offer" ? ADVISOR_STEPS_OFFER : ADVISOR_STEPS_VALUATION} />
      </div>
    ),
  },
];
