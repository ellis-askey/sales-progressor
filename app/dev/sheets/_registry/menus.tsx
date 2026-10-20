"use client";
// Menus & popovers for the /dev/sheets catalogue (completeness sweep,
// 2026-09-19). Every floating dropdown / anchored popover / picker that isn't
// a full drawer or modal. Same contract as the other registries: REAL
// production components, demo-* fixture ids, handlers wired to ctx.onClose or
// noop.
//
// Menus are triggers-plus-flyouts, so most entries render the real TRIGGER
// inline and you click it to open the menu — that IS the production behaviour
// and lets you judge both halves.
//
// NOT REGISTRABLE (inspect in situ — listed here so the sweep is honest):
//   - ContactsSection / TransactionRowView / ReminderCard / chain LinkCard +
//     ChainMapPanel + OnwardPurchaseCard row menus — defined inline inside
//     those large domain components, no standalone export to mount. Of
//     TransactionRowView's two inline hover popovers (2026-10-20 sweep): the
//     JourneyHover stage popover IS live and is registered below by mounting
//     the real row (menu-files-journey-hover); the WithdrawnCell reason hover
//     is currently dead code — renderCell routes the withdrawn columns through
//     DateCell + ReasonCell and nothing calls WithdrawnCell — so there is no
//     live trigger to mount or to inspect in situ.
//   - HeroAddressEdit / HeroSaleFields — inline hero edit popovers requiring
//     the live file hero context.
//   - PipelineStageHover — positions off a live pipeline tile's DOMRect with
//     per-stage stats; only meaningful inside PipelineAtAGlance.
//   - ThemePicker — requires the AgentTheme providers the harness deliberately
//     doesn't mount (it would restyle the harness itself).

import { useState } from "react";
import type { SheetEntry } from "./types";
import { NAME, ADDRESS, SHORT_ADDRESS, LONG_ADDRESS, SHORT_NOTE, DEMO_TX_ID } from "./fixtures";

// ── Real components ──────────────────────────────────────────────────────────
import { RowActionMenu } from "@/components/hub/RowActionMenu";
import { SnoozeMenu } from "@/components/reminders/SnoozeMenu";
import { ChaseSplitButton } from "@/components/reminders/ChaseSplitButton";
import { FilterMenu, type FilterSection } from "@/components/transactions/FilterMenu";
import type { FilterKey } from "@/components/transactions/segments";
import { MonthlyTargetMenu } from "@/components/transactions/MonthlyTargetMenu";
import { DateMenu, FeeMenu } from "@/components/completions/CompletionCardMenus";
import { RowActionsMenu } from "@/components/account/chrome/RowActionsMenu";
import { SolicitorPicker } from "@/components/solicitors/SolicitorPicker";
import { BrokerPicker } from "@/components/brokers/BrokerPicker";
import { AgentPicker } from "@/components/agent-picker/AgentPicker";
import { AuroraOpacityControl } from "@/components/agent/AuroraOpacityControl";
import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import { AgentGlobalSearch } from "@/components/layout/AgentGlobalSearch";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { InfoTip } from "@/components/ui/InfoTip";
import { ReviewsSection } from "@/components/agent/ReviewsSection";
import type { ReviewItem } from "@/lib/services/reviews";
import { CheckpointsPanel } from "@/components/transaction/CheckpointsPanel";
import type { CheckpointView } from "@/lib/services/checkpoints";
import { BuildingInvoiceHero, type BuildingInvoiceHeroProps } from "@/components/billing/v2/BuildingInvoiceHero";
import { TransactionRowView, type TransactionRow } from "@/components/transactions/TransactionRowView";
import { Clock, Check, ArrowsClockwise } from "@phosphor-icons/react";

// ── Controlled-component wrappers (state only — the component is real) ───────

const FILTER_SECTIONS: FilterSection[] = [
  {
    title: "Needs a look",
    items: [
      { key: "risk", label: "At risk", dot: "var(--agent-danger)" },
      { key: "quiet", label: "Gone quiet", dot: "var(--agent-warning)" },
      { key: "nosolicitor", label: "No solicitor", dot: "var(--agent-coral)" },
    ],
  },
  {
    title: "Service",
    items: [
      { key: "selfmanaged", label: "Self-progressed" },
      { key: "outsourced", label: "With us" },
    ],
  },
];

function FilterMenuFixture() {
  const [selected, setSelected] = useState<Set<FilterKey>>(new Set<FilterKey>(["risk"]));
  return (
    <FilterMenu
      sections={FILTER_SECTIONS}
      counts={{ risk: 3, quiet: 7, nosolicitor: 2, selfmanaged: 61, outsourced: 4 }}
      selected={selected}
      onToggle={(k) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(k)) next.delete(k);
          else next.add(k);
          return next;
        })
      }
      onClear={() => setSelected(new Set())}
    />
  );
}

function SolicitorPickerFixture() {
  const [value, setValue] = useState<Parameters<typeof SolicitorPicker>[0]["value"]>(null);
  return <SolicitorPicker label="Seller's solicitor" value={value} onChange={setValue} />;
}

function BrokerPickerFixture() {
  const [value, setValue] = useState<Parameters<typeof BrokerPicker>[0]["value"]>(null);
  return <BrokerPicker label="Mortgage broker" value={value} onChange={setValue} />;
}

function AgentPickerFixture() {
  const [value, setValue] = useState("u-1");
  return (
    <AgentPicker
      value={value}
      onChange={setValue}
      currentUserId="u-1"
      label="File agent"
      agents={[
        { id: "u-1", name: NAME, email: "priya@agency.co.uk", role: "director" },
        { id: "u-2", name: "Tom Whitfield", email: "tom@agency.co.uk", role: "negotiator" },
      ]}
    />
  );
}

// ── Fixture data for the 2026-10-20 gap-sweep additions ──────────────────────

// ReviewsSection rows (to-do Reviews tab). Hold rows carry the split button's
// Extend / Remove-date menu; manual rows carry the Reschedule / Edit / Remove
// kebab menu. Past dates land in "Due now" (open by default) so both menus are
// one click away; the 2027 row exercises the Upcoming drawer.
const REVIEW_ITEMS_MIXED: ReviewItem[] = [
  { kind: "hold", key: "demo-hold-1", transactionId: DEMO_TX_ID, address: ADDRESS, photoStoragePath: null, reviewDate: new Date("2026-09-28"), reason: "Probate pending, seller is waiting on the grant", origin: "hold", startedAt: new Date("2026-08-30"), placedByName: NAME },
  { kind: "manual", key: "demo-task-1", id: "demo-task-0001", transactionId: DEMO_TX_ID, address: SHORT_ADDRESS, photoStoragePath: null, title: "Chase the management pack", notes: SHORT_NOTE, reviewDate: new Date("2026-10-01"), status: "open" },
  { kind: "manual", key: "demo-task-2", id: "demo-task-0002", transactionId: null, address: null, photoStoragePath: null, title: "Call the buyer about their survey date", notes: null, reviewDate: new Date("2027-01-15"), status: "open" },
];
const REVIEW_ITEMS_ORIGINS: ReviewItem[] = [
  { kind: "hold", key: "demo-hold-2", transactionId: DEMO_TX_ID, address: ADDRESS, photoStoragePath: null, reviewDate: new Date("2026-10-05"), reason: "Seller asked for a pause while they consider the asking price", origin: "hold", startedAt: new Date("2026-09-20"), placedByName: NAME },
  { kind: "hold", key: "demo-hold-3", transactionId: "demo-transaction-0001", address: SHORT_ADDRESS, photoStoragePath: null, reviewDate: new Date("2026-10-12"), reason: "Chain collapsed above, waiting on a new related sale", origin: "chain_wait", startedAt: new Date("2026-09-28"), placedByName: null },
  { kind: "hold", key: "demo-hold-4", transactionId: "demo-transaction-0002", address: LONG_ADDRESS, photoStoragePath: null, reviewDate: new Date("2026-10-15"), reason: "Back on the market after the buyer withdrew", origin: "remarketing", startedAt: new Date("2026-10-01"), placedByName: NAME },
];

// CheckpointsPanel rows. First row: shown to both, vendor confirmed, purchaser
// pending with push available, so its kebab menu carries Nudge + Remove. Second
// row: no push, so the same menu is Remove-only.
const CHECKPOINTS_OPEN: CheckpointView[] = [
  { id: "demo-ckp-1", label: "Probate granted", showTo: "both", targetDate: "2026-11-06T00:00:00.000Z", blocksExchange: true, lastNudgedAt: null, requiredParties: ["vendor", "purchaser"], confirmations: [{ party: "vendor", byName: NAME, byKind: "contact", eventDate: null, at: "2026-10-12T09:30:00.000Z" }], isComplete: false, pushVendor: true, pushPurchaser: true },
  { id: "demo-ckp-2", label: "Gifted deposit letter received", showTo: "vendor", targetDate: null, blocksExchange: false, lastNudgedAt: null, requiredParties: ["vendor"], confirmations: [], isComplete: false, pushVendor: false, pushPurchaser: false },
];
const CHECKPOINTS_COMPLETE: CheckpointView[] = [
  { id: "demo-ckp-3", label: "Indemnity policy in place", showTo: "none", targetDate: null, blocksExchange: false, lastNudgedAt: null, requiredParties: ["agent"], confirmations: [{ party: "agent", byName: NAME, byKind: "user", eventDate: null, at: "2026-10-05T14:00:00.000Z" }], isComplete: true, pushVendor: false, pushPurchaser: false },
  { id: "demo-ckp-4", label: "Source of funds provided", showTo: "purchaser", targetDate: "2026-11-20T00:00:00.000Z", blocksExchange: true, lastNudgedAt: null, requiredParties: ["purchaser"], confirmations: [], isComplete: false, pushVendor: false, pushPurchaser: true },
];

// BuildingInvoiceHero lines. photoUrl null exercises the fallback streetscape
// in the address popover; the credit line has no fileHref so it renders as
// plain text (the production synthetic-credit shape).
const INVOICE_LINES: BuildingInvoiceHeroProps["lines"] = [
  { transactionId: DEMO_TX_ID, exchangedAt: new Date("2026-10-02"), address: ADDRESS, serviceLabel: "Self-progressed", serviceSub: "Charged on exchange", totalPence: 5900, variant: "normal", fileHref: `/agent/transactions/${DEMO_TX_ID}`, addedAt: new Date("2026-07-14"), photoUrl: null },
  { transactionId: "demo-transaction-0001", exchangedAt: new Date("2026-10-09"), address: LONG_ADDRESS, serviceLabel: "Outsourced progression", serviceSub: "Progressed for you", totalPence: 25000, variant: "normal", fileHref: "/agent/transactions/demo-transaction-0001", addedAt: null, photoUrl: null },
];
const INVOICE_LINES_MIXED: BuildingInvoiceHeroProps["lines"] = [
  ...INVOICE_LINES,
  { transactionId: "demo-transaction-0002", exchangedAt: new Date("2026-10-14"), address: SHORT_ADDRESS, serviceLabel: "Self-progressed", serviceSub: "First file free", totalPence: 0, variant: "trial", fileHref: "/agent/transactions/demo-transaction-0002", addedAt: new Date("2026-08-02"), photoUrl: null },
  { transactionId: "demo-credit-0001", exchangedAt: new Date("2026-10-14"), address: "Account credit", serviceLabel: "Credit applied", totalPence: -5900, variant: "credit" },
];

// All Files row (fixture). boardStage drives the journey bar, whose hover
// popover is this entry's inspection target.
const FILES_ROW_TX: TransactionRow = {
  id: DEMO_TX_ID,
  propertyAddress: ADDRESS,
  photoUrl: null,
  status: "active",
  expectedExchangeDate: new Date("2026-11-28"),
  overridePredictedDate: null,
  createdAt: new Date("2026-09-01"),
  assignedUser: null,
  agentUser: { id: "demo-user-1", name: NAME, role: "director", image: null },
  serviceType: "self_managed",
  boardStage: "enquiries",
  health: {
    pendingOverdueTasks: 0,
    escalatedTasks: 0,
    lastActivityAt: new Date("2026-10-18"),
    lastActivityType: "chase",
    activityVerb: "Chased the seller's solicitor",
    nextActionLabel: null,
    nextMilestoneLabel: null,
    daysStuckOnMilestone: 4,
    onTrack: "on_track",
    pace: "on_track",
    nextStep: { text: "Next chase due Thursday", tone: "muted" },
  },
};

// Centres a trigger so the flyout has honest room in every direction.
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {children}
    </div>
  );
}

// ── Entries ──────────────────────────────────────────────────────────────────

export const MENU_ENTRIES: SheetEntry[] = [
  {
    id: "menu-row-action",
    name: "Hub row action menu",
    type: "menu",
    area: "Global chrome",
    usedIn: "Hub cards · every row chevron / Deal with it",
    file: "components/hub/RowActionMenu.tsx",
    componentName: "RowActionMenu",
    note: "The shared floating menu behind every hub row action. Click the trigger; the flyout portals to body and clamps to the viewport.",
    preview: "inline",
    states: [
      { id: "labelled", label: "Labelled trigger" },
      { id: "joined", label: "Joined chevron (split button)" },
    ],
    render: (ctx) => (
      <Stage>
        {ctx.stateId === "joined" ? (
          <div style={{ display: "inline-flex" }}>
            <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
              Chase
            </button>
            <RowActionMenu
              joined
              items={[
                { key: "a", icon: <ArrowsClockwise size={16} weight="bold" />, title: "Mark as chased", sub: "Advances the next chase date.", onClick: ctx.onClose },
                { key: "b", icon: <Check size={16} weight="bold" />, title: "Confirm step done", sub: "Marks the step complete.", onClick: ctx.onClose },
                { key: "c", icon: <Clock size={16} weight="bold" />, title: "Snooze until tomorrow", sub: "Back on the list tomorrow.", onClick: ctx.onClose },
              ]}
            />
          </div>
        ) : (
          <RowActionMenu
            label="Deal with it"
            items={[
              { key: "a", icon: <Clock size={16} weight="bold" />, title: "Set a new date", sub: "Once you've spoken to both parties.", onClick: ctx.onClose },
              { key: "b", icon: <ArrowsClockwise size={16} weight="bold" />, title: "Recalibrate estimate", sub: "Re-estimate from today.", onClick: ctx.onClose },
              { key: "c", icon: <Clock size={16} weight="bold" />, title: "Snooze a few days", sub: "Hush it while you chase.", danger: true, onClick: ctx.onClose },
            ]}
          />
        )}
      </Stage>
    ),
  },
  {
    id: "menu-snooze",
    name: "Snooze menu",
    type: "menu",
    area: "Reminders",
    usedIn: "Work queue · reminder rows + Snooze all",
    file: "components/reminders/SnoozeMenu.tsx",
    componentName: "SnoozeMenu",
    note: "Hours presets, pick-a-date, and reason field. Confirm closes the inspector (no data touched).",
    preview: "inline",
    states: [
      { id: "row", label: "Row variant" },
      { id: "all", label: "Snooze-all variant", hint: "bulk trigger with count" },
    ],
    render: (ctx) => (
      <Stage>
        <SnoozeMenu
          variant={ctx.stateId === "all" ? "all" : "row"}
          count={ctx.stateId === "all" ? 7 : undefined}
          onConfirm={ctx.onClose}
        />
      </Stage>
    ),
  },
  {
    id: "menu-chase-split",
    name: "Chase split button",
    type: "menu",
    area: "Reminders",
    usedIn: "Work queue · per-reminder actions",
    file: "components/reminders/ChaseSplitButton.tsx",
    componentName: "ChaseSplitButton",
    note: "Primary Chase + caret with mark-chased / mark-done. All handlers close the inspector.",
    preview: "inline",
    states: [
      { id: "split", label: "Split (with caret)" },
      { id: "solo", label: "Solo (no caret)" },
    ],
    render: (ctx) => (
      <Stage>
        <ChaseSplitButton
          onChase={ctx.onClose}
          onMarkChased={ctx.stateId === "solo" ? undefined : ctx.onClose}
          onMarkDone={ctx.stateId === "solo" ? undefined : ctx.onClose}
          solo={ctx.stateId === "solo"}
        />
      </Stage>
    ),
  },
  {
    id: "menu-filter",
    name: "Files filter menu",
    type: "menu",
    area: "My Files",
    usedIn: "All Files · Filter control",
    file: "components/transactions/FilterMenu.tsx",
    componentName: "FilterMenu",
    note: "Anchored popover with sectioned filter pills + live counts. Fully interactive against fixture sections.",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <Stage>
        <FilterMenuFixture />
      </Stage>
    ),
  },
  {
    id: "menu-monthly-target",
    name: "Monthly target menu",
    type: "menu",
    area: "My Files",
    usedIn: "All Files · fees header target",
    file: "components/transactions/MonthlyTargetMenu.tsx",
    componentName: "MonthlyTargetMenu",
    note: "CAUTION: Save writes YOUR real agency target (no demo id exists for it). Open and inspect, don't save.",
    preview: "inline",
    states: [
      { id: "set", label: "Target set" },
      { id: "unset", label: "No target yet" },
    ],
    render: (ctx) => (
      <Stage>
        <MonthlyTargetMenu currentPence={ctx.stateId === "set" ? 2_500_000_00 : null} />
      </Stage>
    ),
  },
  {
    id: "menu-completion-date",
    name: "Completion date menu",
    type: "menu",
    area: "Completions",
    usedIn: "Completions board · card date chip",
    file: "components/completions/CompletionCardMenus.tsx",
    componentName: "DateMenu",
    note: "Anchored date editor. Save hits a demo id and no-ops.",
    preview: "inline",
    states: [
      { id: "has-date", label: "Date set" },
      { id: "no-date", label: "No date" },
    ],
    render: (ctx) => (
      <Stage>
        <DateMenu txId="demo-transaction-0000" currentIso={ctx.stateId === "has-date" ? "2026-09-25" : null} hasDate={ctx.stateId === "has-date"} />
      </Stage>
    ),
  },
  {
    id: "menu-completion-fee",
    name: "Completion fee menu",
    type: "menu",
    area: "Completions",
    usedIn: "Completions board · card fee chip",
    file: "components/completions/CompletionCardMenus.tsx",
    componentName: "FeeMenu",
    note: "Fixed £ / percent + VAT editor. Save hits a demo id and no-ops.",
    preview: "inline",
    states: [
      { id: "amount", label: "Fixed amount" },
      { id: "percent", label: "Percent of price" },
      { id: "unset", label: "Fee not set" },
    ],
    render: (ctx) => (
      <Stage>
        <FeeMenu
          txId="demo-transaction-0000"
          agentFeeAmount={ctx.stateId === "amount" ? 4_500_00 : null}
          agentFeePercent={ctx.stateId === "percent" ? 1.25 : null}
          agentFeeIsVatInclusive={ctx.stateId === "unset" ? null : false}
          purchasePrice={47_500_000}
        />
      </Stage>
    ),
  },
  {
    id: "menu-account-row-actions",
    name: "Account row actions menu",
    type: "menu",
    area: "Onboarding & account",
    usedIn: "Account · member / connection rows",
    file: "components/account/chrome/RowActionsMenu.tsx",
    componentName: "RowActionsMenu",
    note: "The account surface's kebab menu, incl. a danger item.",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: (ctx) => (
      <Stage>
        <RowActionsMenu
          items={[
            { label: "Manage", onClick: ctx.onClose },
            { label: "Resend invite", onClick: ctx.onClose },
            { label: "Remove member", onClick: ctx.onClose, danger: true },
          ]}
        />
      </Stage>
    ),
  },
  {
    id: "menu-solicitor-picker",
    name: "Solicitor picker",
    type: "menu",
    area: "Solicitors & contacts",
    usedIn: "New sale + file · solicitor fields",
    file: "components/solicitors/SolicitorPicker.tsx",
    componentName: "SolicitorPicker",
    note: "Type to search real firms (read-only fetch). Creating a firm opens the real AddFirmModal.",
    preview: "inline",
    states: [{ id: "default", label: "Empty selection" }],
    render: () => (
      <Stage>
        <div style={{ width: 360 }}>
          <SolicitorPickerFixture />
        </div>
      </Stage>
    ),
  },
  {
    id: "menu-broker-picker",
    name: "Broker picker",
    type: "menu",
    area: "Brokers & partners",
    usedIn: "New sale + file · broker fields",
    file: "components/brokers/BrokerPicker.tsx",
    componentName: "BrokerPicker",
    note: "Type to search real broker firms (read-only fetch).",
    preview: "inline",
    states: [{ id: "default", label: "Empty selection" }],
    render: () => (
      <Stage>
        <div style={{ width: 360 }}>
          <BrokerPickerFixture />
        </div>
      </Stage>
    ),
  },
  {
    id: "menu-agent-picker",
    name: "Agent picker",
    type: "menu",
    area: "My Files",
    usedIn: "New sale + file · assign the file agent",
    file: "components/agent-picker/AgentPicker.tsx",
    componentName: "AgentPicker",
    note: "Compact select with fixture team members.",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <Stage>
        <div style={{ width: 300 }}>
          <AgentPickerFixture />
        </div>
      </Stage>
    ),
  },
  {
    id: "menu-aurora-opacity",
    name: "Background intensity control",
    type: "menu",
    area: "Onboarding & account",
    usedIn: "Account · appearance",
    file: "components/agent/AuroraOpacityControl.tsx",
    componentName: "AuroraOpacityControl",
    note: "Live slider — it really adjusts this page's backdrop (that's its job). Resets on reload.",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <Stage>
        <AuroraOpacityControl initialOpacity={100} />
      </Stage>
    ),
  },
  {
    id: "menu-risk-badge",
    name: "Risk badge popover",
    type: "menu",
    area: "My Files",
    usedIn: "All Files · row health chip",
    file: "components/transactions/RiskBadgeWithPopover.tsx",
    componentName: "RiskBadgeWithPopover",
    note: "Click the chip to open the risk-factor breakdown.",
    preview: "inline",
    states: [
      { id: "risky", label: "Escalated + overdue" },
      { id: "quiet", label: "Quiet file" },
    ],
    render: (ctx) => (
      <Stage>
        <RiskBadgeWithPopover
          raw={
            ctx.stateId === "risky"
              ? { pendingOverdueTasks: 3, escalatedTasks: 1, lastActivityAt: new Date("2026-08-30"), nextActionLabel: "Chase searches", nextMilestoneLabel: "Search results received", onTrack: "off_track", daysStuckOnMilestone: 24 }
              : { pendingOverdueTasks: 0, escalatedTasks: 0, lastActivityAt: new Date("2026-08-12"), nextActionLabel: null, nextMilestoneLabel: null, onTrack: "at_risk", daysStuckOnMilestone: 11 }
          }
        />
      </Stage>
    ),
  },
  {
    id: "menu-agent-global-search",
    name: "Global search (agent app)",
    type: "menu",
    area: "Global chrome",
    usedIn: "Agent topbar · search / ⌘K",
    file: "components/layout/AgentGlobalSearch.tsx",
    componentName: "AgentGlobalSearch",
    note: "The real command palette. Click the field or press ⌘K; queries hit the live search API (read-only).",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <Stage>
        <div style={{ width: 420 }}>
          <AgentGlobalSearch />
        </div>
      </Stage>
    ),
  },
  {
    id: "menu-global-search",
    name: "Global search (internal dashboard)",
    type: "menu",
    area: "Admin & command",
    usedIn: "Internal AppShell topbar",
    file: "components/layout/GlobalSearch.tsx",
    componentName: "GlobalSearch",
    note: "The internal-dashboard palette (dark shell styling). Queries hit the live search API (read-only).",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <Stage>
        <div style={{ width: 420 }}>
          <GlobalSearch />
        </div>
      </Stage>
    ),
  },
  {
    id: "menu-info-tip",
    name: "Info tip popover",
    type: "menu",
    area: "Auto emails",
    usedIn: "Automated emails list + agency chase grid · the (i) after a title",
    file: "components/ui/InfoTip.tsx",
    componentName: "InfoTip",
    note: "Hover opens with a grace period so you can move into the popover; click pins it. Portalled and fixed-positioned, flips above when the trigger sits low.",
    preview: "inline",
    states: [
      { id: "short", label: "Short tip" },
      { id: "long", label: "Long tip", hint: "multi-sentence content, tests the 320px clamp and wrapping" },
    ],
    render: (ctx) => (
      <Stage>
        <span style={{ display: "inline-flex", alignItems: "center", fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          Weekly client email
          <InfoTip label="Weekly client email">
            {ctx.stateId === "long"
              ? "Sent every Friday morning to both sides of the sale, covering what moved this week and what happens next. If nothing moved, we send a short reassurance note instead, so clients never go a week without hearing from you. Pausing the file pauses these too, and they resume with the file."
              : "Sent every Friday morning to both sides, covering what moved this week."}
          </InfoTip>
        </span>
      </Stage>
    ),
  },
  {
    id: "menu-reviews-section",
    name: "Reviews row menus",
    type: "menu",
    area: "To-do",
    usedIn: "To-do · Reviews tab · hold-row caret + manual-row kebab",
    file: "components/agent/ReviewsSection.tsx",
    componentName: "ReviewsSection",
    note: "Open the hold row's caret (Extend / Remove date) and the manual row's kebab (Reschedule / Edit / Remove). CAUTION: Add a review creates a real to-do on your account; the row-menu actions hit demo ids and error-toast harmlessly.",
    preview: "inline",
    states: [
      { id: "mixed", label: "Hold + manual rows", hint: "both menu kinds, due now" },
      { id: "origins", label: "All hold origins", hint: "hold / chain wait / remarketing pills" },
    ],
    render: (ctx) => (
      <Stage>
        <div style={{ width: "100%", maxWidth: 720 }}>
          <ReviewsSection
            initialItems={ctx.stateId === "origins" ? REVIEW_ITEMS_ORIGINS : REVIEW_ITEMS_MIXED}
            initialDone={[]}
            attachableFiles={[{ id: DEMO_TX_ID, propertyAddress: ADDRESS }]}
          />
        </div>
      </Stage>
    ),
  },
  {
    id: "menu-checkpoints-row",
    name: "Checkpoint row menu",
    type: "menu",
    area: "Property file",
    usedIn: "Property file · Overview · Checkpoints card row kebab",
    file: "components/transaction/CheckpointsPanel.tsx",
    componentName: "CheckpointsPanel",
    note: "Open a row's kebab: Nudge (when that side has push) + Remove, portalled with a full-screen scrim. CAUTION: Confirm, Nudge and Remove call the real server actions with demo ids; they fail the scope guard and error-toast, nothing is written.",
    preview: "inline",
    states: [
      { id: "open", label: "Open rows", hint: "first row nudgeable, second remove-only" },
      { id: "complete", label: "Complete + no-push rows", hint: "ticked row hides the kebab" },
    ],
    render: (ctx) => (
      <Stage>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <CheckpointsPanel
            transactionId={DEMO_TX_ID}
            vendorName={NAME}
            purchaserName="Tom Whitfield"
            hasVendor
            hasPurchaser
            items={ctx.stateId === "complete" ? CHECKPOINTS_COMPLETE : CHECKPOINTS_OPEN}
          />
        </div>
      </Stage>
    ),
  },
  {
    id: "menu-invoice-address-pop",
    name: "Invoice address popover",
    type: "menu",
    area: "Billing",
    usedIn: "Billing · current invoice · click a line's address",
    file: "components/billing/v2/BuildingInvoiceHero.tsx",
    componentName: "BuildingInvoiceHero (AddressCell)",
    note: "Click an address for the glassy property card: fallback streetscape photo, added + exchange dates, Go to file link (demo id, so it 404s). The credit line's address is plain text, no popover. PDF preview button hidden here, it hits a live API route.",
    preview: "inline",
    states: [
      { id: "lines", label: "Two billable lines" },
      { id: "mixed", label: "Trial + credit lines", hint: "credit applied in the totals, plain-text credit address" },
    ],
    render: (ctx) => (
      <Stage>
        <div style={{ width: "100%", maxWidth: 760 }}>
          <BuildingInvoiceHero
            periodLabel="October 2026"
            lines={ctx.stateId === "mixed" ? INVOICE_LINES_MIXED : INVOICE_LINES}
            subtotalPence={30900}
            creditsAppliedPence={ctx.stateId === "mixed" ? 5900 : 0}
            totalPence={ctx.stateId === "mixed" ? 25000 : 30900}
            hidePreviewButton
          />
        </div>
      </Stage>
    ),
  },
  {
    id: "menu-files-journey-hover",
    name: "Files row journey popover",
    type: "menu",
    area: "My Files",
    usedIn: "All Files · hover a row's stage bar",
    file: "components/transactions/TransactionRowView.tsx",
    componentName: "TransactionRowView (JourneyHover)",
    note: "Hover (or focus) the stage bar for the six-stage glass popover, current stage coral. The whole row is a live link to a demo id, so a click navigates to a 404. The sibling WithdrawnCell hover is dead code, see the header note.",
    preview: "inline",
    states: [
      { id: "grid", label: "Desktop grid row" },
      { id: "card", label: "Card row", hint: "the sub-680px container layout" },
    ],
    render: (ctx) => (
      <Stage>
        <div
          className={ctx.stateId === "card" ? "files-table" : "files-table files-switch-680"}
          style={{ width: "100%", maxWidth: ctx.stateId === "card" ? 420 : 1040 }}
        >
          <TransactionRowView
            tx={FILES_ROW_TX}
            isLast
            cols={["stage", "activity", "exchange"]}
            showAssignedToColumn={false}
            activeTab="active"
          />
        </div>
      </Stage>
    ),
  },
];
