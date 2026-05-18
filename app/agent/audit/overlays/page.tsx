"use client";

import { useState, useEffect, useCallback } from "react";

// ── Section 1: Drawers ────────────────────────────────────────────────────────
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { EditSaleDetailsDrawer } from "@/components/transaction/EditSaleDetailsDrawer";
import { ReconciliationDrawer, type ReconciliationItem } from "@/components/milestones/ReconciliationDrawer";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";

// ── Section 2: Modals ─────────────────────────────────────────────────────────
import { WelcomeModal } from "@/components/agent/WelcomeModal";
import { UndoMilestoneModal } from "@/components/milestones/UndoMilestoneModal";
import { MortgageModal } from "@/components/milestones/MortgageModal";
import { SurveyNrConfirmModal } from "@/components/milestones/SurveyNrConfirmModal";
import { AddFirmModal } from "@/components/solicitors/AddFirmModal";
import { AddBrokerModal } from "@/components/brokers/AddBrokerModal";
import { DuplicateAddressModal } from "@/components/transactions-v2/DuplicateAddressModal";
import { NavAwayModal } from "@/components/transactions-v2/NavAwayModal";
import { StatusControl } from "@/components/transaction/StatusControl";
import { AccountDangerZone } from "@/components/agent/AccountDangerZone";
import { ExchangeCelebration } from "@/components/milestones/ExchangeCelebration";

// ── Section 3: Popovers ───────────────────────────────────────────────────────
import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import { MissingFeeRow } from "@/components/analytics/MissingFeeRow";

// ── Section 4: Dropdowns ──────────────────────────────────────────────────────
import { SolicitorPicker } from "@/components/solicitors/SolicitorPicker";
import { BrokerPicker } from "@/components/brokers/BrokerPicker";

// ── Section 5: Toasts ─────────────────────────────────────────────────────────
import { useAgentToast } from "@/components/agent/AgentToaster";
import { ToastProvider, useToast } from "@/components/ui/ToastContext";

// ── Section 6–9 ───────────────────────────────────────────────────────────────
import { AgentGlobalSearch } from "@/components/layout/AgentGlobalSearch";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { SubmissionOverlay } from "@/components/transactions-v2/SubmissionOverlay";
import { ChangelogDropdown } from "@/components/layout/ChangelogDropdown";
import type { UndoImpact } from "@/lib/services/milestones";
import type { HealthRaw } from "@/components/transactions/TransactionRowView";
import type { SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import type { BrokerSelection } from "@/components/brokers/BrokerPicker";

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TX_ID = "audit-demo-00000000";
const MOCK_ADDR = "14 Birchwood Close, Birmingham B15 2TT";
const MOCK_USER_ID = "audit-user-001";

const MOCK_CONTACTS = [
  { id: "c1", name: "Sarah Mitchell", roleType: "vendor_solicitor", email: "s.mitchell@graysonlaw.co.uk", phone: "+447700900111" },
  { id: "c2", name: "James Cooper", roleType: "purchaser_solicitor", email: "j.cooper@cooperlegal.co.uk", phone: "+447700900222" },
  { id: "c3", name: "Emily Thornton", roleType: "vendor", email: "emily@email.com", phone: "+447700900333" },
];

const MOCK_MILESTONES = [
  { chaseTaskId: "ct1", name: "Searches requested", chaseCount: 2 },
  { chaseTaskId: "ct2", name: "Enquiries raised", chaseCount: 1 },
];

const MOCK_UNDO_NO_CASCADE: UndoImpact = {
  cascade: [],
  currentPercent: 42,
  targetOnlyPercent: 38,
  cascadePercent: 38,
};

const MOCK_UNDO_CASCADE: UndoImpact = {
  cascade: [
    { id: "m1", name: "Searches returned", side: "Vendor", code: "VM04", reconciledAtExchange: false },
    { id: "m2", name: "Enquiries raised", side: "Vendor", code: "VM05", reconciledAtExchange: false },
    { id: "m3", name: "Enquiries answered", side: "Vendor", code: "VM06", reconciledAtExchange: true },
  ],
  currentPercent: 68,
  targetOnlyPercent: 62,
  cascadePercent: 51,
};

const MOCK_RECONCILIATION_ITEMS: ReconciliationItem[] = [
  { id: "r1", name: "Mortgage offer received", side: "Purchaser", code: "PM08", eventDateRequired: false },
  { id: "r2", name: "Survey completed", side: "Purchaser", code: "PM09", eventDateRequired: true },
];

const MOCK_HEALTH_LOW: HealthRaw = {
  pendingOverdueTasks: 0,
  escalatedTasks: 0,
  lastActivityAt: new Date(),
  lastActivityType: "milestone",
  lastActivityLabel: "Searches requested",
  nextChaseLabel: "In 3 days",
  nextActionLabel: "Chase vendor solicitor",
  nextMilestoneLabel: "Searches returned",
  daysStuckOnMilestone: null,
  onTrack: "on_track",
};

const MOCK_HEALTH_HIGH: HealthRaw = {
  pendingOverdueTasks: 3,
  escalatedTasks: 1,
  lastActivityAt: new Date(Date.now() - 11 * 86400000),
  lastActivityType: "chase",
  lastActivityLabel: "Chase sent",
  nextChaseLabel: "4 days overdue",
  nextActionLabel: "Chase solicitors — urgent",
  nextMilestoneLabel: "Searches returned",
  daysStuckOnMilestone: 19,
  onTrack: "off_track",
};

const MOCK_SOLICITOR_VALUE: SolicitorSelection = {
  firmId: "sf1",
  firmName: "Grayson Law LLP",
  contactId: "sc1",
  contactName: "Sarah Mitchell",
  phone: "+447700900111",
  email: "s.mitchell@graysonlaw.co.uk",
};

const MOCK_BROKER_VALUE: BrokerSelection = {
  firmId: "bf1",
  firmName: "Premier Mortgages Ltd",
  contactId: "bc1",
  contactName: "Daniel Webb",
  phone: "+447700900444",
  email: "d.webb@premiermortgages.co.uk",
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
  .oa-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 16px; border-bottom: 1px solid rgba(0,0,0,0.06); background: rgba(255,255,255,0.55); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 10; }
  .oa-pill { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid rgba(0,0,0,0.10); background: rgba(255,255,255,0.6); color: rgba(15,23,42,0.55); transition: all 120ms; }
  .oa-pill.on { background: rgba(15,23,42,0.85); color: #fff; border-color: transparent; }
  .oa-pill:hover:not(.on) { background: rgba(255,255,255,0.9); color: rgba(15,23,42,0.80); }
  .oa-sep { width: 1px; height: 20px; background: rgba(0,0,0,0.08); margin: 0 4px; }
  .oa-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(15,23,42,0.30); margin-right: 2px; }
  .oa-content { padding: 24px 20px; display: flex; flex-direction: column; gap: 32px; max-width: 1100px; margin: 0 auto; }
  .oa-section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(15,23,42,0.30); margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,0,0,0.06); }
  .oa-section { display: flex; flex-direction: column; gap: 12px; }
  .oa-card { background: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.60); border-radius: 16px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
  .oa-card-hdr { padding: 12px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; border-bottom: 1px solid rgba(0,0,0,0.06); }
  .oa-card-name { font-size: 13px; font-weight: 700; color: rgba(15,23,42,0.85); display: block; margin-bottom: 2px; }
  .oa-card-file { font-size: 11px; color: rgba(15,23,42,0.35); font-family: monospace; }
  .oa-card-pages { font-size: 11px; color: rgba(15,23,42,0.35); text-align: right; flex-shrink: 0; max-width: 220px; }
  .oa-card-body { padding: 12px 16px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .oa-card-note { padding: 0 16px 10px; font-size: 11.5px; color: rgba(15,23,42,0.40); line-height: 1.5; margin: 0; }
  .oa-state-btn { padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1.5px solid rgba(0,0,0,0.10); background: transparent; color: rgba(15,23,42,0.45); transition: all 100ms; }
  .oa-state-btn.on { background: rgba(var(--agent-coral-base-rgb),0.10); border-color: rgba(var(--agent-coral-base-rgb),0.30); color: var(--agent-coral); }
  .oa-trigger { padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; background: var(--agent-coral); color: #fff; border: none; transition: opacity 100ms; }
  .oa-trigger:hover { opacity: 0.85; }
  .oa-trigger.ghost { background: transparent; border: 1.5px solid rgba(0,0,0,0.12); color: rgba(15,23,42,0.60); }
  .oa-trigger.ghost:hover { background: rgba(0,0,0,0.04); }
  .oa-note-pill { font-size: 11px; color: rgba(15,23,42,0.35); font-style: italic; }
  .oa-toast-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; padding: 12px 16px; }
  [data-rm="1"] *, [data-rm="1"] *::before, [data-rm="1"] *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Card wrapper
// ─────────────────────────────────────────────────────────────────────────────

function OCard({
  name,
  file,
  pages,
  note,
  children,
}: {
  name: string;
  file: string;
  pages: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="oa-card">
      <div className="oa-card-hdr">
        <div>
          <span className="oa-card-name">{name}</span>
          <span className="oa-card-file">{file}</span>
        </div>
        <span className="oa-card-pages">{pages}</span>
      </div>
      {note && <p className="oa-card-note">{note}</p>}
      {children}
    </div>
  );
}

function StateBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`oa-state-btn${active ? " on" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — Drawers
// ─────────────────────────────────────────────────────────────────────────────

function DrawersSection() {
  // Chase Drawer
  const [chaseOpen, setChaseOpen] = useState(false);
  const [chaseCount, setChaseCount] = useState(1);

  // Edit Sale Details Drawer
  const [editOpen, setEditOpen] = useState(false);

  // Reconciliation Drawer
  const [reconOpen, setReconOpen] = useState(false);
  const [reconExchange, setReconExchange] = useState(true);
  const [reconItems, setReconItems] = useState(false);

  // Chain Drawer
  const [chainOpen, setChainOpen] = useState(false);

  // Add Node Drawer
  const [nodeOpen, setNodeOpen] = useState(false);
  const [nodeDir, setNodeDir] = useState<"above" | "below">("below");

  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 1 — Drawers</p>

      {/* ChaseDrawer */}
      <OCard
        name="ChaseDrawer"
        file="components/chase/ChaseDrawer.tsx"
        pages="/agent/transactions/[id]"
        note="Channel toggle (Email / WhatsApp), tone selector nested, AI generation loading → generated → error paths, CC solicitor toggle, multi-milestone mode. Mock data shows 3 contacts and 2 milestones."
      >
        <div className="oa-card-body">
          <span className="oa-label">chase count</span>
          {[1, 3, 6].map((n) => (
            <StateBtn key={n} label={`×${n}`} active={chaseCount === n} onClick={() => setChaseCount(n)} />
          ))}
          <span className="oa-sep" />
          <button type="button" className="oa-trigger" onClick={() => setChaseOpen(true)}>Open drawer</button>
        </div>
        {chaseOpen && (
          <ChaseDrawer
            chaseTaskId="ct-audit-001"
            transactionId={MOCK_TX_ID}
            propertyAddress={MOCK_ADDR}
            milestoneName="Searches requested"
            chaseCount={chaseCount}
            contacts={MOCK_CONTACTS}
            milestones={MOCK_MILESTONES}
            onClose={() => setChaseOpen(false)}
            onSent={() => setChaseOpen(false)}
          />
        )}
      </OCard>

      {/* EditSaleDetailsDrawer */}
      <OCard
        name="EditSaleDetailsDrawer"
        file="components/transaction/EditSaleDetailsDrawer.tsx"
        pages="/agent/transactions/[id]"
        note="Three independently-saving sections: Property, Price & Fees, Timeline. Dirty-section chips appear when unsaved. Nested UnsavedChangesModal (close with unsaved data) and AddressConsequencesModal (change address) accessible via drawer interactions. Save actions will fail silently (mock transaction ID)."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setEditOpen(true)}>Open drawer</button>
        </div>
        {editOpen && (
          <EditSaleDetailsDrawer
            transactionId={MOCK_TX_ID}
            propertyAddress={MOCK_ADDR}
            tenure="freehold"
            purchaseType="mortgage"
            purchasePrice={38500000}
            agentFeeAmount={null}
            agentFeePercent={1.5}
            agentFeeIsVatInclusive={false}
            referralFee={null}
            referredFirmName={null}
            referredFirmId={null}
            overridePredictedDate={null}
            predictedExchangeDate={new Date(Date.now() + 56 * 86400000)}
            completionDate={null}
            exchangeConfirmed={false}
            isTopmost
            onClose={() => setEditOpen(false)}
          />
        )}
      </OCard>

      {/* ReconciliationDrawer */}
      <OCard
        name="ReconciliationDrawer"
        file="components/milestones/ReconciliationDrawer.tsx"
        pages="/agent/transactions/[id] (via MilestoneRow)"
        note="Exchange flow: event date field required. Completion flow: completion date field added. Toggle outstanding items to see unchecked list with per-item event date inputs. Non-dismissible backdrop."
      >
        <div className="oa-card-body">
          <span className="oa-label">flow</span>
          <StateBtn label="Exchange" active={reconExchange} onClick={() => setReconExchange(true)} />
          <StateBtn label="Completion" active={!reconExchange} onClick={() => setReconExchange(false)} />
          <span className="oa-sep" />
          <span className="oa-label">outstanding</span>
          <StateBtn label="none" active={!reconItems} onClick={() => setReconItems(false)} />
          <StateBtn label="2 items" active={reconItems} onClick={() => setReconItems(true)} />
          <span className="oa-sep" />
          <button type="button" className="oa-trigger" onClick={() => setReconOpen(true)}>Open drawer</button>
        </div>
        {reconOpen && (
          <ReconciliationDrawer
            isExchangeFlow={reconExchange}
            outstanding={reconItems ? MOCK_RECONCILIATION_ITEMS : []}
            initialEventDate={new Date().toISOString().split("T")[0]}
            onConfirm={() => setReconOpen(false)}
            onCancel={() => setReconOpen(false)}
          />
        )}
      </OCard>

      {/* ChainDrawer */}
      <OCard
        name="ChainDrawer"
        file="components/chain/ChainDrawer.tsx"
        pages="/agent/transactions/[id]"
        note="Fetches /api/chains internally on open. With mock transaction ID, will show loading → empty state. In production, shows chain visualisation with LinkCard nodes, bulk-invite footer, inline delete confirmation. Uses legacy ToastContext."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setChainOpen(true)}>Open drawer</button>
          <span className="oa-note-pill">Will show loading → empty state (mock ID)</span>
        </div>
        {chainOpen && (
          <ChainDrawer
            transactionId={MOCK_TX_ID}
            currentUserId={MOCK_USER_ID}
            onClose={() => setChainOpen(false)}
            onOpenAddNode={(dir) => { setNodeDir(dir); setNodeOpen(true); }}
          />
        )}
      </OCard>

      {/* AddNodeDrawer */}
      <OCard
        name="AddNodeDrawer"
        file="components/chain/AddNodeDrawer.tsx"
        pages="/agent/transactions/[id] (via ChainDrawer)"
        note="Add or edit a chain node. Direction toggle simulates opening from above or below the current file. Form shows field-level validation when submitted empty. Save will fail (mock chain ID)."
      >
        <div className="oa-card-body">
          <span className="oa-label">direction</span>
          <StateBtn label="above" active={nodeDir === "above"} onClick={() => setNodeDir("above")} />
          <StateBtn label="below" active={nodeDir === "below"} onClick={() => setNodeDir("below")} />
          <span className="oa-sep" />
          <button type="button" className="oa-trigger" onClick={() => setNodeOpen(true)}>Open drawer</button>
        </div>
        {nodeOpen && (
          <AddNodeDrawer
            direction={nodeDir}
            onClose={() => setNodeOpen(false)}
            onSaved={() => setNodeOpen(false)}
          />
        )}
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — Modals / Dialogs
// ─────────────────────────────────────────────────────────────────────────────

function ModalsSection() {
  const [welcome, setWelcome]       = useState(false);
  const [undoOpen, setUndoOpen]     = useState(false);
  const [undoCascade, setUndoCascade] = useState(false);
  const [mortgage, setMortgage]     = useState(false);
  const [surveyNr, setSurveyNr]     = useState(false);
  const [addFirm, setAddFirm]       = useState(false);
  const [addBroker, setAddBroker]   = useState(false);
  const [dupAddr, setDupAddr]       = useState(false);
  const [navAway, setNavAway]       = useState(false);
  const [navSaving, setNavSaving]   = useState(false);
  const [status, setStatus]         = useState(false);
  const [danger, setDanger]         = useState(false);
  const [celebrate, setCelebrate]   = useState(false);

  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 2 — Modals / Dialogs</p>

      {/* WelcomeModal */}
      <OCard
        name="WelcomeModal"
        file="components/agent/WelcomeModal.tsx"
        pages="/agent (first login)"
        note="Shown once per session after first login. Two states: welcome card and tour slides. Portal-rendered."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setWelcome(true)}>Open</button>
        </div>
        {welcome && <WelcomeModal name="Ellis" />}
      </OCard>

      {/* UndoMilestoneModal */}
      <OCard
        name="UndoMilestoneModal"
        file="components/milestones/UndoMilestoneModal.tsx"
        pages="/agent/transactions/[id] (via MilestoneRow)"
        note="Orange warning accent. Toggle cascade to see radio-selection mode with downstream impact visualisation and expandable step list."
      >
        <div className="oa-card-body">
          <span className="oa-label">cascade</span>
          <StateBtn label="none" active={!undoCascade} onClick={() => setUndoCascade(false)} />
          <StateBtn label="3 steps" active={undoCascade} onClick={() => setUndoCascade(true)} />
          <span className="oa-sep" />
          <button type="button" className="oa-trigger" onClick={() => setUndoOpen(true)}>Open</button>
        </div>
        {undoOpen && (
          <UndoMilestoneModal
            milestoneName="Searches requested"
            milestoneId="m-audit-001"
            undoData={undoCascade ? MOCK_UNDO_CASCADE : MOCK_UNDO_NO_CASCADE}
            isPending={false}
            onConfirm={() => setUndoOpen(false)}
            onCancel={() => setUndoOpen(false)}
          />
        )}
      </OCard>

      {/* MortgageModal */}
      <OCard
        name="MortgageModal"
        file="components/milestones/MortgageModal.tsx"
        pages="/agent/transactions/[id] (mortgage type change)"
        note="3-option confirmation: Yes mortgage / Reinstate without change / Cancel. Non-dismissible backdrop."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setMortgage(true)}>Open</button>
        </div>
        {mortgage && (
          <MortgageModal
            onConfirmMortgage={() => setMortgage(false)}
            onConfirmReinstate={() => setMortgage(false)}
            onCancel={() => setMortgage(false)}
          />
        )}
      </OCard>

      {/* SurveyNrConfirmModal */}
      <OCard
        name="SurveyNrConfirmModal"
        file="components/milestones/SurveyNrConfirmModal.tsx"
        pages="/agent/transactions/[id] (PM9 N/R only)"
        note="Simple 2-button confirmation for skipping survey milestone. Non-dismissible."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setSurveyNr(true)}>Open</button>
        </div>
        {surveyNr && (
          <SurveyNrConfirmModal
            onConfirm={() => setSurveyNr(false)}
            onCancel={() => setSurveyNr(false)}
          />
        )}
      </OCard>

      {/* AddFirmModal */}
      <OCard
        name="AddFirmModal"
        file="components/solicitors/AddFirmModal.tsx"
        pages="New sale form (via SolicitorPicker)"
        note="Quick solicitor firm + handler creation. Field-level validation on submit. Server call will fail with mock data."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setAddFirm(true)}>Open</button>
        </div>
        {addFirm && (
          <AddFirmModal
            prefillName=""
            onClose={() => setAddFirm(false)}
            onCreated={() => setAddFirm(false)}
          />
        )}
      </OCard>

      {/* AddBrokerModal */}
      <OCard
        name="AddBrokerModal"
        file="components/brokers/AddBrokerModal.tsx"
        pages="New sale form (via BrokerPicker)"
        note="Same structure as AddFirmModal but for mortgage brokers. Handler is optional."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setAddBroker(true)}>Open</button>
        </div>
        {addBroker && (
          <AddBrokerModal
            prefillName=""
            onClose={() => setAddBroker(false)}
            onCreated={() => setAddBroker(false)}
          />
        )}
      </OCard>

      {/* DuplicateAddressModal */}
      <OCard
        name="DuplicateAddressModal"
        file="components/transactions-v2/DuplicateAddressModal.tsx"
        pages="New sale flow (address already exists)"
        note="z-index 2000. Actions: View existing file (link) / Create anyway / Cancel. Uses nv2 surface tokens."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setDupAddr(true)}>Open</button>
        </div>
        {dupAddr && (
          <DuplicateAddressModal
            address={MOCK_ADDR}
            duplicateId="existing-tx-001"
            assignedTo="Sarah Mitchell"
            onClose={() => setDupAddr(false)}
            onForceCreate={() => setDupAddr(false)}
          />
        )}
      </OCard>

      {/* NavAwayModal */}
      <OCard
        name="NavAwayModal"
        file="components/transactions-v2/NavAwayModal.tsx"
        pages="New sale flow (unsaved changes on navigation)"
        note="Yellow accent. Three actions: Discard changes / Stay here / Save draft. Toggle saving state."
      >
        <div className="oa-card-body">
          <span className="oa-label">state</span>
          <StateBtn label="idle" active={!navSaving} onClick={() => setNavSaving(false)} />
          <StateBtn label="saving" active={navSaving} onClick={() => setNavSaving(true)} />
          <span className="oa-sep" />
          <button type="button" className="oa-trigger" onClick={() => setNavAway(true)}>Open</button>
        </div>
        {navAway && (
          <NavAwayModal
            isSaving={navSaving}
            onDiscard={() => setNavAway(false)}
            onStay={() => setNavAway(false)}
            onSave={() => setNavAway(false)}
          />
        )}
      </OCard>

      {/* StatusControl + WithdrawalReasonModal */}
      <OCard
        name="StatusControl + WithdrawalReasonModal"
        file="components/transaction/StatusControl.tsx"
        pages="/agent/transactions/[id]"
        note="Click the status badge to open the dropdown (4 options). Select 'Withdrawn' to trigger the WithdrawalReasonModal inline — 10 predefined reasons + Other with custom text input. Status change server action will fail (mock ID)."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger ghost" onClick={() => setStatus((v) => !v)}>
            {status ? "Hide" : "Render StatusControl"}
          </button>
        </div>
        {status && (
          <div style={{ padding: "0 16px 14px" }}>
            <StatusControl transactionId={MOCK_TX_ID} currentStatus="active" />
          </div>
        )}
      </OCard>

      {/* AccountDangerZone */}
      <OCard
        name="AccountDangerZone (inline danger modal)"
        file="components/agent/AccountDangerZone.tsx"
        pages="/agent/settings"
        note="Red danger styling. Email confirmation gate before account delete. Fixed positioning (no portal). Export data action also present. Delete/export server calls will fail (mock user)."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger ghost" onClick={() => setDanger((v) => !v)}>
            {danger ? "Hide" : "Render AccountDangerZone"}
          </button>
        </div>
        {danger && (
          <div style={{ padding: "0 16px 14px" }}>
            <AccountDangerZone userEmail="audit@example.com" />
          </div>
        )}
      </OCard>

      {/* ExchangeCelebration */}
      <OCard
        name="ExchangeCelebration"
        file="components/milestones/ExchangeCelebration.tsx"
        pages="/agent/transactions/[id] (post-exchange)"
        note="Full-screen canvas confetti. Tap anywhere to dismiss. z-index 200. Respects prefers-reduced-motion (reduced-motion toggle suppresses confetti animation)."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setCelebrate(true)}>Open</button>
        </div>
        {celebrate && (
          <ExchangeCelebration
            address={MOCK_ADDR}
            onDismiss={() => setCelebrate(false)}
          />
        )}
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Popovers / Pickers
// ─────────────────────────────────────────────────────────────────────────────

function PopoversSection() {
  const [riskVariant, setRiskVariant] = useState<"low" | "high">("low");
  const [feeRendered, setFeeRendered] = useState(false);

  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 3 — Popovers / Pickers</p>

      {/* RiskBadgeWithPopover */}
      <OCard
        name="RiskBadgeWithPopover"
        file="components/transactions/RiskBadgeWithPopover.tsx"
        pages="/agent/transactions (list rows)"
        note="Hover or click the badge to open. Dynamic positioning (above/below). Hover-delayed close. Scroll to dismiss. Switch between low-risk and high-risk data to see badge colour and popover contents change."
      >
        <div className="oa-card-body">
          <span className="oa-label">risk data</span>
          <StateBtn label="low risk" active={riskVariant === "low"} onClick={() => setRiskVariant("low")} />
          <StateBtn label="high risk" active={riskVariant === "high"} onClick={() => setRiskVariant("high")} />
          <span className="oa-sep" />
          <span className="oa-note-pill">hover badge to open popover</span>
          <div style={{ marginLeft: "auto" }}>
            <RiskBadgeWithPopover raw={riskVariant === "low" ? MOCK_HEALTH_LOW : MOCK_HEALTH_HIGH} />
          </div>
        </div>
      </OCard>

      {/* MissingFeeRow — desktop popover + mobile sheet */}
      <OCard
        name="MissingFeeRow (popover / mobile sheet)"
        file="components/analytics/MissingFeeRow.tsx"
        pages="/agent/analytics"
        note="Click 'Set fee' to open the fee editor. Desktop (≥768px): floating popover near button. Mobile (<768px): full-screen bottom sheet. Fee type toggle (£ / %), VAT toggle (+ VAT / Inc VAT). Save will fail (mock transaction ID)."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger ghost" onClick={() => setFeeRendered((v) => !v)}>
            {feeRendered ? "Hide" : "Render MissingFeeRow"}
          </button>
          <span className="oa-note-pill">Resize window below 768px to see mobile sheet</span>
        </div>
        {feeRendered && (
          <div style={{ padding: "0 16px 14px" }}>
            <MissingFeeRow
              id={MOCK_TX_ID}
              propertyAddress={MOCK_ADDR}
              ownerLine="Emily Thornton"
              awaitingAssignment={false}
              txBasePath="/agent/transactions/audit-demo"
            />
          </div>
        )}
      </OCard>

      {/* ToneSelector — note */}
      <OCard
        name="ToneSelector"
        file="components/chase/ChaseDrawer.tsx (inline)"
        pages="/agent/transactions/[id] (inside ChaseDrawer)"
        note="Embedded within ChaseDrawer — not a standalone component. Open ChaseDrawer above and click the tone pill to inspect. 6 tones: Friendly → Final Reminder. Dropdown with colour pills and recommended indicator."
      >
        <div className="oa-card-body">
          <span className="oa-note-pill">Inspect via ChaseDrawer (Section 1 above)</span>
        </div>
      </OCard>

      {/* StatusControlDropdown — note */}
      <OCard
        name="StatusControl Dropdown"
        file="components/transaction/StatusControl.tsx (inline)"
        pages="/agent/transactions/[id]"
        note="Positioned-fixed dropdown rendered via createPortal. Embedded within StatusControl — inspect via Section 2 above. 4 status options; 'Withdrawn' triggers the WithdrawalReasonModal."
      >
        <div className="oa-card-body">
          <span className="oa-note-pill">Inspect via StatusControl (Section 2 above)</span>
        </div>
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Dropdown Menus
// ─────────────────────────────────────────────────────────────────────────────

function DropdownsSection() {
  const [solValue, setSolValue] = useState<SolicitorSelection | null>(null);
  const [brokerValue, setBrokerValue] = useState<BrokerSelection | null>(null);
  const [solPreset, setSolPreset] = useState(false);
  const [brokerPreset, setBrokerPreset] = useState(false);

  // Snooze menus rendered inline from AgentRemindersList — note only
  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 4 — Dropdown Menus</p>

      {/* SolicitorPicker */}
      <OCard
        name="SolicitorPicker"
        file="components/solicitors/SolicitorPicker.tsx"
        pages="New sale form, transaction form tabs"
        note="Combobox-style search. Type to trigger debounced search (200ms). 'Add new firm' option opens AddFirmModal nested. Toggle pre-populated value to see filled state."
      >
        <div className="oa-card-body">
          <span className="oa-label">initial value</span>
          <StateBtn label="empty" active={!solPreset} onClick={() => { setSolPreset(false); setSolValue(null); }} />
          <StateBtn label="pre-filled" active={solPreset} onClick={() => { setSolPreset(true); setSolValue(MOCK_SOLICITOR_VALUE); }} />
        </div>
        <div style={{ padding: "0 16px 14px" }}>
          <SolicitorPicker
            label="Vendor's solicitor"
            value={solValue}
            onChange={setSolValue}
          />
        </div>
      </OCard>

      {/* BrokerPicker */}
      <OCard
        name="BrokerPicker"
        file="components/brokers/BrokerPicker.tsx"
        pages="New sale form, transaction form tabs"
        note="Same shape as SolicitorPicker. 'Add new brokerage' opens AddBrokerModal. Preferred broker pre-populates on first render when toggle is on."
      >
        <div className="oa-card-body">
          <span className="oa-label">initial value</span>
          <StateBtn label="empty" active={!brokerPreset} onClick={() => { setBrokerPreset(false); setBrokerValue(null); }} />
          <StateBtn label="pre-filled" active={brokerPreset} onClick={() => { setBrokerPreset(true); setBrokerValue(MOCK_BROKER_VALUE); }} />
        </div>
        <div style={{ padding: "0 16px 14px" }}>
          <BrokerPicker
            label="Mortgage broker"
            value={brokerValue}
            onChange={setBrokerValue}
            preferredBroker={brokerPreset ? MOCK_BROKER_VALUE : null}
          />
        </div>
      </OCard>

      {/* SideSnoozeMenu + RowSnoozeMenu — note */}
      <OCard
        name="SideSnoozeMenu + RowSnoozeMenu"
        file="components/reminders/AgentRemindersList.tsx (inline)"
        pages="/agent/work-queue"
        note="Portal-rendered dropdowns. SideSnoozeMenu appears above a 'Snooze all' button at the foot of each reminder group column. RowSnoozeMenu appears above per-row clock-icon buttons. Both use agent-dropdown-in/out animation. 5 snooze duration options. Cannot be extracted as standalone — inspect on the live /agent/work-queue page."
      >
        <div className="oa-card-body">
          <span className="oa-note-pill">Inspect on /agent/work-queue (not extractable as standalone)</span>
        </div>
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5 — Toasts
// ─────────────────────────────────────────────────────────────────────────────

function LegacyToastTrigger() {
  const { addToast } = useToast();
  return (
    <>
      <button type="button" className="oa-trigger ghost" onClick={() => addToast("File created", "success", "14 Birchwood Close, Birmingham B15 2TT")}>
        Legacy · success + subtext
      </button>
      <button type="button" className="oa-trigger ghost" onClick={() => addToast("Failed to remove", "error")}>
        Legacy · error
      </button>
      <button type="button" className="oa-trigger ghost" onClick={() => addToast("1 invite sent", "info")}>
        Legacy · info
      </button>
    </>
  );
}

function ToastsSection() {
  const { toast } = useAgentToast();

  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 5 — Toasts</p>

      {/* AgentToaster variants */}
      <OCard
        name="AgentToaster — success variants"
        file="components/agent/AgentToaster.tsx"
        pages="Global (agent layout)"
        note="Success toasts. Simple = title only. With description = title + sub-line. Bottom-right stack. Hover to pause auto-dismiss."
      >
        <div className="oa-toast-grid">
          <button type="button" className="oa-trigger ghost" onClick={() => toast.success("Step confirmed")}>Simple success</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.success("Step confirmed", { description: "+3 steps reconciled at exchange" })}>Success + description</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.success("MOS confirmed for both sides", { description: "Both sides have confirmed exchange." })}>Success + long description</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.success("Skipped")}>Success · terse (Skipped)</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.success("To-do completed")}>Success · To-do</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.success("Note added")}>Success · Note added</button>
        </div>
      </OCard>

      <OCard
        name="AgentToaster — info variants"
        file="components/agent/AgentToaster.tsx"
        pages="Global (agent layout)"
      >
        <div className="oa-toast-grid">
          <button type="button" className="oa-trigger ghost" onClick={() => toast.info("Step undone", { description: "+2 linked steps also undone" })}>Info · Step undone + cascade</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.info("Member removed from team")}>Info · team remove</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.info("Invitation cancelled")}>Info · invitation cancelled</button>
        </div>
      </OCard>

      <OCard
        name="AgentToaster — error variants"
        file="components/agent/AgentToaster.tsx"
        pages="Global (agent layout)"
      >
        <div className="oa-toast-grid">
          <button type="button" className="oa-trigger ghost" onClick={() => toast.error("Couldn't update status — please try again")}>Error · status update fail</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.error("Export failed — please try again")}>Error · export fail</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.error("Couldn't complete milestone", { description: "Exchange must be confirmed on both sides first." })}>Error + description</button>
        </div>
      </OCard>

      <OCard
        name="AgentToaster — warning + action button"
        file="components/agent/AgentToaster.tsx"
        pages="Global (agent layout)"
      >
        <div className="oa-toast-grid">
          <button type="button" className="oa-trigger ghost" onClick={() => toast.warning("File may be at risk", { description: "17 days without activity." })}>Warning</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.success("File moved to On hold", { action: { label: "Undo", onClick: () => toast.info("Undid hold") } })}>Success + action button (Undo)</button>
          <button type="button" className="oa-trigger ghost" onClick={() => toast.error("Save failed", { action: { label: "Retry", onClick: () => toast.success("Saved") }, duration: 0 })}>Error + action + persistent</button>
          <button type="button" className="oa-trigger ghost" onClick={() => { for (let i = 0; i < 5; i++) toast.success(`Toast ${i + 1} of 5`); }}>Stack test (5 rapid)</button>
        </div>
      </OCard>

      <OCard
        name="ToastContext (legacy) — ChainDrawer / NewSaleFlow"
        file="components/ui/ToastContext.tsx"
        pages="New sale flow, ChainDrawer"
        note="Older simpler toast system. Used by ChainDrawer and NewSaleFlow. Same bottom-right position, slightly different visual. 4s auto-dismiss, no action button support."
      >
        <div className="oa-toast-grid">
          <LegacyToastTrigger />
        </div>
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6 — Full-Screen Search
// ─────────────────────────────────────────────────────────────────────────────

function SearchSection() {
  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 6 — Full-Screen Search Overlay</p>
      <OCard
        name="AgentGlobalSearch"
        file="components/layout/AgentGlobalSearch.tsx"
        pages="All agent pages (AgentShell)"
        note="Cmd+K / Ctrl+K trigger (also the search icon in sidebar). Full-screen panel with backdrop. Debounced search (300ms). Keyboard navigation ↑↓ Enter. Shows nav items instantly; file results load on type. The Cmd+K global listener is active on this page. An additional instance is rendered below for direct trigger."
      >
        <div className="oa-card-body">
          <span className="oa-note-pill">Press Cmd+K (or Ctrl+K) anywhere on this page to open. Or:</span>
          <AgentGlobalSearch />
        </div>
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 7 — Feedback Widget
// ─────────────────────────────────────────────────────────────────────────────

function FeedbackSection() {
  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 7 — Feedback / Support Widget</p>
      <OCard
        name="FeedbackWidget"
        file="components/feedback/FeedbackWidget.tsx"
        pages="All agent pages (app/agent/layout.tsx)"
        note="Floating button (bottom-right in layout — already active on this page). role=dialog, aria-modal. Three category flows: Bug / Suggestion / Question. Screenshot capture (base64). Browser detection in submission. A second instance is rendered below for isolated inspection — click the chat icon."
      >
        <div className="oa-card-body">
          <span className="oa-note-pill">Layout instance active (bottom-right). Second instance below:</span>
          <FeedbackWidget checklistAware={false} userId={MOCK_USER_ID} />
        </div>
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8 — Loading Overlay
// ─────────────────────────────────────────────────────────────────────────────

function LoadingSection() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setVisible(false), 3500);
      return () => clearTimeout(t);
    }
  }, [visible]);

  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 8 — Loading Overlay</p>
      <OCard
        name="SubmissionOverlay"
        file="components/transactions-v2/SubmissionOverlay.tsx"
        pages="New sale flow (file creation)"
        note="Full-screen backdrop. z-index 3000 (above everything). Spinner + 6 rotating messages cycling every 2s. Auto-dismisses after 3.5s on this card."
      >
        <div className="oa-card-body">
          <button type="button" className="oa-trigger" onClick={() => setVisible(true)}>Show overlay</button>
          {visible && <span className="oa-note-pill">Auto-dismisses in ~3.5s</span>}
        </div>
        <SubmissionOverlay isVisible={visible} />
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 9 — Changelog Dropdown
// ─────────────────────────────────────────────────────────────────────────────

function ChangelogSection() {
  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 9 — Changelog Dropdown</p>
      <OCard
        name="ChangelogDropdown"
        file="components/layout/ChangelogDropdown.tsx"
        pages="All agent pages (AgentShell sidebar)"
        note="Bell icon in sidebar. Positioned dropdown (right-aligned, top-9 from button). Shows changelog entries from lib/changelog.json. Unread dot clears on open (localStorage). Escape key + outside-click to dismiss."
      >
        <div className="oa-card-body">
          <span className="oa-note-pill">Click the bell icon:</span>
          <ChangelogDropdown />
        </div>
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 10 — native window.confirm() (not renderable)
// ─────────────────────────────────────────────────────────────────────────────

function NativeConfirmSection() {
  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 10 — Native window.confirm() — design debt</p>
      <OCard
        name="window.confirm() — 5 call sites"
        file="Multiple components"
        pages="Various"
        note="Native browser dialogs. Cannot be styled or themed. Each fires a blocking OS dialog. These are design debt — all should be replaced with custom confirmation modals. Trigger buttons below fire the actual native dialogs."
      >
        <div className="oa-toast-grid">
          <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Resend the invitation email to your director?")}>
            InviteDirector — resend invite
          </button>
          <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Remove Sarah Mitchell from the team? They will no longer be able to log in.")}>
            TeamManagement — remove member
          </button>
          <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Cancel the invitation for Sarah Mitchell? The link will stop working.")}>
            TeamManagement — cancel invite
          </button>
          <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Discard chain and 2 added nodes?")}>
            ChainSection — discard chain
          </button>
          <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Delete this task?")}>
            ManualTaskCard — delete task
          </button>
        </div>
      </OCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const THEMES = ["sunset", "coastal", "heritage", "slate", "emerald", "claret"] as const;

export default function OverlayAuditPage() {
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("sunset");
  const [solid, setSolid] = useState(false);
  const [night, setNight] = useState(false);
  const [rm, setRm] = useState(false);

  // Keep the real agent-shell-root in sync so usePortalTheme() reads correctly
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".agent-shell-root");
    if (!shell) return;
    const prevTheme = shell.getAttribute("data-theme") ?? "sunset";
    const prevNight = shell.hasAttribute("data-night");

    shell.setAttribute("data-theme", theme);
    if (night) shell.setAttribute("data-night", "");
    else shell.removeAttribute("data-night");

    return () => {
      shell.setAttribute("data-theme", prevTheme);
      if (prevNight) shell.setAttribute("data-night", "");
      else shell.removeAttribute("data-night");
    };
  }, [theme, night]);

  // Solid mode on documentElement (same mechanism as SolidModeToggle)
  useEffect(() => {
    if (solid) document.documentElement.setAttribute("data-solid", "");
    else document.documentElement.removeAttribute("data-solid");
    return () => { document.documentElement.removeAttribute("data-solid"); };
  }, [solid]);

  return (
    <ToastProvider>
      <style>{CSS}</style>
      <div data-theme={theme} data-night={night ? "" : undefined} data-rm={rm ? "1" : "0"} style={{ minHeight: "100vh" }}>

        {/* Controls bar */}
        <div className="oa-bar">
          <span className="oa-label">theme</span>
          {THEMES.map((t) => (
            <button key={t} type="button" className={`oa-pill${theme === t ? " on" : ""}`} onClick={() => setTheme(t)}>
              {t}
            </button>
          ))}
          <span className="oa-sep" />
          <button type="button" className={`oa-pill${solid ? " on" : ""}`} onClick={() => setSolid((v) => !v)}>solid</button>
          <button type="button" className={`oa-pill${night ? " on" : ""}`} onClick={() => setNight((v) => !v)}>night</button>
          <button type="button" className={`oa-pill${rm ? " on" : ""}`} onClick={() => setRm((v) => !v)}>rm</button>
          <span className="oa-sep" />
          <span className="oa-label" style={{ marginLeft: "auto" }}>33 components · 10 sections</span>
        </div>

        {/* Page content */}
        <div className="oa-content">
          <DrawersSection />
          <ModalsSection />
          <PopoversSection />
          <DropdownsSection />
          <ToastsSection />
          <SearchSection />
          <FeedbackSection />
          <LoadingSection />
          <ChangelogSection />
          <NativeConfirmSection />
        </div>
      </div>
    </ToastProvider>
  );
}
