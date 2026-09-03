"use client";
// Notification / banner / callout / empty-state entries for /dev/sheets. See types.ts.
//
// Every entry mounts a REAL production notice/banner/empty-state inside the
// faux agent page column (FixturePage, supplied by the host) so a reviewer can
// judge it in realistic context, against the live iridescent background and the
// real design tokens. All handlers are wired to `noop` / `ctx.onClose` and all
// ids are demo ids, so nothing here can mutate a live file.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Info,
  Warning,
  WarningCircle,
  CheckCircle,
  Bell,
} from "@phosphor-icons/react";

import type { SheetEntry } from "./types";
import {
  DEMO_TX_ID,
  ADDRESS,
  LONG_ADDRESS,
  NAME,
  LONG_NOTE,
  noop,
} from "./fixtures";
import { FixtureCard, FixtureContextLabel } from "../_components/FixtureUI";

// ── Canonical primitives ───────────────────────────────────────────────────
import { AgentBanner } from "@/components/ui/AgentBanner";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { StatusBadge } from "@/components/ui/StatusBadge";

// ── File-level banners ──────────────────────────────────────────────────────
import { OnHoldBanner } from "@/components/transaction/OnHoldBanner";
import { RelistBanner } from "@/components/transaction/RelistBanner";
import { ReviseExchangeBanner } from "@/components/transaction/ReviseExchangeBanner";
import { FileHealthBanner } from "@/components/transaction/FileHealthBanner";
import { ReconcileLaterBanner } from "@/components/transaction/ReconcileLaterBanner";

// ── Hub / onboarding ────────────────────────────────────────────────────────
import { DirectorJoinedBanner } from "@/components/agent/DirectorJoinedBanner";
import { ChainDeclineBanner } from "@/components/agent/ChainDeclineBanner";
import { EmailSetupPrompt } from "@/components/agent/EmailSetupPrompt";
import { OnboardingChecklist } from "@/components/agent/OnboardingChecklist";
import { SetupCard } from "@/components/agent/SetupCard";
import { NoChainSetupCard } from "@/components/chain/NoChainSetupCard";
import { AnalyticsNotifCta } from "@/components/analytics/AnalyticsNotifCta";

// ── Auto-emails / reminders ─────────────────────────────────────────────────
import { AutomationBanner } from "@/components/automated-emails/AutomationBanner";
import { NeedsAttentionPanel } from "@/components/automated-emails/NeedsAttentionPanel";
import { FileAlertsStrip } from "@/components/reminders/FileAlertsStrip";
import { AutomatedEmailsCard } from "@/components/reminders/AutomatedEmailsCard";

// ── Full-page empty states ──────────────────────────────────────────────────
import { HubEmptyState } from "@/components/agent/HubEmptyState";
import { AllFilesEmptyState } from "@/components/transactions/AllFilesEmptyState";
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState";
import { TodoEmptyState } from "@/components/agent/TodoEmptyState";
import { PartnersEmptyState } from "@/components/agent/partners/PartnersEmptyState";
import { CommsEmptyState } from "@/components/agent/CommsEmptyState";
import { HubEmptyWelcomeCard } from "@/components/agent/HubEmptyWelcomeCard";

// ── Service-shaped fixture types ────────────────────────────────────────────
import type {
  AutomationBanner as AutomationBannerData,
  NeedsAttention,
} from "@/lib/services/automated-emails-overview";
import type { WorkQueueItem } from "@/lib/services/work-queue";
import type { AutomatedEmailsPreview } from "@/lib/services/automated-emails-preview";
import type { NoChainSale } from "@/lib/services/chains";

// ── Local fixtures ──────────────────────────────────────────────────────────

const AGENCY = "Harbrook & Vale";
const D = (iso: string) => new Date(iso);

// ── Small inner components (hooks can't live in a render() directly) ─────────

// Toast trigger board. The AgentToaster provider is mounted by the /dev/sheets
// layout, so these fire real toasts bottom-right.
function ToastBoard() {
  const { toast } = useAgentToast();
  const btn = "agent-btn agent-btn-sm agent-btn-secondary";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button
        type="button"
        className={btn}
        onClick={() => toast.success("Saved", { description: "Your changes are live." })}
      >
        Success
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => toast.info("Heads up", { description: "A solicitor reply just came in." })}
      >
        Info
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => toast.warning("Check this", { description: "Exchange date is in the past." })}
      >
        Warning
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => toast.error("Couldn't send", { description: "The last chase bounced." })}
      >
        Error
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          toast.info("File assigned", {
            description: "Assigned to you.",
            action: { label: "Undo", onClick: noop },
          })
        }
      >
        With action
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          toast.warning("Automation paused", {
            description: "This stays until you dismiss it.",
            duration: Infinity,
          })
        }
      >
        Persistent
      </button>
    </div>
  );
}

// ReconcileLaterBanner reads a per-file localStorage flag written by the claim
// flow; without it the component renders null. Seed the demo flag on mount so
// the banner is inspectable here.
function ReconcileLaterSeeded() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      window.localStorage.setItem(`reconcileLater:${DEMO_TX_ID}`, "1");
    } catch {
      /* private mode — the banner just won't show */
    }
    setReady(true);
    return () => {
      try {
        window.localStorage.removeItem(`reconcileLater:${DEMO_TX_ID}`);
      } catch {
        /* ignore */
      }
    };
  }, []);
  if (!ready) return null;
  return (
    <ReconcileLaterBanner
      transactionId={DEMO_TX_ID}
      milestoneDefinitions={[]}
      tenure="freehold"
      purchaseType="mortgage"
    />
  );
}

// ── Auto-emails / reminders fixtures ─────────────────────────────────────────

const AUTOMATION_BANNER_HEALTHY: AutomationBannerData = {
  activeFiles: 24,
  automationPaused: false,
  nextSendAt: D("2026-09-03T14:30:00Z"),
  chasingTodayCount: 7,
  chasingTodayFiles: 5,
};
const AUTOMATION_BANNER_PAUSED: AutomationBannerData = {
  activeFiles: 24,
  automationPaused: true,
  nextSendAt: null,
  chasingTodayCount: 0,
  chasingTodayFiles: 0,
};

const NEEDS_ATTENTION_EMPTY: NeedsAttention = {
  total: 0,
  affectedFiles: 0,
  byStatus: { bounced: 0, blocked: 0, missing: 0, failed: 0, errored: 0, deferred: 0 },
  items: [],
};
const NEEDS_ATTENTION_POPULATED: NeedsAttention = {
  total: 5,
  affectedFiles: 4,
  byStatus: { bounced: 2, blocked: 1, missing: 1, failed: 0, errored: 0, deferred: 1 },
  items: [
    {
      emailId: "demo-e1",
      source: "queue",
      status: "bounced",
      transactionId: DEMO_TX_ID,
      transactionAddress: ADDRESS,
      recipientName: NAME,
      recipientEmail: "priya.c@example.com",
      recipientRole: "vendor",
      reason: "550 mailbox unavailable",
      deferredCount: 0,
      action: "update_contact",
      count: 2,
    },
    {
      emailId: "demo-e2",
      source: "message",
      status: "blocked",
      transactionId: "demo-tx-2",
      transactionAddress: LONG_ADDRESS,
      recipientName: "Tom & Rebecca Whitfield",
      recipientEmail: "t.whitfield@example.com",
      recipientRole: "purchaser",
      reason: "Recipient server rejected the message",
      deferredCount: 0,
      action: "update_contact",
      count: 1,
    },
    {
      emailId: "demo-e3",
      source: "queue",
      status: "missing",
      transactionId: "demo-tx-3",
      transactionAddress: "8 Rowan Close, Sheffield",
      recipientName: "Margaret Osei-Bonsu",
      recipientEmail: "",
      recipientRole: "solicitor",
      reason: null,
      deferredCount: 0,
      action: "update_contact",
      count: 1,
    },
    {
      emailId: "demo-e4",
      source: "queue",
      status: "deferred",
      transactionId: "demo-tx-4",
      transactionAddress: "142 Kings Road, Reading",
      recipientName: "Daniel Fitzgerald",
      recipientEmail: "dan@example.com",
      recipientRole: "purchaser",
      reason: "Greylisted, retrying",
      deferredCount: 4,
      action: "review",
      count: 1,
    },
  ],
};

const WORK_QUEUE_ITEMS: WorkQueueItem[] = [
  {
    id: DEMO_TX_ID,
    propertyAddress: ADDRESS,
    status: "active",
    expectedExchangeDate: D("2026-08-20"),
    alerts: ["overdue_exchange"],
    vendors: [NAME],
    purchasers: ["Tom & Rebecca Whitfield"],
    lastActivityAt: D("2026-08-15"),
    agentUser: { id: "demo-user", name: "Sam Rai" },
    createdAt: D("2026-06-01"),
  },
  {
    id: "demo-tx-2",
    propertyAddress: LONG_ADDRESS,
    status: "active",
    expectedExchangeDate: null,
    alerts: ["missing_vendor_solicitor", "missing_purchaser_solicitor"],
    vendors: ["Priya Chandrasekaran"],
    purchasers: [],
    lastActivityAt: D("2026-08-28"),
    agentUser: null,
    createdAt: D("2026-07-10"),
  },
  {
    id: "demo-tx-3",
    propertyAddress: "8 Rowan Close, Sheffield",
    status: "active",
    expectedExchangeDate: D("2026-10-01"),
    alerts: ["stale"],
    vendors: ["Alan Beckett"],
    purchasers: ["Nadia Khan"],
    lastActivityAt: D("2026-08-05"),
    agentUser: { id: "demo-user-2", name: "Jo Miller" },
    createdAt: D("2026-05-20"),
  },
];

const PAUSE_HEALTHY = {
  globalDisabled: false,
  agencyDisabled: false,
  fileDisabled: false,
  activePauseReason: null,
  agencyName: null,
} as const;

const AUTO_EMAILS_EMPTY: AutomatedEmailsPreview = {
  pending: [],
  sentToday: [],
  upcoming: [],
  pauseState: { ...PAUSE_HEALTHY },
};

const AUTO_EMAILS_POPULATED: AutomatedEmailsPreview = {
  pending: [
    {
      id: "demo-p1",
      emailType: "chase_searches",
      category: "chase",
      recipientName: "Margaret Osei-Bonsu",
      recipientRole: "solicitor",
      subject: "Searches on 14 Oakwood Avenue",
      scheduledFor: D("2026-09-03T08:30:00Z"),
    },
  ],
  sentToday: [
    {
      id: "demo-s1",
      emailType: "milestone_update",
      category: "notification",
      recipientName: NAME,
      recipientRole: "vendor",
      subject: "An update on your sale",
      sentAt: D("2026-09-03T07:10:00Z"),
      deliveryStatus: "delivered",
      deliveredAt: D("2026-09-03T07:11:00Z"),
      deferredAt: null,
      deferredCount: 0,
      deferredReason: null,
      bouncedAt: null,
      bouncedReason: null,
      blockedAt: null,
      blockedReason: null,
    },
    {
      id: "demo-s2",
      emailType: "chase_mortgage",
      category: "chase",
      recipientName: "Tom & Rebecca Whitfield",
      recipientRole: "purchaser",
      subject: "Mortgage offer chase",
      sentAt: D("2026-09-03T07:20:00Z"),
      deliveryStatus: "bounced",
      deliveredAt: null,
      deferredAt: null,
      deferredCount: 0,
      deferredReason: null,
      bouncedAt: D("2026-09-03T07:21:00Z"),
      bouncedReason: "Mailbox full",
      blockedAt: null,
      blockedReason: null,
    },
  ],
  upcoming: [
    {
      contactId: "demo-c1",
      contactName: NAME,
      contactRole: "vendor",
      milestoneCode: "searches_ordered",
      milestoneLabel: "Searches ordered",
      predictedFireDate: D("2026-09-05T08:30:00Z"),
      chaseNumber: 1,
    },
    {
      contactId: "demo-c2",
      contactName: "Margaret Osei-Bonsu",
      contactRole: "solicitor",
      milestoneCode: "enquiries_raised",
      milestoneLabel: "Enquiries raised",
      predictedFireDate: D("2026-09-09T08:30:00Z"),
      chaseNumber: 2,
    },
  ],
  pauseState: { ...PAUSE_HEALTHY },
};

const AUTO_EMAILS_PAUSED: AutomatedEmailsPreview = {
  ...AUTO_EMAILS_POPULATED,
  pauseState: {
    globalDisabled: false,
    agencyDisabled: true,
    fileDisabled: false,
    activePauseReason: "agency",
    agencyName: AGENCY,
  },
};

// ── NoChainSetupCard fixtures ────────────────────────────────────────────────

function noChainSale(overrides: Partial<NoChainSale>): NoChainSale {
  return {
    transactionId: DEMO_TX_ID,
    address: ADDRESS,
    status: "active",
    createdAt: "2026-06-15",
    photoUrl: null,
    agencyName: AGENCY,
    buyerPosition: null,
    noChainRequired: false,
    noChainConfirmedAt: null,
    resurfaced: false,
    awaitingClientOnward: false,
    search: "",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_ENTRIES: SheetEntry[] = [
  // ══ Canonical primitives ══════════════════════════════════════════════════
  {
    id: "notice-agent-banner",
    name: "Banner (AgentBanner)",
    type: "notification",
    area: "Global chrome",
    usedIn: "Every agent surface · horizontal alert card",
    file: "components/ui/AgentBanner.tsx",
    componentName: "AgentBanner",
    note: "Canonical horizontal alert (aliased as Banner). Semantic meaning is carried by border + icon + heading colour on a neutral blurred surface, never a tinted background. Check each kind reads clearly against the iridescent app background.",
    preview: "inline",
    states: [
      { id: "info", label: "Info" },
      { id: "warning", label: "Warning" },
      { id: "danger", label: "Danger" },
      { id: "success", label: "Success" },
      { id: "with-action", label: "With action", hint: "arrow-suffixed nav action" },
      { id: "dismissible", label: "Dismissible", hint: "action + dismiss X" },
      { id: "long", label: "Long content", hint: "long title + long body" },
    ],
    render: ({ stateId }) => {
      switch (stateId) {
        case "warning":
          return (
            <AgentBanner
              kind="warning"
              icon={<Warning size={18} weight="fill" />}
              title="This exchange date has passed."
              body="Give the file a realistic new date so predictions stay accurate."
            />
          );
        case "danger":
          return (
            <AgentBanner
              kind="danger"
              icon={<WarningCircle size={18} weight="fill" />}
              title="This sale may be falling behind."
              body="Three reminders are overdue and nothing has moved in two weeks."
            />
          );
        case "success":
          return (
            <AgentBanner
              kind="success"
              icon={<CheckCircle size={18} weight="fill" />}
              title="Exchange confirmed."
              body="Both solicitors have confirmed contracts are exchanged."
            />
          );
        case "with-action":
          return (
            <AgentBanner
              kind="info"
              icon={<Info size={18} weight="fill" />}
              title="A chain is waiting to be linked."
              body="Connect the onward purchase to see the whole chain in one place."
              action={{ label: "Go to chain panel →", onClick: noop }}
            />
          );
        case "dismissible":
          return (
            <AgentBanner
              kind="warning"
              icon={<Warning size={18} weight="fill" />}
              title="Two reminders need attention."
              body="They're overdue on this file."
              action={{ label: "View reminders →", onClick: noop }}
              actionPlacement="top-right"
              dismissible={{ onDismiss: noop }}
            />
          );
        case "long":
          return (
            <AgentBanner
              kind="danger"
              icon={<WarningCircle size={18} weight="fill" />}
              title="This sale is at serious risk of falling through and needs your attention today"
              body={LONG_NOTE}
              action={{ label: "Open the file →", onClick: noop }}
              actionPlacement="bottom-right"
              dismissible={{ onDismiss: noop }}
            />
          );
        default:
          return (
            <AgentBanner
              kind="info"
              icon={<Info size={18} weight="fill" />}
              title="This file was brought over from your old system."
              body="Mark which steps are already done so the timeline is accurate."
            />
          );
      }
    },
  },
  {
    id: "notice-toasts",
    name: "Toasts",
    type: "notification",
    area: "Global chrome",
    usedIn: "Every agent surface · useAgentToast()",
    file: "components/agent/AgentToaster.tsx",
    componentName: "AgentToaster / useAgentToast",
    note: "Toasts appear bottom-right (fixed), stacked newest-last, capped at 4 visible. Hover pauses the auto-dismiss timer. Fire each type; the persistent one stays until dismissed.",
    preview: "inline",
    states: [{ id: "board", label: "Trigger board" }],
    render: () => (
      <FixtureCard>
        <FixtureContextLabel>Toasts render bottom-right of the viewport</FixtureContextLabel>
        <div style={{ marginTop: 12 }}>
          <ToastBoard />
        </div>
      </FixtureCard>
    ),
  },
  {
    id: "notice-empty-state",
    name: "EmptyState",
    type: "notification",
    area: "Global chrome",
    usedIn: "Cards + panels · no-data placeholder",
    file: "components/ui/EmptyState.tsx",
    componentName: "EmptyState",
    note: "Small centered placeholder for empty cards/panels (distinct from the full-page onboarding heroes). Compact drops the icon + padding for tight spaces.",
    preview: "inline",
    states: [
      { id: "default", label: "Default" },
      { id: "with-action", label: "With action" },
      { id: "compact", label: "Compact" },
    ],
    render: ({ stateId }) => {
      if (stateId === "compact") {
        return (
          <FixtureCard>
            <EmptyState compact title="No documents yet" description="Uploads will show here." />
          </FixtureCard>
        );
      }
      if (stateId === "with-action") {
        return (
          <FixtureCard>
            <EmptyState
              title="No reminders on this file"
              description="Add a manual reminder or let automation take over."
              action={
                <button type="button" className="agent-btn agent-btn-sm agent-btn-primary" onClick={noop}>
                  Add a reminder
                </button>
              }
            />
          </FixtureCard>
        );
      }
      return (
        <FixtureCard>
          <EmptyState title="Nothing here yet" description="This is where activity will appear." />
        </FixtureCard>
      );
    },
  },
  {
    id: "notice-status-pills",
    name: "Status pills & badges",
    type: "notification",
    area: "Global chrome",
    usedIn: "Pill everywhere · StatusBadge on file lists",
    file: "components/ui/Pill.tsx",
    componentName: "Pill / StatusBadge",
    note: "Full Pill tone matrix (default/muted/brand/info/success/warning/danger) at both sizes, plus outline / glass / dot treatments, and StatusBadge for every TransactionStatus. Check tone contrast against the app background.",
    preview: "inline",
    states: [{ id: "matrix", label: "Full matrix" }],
    render: () => {
      const tones = ["default", "muted", "brand", "info", "success", "warning", "danger"] as const;
      const row: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 };
      const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" };
      return (
        <FixtureCard>
          <p style={label}>Solid · md / sm</p>
          <div style={row}>
            {tones.map((t) => (
              <Pill key={t} tone={t}>{t}</Pill>
            ))}
          </div>
          <div style={row}>
            {tones.map((t) => (
              <Pill key={t} tone={t} size="sm">{t}</Pill>
            ))}
          </div>
          <p style={label}>Outline</p>
          <div style={row}>
            {tones.map((t) => (
              <Pill key={t} tone={t} outline>{t}</Pill>
            ))}
          </div>
          <p style={label}>Glass + dot</p>
          <div style={row}>
            {tones.map((t) => (
              <Pill key={t} tone={t} glass dot>{t}</Pill>
            ))}
          </div>
          <p style={label}>StatusBadge (TransactionStatus)</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatusBadge status="draft" />
            <StatusBadge status="active" />
            <StatusBadge status="on_hold" />
            <StatusBadge status="completed" />
            <StatusBadge status="withdrawn" />
          </div>
        </FixtureCard>
      );
    },
  },

  // ══ File-level banners (Property file) ════════════════════════════════════
  {
    id: "notice-on-hold-banner",
    name: "On-hold banner",
    type: "notification",
    area: "Property file",
    usedIn: "Property file · top of page when status = on_hold",
    file: "components/transaction/OnHoldBanner.tsx",
    componentName: "OnHoldBanner",
    note: "Warning banner that all automation is frozen. Renders nothing when show=false.",
    preview: "inline",
    states: [{ id: "default", label: "On hold" }],
    render: () => (
      <>
        <FixtureContextLabel>Top of the property file</FixtureContextLabel>
        <div style={{ marginTop: 8 }}>
          <OnHoldBanner show />
        </div>
      </>
    ),
  },
  {
    id: "notice-relist-banner",
    name: "Relist banner",
    type: "notification",
    area: "Property file",
    usedIn: "Property file · withdrawn, not yet exchanged",
    file: "components/transaction/RelistBanner.tsx",
    componentName: "RelistBanner",
    note: "Convenience banner + relist modal. The action opens RelistFileModal (portals over the page); demo ids mean nothing mutates.",
    preview: "inline",
    states: [{ id: "default", label: "Sale fell through" }],
    render: () => (
      <>
        <FixtureContextLabel>Top of the property file</FixtureContextLabel>
        <div style={{ marginTop: 8 }}>
          <RelistBanner show transactionId={DEMO_TX_ID} previousPurchasePrice={475000} inChain={false} />
        </div>
      </>
    ),
  },
  {
    id: "notice-revise-exchange-banner",
    name: "Revise exchange banner",
    type: "notification",
    area: "Property file",
    usedIn: "Property file · exchange date passed + file quiet",
    file: "components/transaction/ReviseExchangeBanner.tsx",
    componentName: "ReviseExchangeBanner",
    note: "Bespoke amber banner (not AgentBanner) + a revise-date modal gated on a 'spoken to both parties' tick. Inspect the banner; the button opens the modal.",
    preview: "inline",
    states: [{ id: "default", label: "Overdue + quiet" }],
    render: () => (
      <>
        <FixtureContextLabel>Top of the property file</FixtureContextLabel>
        <div style={{ marginTop: 8 }}>
          <ReviseExchangeBanner transactionId={DEMO_TX_ID} address={ADDRESS} passedDateIso="2026-08-20" />
        </div>
      </>
    ),
  },
  {
    id: "notice-file-health-banner",
    name: "File health banner",
    type: "notification",
    area: "Property file",
    usedIn: "Property file · reminders health + slip warning",
    file: "components/transaction/FileHealthBanner.tsx",
    componentName: "FileHealthBanner",
    note: "Multi-state: the slip warning (names the bottleneck) takes precedence, then overdue/attention counts. Dismiss is count-aware via localStorage. Reads TabContext (safe default when no provider).",
    preview: "inline",
    states: [
      { id: "slip", label: "Running behind (slip)" },
      { id: "overdue", label: "Overdue + behind" },
      { id: "attention", label: "Needs attention" },
      { id: "behind", label: "Behind, no reminders" },
    ],
    render: ({ stateId }) => {
      const common = { transactionId: DEMO_TX_ID };
      let node: ReactNode;
      if (stateId === "slip") {
        node = (
          <FileHealthBanner
            {...common}
            actionableCount={2}
            overdueCount={1}
            onTrack="off_track"
            slip={{ predictedDateLabel: "3 October", bottleneckName: "the buyer's solicitor" }}
          />
        );
      } else if (stateId === "overdue") {
        node = <FileHealthBanner {...common} actionableCount={3} overdueCount={2} onTrack="at_risk" slip={null} />;
      } else if (stateId === "attention") {
        node = <FileHealthBanner {...common} actionableCount={2} overdueCount={0} onTrack="on_track" slip={null} />;
      } else {
        node = <FileHealthBanner {...common} actionableCount={0} overdueCount={0} onTrack="off_track" slip={null} />;
      }
      return (
        <>
          <FixtureContextLabel>Top of the property file, under the tab bar</FixtureContextLabel>
          <div style={{ marginTop: 8 }}>{node}</div>
        </>
      );
    },
  },
  {
    id: "notice-reconcile-later-banner",
    name: "Reconcile-later banner",
    type: "notification",
    area: "Property file",
    usedIn: "Property file · agent chose 'set up later' on claim",
    file: "components/transaction/ReconcileLaterBanner.tsx",
    componentName: "ReconcileLaterBanner",
    note: "Self-gates on a per-file localStorage flag written by the claim flow; the harness seeds that flag on mount so the info banner shows. 'Set up steps' opens the reconcile modal (empty milestone list in the fixture).",
    preview: "inline",
    states: [{ id: "default", label: "Bring file up to date" }],
    render: () => (
      <>
        <FixtureContextLabel>Top of the property file after a claim</FixtureContextLabel>
        <div style={{ marginTop: 8 }}>
          <ReconcileLaterSeeded />
        </div>
      </>
    ),
  },

  // ══ Hub / onboarding ══════════════════════════════════════════════════════
  {
    id: "notice-director-joined-banner",
    name: "Director joined banner",
    type: "notification",
    area: "Onboarding & account",
    usedIn: "Hub · after a director accepts an invite",
    file: "components/agent/DirectorJoinedBanner.tsx",
    componentName: "DirectorJoinedBanner",
    note: "Success AgentBanner, dismissible. Dismiss calls a server action (demo session, no-op).",
    preview: "inline",
    states: [{ id: "default", label: "Director joined" }],
    render: () => (
      <>
        <FixtureContextLabel>Top of the hub</FixtureContextLabel>
        <div style={{ marginTop: 8 }}>
          <DirectorJoinedBanner directorName={NAME} agencyName={AGENCY} />
        </div>
      </>
    ),
  },
  {
    id: "notice-chain-decline-banner",
    name: "Chain decline banner",
    type: "notification",
    area: "Chains",
    usedIn: "Hub · a chain invite was declined",
    file: "components/agent/ChainDeclineBanner.tsx",
    componentName: "ChainDeclineBanner",
    note: "Danger AgentBanner, dismissible. Long-address state stresses the interpolated body line.",
    preview: "inline",
    states: [
      { id: "default", label: "Declined" },
      { id: "long", label: "Long address" },
    ],
    render: ({ stateId }) => (
      <>
        <FixtureContextLabel>Top of the hub</FixtureContextLabel>
        <div style={{ marginTop: 8 }}>
          <ChainDeclineBanner address={stateId === "long" ? LONG_ADDRESS : ADDRESS} />
        </div>
      </>
    ),
  },
  {
    id: "notice-email-setup-prompt",
    name: "Email setup prompt",
    type: "notification",
    area: "Onboarding & account",
    usedIn: "Hub · director, agency still on shared sender",
    file: "components/agent/EmailSetupPrompt.tsx",
    componentName: "EmailSetupPrompt",
    note: "Self-gates on a live /api/agent/onboarding-progress fetch + a per-user localStorage dismissal, so it may render blank in the harness if the logged-in account already has a verified sender or has dismissed it.",
    preview: "inline",
    states: [{ id: "default", label: "Nudge" }],
    render: () => (
      <>
        <FixtureContextLabel>Top of the hub (director only)</FixtureContextLabel>
        <div style={{ marginTop: 8 }}>
          <EmailSetupPrompt userId="demo-user" />
        </div>
      </>
    ),
  },
  {
    id: "notice-onboarding-checklist",
    name: "Onboarding checklist (inline)",
    type: "notification",
    area: "Onboarding & account",
    usedIn: "Hub empty state · getting-started checklist",
    file: "components/agent/OnboardingChecklist.tsx",
    componentName: "OnboardingChecklist",
    note: "Inline variant (the floating variant is fixed bottom-right). It fetches live onboarding progress, so which steps show ticked depends on the logged-in account; on first paint it shows the default all-incomplete list.",
    preview: "inline",
    states: [{ id: "inline", label: "Inline checklist" }],
    render: () => (
      <div style={{ maxWidth: 380 }}>
        <OnboardingChecklist userId="demo-user" variant="inline" role="director" />
      </div>
    ),
  },
  {
    id: "notice-setup-card",
    name: "Setup card",
    type: "notification",
    area: "Onboarding & account",
    usedIn: "Empty states · tinted info/CTA card",
    file: "components/agent/SetupCard.tsx",
    componentName: "SetupCard",
    note: "Tinted (coral/blue/green) info card with an optional glass CTA button. Info-only state omits the CTA. Long-content state stresses wrapping.",
    preview: "inline",
    states: [
      { id: "coral", label: "Coral + CTA" },
      { id: "blue", label: "Blue + CTA" },
      { id: "green", label: "Green (info only)" },
      { id: "long", label: "Long content" },
    ],
    render: ({ stateId }) => {
      if (stateId === "blue") {
        return (
          <div style={{ maxWidth: 320 }}>
            <SetupCard tint="blue" icon={<Info size={20} weight="regular" />} title="See each sale's next step" desc="Each file shows the exact next thing to do." cta="Add a sale" onClick={noop} />
          </div>
        );
      }
      if (stateId === "green") {
        return (
          <div style={{ maxWidth: 320 }}>
            <SetupCard tint="green" icon={<CheckCircle size={20} weight="regular" />} title="Your network builds itself" desc="Solicitors and brokers on your sales appear here automatically." />
          </div>
        );
      }
      if (stateId === "long") {
        return (
          <div style={{ maxWidth: 320 }}>
            <SetupCard tint="coral" icon={<Bell size={20} weight="regular" />} title="Keep everyone in the picture on every single one of your live sales" desc={LONG_NOTE} cta="Get started" onClick={noop} />
          </div>
        );
      }
      return (
        <div style={{ maxWidth: 320 }}>
          <SetupCard tint="coral" icon={<Bell size={20} weight="regular" />} title="Spot at-risk sales early" desc="Every sale gets a live risk read so drift stands out." cta="Add your first sale" onClick={noop} />
        </div>
      );
    },
  },
  {
    id: "notice-no-chain-setup-card",
    name: "No-chain setup card",
    type: "notification",
    area: "Chains",
    usedIn: "Chains workspace · needs-chain-setup queue",
    file: "components/chain/NoChainSetupCard.tsx",
    componentName: "NoChainSetupCard",
    note: "Resolves a live sale either into a chain or a confirmed 'no chain'. States mirror the real queue: needs setup, looks chain-free, awaiting the seller's reply, confirmed no-chain, and resurfaced (client now buying onward).",
    preview: "inline",
    states: [
      { id: "default", label: "Needs setup" },
      { id: "likely", label: "Looks chain-free" },
      { id: "awaiting", label: "Awaiting reply" },
      { id: "confirmed", label: "Confirmed no chain" },
      { id: "resurfaced", label: "Resurfaced" },
    ],
    render: ({ stateId }) => {
      let sale: NoChainSale;
      if (stateId === "likely") sale = noChainSale({ noChainRequired: true, buyerPosition: "First-time buyer" });
      else if (stateId === "awaiting") sale = noChainSale({ awaitingClientOnward: true });
      else if (stateId === "confirmed") sale = noChainSale({ noChainConfirmedAt: "2026-08-01" });
      else if (stateId === "resurfaced") sale = noChainSale({ noChainConfirmedAt: "2026-08-01", resurfaced: true });
      else sale = noChainSale({});
      return (
        <NoChainSetupCard
          sale={sale}
          currentUserId="demo-user"
          currentUserRole="director"
          showAgency
          onConfirmNoChain={noop}
          onUndoNoChain={noop}
        />
      );
    },
  },
  {
    id: "notice-analytics-notif-cta",
    name: "Enable alerts CTA",
    type: "notification",
    area: "Global chrome",
    usedIn: "Analytics header · push-notification opt-in",
    file: "components/analytics/AnalyticsNotifCta.tsx",
    componentName: "AnalyticsNotifCta",
    note: "Small pill button that opts into browser push. Self-gates on Notification/ServiceWorker/PushManager support and prior subscription, so it renders blank where push isn't available or already granted.",
    preview: "inline",
    states: [{ id: "default", label: "CTA" }],
    render: () => (
      <FixtureCard>
        <FixtureContextLabel>Sits inline in the Analytics page header</FixtureContextLabel>
        <div style={{ marginTop: 12 }}>
          <AnalyticsNotifCta />
        </div>
      </FixtureCard>
    ),
  },

  // ══ Auto-emails / reminders ═══════════════════════════════════════════════
  {
    id: "notice-automation-banner",
    name: "Automation health banner",
    type: "notification",
    area: "Auto emails",
    usedIn: "Automated-emails page · health strip",
    file: "components/automated-emails/AutomationBanner.tsx",
    componentName: "AutomationBanner",
    note: "Leads the automated-emails page: a healthy/paused lead plus four scan-figures (queued, chasing today, need attention, monitored).",
    preview: "inline",
    states: [
      { id: "healthy", label: "Healthy" },
      { id: "attention", label: "Healthy + attention" },
      { id: "paused", label: "Paused" },
    ],
    render: ({ stateId }) => {
      if (stateId === "paused") {
        return <AutomationBanner banner={AUTOMATION_BANNER_PAUSED} needsTotal={0} queuedNow={0} />;
      }
      const needsTotal = stateId === "attention" ? 5 : 0;
      return <AutomationBanner banner={AUTOMATION_BANNER_HEALTHY} needsTotal={needsTotal} queuedNow={3} />;
    },
  },
  {
    id: "notice-needs-attention-panel",
    name: "Needs-attention panel",
    type: "notification",
    area: "Auto emails",
    usedIn: "Automated-emails page · actionable problems",
    file: "components/automated-emails/NeedsAttentionPanel.tsx",
    componentName: "NeedsAttentionPanel",
    note: "Typed problem cards (bounced/blocked/missing/deferred) each with one safe link-only action. Empty state shows the all-clear reassurance line.",
    preview: "inline",
    states: [
      { id: "populated", label: "Populated" },
      { id: "empty", label: "All clear" },
    ],
    render: ({ stateId }) => (
      <NeedsAttentionPanel data={stateId === "empty" ? NEEDS_ATTENTION_EMPTY : NEEDS_ATTENTION_POPULATED} />
    ),
  },
  {
    id: "notice-file-alerts-strip",
    name: "File alerts strip",
    type: "notification",
    area: "Reminders",
    usedIn: "Reminders page · collapsible file-alerts strip",
    file: "components/reminders/FileAlertsStrip.tsx",
    componentName: "FileAlertsStrip",
    note: "Collapsible strip summarising overdue-exchange / unreachable-solicitor / not-progressing alerts across files. Renders nothing when there are no alerts. Click the header to expand.",
    preview: "inline",
    states: [
      { id: "mixed", label: "Mixed alerts" },
      { id: "single", label: "Single alert" },
    ],
    render: ({ stateId }) => (
      <FileAlertsStrip items={stateId === "single" ? WORK_QUEUE_ITEMS.slice(0, 1) : WORK_QUEUE_ITEMS} />
    ),
  },
  {
    id: "notice-automated-emails-card",
    name: "Automated emails card",
    type: "notification",
    area: "Auto emails",
    usedIn: "Reminders section · per-file automation accordion",
    file: "components/reminders/AutomatedEmailsCard.tsx",
    componentName: "AutomatedEmailsCard",
    note: "Per-file accordion: pending now / sent today (with delivery chips) / upcoming predicted. Click the header to expand. States cover empty, populated, agency-paused, and file-on-hold.",
    preview: "inline",
    states: [
      { id: "populated", label: "Populated" },
      { id: "empty", label: "Empty" },
      { id: "paused", label: "Agency paused" },
      { id: "on-hold", label: "File on hold" },
    ],
    render: ({ stateId }) => {
      if (stateId === "on-hold") {
        return <AutomatedEmailsCard data={AUTO_EMAILS_EMPTY} transactionId={DEMO_TX_ID} fileOnHold />;
      }
      if (stateId === "empty") {
        return <AutomatedEmailsCard data={AUTO_EMAILS_EMPTY} transactionId={DEMO_TX_ID} />;
      }
      const data = stateId === "paused" ? AUTO_EMAILS_PAUSED : AUTO_EMAILS_POPULATED;
      return <AutomatedEmailsCard data={data} transactionId={DEMO_TX_ID} />;
    },
  },

  // ══ Full-page empty states ════════════════════════════════════════════════
  {
    id: "notice-hub-empty-state",
    name: "Hub empty state",
    type: "notification",
    area: "Onboarding & account",
    usedIn: "Hub · agency user with no sales",
    file: "components/agent/HubEmptyState.tsx",
    componentName: "HubEmptyState",
    note: "Full onboarding hero + three 'what happens next' cards + a 'continue setup' card. canCreateSale toggles the primary CTA. Uses the shared demo-explore flow.",
    preview: "inline",
    states: [
      { id: "default", label: "Can create sale" },
      { id: "no-create", label: "Read-only (negotiator)" },
    ],
    render: ({ stateId }) => (
      <HubEmptyState userId="demo-user" canCreateSale={stateId !== "no-create"} />
    ),
  },
  {
    id: "notice-all-files-empty-state",
    name: "All files empty state",
    type: "notification",
    area: "My Files",
    usedIn: "My Files · agency user with no files",
    file: "components/transactions/AllFilesEmptyState.tsx",
    componentName: "AllFilesEmptyState",
    note: "Full onboarding hero + three info cards + a real 'explore demo sale' card.",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => <AllFilesEmptyState />,
  },
  {
    id: "notice-analytics-empty-state",
    name: "Analytics empty state",
    type: "notification",
    area: "Global chrome",
    usedIn: "Analytics · agency user with no files",
    file: "components/analytics/AnalyticsEmptyState.tsx",
    componentName: "AnalyticsEmptyState",
    note: "Analytics onboarding hero + three info cards. The demo-analytics card is behind SHOW_DEMO_ANALYTICS=false, so it stays hidden here (matches production).",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => <AnalyticsEmptyState />,
  },
  {
    id: "notice-todo-empty-state",
    name: "To-do empty state",
    type: "notification",
    area: "To-do",
    usedIn: "To-do · agency user with no tasks",
    file: "components/agent/TodoEmptyState.tsx",
    componentName: "TodoEmptyState",
    note: "Onboarding hero + cards; CTAs reveal the add-task form inline. canUseProgressor adds the third 'send to your progressor' card (2 vs 3 card grid).",
    preview: "inline",
    states: [
      { id: "with-progressor", label: "With progressor" },
      { id: "no-progressor", label: "No progressor" },
    ],
    render: ({ stateId }) => <TodoEmptyState canUseProgressor={stateId === "with-progressor"} />,
  },
  {
    id: "notice-partners-empty-state",
    name: "Partners empty state",
    type: "notification",
    area: "Brokers & partners",
    usedIn: "Partners · director, brand-new agency",
    file: "components/agent/partners/PartnersEmptyState.tsx",
    componentName: "PartnersEmptyState",
    note: "Onboarding hero + three partner cards that fill in as a broker/solicitor is added, plus an add popup. Fixture starts with no partners set.",
    preview: "inline",
    states: [{ id: "default", label: "No partners yet" }],
    render: () => (
      <PartnersEmptyState initialBroker={null} initialRecommended={[]} allFirms={[]} canCreateSale />
    ),
  },
  {
    id: "notice-comms-empty-state",
    name: "Updates empty state",
    type: "notification",
    area: "Updates",
    usedIn: "Updates · agency user with no updates",
    file: "components/agent/CommsEmptyState.tsx",
    componentName: "CommsEmptyState",
    note: "Onboarding hero + three info-only cards (no user action creates an update, so the cards have no CTA until the guides ship).",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => <CommsEmptyState />,
  },
  {
    id: "notice-hub-empty-welcome-card",
    name: "Hub welcome card",
    type: "notification",
    area: "Onboarding & account",
    usedIn: "Hub · compact first-run welcome card",
    file: "components/agent/HubEmptyWelcomeCard.tsx",
    componentName: "HubEmptyWelcomeCard",
    note: "The compact glass welcome card (a lighter alternative to the full HubEmptyState hero).",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => <HubEmptyWelcomeCard />,
  },
];
