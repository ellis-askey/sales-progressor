"use client";

// Live gallery of every agent-app overlay + button, each rendered as the REAL
// component with realistic mock data — so it looks exactly as it does in the
// app. A light/dark toggle flips document.documentElement's data-theme, which
// is what the theme tokens + every portalled overlay (usePortalTheme) key off.
//
// Mock data mirrors app/agent/audit/overlays/page.tsx (the proven set).

import { useEffect, useState } from "react";
import { Info, CheckCircle, Warning, WarningOctagon } from "@phosphor-icons/react";

import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { EditSaleDetailsDrawer } from "@/components/transaction/EditSaleDetailsDrawer";
import { ReconciliationDrawer, type ReconciliationItem } from "@/components/milestones/ReconciliationDrawer";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import { ArchivedRoundDrawer } from "@/components/transaction/ArchivedRoundDrawer";
import { DesignLabDrawer } from "@/components/glass/DesignLabDrawer";
import { GlassPicksProvider } from "@/lib/glass/context";
import { WelcomeModal } from "@/components/agent/WelcomeModal";
import { UndoMilestoneModal } from "@/components/milestones/UndoMilestoneModal";
import { MortgageModal } from "@/components/milestones/MortgageModal";
import { SurveyNrConfirmModal } from "@/components/milestones/SurveyNrConfirmModal";
import { AddFirmModal } from "@/components/solicitors/AddFirmModal";
import { AddBrokerModal } from "@/components/brokers/AddBrokerModal";
import { AutomationStopModal } from "@/components/transaction/AutomationStopModal";
import { DuplicateAddressModal } from "@/components/transactions-v2/DuplicateAddressModal";
import { NavAwayModal } from "@/components/transactions-v2/NavAwayModal";
import { ExchangeCelebration } from "@/components/milestones/ExchangeCelebration";
import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import { MissingFeeRow } from "@/components/analytics/MissingFeeRow";
import { SolicitorPicker, type SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { BrokerPicker, type BrokerSelection } from "@/components/brokers/BrokerPicker";
import { StatusControl } from "@/components/transaction/StatusControl";
import { ChangelogDropdown } from "@/components/layout/ChangelogDropdown";
import { AgentGlobalSearch } from "@/components/layout/AgentGlobalSearch";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { SubmissionOverlay } from "@/components/transactions-v2/SubmissionOverlay";
import { AgentBanner } from "@/components/ui/AgentBanner";
import { Button } from "@/components/ui/Button";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { UndoImpact } from "@/lib/services/milestones";
import type { HealthRaw } from "@/components/transactions/TransactionRowView";

// ─── Mock data (mirrors the audit page's proven set) ────────────────────────
const MOCK_TX_ID = "dev-overlays-00000000";
const MOCK_ADDR = "14 Birchwood Close, Birmingham B15 2TT";
const MOCK_USER_ID = "dev-user-001";
const MOCK_CONTACTS = [
  { id: "c1", name: "Sarah Mitchell", roleType: "vendor_solicitor", email: "s.mitchell@graysonlaw.co.uk", phone: "+447700900111" },
  { id: "c2", name: "James Cooper", roleType: "purchaser_solicitor", email: "j.cooper@cooperlegal.co.uk", phone: "+447700900222" },
  { id: "c3", name: "Emily Thornton", roleType: "vendor", email: "emily@email.com", phone: "+447700900333" },
];
const MOCK_MILESTONES = [
  { chaseTaskId: "ct1", name: "Searches requested", chaseCount: 2 },
  { chaseTaskId: "ct2", name: "Enquiries raised", chaseCount: 1 },
];
const MOCK_UNDO_CASCADE: UndoImpact = {
  cascade: [
    { id: "m1", name: "Searches returned", side: "Vendor", code: "VM04", reconciledAtExchange: false },
    { id: "m2", name: "Enquiries raised", side: "Vendor", code: "VM05", reconciledAtExchange: false },
    { id: "m3", name: "Enquiries answered", side: "Vendor", code: "VM06", reconciledAtExchange: true },
  ],
  currentPercent: 68, targetOnlyPercent: 62, cascadePercent: 51,
};
const MOCK_RECON_ITEMS: ReconciliationItem[] = [
  { id: "r1", name: "Mortgage offer received", side: "Purchaser", code: "PM08", eventDateRequired: false },
  { id: "r2", name: "Survey completed", side: "Purchaser", code: "PM09", eventDateRequired: true },
];
const MOCK_HEALTH_LOW: HealthRaw = {
  pendingOverdueTasks: 0, escalatedTasks: 0, lastActivityAt: new Date(),
  lastActivityType: "milestone", lastActivityLabel: "Searches requested",
  nextChaseLabel: "In 3 days", nextActionLabel: "Chase vendor solicitor",
  nextMilestoneLabel: "Searches returned", daysStuckOnMilestone: null, onTrack: "on_track",
};
const MOCK_HEALTH_HIGH: HealthRaw = {
  pendingOverdueTasks: 3, escalatedTasks: 1, lastActivityAt: new Date(Date.now() - 11 * 86400000),
  lastActivityType: "chase", lastActivityLabel: "Chase sent",
  nextChaseLabel: "4 days overdue", nextActionLabel: "Chase solicitors — urgent",
  nextMilestoneLabel: "Searches returned", daysStuckOnMilestone: 19, onTrack: "off_track",
};
const CHASE_PROPS = {
  chaseTaskId: "ct-dev-001", transactionId: MOCK_TX_ID, propertyAddress: MOCK_ADDR,
  milestoneName: "Searches requested", contacts: MOCK_CONTACTS, milestones: MOCK_MILESTONES,
} as const;
const EDIT_SHARED = {
  transactionId: MOCK_TX_ID, propertyAddress: MOCK_ADDR, tenure: "freehold" as const,
  purchaseType: "mortgage" as const, isShareOfFreehold: false, purchasePrice: 38500000, agentFeeAmount: null,
  agentFeePercent: 1.5, agentFeeIsVatInclusive: false, referralFee: null,
  referredFirmName: null, referredFirmId: null, overridePredictedDate: null,
  predictedExchangeDate: new Date(Date.now() + 56 * 86400000), completionDate: null, exchangeConfirmed: false,
};

// ─── The gallery ────────────────────────────────────────────────────────────

const MOCK_ARCHIVED_ROUNDS = [
  { id: "ar1", roundNumber: 1 },
  { id: "ar2", roundNumber: 2 },
];

type OverlayKey =
  | "chase" | "edit" | "recon" | "chain" | "node" | "archived" | "designLab"
  | "welcome" | "undo" | "mortgage" | "surveyNr" | "addFirm" | "addBroker"
  | "automationStop" | "dupAddr" | "navAway" | "celebrate"
  | "globalSearch" | "submission" | "feedback";

export function OverlaysGallery() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState<OverlayKey | null>(null);
  const [nodeDir] = useState<"above" | "below">("below");
  const [solVal, setSolVal] = useState<SolicitorSelection | null>(null);
  const [brokerVal, setBrokerVal] = useState<BrokerSelection | null>(null);
  const { toast } = useAgentToast();

  // Drive light/dark exactly like the app. The unified system uses data-theme
  // ("light"/"dark") on <html>; some overlays still read the older data-night
  // on .agent-shell-root. Set both so every component flips correctly.
  useEffect(() => {
    const html = document.documentElement;
    const shell = document.querySelector<HTMLElement>(".agent-shell-root");
    const prev = html.dataset.theme;
    html.dataset.theme = dark ? "dark" : "light";
    if (shell) {
      if (dark) shell.setAttribute("data-night", "");
      else shell.removeAttribute("data-night");
    }
    return () => {
      if (prev) html.dataset.theme = prev;
      shell?.removeAttribute("data-night");
    };
  }, [dark]);

  const close = () => setOpen(null);

  return (
    <main style={{ minHeight: "100vh", padding: "0 0 120px" }}>
      {/* Sticky control bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "14px 22px", background: "var(--agent-surface-glass, rgba(255,255,255,.6))",
        backdropFilter: "blur(14px)", borderBottom: "0.5px solid var(--agent-border, rgba(15,23,42,.08))",
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Overlay &amp; button gallery</span>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Every real component, mock data</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-muted)" }}>{dark ? "Dark" : "Light"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label="Toggle dark mode"
            onClick={() => setDark((v) => !v)}
            className="relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors"
            style={{ height: 26, width: 46, background: dark ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)" }}
          >
            <span className="inline-block rounded-full bg-white shadow transition-transform"
              style={{ height: 20, width: 20, marginTop: 3, transform: dark ? "translateX(23px)" : "translateX(3px)" }} />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 22px", display: "flex", flexDirection: "column", gap: 36 }}>
        {/* DRAWERS */}
        <Section n={1} title="Drawers" sub="Right-anchored side panels">
          <Item label="Chase drawer" where="ChaseButton · RemindersSection" onOpen={() => setOpen("chase")} />
          <Item label="Edit sale details" where="File header · Overview" onOpen={() => setOpen("edit")} />
          <Item label="Reconciliation" where="Exchange / completion flow" onOpen={() => setOpen("recon")} />
          <Item label="Chain visualiser" where="ViewChainButton" onOpen={() => setOpen("chain")} />
          <Item label="Add chain node" where="Inside the chain drawer" onOpen={() => setOpen("node")} />
          <Item label="Archived rounds" where="File · after a relist" onOpen={() => setOpen("archived")} />
          <Item label="Design lab (glass picker)" where="Top bar · Ellis only" onOpen={() => setOpen("designLab")} />
        </Section>

        {/* MODALS */}
        <Section n={2} title="Modals" sub="Centred dialogs">
          <Item label="Undo milestone (cascade)" where="MilestoneRow · undo" onOpen={() => setOpen("undo")} />
          <Item label="Mortgage choice" where="Mortgage milestone" onOpen={() => setOpen("mortgage")} />
          <Item label="Survey N/R confirm" where="Survey milestone" onOpen={() => setOpen("surveyNr")} />
          <Item label="Add solicitor firm" where="SolicitorPicker" onOpen={() => setOpen("addFirm")} />
          <Item label="Add broker" where="BrokerPicker" onOpen={() => setOpen("addBroker")} />
          <Item label="Stop automation" where="AutomationControls" onOpen={() => setOpen("automationStop")} />
          <Item label="Duplicate address" where="New sale flow" onOpen={() => setOpen("dupAddr")} />
          <Item label="Unsaved changes" where="New sale form nav-away" onOpen={() => setOpen("navAway")} />
          <Item label="Welcome (first run)" where="First agent login" onOpen={() => setOpen("welcome")} />
        </Section>

        {/* TOASTS */}
        <Section n={3} title="Toasts" sub="Bottom-right transient notifications">
          <Item label="Success" where="e.g. 'Sale saved'" onOpen={() => toast.success("Sale saved", { description: "14 Birchwood Close is now active." })} />
          <Item label="Info" where="e.g. 'Chase queued'" onOpen={() => toast.info("Chase queued", { description: "Sarah Mitchell will be emailed at 9am." })} />
          <Item label="Warning" where="e.g. 'Overdue'" onOpen={() => toast.warning("File overdue", { description: "No activity for 11 days." })} />
          <Item label="Error + action" where="e.g. 'Failed — Undo'" onOpen={() => toast.error("Couldn't send chase", { action: { label: "Retry", onClick: () => toast.info("Retrying…") } })} />
          <Item label="Persistent (no auto-dismiss)" where="duration: 0" onOpen={() => toast.warning("Exchange blocked", { description: "Resolve outstanding enquiries first.", duration: 0 })} />
        </Section>

        {/* POPOVERS + PICKERS */}
        <Section n={4} title="Popovers & pickers" sub="Hover cards + portal dropdowns">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={inlineLabel}>Risk badge (hover / click)</span>
              <div style={{ display: "flex", gap: 10 }}>
                <RiskBadgeWithPopover raw={MOCK_HEALTH_LOW} />
                <RiskBadgeWithPopover raw={MOCK_HEALTH_HIGH} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            <span style={inlineLabel}>Missing-fee row popover</span>
            <MissingFeeRow id="mf-dev-001" propertyAddress={MOCK_ADDR} ownerLine="Sarah Mitchell" awaitingAssignment={false} txBasePath={`/agent/transactions/${MOCK_TX_ID}`} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 8, maxWidth: 620 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={inlineLabel}>Solicitor picker</span>
              <SolicitorPicker label="Solicitor" value={solVal} onChange={setSolVal} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={inlineLabel}>Broker picker</span>
              <BrokerPicker label="Broker" value={brokerVal} onChange={setBrokerVal} preferredBroker={null} />
            </div>
          </div>
        </Section>

        {/* DROPDOWNS */}
        <Section n={5} title="Dropdown menus" sub="Portal / fixed-position menus">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={inlineLabel}>Status control</span>
              <StatusControl transactionId={MOCK_TX_ID} currentStatus="active" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={inlineLabel}>Changelog</span>
              <ChangelogDropdown />
            </div>
          </div>
        </Section>

        {/* FULL-SCREEN */}
        <Section n={6} title="Full-screen & floating" sub="Search, loading, celebration, feedback">
          <Item label="Global search (⌘K)" where="Top bar · always mounted" onOpen={() => setOpen("globalSearch")} />
          <Item label="Submission overlay" where="Submitting a new sale" onOpen={() => { setOpen("submission"); setTimeout(() => setOpen((k) => (k === "submission" ? null : k)), 3500); }} />
          <Item label="Exchange celebration" where="On exchange" onOpen={() => setOpen("celebrate")} />
          <Item label="Feedback widget" where="Floating pill, bottom-right" onOpen={() => setOpen("feedback")} />
        </Section>

        {/* BANNERS */}
        <Section n={7} title="Inline banners" sub="AgentBanner — kinds info / warning / danger / success">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
            <AgentBanner kind="info" icon={<Info size={18} weight="fill" />} title="On hold" body="This file is paused. Automated chasing is off until you reactivate it." />
            <AgentBanner kind="success" icon={<CheckCircle size={18} weight="fill" />} title="Reminders ready" body="We've generated the reminder schedule for this file." />
            <AgentBanner kind="warning" icon={<Warning size={18} weight="fill" />} title="Fee not set" body="Add an agent fee so this sale counts toward your pipeline value." />
            <AgentBanner kind="danger" icon={<WarningOctagon size={18} weight="fill" />} title="Chain setup failed" body="We couldn't link the onward purchase. Try again or set it manually." />
          </div>
        </Section>

        {/* BUTTONS */}
        <Section n={8} title="Buttons" sub="Every style used across the app, with where each lives">
          <ButtonsShowcase />
        </Section>
      </div>

      {/* ─── Overlay mounts (real components, mock data) ─── */}
      {open === "chase" && <ChaseDrawer {...CHASE_PROPS} chaseCount={2} onClose={close} onSent={close} />}
      {open === "edit" && <EditSaleDetailsDrawer {...EDIT_SHARED} onClose={close} />}
      {open === "recon" && <ReconciliationDrawer isExchangeFlow outstanding={MOCK_RECON_ITEMS} initialEventDate={new Date().toISOString().split("T")[0]} onConfirm={close} onCancel={close} />}
      {open === "chain" && <ChainDrawer transactionId={MOCK_TX_ID} currentUserId={MOCK_USER_ID} onClose={close} onOpenAddNode={() => setOpen("node")} />}
      {open === "node" && <AddNodeDrawer direction={nodeDir} onClose={close} onSaved={close} />}
      {open === "archived" && <ArchivedRoundDrawer open transactionId={MOCK_TX_ID} archivedRounds={MOCK_ARCHIVED_ROUNDS} onClose={close} />}
      {open === "designLab" && <GlassPicksProvider initialPicks={{}}><DesignLabDrawer open onClose={close} /></GlassPicksProvider>}
      {open === "welcome" && <WelcomeModal />}
      {open === "undo" && <UndoMilestoneModal milestoneName="Searches requested" milestoneId="m-dev-001" undoData={MOCK_UNDO_CASCADE} isPending={false} onConfirm={close} onCancel={close} />}
      {open === "mortgage" && <MortgageModal onConfirmMortgage={close} onConfirmReinstate={close} onCancel={close} />}
      {open === "surveyNr" && <SurveyNrConfirmModal onConfirm={close} onCancel={close} />}
      {open === "addFirm" && <AddFirmModal prefillName="" onClose={close} onCreated={close} />}
      {open === "addBroker" && <AddBrokerModal prefillName="" onClose={close} onCreated={close} />}
      {open === "automationStop" && <AutomationStopModal onPick={close} onClose={close} isPending={false} />}
      {open === "dupAddr" && <DuplicateAddressModal address={MOCK_ADDR} duplicateId="dup-001" assignedTo={null} onClose={close} onForceCreate={close} />}
      {open === "navAway" && <NavAwayModal isSaving={false} onDiscard={close} onStay={close} onSave={async () => close()} />}
      {open === "celebrate" && <ExchangeCelebration address={MOCK_ADDR} onDismiss={close} />}
      {open === "feedback" && <FeedbackWidget checklistAware={false} userId={MOCK_USER_ID} />}
      <AgentGlobalSearch />
      <SubmissionOverlay isVisible={open === "submission"} />
    </main>
  );
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

const inlineLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--agent-text-muted)",
};

function Section({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "0.5px solid var(--agent-border, rgba(15,23,42,.08))", borderRadius: 16, overflow: "hidden", background: "var(--agent-surface-elevated, rgba(255,255,255,.5))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "0.5px solid var(--agent-border, rgba(15,23,42,.08))" }}>
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--agent-coral, #ff6b4a)", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)", marginLeft: "auto" }}>{sub}</span>
      </div>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}

function Item({ label, where, onOpen }: { label: string; where: string; onOpen: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button type="button" onClick={onOpen} className="agent-btn agent-btn-sm agent-btn-primary" style={{ flexShrink: 0 }}>
        Show
      </button>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{where}</span>
      </div>
    </div>
  );
}

// ─── Buttons showcase ───────────────────────────────────────────────────────

function ButtonsShowcase() {
  const variants = ["primary", "secondary", "ghost", "danger"] as const;
  const sizes = ["xs", "sm", "md", "lg"] as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={inlineLabel}>Button primitive — variant × size (components/ui/Button.tsx)</p>
        <p style={btnWhere}>Used in MilestoneRow, RemindersSection, AddManualTaskForm</p>
        <table style={{ borderCollapse: "separate", borderSpacing: "12px 12px" }}>
          <tbody>
            {variants.map((v) => (
              <tr key={v}>
                <td style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "capitalize" }}>{v}</td>
                {sizes.map((s) => (
                  <td key={s}><Button variant={v} size={s}>{s}</Button></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="secondary" disabled>Disabled</Button>
        </div>
      </div>

      <div>
        <p style={inlineLabel}>Raw agent-btn classes (agent-system.css)</p>
        <p style={btnWhere}>The class system the primitive wraps — used across ~80 files</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <RawBtn cls="agent-btn agent-btn-sm agent-btn-primary" label="primary" where="AddFirmModal, MortgageModal" />
          <RawBtn cls="agent-btn agent-btn-sm agent-btn-secondary" label="secondary" where="UndoMilestoneModal, NavAwayModal" />
          <RawBtn cls="agent-btn agent-btn-sm agent-btn-ghost" label="ghost" where="ChaseDrawer, EditSaleDetailsDrawer" />
          <RawBtn cls="agent-btn agent-btn-sm agent-btn-danger" label="danger" where="AccountDangerZone, SurveyNrConfirmModal" />
          <RawBtn cls="agent-btn agent-btn-sm agent-btn-ghost-bordered" label="ghost-bordered" where="SolicitorSection" />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <span style={btnWhere}>Sizes:</span>
          <button className="agent-btn agent-btn-xs agent-btn-primary">xs</button>
          <button className="agent-btn agent-btn-sm agent-btn-primary">sm</button>
          <button className="agent-btn agent-btn-md agent-btn-primary">md</button>
          <button className="agent-btn agent-btn-lg agent-btn-primary">lg</button>
        </div>
      </div>

      <div>
        <p style={inlineLabel}>Link buttons &amp; icon buttons</p>
        <p style={btnWhere}>agent-link (EmailPreviewModal, TransactionNotes) · agent-icon-btn (dismiss)</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <button className="agent-link">Edit</button>
          <button className="agent-link agent-link-muted">View all</button>
          <button className="agent-icon-btn agent-icon-btn-md" aria-label="Close">✕</button>
          <button className="agent-icon-btn agent-icon-btn-sm" aria-label="Close">✕</button>
        </div>
      </div>

      <div>
        <p style={inlineLabel}>Segment / toggle pills</p>
        <p style={btnWhere}>agent-segment-pill — tenure / purchase-type / mode pickers</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="agent-segment-pill on">Freehold</button>
          <button className="agent-segment-pill">Leasehold</button>
          <span style={{ width: 12 }} />
          <button className="agent-segment-pill agent-segment-pill-sm on">Mortgage</button>
          <button className="agent-segment-pill agent-segment-pill-sm">Cash</button>
        </div>
      </div>
    </div>
  );
}

const btnWhere: React.CSSProperties = { fontSize: 11.5, color: "var(--agent-text-muted)", margin: "2px 0 10px", fontStyle: "italic" };

function RawBtn({ cls, label, where }: { cls: string; label: string; where: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button className={cls}>{label}</button>
      <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>{where}</span>
    </span>
  );
}
