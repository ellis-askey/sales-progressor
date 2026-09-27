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
//     those large domain components, no standalone export to mount.
//   - HeroAddressEdit / HeroSaleFields — inline hero edit popovers requiring
//     the live file hero context.
//   - PipelineStageHover — positions off a live pipeline tile's DOMRect with
//     per-stage stats; only meaningful inside PipelineAtAGlance.
//   - ThemePicker — requires the AgentTheme providers the harness deliberately
//     doesn't mount (it would restyle the harness itself).

import { useState } from "react";
import type { SheetEntry } from "./types";
import { NAME } from "./fixtures";

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
];
