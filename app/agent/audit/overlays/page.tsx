"use client";

import { useState, useEffect, createContext, useContext } from "react";

import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { EditSaleDetailsDrawer } from "@/components/transaction/EditSaleDetailsDrawer";
import { ReconciliationDrawer, type ReconciliationItem } from "@/components/milestones/ReconciliationDrawer";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";

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

import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import { MissingFeeRow } from "@/components/analytics/MissingFeeRow";

import { SolicitorPicker } from "@/components/solicitors/SolicitorPicker";
import { BrokerPicker } from "@/components/brokers/BrokerPicker";

import { useAgentToast } from "@/components/agent/AgentToaster";
import { ToastProvider, useToast } from "@/components/ui/ToastContext";

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

const MOCK_UNDO_NO_CASCADE: UndoImpact = { cascade: [], currentPercent: 42, targetOnlyPercent: 38, cascadePercent: 38 };
const MOCK_UNDO_CASCADE: UndoImpact = {
  cascade: [
    { id: "m1", name: "Searches returned", side: "Vendor", code: "VM04", reconciledAtExchange: false },
    { id: "m2", name: "Enquiries raised", side: "Vendor", code: "VM05", reconciledAtExchange: false },
    { id: "m3", name: "Enquiries answered", side: "Vendor", code: "VM06", reconciledAtExchange: true },
  ],
  currentPercent: 68, targetOnlyPercent: 62, cascadePercent: 51,
};
const MOCK_RECONCILIATION_ITEMS: ReconciliationItem[] = [
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
const MOCK_SOLICITOR_VALUE: SolicitorSelection = {
  firmId: "sf1", firmName: "Grayson Law LLP", contactId: "sc1",
  contactName: "Sarah Mitchell", phone: "+447700900111", email: "s.mitchell@graysonlaw.co.uk",
};
const MOCK_BROKER_VALUE: BrokerSelection = {
  firmId: "bf1", firmName: "Premier Mortgages Ltd", contactId: "bc1",
  contactName: "Daniel Webb", phone: "+447700900444", email: "d.webb@premiermortgages.co.uk",
};

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
  /* Control bar */
  .oa-bar { display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06);background:rgba(255,255,255,0.55);backdrop-filter:blur(12px);position:sticky;top:0;z-index:10; }
  .oa-pill { padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid rgba(0,0,0,0.10);background:rgba(255,255,255,0.6);color:rgba(15,23,42,0.55);transition:all 120ms; }
  .oa-pill.on { background:rgba(15,23,42,0.85);color:#fff;border-color:transparent; }
  .oa-pill:hover:not(.on) { background:rgba(255,255,255,0.9);color:rgba(15,23,42,0.80); }
  .oa-sep { width:1px;height:20px;background:rgba(0,0,0,0.08);margin:0 4px; }
  .oa-label { font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(15,23,42,0.30);margin-right:2px; }
  /* Layout */
  .oa-content { padding:24px 20px;display:flex;flex-direction:column;gap:32px;max-width:1100px;margin:0 auto; }
  .oa-section-title { font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(15,23,42,0.30);margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(0,0,0,0.06); }
  .oa-section { display:flex;flex-direction:column;gap:12px; }
  /* Cards */
  .oa-card { background:rgba(255,255,255,0.55);border:1px solid rgba(255,255,255,0.60);border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05); }
  .oa-card-hdr { padding:12px 16px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(0,0,0,0.06); }
  .oa-card-name { font-size:13px;font-weight:700;color:rgba(15,23,42,0.85);display:block;margin-bottom:2px; }
  .oa-card-file { font-size:11px;color:rgba(15,23,42,0.35);font-family:monospace; }
  .oa-card-pages { font-size:11px;color:rgba(15,23,42,0.35);text-align:right;flex-shrink:0;max-width:220px; }
  .oa-card-body { padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
  .oa-card-note { padding:8px 16px 0;font-size:11.5px;color:rgba(15,23,42,0.40);line-height:1.5;margin:0; }
  /* Controls */
  .oa-state-btn { padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid rgba(0,0,0,0.10);background:transparent;color:rgba(15,23,42,0.45);transition:all 100ms; }
  .oa-state-btn.on { background:rgba(var(--agent-coral-base-rgb),0.10);border-color:rgba(var(--agent-coral-base-rgb),0.30);color:var(--agent-coral); }
  .oa-trigger { padding:6px 14px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;background:var(--agent-coral);color:#fff;border:none;transition:opacity 100ms; }
  .oa-trigger:hover { opacity:0.85; }
  .oa-trigger.ghost { background:transparent;border:1.5px solid rgba(0,0,0,0.12);color:rgba(15,23,42,0.60); }
  .oa-trigger.ghost:hover { background:rgba(0,0,0,0.04); }
  .oa-note-pill { font-size:11px;color:rgba(15,23,42,0.35);font-style:italic; }
  .oa-toast-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;padding:12px 16px; }
  [data-rm="1"] *,[data-rm="1"] *::before,[data-rm="1"] *::after { animation-duration:0ms!important;transition-duration:0ms!important; }

  /* Stage 2 — comparison tabs */
  .oa-tabs { display:flex;border-bottom:1px solid rgba(0,0,0,0.06); }
  .oa-tab { flex:1;padding:8px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;border:none;background:transparent;transition:background 80ms,color 80ms;color:rgba(15,23,42,0.35); }
  .oa-tab.tab-current.tab-active { background:rgba(15,23,42,0.04);color:rgba(15,23,42,0.80);box-shadow:inset 0 -2px 0 rgba(15,23,42,0.35); }
  .oa-tab.tab-proposed.tab-active { background:rgba(var(--agent-coral-base-rgb),0.04);color:var(--agent-coral);box-shadow:inset 0 -2px 0 var(--agent-coral); }
  .oa-tab.tab-current:not(.tab-active):hover { background:rgba(15,23,42,0.02);color:rgba(15,23,42,0.55); }
  .oa-tab.tab-proposed:not(.tab-active):hover { background:rgba(var(--agent-coral-base-rgb),0.02);color:rgba(var(--agent-coral-base-rgb),0.65); }

  /* Stage 2 — proposed pane */
  .oa-proposed-body { padding:12px 16px; }
  .oa-diff-heading { font-size:10px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:rgba(15,23,42,0.28);margin:0 0 6px; }
  .oa-diff-list { list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:3px; }
  .oa-diff-item { font-size:11.5px;color:rgba(15,23,42,0.60);padding:3px 0 3px 16px;position:relative;line-height:1.4; }
  .oa-diff-item::before { content:"→";position:absolute;left:0;color:var(--agent-coral,#ff6b4a);font-weight:800;font-size:10px;top:4px; }
  .oa-diff-item.ok { color:rgba(15,23,42,0.35); }
  .oa-diff-item.ok::before { content:"✓";color:rgba(15,23,42,0.25); }

  /* Stage 2 — pick row */
  .oa-pick-row { padding:10px 16px 12px;display:flex;align-items:center;gap:7px;border-top:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.01); }
  .oa-pick-label { font-size:10px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:rgba(15,23,42,0.28);margin-right:2px; }
  .oa-pick-btn { padding:4px 12px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;border:1.5px solid rgba(0,0,0,0.09);background:transparent;color:rgba(15,23,42,0.50);transition:all 100ms; }
  .oa-pick-btn:hover { background:rgba(0,0,0,0.04); }
  .oa-pick-btn.picked-current { background:rgba(15,23,42,0.07);border-color:rgba(15,23,42,0.22);color:rgba(15,23,42,0.82); }
  .oa-pick-btn.picked-proposed { background:rgba(var(--agent-coral-base-rgb),0.09);border-color:rgba(var(--agent-coral-base-rgb),0.28);color:var(--agent-coral); }
  .oa-pick-btn.picked-modify { background:rgba(234,179,8,0.09);border-color:rgba(234,179,8,0.30);color:rgb(150,115,5); }
  .oa-cat-badge { font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(var(--agent-coral-base-rgb),0.08);color:var(--agent-coral);letter-spacing:0.04em;margin-left:auto; }
  .oa-pick-note { font-size:11px;color:rgba(15,23,42,0.35);font-style:italic; }

  /* Stage 2 — drawer chrome preview */
  .oa-chr-draw-wrap { position:relative;height:220px;border:1px solid rgba(0,0,0,0.06);border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.025);margin-top:10px; }
  .oa-chr-page { position:absolute;inset:0;background:var(--agent-surface-base,rgba(250,248,245,0.8)); }
  .oa-chr-veil { position:absolute;inset:0;background:rgba(0,0,0,0.12); }
  .oa-chr-draw-panel { position:absolute;right:0;top:0;bottom:0;width:72%;background:var(--agent-surface-elevated,rgba(255,255,255,0.96));border-left:1px solid rgba(0,0,0,0.07);display:flex;flex-direction:column;box-shadow:-4px 0 16px rgba(0,0,0,0.07); }
  .oa-chr-dhdr { height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid rgba(0,0,0,0.06);flex-shrink:0; }
  .oa-chr-dleft { display:flex;align-items:center;gap:6px; }
  .oa-chr-dtitle { font-size:12px;font-weight:600;color:rgba(15,23,42,0.85); }
  .oa-chr-xbtn { width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(15,23,42,0.45); }
  .oa-chr-dbody { flex:1;padding:10px 14px;display:flex;flex-direction:column;gap:5px; }
  .oa-chr-pl { height:7px;border-radius:3px;background:rgba(0,0,0,0.07); }
  .oa-chr-pl.s { width:55%; }
  .oa-chr-pl.m { width:78%; }
  .oa-chr-dftr { height:52px;display:flex;align-items:center;justify-content:flex-end;gap:7px;padding:0 14px;border-top:1px solid rgba(0,0,0,0.06);flex-shrink:0; }
  .oa-chr-wtag { position:absolute;top:6px;left:6px;font-size:10px;font-weight:700;color:var(--agent-coral,#ff6b4a);background:rgba(255,107,74,0.12);padding:2px 6px;border-radius:4px;z-index:3; }
  .oa-chr-mb { height:28px;padding:0 11px;border-radius:7px;font-size:11px;font-weight:600;display:flex;align-items:center;cursor:default; }
  .oa-chr-mb.p { background:var(--agent-coral,#ff6b4a);color:white; }
  .oa-chr-mb.g { border:1.5px solid rgba(0,0,0,0.10);color:rgba(15,23,42,0.50); }

  /* Stage 2 — modal chrome preview */
  .oa-chr-modal-wrap { border:1px solid rgba(0,0,0,0.06);border-radius:8px;overflow:hidden;margin-top:10px;background:rgba(0,0,0,0.025);padding:14px;display:flex;align-items:center;justify-content:center; }
  .oa-chr-mcard { width:100%;background:var(--agent-surface-elevated,rgba(255,255,255,0.96));border:0.5px solid rgba(0,0,0,0.07);border-radius:13px;box-shadow:0 6px 24px rgba(0,0,0,0.07);overflow:hidden; }
  .oa-chr-mhdr { padding:14px 16px 8px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px; }
  .oa-chr-mtitle { font-size:13px;font-weight:700;color:rgba(15,23,42,0.85); }
  .oa-chr-msub { font-size:11px;color:rgba(15,23,42,0.42);margin-top:3px;line-height:1.4; }
  .oa-chr-mbody { padding:0 16px 10px;font-size:11px;color:rgba(15,23,42,0.38);line-height:1.5; }
  .oa-chr-mftr { padding:8px 16px 14px;display:flex;gap:7px; }
  .oa-chr-mftr.stacked { flex-direction:column; }
  .oa-chr-mftr.inline { justify-content:flex-end; }
  .oa-chr-mftr-btn { height:34px;padding:0 14px;border-radius:8px;font-size:11.5px;font-weight:600;display:flex;align-items:center;justify-content:center;cursor:default;white-space:nowrap; }
  .oa-chr-mftr-btn.p { background:var(--agent-coral,#ff6b4a);color:white; }
  .oa-chr-mftr-btn.d { background:#dc2626;color:white; }
  .oa-chr-mftr-btn.g { border:1.5px solid rgba(0,0,0,0.09);color:rgba(15,23,42,0.50); }
  .oa-chr-mftr-btn.full { width:100%; }

  /* Decisions summary */
  .oa-dec-table { width:100%;border-collapse:collapse; }
  .oa-dec-table th { padding:4px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:rgba(15,23,42,0.40);border-bottom:1px solid rgba(0,0,0,0.08); }
  .oa-dec-table td { padding:5px 8px;font-size:12px;border-bottom:1px solid rgba(0,0,0,0.04);color:rgba(15,23,42,0.75); }
  .oa-dec-stats { display:flex;gap:20px;font-size:12px;color:rgba(15,23,42,0.55);padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06); }
  .oa-dec-stats span { font-weight:600;color:rgba(15,23,42,0.75); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Picks context
// ─────────────────────────────────────────────────────────────────────────────

type PickVal = "current" | "proposed" | "modify";
type PicksCtxType = {
  picks: Record<string, PickVal>;
  setPick: (key: string, val: PickVal) => void;
};

const PicksCtx = createContext<PicksCtxType>({ picks: {}, setPick: () => {} });

function usePickState(id: string) {
  const { picks, setPick } = useContext(PicksCtx);
  return [picks[id] ?? null, (v: PickVal) => setPick(id, v)] as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function StateBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`oa-state-btn${active ? " on" : ""}`} onClick={onClick}>{label}</button>;
}

function DiffList({ items }: { items: Array<{ text: string; ok?: boolean }> }) {
  return (
    <ul className="oa-diff-list">
      {items.map((item, i) => (
        <li key={i} className={`oa-diff-item${item.ok ? " ok" : ""}`}>{item.text}</li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome previews
// ─────────────────────────────────────────────────────────────────────────────

function DrawerChrome({
  title,
  width,
  footer = "compose",
  primaryLabel = "Send",
}: {
  title: string;
  width: 420 | 480 | 520;
  footer?: "compose" | "bulk" | "none";
  primaryLabel?: string;
}) {
  return (
    <div className="oa-chr-draw-wrap">
      <div className="oa-chr-page" />
      <div className="oa-chr-veil" />
      <span className="oa-chr-wtag">{width}px</span>
      <div className="oa-chr-draw-panel">
        <div className="oa-chr-dhdr">
          <div className="oa-chr-dleft">
            <span style={{ fontSize: 13 }}>✉</span>
            <span className="oa-chr-dtitle">{title}</span>
          </div>
          <div className="oa-chr-xbtn">✕</div>
        </div>
        <div className="oa-chr-dbody">
          <div className="oa-chr-pl m" />
          <div className="oa-chr-pl s" />
          <div className="oa-chr-pl m" />
          <div className="oa-chr-pl s" />
        </div>
        {footer !== "none" && (
          <div className="oa-chr-dftr">
            {footer === "compose" && <div className="oa-chr-mb g">Cancel</div>}
            <div className="oa-chr-mb p">{primaryLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalChrome({
  title,
  subtitle,
  hasX,
  footerLayout,
  primaryLabel,
  secondaryLabel,
  primaryDanger = false,
  bodyContent,
}: {
  title: string;
  subtitle?: string;
  hasX: boolean;
  footerLayout: "stacked" | "inline";
  primaryLabel: string;
  secondaryLabel?: string;
  primaryDanger?: boolean;
  bodyContent?: string;
}) {
  return (
    <div className="oa-chr-modal-wrap">
      <div className="oa-chr-mcard">
        <div className="oa-chr-mhdr">
          <div>
            <div className="oa-chr-mtitle">{title}</div>
            {subtitle && <div className="oa-chr-msub">{subtitle}</div>}
          </div>
          {hasX && <div className="oa-chr-xbtn" style={{ flexShrink: 0, marginTop: 2 }}>✕</div>}
        </div>
        {bodyContent && <div className="oa-chr-mbody">{bodyContent}</div>}
        <div className={`oa-chr-mftr ${footerLayout}`}>
          {footerLayout === "stacked" ? (
            <>
              <div className={`oa-chr-mftr-btn full${primaryDanger ? " d" : " p"}`}>{primaryLabel}</div>
              {secondaryLabel && <div className="oa-chr-mftr-btn g full">{secondaryLabel}</div>}
            </>
          ) : (
            <>
              {secondaryLabel && <div className="oa-chr-mftr-btn g">{secondaryLabel}</div>}
              <div className={`oa-chr-mftr-btn${primaryDanger ? " d" : " p"}`}>{primaryLabel}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompCard — comparison card with current/proposed tabs and pick row
// ─────────────────────────────────────────────────────────────────────────────

function CompCard({
  id,
  name,
  file,
  pages,
  category,
  note,
  currentContent,
  proposedContent,
  currentNote,
}: {
  id: string;
  name: string;
  file: string;
  pages: string;
  category: string;
  note?: string;
  currentContent: React.ReactNode;
  proposedContent: React.ReactNode;
  currentNote?: string;
}) {
  const [pane, setPane] = useState<"current" | "proposed">("current");
  const [pick, setPick] = usePickState(id);

  return (
    <div className="oa-card">
      <div className="oa-card-hdr">
        <div>
          <span className="oa-card-name">{name}</span>
          <span className="oa-card-file">{file}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="oa-cat-badge" style={{ margin: 0 }}>{category}</span>
          <span className="oa-card-pages">{pages}</span>
        </div>
      </div>
      {note && <p className="oa-card-note">{note}</p>}
      <div className="oa-tabs">
        <button type="button" className={`oa-tab tab-current${pane === "current" ? " tab-active" : ""}`} onClick={() => setPane("current")}>
          Current
        </button>
        <button type="button" className={`oa-tab tab-proposed${pane === "proposed" ? " tab-active" : ""}`} onClick={() => setPane("proposed")}>
          Proposed
        </button>
      </div>
      {pane === "current" ? (
        <div>
          {currentNote && <p className="oa-card-note" style={{ paddingBottom: 4 }}>{currentNote}</p>}
          {currentContent}
        </div>
      ) : (
        <div className="oa-proposed-body">
          {proposedContent}
        </div>
      )}
      <div className="oa-pick-row">
        <span className="oa-pick-label">Pick</span>
        <button type="button" className={`oa-pick-btn${pick === "current" ? " picked-current" : ""}`} onClick={() => setPick("current")}>Current</button>
        <button type="button" className={`oa-pick-btn${pick === "proposed" ? " picked-proposed" : ""}`} onClick={() => setPick("proposed")}>Proposed</button>
        <button type="button" className={`oa-pick-btn${pick === "modify" ? " picked-modify" : ""}`} onClick={() => setPick("modify")}>Modify</button>
        {pick && (
          <span className="oa-pick-note" style={{ marginLeft: 6 }}>
            {pick === "current" ? "Keep current" : pick === "proposed" ? "Use canonical" : "Needs modification"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — Drawers
// ─────────────────────────────────────────────────────────────────────────────

function DrawersSection() {
  const [chaseOpen, setChaseOpen] = useState(false);
  const [chaseCount, setChaseCount] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [reconOpen, setReconOpen] = useState(false);
  const [reconExchange, setReconExchange] = useState(true);
  const [reconItems, setReconItems] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const [nodeOpen, setNodeOpen] = useState(false);
  const [nodeDir, setNodeDir] = useState<"above" | "below">("below");

  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 1 — Drawers</p>

      <CompCard
        id="chase-drawer"
        name="ChaseDrawer"
        file="components/chase/ChaseDrawer.tsx"
        pages="/agent/transactions/[id]"
        category="1a — Compose"
        note="Channel toggle (Email / WhatsApp), tone selector nested, AI generation paths, CC solicitor toggle, multi-milestone mode."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-label">chase count</span>
            {[1, 3, 6].map((n) => <StateBtn key={n} label={`×${n}`} active={chaseCount === n} onClick={() => setChaseCount(n)} />)}
            <span className="oa-sep" />
            <button type="button" className="oa-trigger" onClick={() => setChaseOpen(true)}>Open drawer</button>
            {chaseOpen && (
              <ChaseDrawer
                chaseTaskId="ct-audit-001" transactionId={MOCK_TX_ID}
                propertyAddress={MOCK_ADDR} milestoneName="Searches requested"
                chaseCount={chaseCount} contacts={MOCK_CONTACTS} milestones={MOCK_MILESTONES}
                onClose={() => setChaseOpen(false)} onSent={() => setChaseOpen(false)}
              />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Width: max-w-[28rem] (448px) → 420px (canonical 1a)" },
              { text: "Header: add canonical 56px sticky header — icon left, title, X right" },
              { text: "Exit animation: instant unmount → agent-drawer-out 200ms slide-out (new keyframe needed)" },
              { text: "Backdrop click: already closes on empty form — keep", ok: true },
              { text: "Footer: sticky Cancel + Send — keep pattern, canonicalize button classes", ok: true },
            ]} />
            <DrawerChrome title="Send chase" width={420} footer="compose" primaryLabel="Send chase" />
          </>
        }
      />

      <CompCard
        id="edit-drawer"
        name="EditSaleDetailsDrawer"
        file="components/transaction/EditSaleDetailsDrawer.tsx"
        pages="/agent/transactions/[id]"
        category="1b — Edit"
        note="Three independently-saving sections: Property, Price & Fees, Timeline. Dirty chips above fold. Nested UnsavedChangesModal and AddressConsequencesModal accessible via drawer interactions."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setEditOpen(true)}>Open drawer</button>
            {editOpen && (
              <EditSaleDetailsDrawer
                transactionId={MOCK_TX_ID} propertyAddress={MOCK_ADDR}
                tenure="freehold" purchaseType="mortgage" purchasePrice={38500000}
                agentFeeAmount={null} agentFeePercent={1.5} agentFeeIsVatInclusive={false}
                referralFee={null} referredFirmName={null} referredFirmId={null}
                overridePredictedDate={null} predictedExchangeDate={new Date(Date.now() + 56 * 86400000)}
                completionDate={null} exchangeConfirmed={false} isTopmost
                onClose={() => setEditOpen(false)}
              />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Width: style={{ width: 440 }} → 520px (canonical 1b — edit drawers are wider)" },
              { text: "Header: canonicalize to 56px sticky — currently uses custom complex header" },
              { text: "Exit animation: add agent-drawer-out 200ms" },
              { text: "Section-level save buttons: keep pattern — correct for 1b multi-section edit", ok: true },
              { text: "Backdrop click: already non-dismissible when dirty — keep", ok: true },
            ]} />
            <DrawerChrome title="Edit sale details" width={520} footer="none" />
          </>
        }
      />

      <CompCard
        id="recon-drawer"
        name="ReconciliationDrawer"
        file="components/milestones/ReconciliationDrawer.tsx"
        pages="/agent/transactions/[id] (via MilestoneRow)"
        category="1b — Edit"
        note="Exchange flow vs completion flow. Outstanding items checklist with event date inputs. Non-dismissible backdrop."
        currentContent={
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
            {reconOpen && (
              <ReconciliationDrawer
                isExchangeFlow={reconExchange}
                outstanding={reconItems ? MOCK_RECONCILIATION_ITEMS : []}
                initialEventDate={new Date().toISOString().split("T")[0]}
                onConfirm={() => setReconOpen(false)} onCancel={() => setReconOpen(false)}
              />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Width: canonicalize to 520px (1b)" },
              { text: "Header: canonicalize to 56px sticky with title + X" },
              { text: "Exit animation: add agent-drawer-out 200ms" },
              { text: "Backdrop: non-dismissible during data entry — keep", ok: true },
              { text: "Two-flow logic (exchange/completion): keep", ok: true },
            ]} />
            <DrawerChrome title="Confirm exchange" width={520} footer="compose" primaryLabel="Confirm" />
          </>
        }
      />

      <CompCard
        id="chain-drawer"
        name="ChainDrawer"
        file="components/chain/ChainDrawer.tsx"
        pages="/agent/transactions/[id]"
        category="1c — Browse"
        note="Fetches /api/chains internally. Mock ID shows loading → empty. Production: chain visualisation with LinkCard nodes, bulk-invite footer. Uses legacy ToastContext."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setChainOpen(true)}>Open drawer</button>
            <span className="oa-note-pill">Will show loading → empty (mock ID)</span>
            {chainOpen && (
              <ChainDrawer
                transactionId={MOCK_TX_ID} currentUserId={MOCK_USER_ID}
                onClose={() => setChainOpen(false)}
                onOpenAddNode={(dir) => { setNodeDir(dir); setNodeOpen(true); }}
              />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Width: canonicalize to 480px (1c — browse drawers)" },
              { text: "Header: canonicalize to 56px sticky" },
              { text: "Exit animation: add agent-drawer-out 200ms" },
              { text: "Toast: migrate from ToastContext to useAgentToast() (Stage 4)" },
              { text: "Backdrop click: already dismisses (no unsaved state) — keep", ok: true },
              { text: "Bulk-invite sticky footer: keep (valid 1c optional footer)", ok: true },
            ]} />
            <DrawerChrome title="Property chain" width={480} footer="bulk" primaryLabel="Invite all" />
          </>
        }
      />

      <CompCard
        id="addnode-drawer"
        name="AddNodeDrawer"
        file="components/chain/AddNodeDrawer.tsx"
        pages="/agent/transactions/[id] (via ChainDrawer)"
        category="1a — Compose"
        note="Add or edit a chain node. Field-level validation. Save fails on mock data."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-label">direction</span>
            <StateBtn label="above" active={nodeDir === "above"} onClick={() => setNodeDir("above")} />
            <StateBtn label="below" active={nodeDir === "below"} onClick={() => setNodeDir("below")} />
            <span className="oa-sep" />
            <button type="button" className="oa-trigger" onClick={() => setNodeOpen(true)}>Open drawer</button>
            {nodeOpen && (
              <AddNodeDrawer direction={nodeDir} onClose={() => setNodeOpen(false)} onSaved={() => setNodeOpen(false)} />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Width: no explicit width → 420px (canonical 1a)" },
              { text: "Header: canonicalize to 56px sticky" },
              { text: "Exit animation: add agent-drawer-out 200ms" },
              { text: "Footer: Cancel + Save — keep pattern", ok: true },
              { text: "Field-level validation: keep", ok: true },
            ]} />
            <DrawerChrome title="Add to chain" width={420} footer="compose" primaryLabel="Save node" />
          </>
        }
      />
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

      {/* WelcomeModal — 2d Informational */}
      <CompCard
        id="welcome-modal"
        name="WelcomeModal"
        file="components/agent/WelcomeModal.tsx"
        pages="/agent (first login)"
        category="2d — Informational"
        note="Shown once per session after first login. Two states: welcome card and tour slides."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setWelcome(true)}>Open</button>
            {welcome && <WelcomeModal name="Ellis" />}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 520px (2d)" },
              { text: "X button: ensure present (2d informational always has X)" },
              { text: "Backdrop click: should dismiss — verify current behaviour" },
              { text: "Decorative gradient header: keep — correct for 2d rich header variant", ok: true },
              { text: "Tour slides: keep", ok: true },
            ]} />
            <ModalChrome
              title="Welcome to Sales Progressor"
              subtitle="Let's get you set up. This takes about 2 minutes."
              hasX
              footerLayout="inline"
              primaryLabel="Get started"
              secondaryLabel="Skip tour"
            />
          </>
        }
      />

      {/* UndoMilestoneModal — 2b Decision+impact */}
      <CompCard
        id="undo-modal"
        name="UndoMilestoneModal"
        file="components/milestones/UndoMilestoneModal.tsx"
        pages="/agent/transactions/[id] (via MilestoneRow)"
        category="2b — Decision + impact"
        note="Orange accent. Radio options when cascade. Impact % visualisation. Expandable downstream step list."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-label">cascade</span>
            <StateBtn label="none" active={!undoCascade} onClick={() => setUndoCascade(false)} />
            <StateBtn label="3 steps" active={undoCascade} onClick={() => setUndoCascade(true)} />
            <span className="oa-sep" />
            <button type="button" className="oa-trigger" onClick={() => setUndoOpen(true)}>Open</button>
            {undoOpen && (
              <UndoMilestoneModal
                milestoneName="Searches requested" milestoneId="m-audit-001"
                undoData={undoCascade ? MOCK_UNDO_CASCADE : MOCK_UNDO_NO_CASCADE}
                isPending={false} onConfirm={() => setUndoOpen(false)} onCancel={() => setUndoOpen(false)}
              />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 460px (2b)" },
              { text: "X button: ensure present (2b always has X)" },
              { text: "Footer: horizontal — Cancel left, Undo right" },
              { text: "Impact visualisation: keep — core 2b pattern", ok: true },
              { text: "Orange warning accent: keep — semantic", ok: true },
              { text: "Backdrop: non-dismissible mid-decision — keep", ok: true },
            ]} />
            <ModalChrome
              title="Undo: Searches requested"
              subtitle="This will also undo 3 linked steps."
              hasX footerLayout="inline"
              primaryLabel="Undo step" secondaryLabel="Cancel"
              bodyContent="VM04 · VM05 · VM06 will also be undone. Progress: 68% → 51%."
            />
          </>
        }
      />

      {/* MortgageModal — 2a Simple confirm */}
      <CompCard
        id="mortgage-modal"
        name="MortgageModal"
        file="components/milestones/MortgageModal.tsx"
        pages="/agent/transactions/[id] (mortgage type change)"
        category="2a — Simple confirm"
        note="3-option confirmation: Yes mortgage / Reinstate without change / Cancel. Non-dismissible."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setMortgage(true)}>Open</button>
            {mortgage && (
              <MortgageModal
                onConfirmMortgage={() => setMortgage(false)}
                onConfirmReinstate={() => setMortgage(false)}
                onCancel={() => setMortgage(false)}
              />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 400px (2a)" },
              { text: "X button: absent — 2a confirms require explicit choice, no escape" },
              { text: "Footer: stacked full-width buttons (primary top, secondary below)" },
              { text: "3 options (Yes / Reinstate / Cancel): keep — valid for 2a multi-option", ok: true },
              { text: "Backdrop: non-dismissible — keep", ok: true },
            ]} />
            <ModalChrome
              title="Does this sale involve a mortgage?"
              hasX={false} footerLayout="stacked"
              primaryLabel="Yes, mortgage involved"
              secondaryLabel="Reinstate without change"
            />
          </>
        }
      />

      {/* SurveyNrConfirmModal — 2a Simple confirm */}
      <CompCard
        id="survey-modal"
        name="SurveyNrConfirmModal"
        file="components/milestones/SurveyNrConfirmModal.tsx"
        pages="/agent/transactions/[id] (PM9 N/R only)"
        category="2a — Simple confirm"
        note="Simple 2-button confirmation for skipping survey milestone. Non-dismissible."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setSurveyNr(true)}>Open</button>
            {surveyNr && (
              <SurveyNrConfirmModal onConfirm={() => setSurveyNr(false)} onCancel={() => setSurveyNr(false)} />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 400px (2a)" },
              { text: "X button: absent — 2a" },
              { text: "Footer: stacked full-width buttons" },
              { text: "2-button layout: already correct for 2a", ok: true },
              { text: "Backdrop: non-dismissible — keep", ok: true },
            ]} />
            <ModalChrome
              title="Skip survey milestone?"
              subtitle="This marks survey as not required for this purchase."
              hasX={false} footerLayout="stacked"
              primaryLabel="Yes, skip survey" secondaryLabel="Cancel"
            />
          </>
        }
      />

      {/* AddFirmModal — 2c Data entry */}
      <CompCard
        id="addfirm-modal"
        name="AddFirmModal"
        file="components/solicitors/AddFirmModal.tsx"
        pages="New sale form (via SolicitorPicker)"
        category="2c — Data entry"
        note="Quick solicitor firm + handler creation. Field-level validation. Server call fails on mock data."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setAddFirm(true)}>Open</button>
            {addFirm && <AddFirmModal prefillName="" onClose={() => setAddFirm(false)} onCreated={() => setAddFirm(false)} />}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 460px (2c)" },
              { text: "X button: present — 2c data entry (can dismiss on empty form)" },
              { text: "Footer: horizontal — Cancel left, Save right" },
              { text: "Save disabled until required fields filled: keep", ok: true },
              { text: "Field-level validation: keep", ok: true },
            ]} />
            <ModalChrome
              title="Add solicitor firm" hasX footerLayout="inline"
              primaryLabel="Save firm" secondaryLabel="Cancel"
              bodyContent="Firm name, contact name, contact email — with inline validation."
            />
          </>
        }
      />

      {/* AddBrokerModal — 2c Data entry */}
      <CompCard
        id="addbroker-modal"
        name="AddBrokerModal"
        file="components/brokers/AddBrokerModal.tsx"
        pages="New sale form (via BrokerPicker)"
        category="2c — Data entry"
        note="Same structure as AddFirmModal for mortgage brokers. Handler optional."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setAddBroker(true)}>Open</button>
            {addBroker && <AddBrokerModal prefillName="" onClose={() => setAddBroker(false)} onCreated={() => setAddBroker(false)} />}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 460px (2c)" },
              { text: "X button: present — 2c" },
              { text: "Footer: horizontal — Cancel left, Save right" },
              { text: "Optional handler field: keep", ok: true },
            ]} />
            <ModalChrome
              title="Add mortgage broker" hasX footerLayout="inline"
              primaryLabel="Save broker" secondaryLabel="Cancel"
              bodyContent="Brokerage name, optional contact details — same shape as AddFirmModal."
            />
          </>
        }
      />

      {/* DuplicateAddressModal — 2b Decision+impact */}
      <CompCard
        id="dupaddr-modal"
        name="DuplicateAddressModal"
        file="components/transactions-v2/DuplicateAddressModal.tsx"
        pages="New sale flow (address already exists)"
        category="2b — Decision + impact"
        note="z-index 2000 hardcoded. Actions: View existing / Create anyway / Cancel."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setDupAddr(true)}>Open</button>
            {dupAddr && (
              <DuplicateAddressModal
                address={MOCK_ADDR} duplicateId="existing-tx-001" assignedTo="Sarah Mitchell"
                onClose={() => setDupAddr(false)} onForceCreate={() => setDupAddr(false)}
              />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "z-index: 2000 (hardcoded) → var(--agent-z-modal) 1000 — current z-index causes it to sit above toasts" },
              { text: "Max-width: canonicalize to 460px (2b)" },
              { text: "X button: present (2b — user can cancel out)" },
              { text: "Footer: horizontal — Cancel, Create anyway (danger)" },
              { text: "Warning content about existing file: keep", ok: true },
            ]} />
            <ModalChrome
              title="File already exists at this address"
              subtitle="14 Birchwood Close, Birmingham B15 2TT — assigned to Sarah Mitchell."
              hasX footerLayout="inline"
              primaryLabel="Create anyway" secondaryLabel="Cancel"
              primaryDanger
            />
          </>
        }
      />

      {/* NavAwayModal — 2b Decision+impact */}
      <CompCard
        id="navaway-modal"
        name="NavAwayModal"
        file="components/transactions-v2/NavAwayModal.tsx"
        pages="New sale flow (unsaved changes)"
        category="2b — Decision + impact"
        note="Yellow accent. Three actions: Discard / Stay / Save draft. Non-dismissible."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-label">state</span>
            <StateBtn label="idle" active={!navSaving} onClick={() => setNavSaving(false)} />
            <StateBtn label="saving" active={navSaving} onClick={() => setNavSaving(true)} />
            <span className="oa-sep" />
            <button type="button" className="oa-trigger" onClick={() => setNavAway(true)}>Open</button>
            {navAway && (
              <NavAwayModal
                isSaving={navSaving} onDiscard={() => setNavAway(false)}
                onStay={() => setNavAway(false)} onSave={() => setNavAway(false)}
              />
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 460px (2b)" },
              { text: "X button: present (2b) — maps to 'Stay here'" },
              { text: "Footer: 3-action layout within 2b — vertical stacking justified by 3 options" },
              { text: "Yellow warning accent: keep — semantic for unsaved data loss", ok: true },
              { text: "Non-dismissible backdrop: keep", ok: true },
            ]} />
            <ModalChrome
              title="Leave without saving?"
              subtitle="Your new sale form has unsaved changes."
              hasX footerLayout="stacked"
              primaryLabel="Save draft" secondaryLabel="Discard changes"
            />
          </>
        }
      />

      {/* StatusControl + WithdrawalReasonModal — 2b */}
      <CompCard
        id="withdrawal-modal"
        name="StatusControl + WithdrawalReasonModal"
        file="components/transaction/StatusControl.tsx (inline)"
        pages="/agent/transactions/[id]"
        category="2b — Decision + impact"
        note="Click status badge to open 4-option dropdown. Select Withdrawn to trigger reason modal — 10 predefined reasons + Other with custom text. Status change fails on mock ID."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger ghost" onClick={() => setStatus((v) => !v)}>
              {status ? "Hide" : "Render StatusControl"}
            </button>
            {status && (
              <div style={{ padding: "0 0 0 0", width: "100%" }}>
                <StatusControl transactionId={MOCK_TX_ID} currentStatus="active" />
              </div>
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes — WithdrawalReasonModal</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 460px (2b)" },
              { text: "X button: present (2b — user can cancel withdrawal)" },
              { text: "Footer: horizontal — Cancel left, Confirm withdrawal right (danger)" },
              { text: "10 predefined reasons + Other: keep", ok: true },
              { text: "Custom text field conditional on 'Other': keep", ok: true },
            ]} />
            <p className="oa-diff-heading" style={{ marginTop: 10 }}>What changes — StatusControlDropdown (Cat 4a)</p>
            <DiffList items={[
              { text: "Canonicalize to agent-dropdown-in animation and agent-dropdown-item class" },
              { text: "4-option layout and optimistic update: keep", ok: true },
            ]} />
            <ModalChrome
              title="Reason for withdrawal" hasX footerLayout="inline"
              primaryLabel="Confirm withdrawal" secondaryLabel="Cancel"
              primaryDanger
              bodyContent="Select from 10 predefined reasons, or choose 'Other' for free text."
            />
          </>
        }
      />

      {/* AccountDangerZone — 2b destructive */}
      <CompCard
        id="danger-modal"
        name="AccountDangerZone (inline danger modal)"
        file="components/agent/AccountDangerZone.tsx"
        pages="/agent/settings"
        category="2b — Decision + impact (destructive)"
        note="Red danger styling. Email confirmation gate. Fixed positioning, no portal. Export data also present."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger ghost" onClick={() => setDanger((v) => !v)}>
              {danger ? "Hide" : "Render AccountDangerZone"}
            </button>
            {danger && (
              <div style={{ padding: "0 16px 14px" }}>
                <AccountDangerZone userEmail="audit@example.com" />
              </div>
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Extract delete modal into createPortal — currently uses position:fixed inline with no z-index token" },
              { text: "z-index: add explicit var(--agent-z-modal) 1000" },
              { text: "X button: present — destructive confirms get X per spec" },
              { text: "Max-width: 460px (2b)" },
              { text: "Email confirmation gate: keep — critical safety pattern", ok: true },
              { text: "Red/danger semantic: keep", ok: true },
            ]} />
            <ModalChrome
              title="Delete account"
              subtitle="Type your email address to confirm. This cannot be undone."
              hasX footerLayout="inline"
              primaryLabel="Delete my account" secondaryLabel="Cancel"
              primaryDanger
            />
          </>
        }
      />

      {/* UnsavedChangesModal — 2b, nested */}
      <CompCard
        id="unsaved-modal"
        name="UnsavedChangesModal"
        file="components/transaction/EditSaleDetailsDrawer.tsx (inline)"
        pages="/agent/transactions/[id] (via EditSaleDetailsDrawer)"
        category="2b — Decision + impact"
        note="Nested inside EditSaleDetailsDrawer. Lists dirty sections. Three actions: Save all / Discard / Keep editing. Accessible by making changes in the drawer then clicking X."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Trigger via EditSaleDetailsDrawer (Section 1): make changes in any section, then click X.</span>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: 460px (2b)" },
              { text: "X button: present — maps to 'Keep editing'" },
              { text: "Footer: 3 stacked actions — Save all (primary), Discard (danger-ghost), Keep editing (ghost)" },
              { text: "Nesting: stays as a modal-within-drawer (z-index 1001 to sit above parent 1b drawer)" },
              { text: "Dirty section list: keep", ok: true },
            ]} />
            <ModalChrome
              title="You have unsaved changes"
              subtitle="Property section and Timeline section have unsaved changes."
              hasX footerLayout="stacked"
              primaryLabel="Save all sections" secondaryLabel="Discard changes"
            />
          </>
        }
      />

      {/* AddressConsequencesModal — 2b, nested */}
      <CompCard
        id="address-modal"
        name="AddressConsequencesModal"
        file="components/transaction/EditSaleDetailsDrawer.tsx (inline)"
        pages="/agent/transactions/[id] (via EditSaleDetailsDrawer)"
        category="2b — Decision + impact"
        note="Shown when property address is changed. Shows impact count. Non-dismissible. Trigger: change address in EditSaleDetailsDrawer → Save property section."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Trigger via EditSaleDetailsDrawer (Section 1): edit address field → Save property section.</span>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: 460px (2b)" },
              { text: "X button: absent — non-dismissible, user must choose to proceed or cancel" },
              { text: "Footer: horizontal — Cancel left, Confirm address change right" },
              { text: "Impact count display: keep", ok: true },
              { text: "Non-dismissible backdrop: keep", ok: true },
            ]} />
            <ModalChrome
              title="Address change affects 4 items"
              subtitle="Updating this address will regenerate 3 chase templates and 1 milestone note."
              hasX={false} footerLayout="inline"
              primaryLabel="Confirm change" secondaryLabel="Cancel"
            />
          </>
        }
      />

      {/* ExchangeCelebration — 2e */}
      <CompCard
        id="exchange-celebration"
        name="ExchangeCelebration"
        file="components/milestones/ExchangeCelebration.tsx"
        pages="/agent/transactions/[id] (post-exchange)"
        category="2e — Celebration"
        note="Full-screen canvas confetti. Tap to dismiss. z-index 200. Respects prefers-reduced-motion."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setCelebrate(true)}>Open</button>
            {celebrate && <ExchangeCelebration address={MOCK_ADDR} onDismiss={() => setCelebrate(false)} />}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "z-index: 200 → var(--agent-z-modal) 1000 — currently buried under drawers/modals if any are open" },
              { text: "Animation: agent-modal-in--celebrate (scale 0.92 → 1, 200ms) — formalise as named keyframe" },
              { text: "Canvas confetti: keep", ok: true },
              { text: "Tap-to-dismiss: keep", ok: true },
              { text: "Reduced-motion: already implemented — keep", ok: true },
            ]} />
            <div style={{ padding: "14px 0 4px", textAlign: "center", fontSize: 12, color: "rgba(15,23,42,0.40)" }}>
              Full-screen by definition — no bounded preview meaningful. Visual is unchanged; only z-index and animation keyframe name change.
            </div>
          </>
        }
      />
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

      <CompCard
        id="risk-popover"
        name="RiskBadgeWithPopover"
        file="components/transactions/RiskBadgeWithPopover.tsx"
        pages="/agent/transactions (list rows)"
        category="3a — Detail popover"
        note="Hover or click badge. Dynamic above/below positioning. Hover-delayed close. Scroll to dismiss."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-label">risk data</span>
            <StateBtn label="low" active={riskVariant === "low"} onClick={() => setRiskVariant("low")} />
            <StateBtn label="high" active={riskVariant === "high"} onClick={() => setRiskVariant("high")} />
            <span className="oa-sep" />
            <span className="oa-note-pill">hover badge to open popover</span>
            <div style={{ marginLeft: "auto" }}>
              <RiskBadgeWithPopover raw={riskVariant === "low" ? MOCK_HEALTH_LOW : MOCK_HEALTH_HIGH} />
            </div>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 340px (3a)" },
              { text: "Animation: ensure agent-dropdown-in on open, agent-dropdown-out on close" },
              { text: "z-index: ensure var(--agent-z-dropdown) 1500" },
              { text: "No backdrop — correct for 3a", ok: true },
              { text: "Dynamic above/below positioning: keep", ok: true },
              { text: "Scroll-to-dismiss: keep", ok: true },
            ]} />
          </>
        }
      />

      <CompCard
        id="missingfee-desktop"
        name="MissingFeeRow — desktop popover"
        file="components/analytics/MissingFeeRow.tsx (inline)"
        pages="/agent/analytics"
        category="3a — Detail popover"
        note="Desktop (≥768px): floating near 'Set fee' button. Fee type £/%, VAT toggle. Save fails on mock ID."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger ghost" onClick={() => setFeeRendered((v) => !v)}>
              {feeRendered ? "Hide" : "Render MissingFeeRow"}
            </button>
            <span className="oa-note-pill">≥768px: click 'Set fee' for popover · &lt;768px: bottom sheet</span>
            {feeRendered && (
              <div style={{ padding: "0 0 0 0", width: "100%" }}>
                <MissingFeeRow
                  id={MOCK_TX_ID} propertyAddress={MOCK_ADDR} ownerLine="Emily Thornton"
                  awaitingAssignment={false} txBasePath="/agent/transactions/audit-demo"
                />
              </div>
            )}
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes — desktop popover (3a)</p>
            <DiffList items={[
              { text: "Max-width: canonicalize to 340px (3a)" },
              { text: "Animation: agent-dropdown-in on open" },
              { text: "Dismiss: click-outside + Escape + scroll — verify all three work", ok: true },
              { text: "No backdrop: correct", ok: true },
            ]} />
          </>
        }
      />

      <CompCard
        id="missingfee-mobile"
        name="MissingFeeRow — mobile sheet"
        file="components/analytics/MissingFeeRow.tsx (inline)"
        pages="/agent/analytics"
        category="3b — Mobile sheet"
        note="Mobile (&lt;768px): full-screen bottom sheet. Same data as desktop popover, different chrome. Resize to &lt;768px and click 'Set fee'."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Resize window below 768px — same MissingFeeRow trigger above shows sheet</span>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes — mobile sheet (3b)</p>
            <DiffList items={[
              { text: "Animation: add agent-sheet-in keyframe (translateY 100% → 0, 280ms) — new keyframe needed in agent-system.css" },
              { text: "Exit animation: add agent-sheet-out (translateY 0 → 100%, 220ms)" },
              { text: "Border-radius: canonicalize to 20px 20px 0 0 top edge" },
              { text: "Backdrop: use agent-backdrop-overlay (35% opacity, 4px blur) — lighter than full modal backdrop" },
              { text: "Max-height: 80vh with overflow-y scroll", ok: true },
              { text: "Full-width bottom anchor: correct", ok: true },
            ]} />
          </>
        }
      />

      <CompCard
        id="tone-selector"
        name="ToneSelector"
        file="components/chase/ChaseDrawer.tsx (inline)"
        pages="/agent/transactions/[id] (inside ChaseDrawer)"
        category="4a — Selection menu"
        note="Embedded in ChaseDrawer. Not extractable standalone. Open ChaseDrawer above and click tone pill."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Inspect via ChaseDrawer (Section 1)</span>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Animation: ensure agent-dropdown-in/out classes" },
              { text: "z-index: ensure var(--agent-z-dropdown) 1500 (must clear its parent drawer at 1000)" },
              { text: "6-tone layout with colour pills: keep", ok: true },
              { text: "Recommended indicator: keep", ok: true },
            ]} />
          </>
        }
      />

      <CompCard
        id="status-dropdown"
        name="StatusControlDropdown"
        file="components/transaction/StatusControl.tsx (inline)"
        pages="/agent/transactions/[id]"
        category="4a — Selection menu"
        note="Fixed dropdown via createPortal. 4 options. 'Withdrawn' triggers WithdrawalReasonModal. Inspect via StatusControl (Section 2)."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Inspect via StatusControl (Section 2 above)</span>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Animation: canonicalize to agent-dropdown-in/out" },
              { text: "Item class: ensure agent-dropdown-item for each option" },
              { text: "z-index: var(--agent-z-dropdown) 1500" },
              { text: "Optimistic update + outside-click dismiss: keep", ok: true },
            ]} />
          </>
        }
      />
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

  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 4 — Dropdown Menus</p>

      <CompCard
        id="solicitor-picker"
        name="SolicitorPicker"
        file="components/solicitors/SolicitorPicker.tsx"
        pages="New sale form, transaction form tabs"
        category="4a — Selection menu"
        note="Combobox-style search. Debounced 200ms. 'Add new firm' opens AddFirmModal."
        currentContent={
          <div>
            <div className="oa-card-body">
              <span className="oa-label">initial value</span>
              <StateBtn label="empty" active={!solPreset} onClick={() => { setSolPreset(false); setSolValue(null); }} />
              <StateBtn label="pre-filled" active={solPreset} onClick={() => { setSolPreset(true); setSolValue(MOCK_SOLICITOR_VALUE); }} />
            </div>
            <div style={{ padding: "0 16px 14px" }}>
              <SolicitorPicker label="Vendor's solicitor" value={solValue} onChange={setSolValue} />
            </div>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Dropdown layer: canonicalize to agent-dropdown-in/out animation, agent-dropdown-item class per result row" },
              { text: "z-index: var(--agent-z-dropdown) 1500" },
              { text: "Combobox search + debounce: keep", ok: true },
              { text: "Add firm inline modal: keep", ok: true },
              { text: "Firm + handler two-step selection: keep", ok: true },
            ]} />
          </>
        }
      />

      <CompCard
        id="broker-picker"
        name="BrokerPicker"
        file="components/brokers/BrokerPicker.tsx"
        pages="New sale form, transaction form tabs"
        category="4a — Selection menu"
        note="Same shape as SolicitorPicker. 'Add new brokerage' opens AddBrokerModal. Preferred broker pre-populates."
        currentContent={
          <div>
            <div className="oa-card-body">
              <span className="oa-label">initial value</span>
              <StateBtn label="empty" active={!brokerPreset} onClick={() => { setBrokerPreset(false); setBrokerValue(null); }} />
              <StateBtn label="pre-filled" active={brokerPreset} onClick={() => { setBrokerPreset(true); setBrokerValue(MOCK_BROKER_VALUE); }} />
            </div>
            <div style={{ padding: "0 16px 14px" }}>
              <BrokerPicker
                label="Mortgage broker" value={brokerValue} onChange={setBrokerValue}
                preferredBroker={brokerPreset ? MOCK_BROKER_VALUE : null}
              />
            </div>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Dropdown layer: same as SolicitorPicker — canonicalize agent-dropdown-in/out, agent-dropdown-item" },
              { text: "z-index: var(--agent-z-dropdown) 1500" },
              { text: "Preferred broker pre-fill: keep", ok: true },
            ]} />
          </>
        }
      />

      <CompCard
        id="side-snooze"
        name="SideSnoozeMenu"
        file="components/reminders/AgentRemindersList.tsx (inline)"
        pages="/agent/work-queue"
        category="4b — Action menu"
        note="'Snooze all' at foot of each reminder group. Portal dropdown above trigger. 5 duration options. Not extractable — inspect on /agent/work-queue."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Inspect on /agent/work-queue (not extractable as standalone)</span>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Already uses agent-dropdown-in/out — keep", ok: true },
              { text: "Canonicalize item class to agent-dropdown-item" },
              { text: "z-index: verify var(--agent-z-dropdown) 1500" },
              { text: "5 duration options, no checkmarks (4b action): keep", ok: true },
            ]} />
          </>
        }
      />

      <CompCard
        id="row-snooze"
        name="RowSnoozeMenu"
        file="components/reminders/AgentRemindersList.tsx (inline)"
        pages="/agent/work-queue"
        category="4b — Action menu"
        note="Per-row clock-icon trigger. Same options as SideSnoozeMenu. Portal. Not extractable."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Inspect on /agent/work-queue (not extractable as standalone)</span>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Same as SideSnoozeMenu: canonicalize agent-dropdown-item, verify z-index 1500" },
              { text: "Per-row action menu (4b): correct, keep", ok: true },
            ]} />
          </>
        }
      />
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
      <button type="button" className="oa-trigger ghost" onClick={() => addToast("File created", "success", "14 Birchwood Close, Birmingham B15 2TT")}>Legacy · success + subtext</button>
      <button type="button" className="oa-trigger ghost" onClick={() => addToast("Failed to remove", "error")}>Legacy · error</button>
      <button type="button" className="oa-trigger ghost" onClick={() => addToast("1 invite sent", "info")}>Legacy · info</button>
    </>
  );
}

function ToastsSection() {
  const { toast } = useAgentToast();

  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 5 — Toasts</p>

      <CompCard
        id="agent-toaster"
        name="AgentToaster — success / info / error / warning / action"
        file="components/agent/AgentToaster.tsx"
        pages="Global (agent layout)"
        category="5a–5e — canonical"
        note="Full-featured toast system. Max 4 stacked. Hover pauses. Action button support. Semantic types."
        currentContent={
          <div>
            <div className="oa-toast-grid">
              <button type="button" className="oa-trigger ghost" onClick={() => toast.success("Step confirmed")}>Simple success</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.success("Step confirmed", { description: "+3 steps reconciled at exchange" })}>Success + description</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.success("MOS confirmed for both sides", { description: "Both sides have confirmed exchange." })}>Success + long description</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.success("Skipped")}>Terse (Skipped)</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.success("To-do completed")}>To-do completed</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.info("Step undone", { description: "+2 linked steps also undone" })}>Info · cascade</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.info("Member removed from team")}>Info · team</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.error("Couldn't update status — please try again")}>Error</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.error("Couldn't complete milestone", { description: "Exchange must be confirmed on both sides first." })}>Error + description</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.warning("File may be at risk", { description: "17 days without activity." })}>Warning</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.success("File moved to On hold", { action: { label: "Undo", onClick: () => toast.info("Undid hold") } })}>Success + Undo action</button>
              <button type="button" className="oa-trigger ghost" onClick={() => toast.error("Save failed", { action: { label: "Retry", onClick: () => toast.success("Saved") }, duration: 0 })}>Error + Retry + persistent</button>
              <button type="button" className="oa-trigger ghost" onClick={() => { for (let i = 0; i < 5; i++) toast.success(`Toast ${i + 1} of 5`); }}>Stack test (5 rapid)</button>
            </div>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "AgentToaster is already the canonical system — no visual changes", ok: true },
              { text: "ToastContext (legacy) retirement: migrate ChainDrawer + NewSaleFlow to useAgentToast() in Stage 4" },
              { text: "NewTransactionToast: verify it calls useAgentToast() not ToastContext" },
              { text: "Duration tokens: success 4s · info 4s · warning 6s · error 8s — already correct", ok: true },
            ]} />
          </>
        }
      />

      <CompCard
        id="toast-context"
        name="ToastContext (legacy)"
        file="components/ui/ToastContext.tsx"
        pages="New sale flow, ChainDrawer"
        category="5 — retire"
        note="Older simpler system. Used by ChainDrawer and NewSaleFlow. Same position, slightly different visual. 4s auto-dismiss, no action button support."
        currentContent={
          <div className="oa-toast-grid">
            <LegacyToastTrigger />
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">Decision confirmed: retire ToastContext</p>
            <DiffList items={[
              { text: "Stage 4 migration: ChainDrawer useToast() → useAgentToast()" },
              { text: "Stage 4 migration: NavAwayModal / NewSaleFlow useToast() → useAgentToast()" },
              { text: "ToastContext.tsx + ToastProvider: delete after migration" },
              { text: "Visual gap: legacy toasts have no left-border semantic colour stripe — AgentToaster does, which is the improvement" },
            ]} />
          </>
        }
      />

      <CompCard
        id="new-tx-toast"
        name="NewTransactionToast"
        file="components/transaction/NewTransactionToast.tsx"
        pages="Post-creation redirect"
        category="5a — success"
        note="Session-storage gate (shows once per session). Address as subtext. File creation success."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Shown once per session after new file creation — inspect in new sale flow</span>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Verify component calls useAgentToast() not useToast() — if legacy, migrate in Stage 4" },
              { text: "Session-storage single-show gate: keep", ok: true },
              { text: "Address as description line: keep", ok: true },
            ]} />
          </>
        }
      />
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
      <CompCard
        id="global-search"
        name="AgentGlobalSearch"
        file="components/layout/AgentGlobalSearch.tsx"
        pages="All agent pages (AgentShell)"
        category="6a — Command overlay"
        note="Cmd+K / Ctrl+K trigger. Full-screen panel. Debounced 300ms. Keyboard nav ↑↓ Enter. A second instance below for direct trigger."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Press Cmd+K / Ctrl+K to open. Or:</span>
            <AgentGlobalSearch />
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Focus trap: add — Tab should cycle within search panel only" },
              { text: "Panel position: upper-centre (pt-[15vh]) — verify matches Cmd+K convention", ok: true },
              { text: "Max-width 640px: verify", ok: true },
              { text: "Escape + backdrop click dismiss: already correct", ok: true },
              { text: "Keyboard nav: already correct", ok: true },
            ]} />
          </>
        }
      />
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
      <CompCard
        id="feedback-widget"
        name="FeedbackWidget"
        file="components/feedback/FeedbackWidget.tsx"
        pages="All agent pages (agent layout)"
        category="6b — Feedback"
        note="Floating bottom-right button. role=dialog, aria-modal. Bug / Suggestion / Question flows. Screenshot capture. Layout instance active. Second instance below:"
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Layout instance active (bottom-right). Second instance:</span>
            <FeedbackWidget checklistAware={false} userId={MOCK_USER_ID} />
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Focus trap: add (currently role=dialog aria-modal is correct but Tab escapes the panel)" },
              { text: "role=dialog aria-modal: already correct", ok: true },
              { text: "Three-category flow: keep", ok: true },
              { text: "Screenshot capture: keep", ok: true },
              { text: "Escape + X close: already correct", ok: true },
            ]} />
          </>
        }
      />
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
      <CompCard
        id="submission-overlay"
        name="SubmissionOverlay"
        file="components/transactions-v2/SubmissionOverlay.tsx"
        pages="New sale flow (file creation)"
        category="6c — Blocking loader"
        note="Full-screen backdrop. z-index 3000 (documented exception — above all other overlays). 6 rotating messages. Auto-dismisses after 3.5s on this card."
        currentContent={
          <div className="oa-card-body">
            <button type="button" className="oa-trigger" onClick={() => setVisible(true)}>Show overlay</button>
            {visible && <span className="oa-note-pill">Auto-dismisses in ~3.5s</span>}
            <SubmissionOverlay isVisible={visible} />
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "z-index 3000: no change — 6c blocking loader is the documented exception above all other overlays", ok: true },
              { text: "No dismiss mechanism: correct — user cannot interrupt file creation", ok: true },
              { text: "Rotating messages: keep", ok: true },
              { text: "Reduced motion: spinner animation suppresses — verify static icon fallback is implemented" },
            ]} />
          </>
        }
      />
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
      <CompCard
        id="changelog-dropdown"
        name="ChangelogDropdown"
        file="components/layout/ChangelogDropdown.tsx"
        pages="All agent pages (AgentShell sidebar)"
        category="3c — Content panel"
        note="Bell icon in sidebar. Right-aligned, top-9 from button. Unread dot clears on open (localStorage). Escape + outside-click dismiss."
        currentContent={
          <div className="oa-card-body">
            <span className="oa-note-pill">Click the bell icon:</span>
            <ChangelogDropdown />
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">What changes</p>
            <DiffList items={[
              { text: "Category: 3c content panel — read-only panel, not a menu, not a dialog" },
              { text: "Max-width: 320px (3c — wider than 3a detail popovers)" },
              { text: "Animation: agent-dropdown-in on open — verify" },
              { text: "z-index: var(--agent-z-dropdown) 1500" },
              { text: "Escape + outside-click: already correct", ok: true },
              { text: "Unread dot localStorage gate: keep", ok: true },
            ]} />
          </>
        }
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 10 — native window.confirm()
// ─────────────────────────────────────────────────────────────────────────────

function NativeConfirmSection() {
  return (
    <div className="oa-section">
      <p className="oa-section-title">Section 10 — Native window.confirm() — design debt</p>
      <CompCard
        id="native-confirm"
        name="window.confirm() — 5 call sites"
        file="Multiple components"
        pages="Various"
        category="→ replace with 2a"
        note="Native browser dialogs. Cannot be styled or themed. All 5 should be replaced with custom 2a simple confirmation modals. Trigger buttons fire the actual native dialogs."
        currentContent={
          <div className="oa-toast-grid">
            <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Resend the invitation email to your director?")}>InviteDirector — resend invite</button>
            <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Remove Sarah Mitchell from the team? They will no longer be able to log in.")}>TeamManagement — remove member</button>
            <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Cancel the invitation for Sarah Mitchell? The link will stop working.")}>TeamManagement — cancel invite</button>
            <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Discard chain and 2 added nodes?")}>ChainSection — discard chain</button>
            <button type="button" className="oa-trigger ghost" onClick={() => window.confirm("Delete this task?")}>ManualTaskCard — delete task</button>
          </div>
        }
        proposedContent={
          <>
            <p className="oa-diff-heading">All 5 should become 2a simple confirm modals</p>
            <DiffList items={[
              { text: "InviteDirector: 2a — 'Resend invitation?' · Yes, resend / Cancel" },
              { text: "TeamManagement remove: 2a destructive — 'Remove Sarah Mitchell?' · Remove / Cancel" },
              { text: "TeamManagement cancel invite: 2a destructive — 'Cancel invitation?' · Cancel invite / Keep" },
              { text: "ChainSection discard: 2a destructive — 'Discard chain?' · Discard / Keep editing" },
              { text: "ManualTaskCard delete: 2a destructive — 'Delete this task?' · Delete / Cancel" },
            ]} />
            <ModalChrome
              title="Remove Sarah Mitchell?"
              subtitle="They will no longer be able to log in to the portal."
              hasX={false} footerLayout="stacked"
              primaryLabel="Remove team member" secondaryLabel="Cancel"
              primaryDanger
            />
          </>
        }
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decisions summary
// ─────────────────────────────────────────────────────────────────────────────

const ALL_COMPONENTS = [
  { key: "chase-drawer",         name: "ChaseDrawer",                    category: "1a" },
  { key: "edit-drawer",          name: "EditSaleDetailsDrawer",          category: "1b" },
  { key: "recon-drawer",         name: "ReconciliationDrawer",           category: "1b" },
  { key: "chain-drawer",         name: "ChainDrawer",                    category: "1c" },
  { key: "addnode-drawer",       name: "AddNodeDrawer",                  category: "1a" },
  { key: "welcome-modal",        name: "WelcomeModal",                   category: "2d" },
  { key: "undo-modal",           name: "UndoMilestoneModal",             category: "2b" },
  { key: "mortgage-modal",       name: "MortgageModal",                  category: "2a" },
  { key: "survey-modal",         name: "SurveyNrConfirmModal",           category: "2a" },
  { key: "addfirm-modal",        name: "AddFirmModal",                   category: "2c" },
  { key: "addbroker-modal",      name: "AddBrokerModal",                 category: "2c" },
  { key: "dupaddr-modal",        name: "DuplicateAddressModal",          category: "2b" },
  { key: "navaway-modal",        name: "NavAwayModal",                   category: "2b" },
  { key: "withdrawal-modal",     name: "WithdrawalReasonModal",          category: "2b" },
  { key: "danger-modal",         name: "AccountDangerZone",              category: "2b" },
  { key: "unsaved-modal",        name: "UnsavedChangesModal",            category: "2b" },
  { key: "address-modal",        name: "AddressConsequencesModal",       category: "2b" },
  { key: "exchange-celebration", name: "ExchangeCelebration",            category: "2e" },
  { key: "risk-popover",         name: "RiskBadgeWithPopover",           category: "3a" },
  { key: "missingfee-desktop",   name: "MissingFeeRow (desktop)",        category: "3a" },
  { key: "missingfee-mobile",    name: "MissingFeeRow (mobile)",         category: "3b" },
  { key: "tone-selector",        name: "ToneSelector",                   category: "4a" },
  { key: "status-dropdown",      name: "StatusControlDropdown",          category: "4a" },
  { key: "solicitor-picker",     name: "SolicitorPicker",                category: "4a" },
  { key: "broker-picker",        name: "BrokerPicker",                   category: "4a" },
  { key: "side-snooze",          name: "SideSnoozeMenu",                 category: "4b" },
  { key: "row-snooze",           name: "RowSnoozeMenu",                  category: "4b" },
  { key: "agent-toaster",        name: "AgentToaster",                   category: "5a–5e" },
  { key: "toast-context",        name: "ToastContext (legacy)",           category: "retire" },
  { key: "new-tx-toast",         name: "NewTransactionToast",            category: "5a" },
  { key: "global-search",        name: "AgentGlobalSearch",              category: "6a" },
  { key: "feedback-widget",      name: "FeedbackWidget",                 category: "6b" },
  { key: "submission-overlay",   name: "SubmissionOverlay",              category: "6c" },
  { key: "changelog-dropdown",   name: "ChangelogDropdown",              category: "3c" },
  { key: "native-confirm",       name: "window.confirm() × 5",          category: "→ 2a" },
];

function DecisionsSummary() {
  const { picks } = useContext(PicksCtx);
  const made = ALL_COMPONENTS.filter((c) => picks[c.key]);
  const total = ALL_COMPONENTS.length;
  const nCurrent  = made.filter((c) => picks[c.key] === "current").length;
  const nProposed = made.filter((c) => picks[c.key] === "proposed").length;
  const nModify   = made.filter((c) => picks[c.key] === "modify").length;

  function generateMarkdown() {
    const date = new Date().toISOString().split("T")[0];
    const rows = ALL_COMPONENTS.map((c) => {
      const p = picks[c.key];
      const dec = p === "current" ? "Keep current" : p === "proposed" ? "Use canonical" : p === "modify" ? "Modify proposal" : "— pending —";
      return `| ${c.name} | ${c.category} | ${dec} | |`;
    });
    return [
      "# Overlay Standards — Decisions",
      "",
      `**Date:** ${date}`,
      "**Reviewed via:** `/agent/audit/overlays` Stage 2",
      "",
      "| Component | Category | Decision | Notes |",
      "|---|---|---|---|",
      ...rows,
    ].join("\n");
  }

  return (
    <div className="oa-section">
      <p className="oa-section-title">
        Decisions — {made.length}/{total} picked{made.length === total ? " · complete ✓" : ""}
      </p>
      <div className="oa-card">
        <div className="oa-dec-stats">
          <span>Keep current: <span>{nCurrent}</span></span>
          <span>Use canonical: <span>{nProposed}</span></span>
          <span>Modify: <span>{nModify}</span></span>
          <span style={{ marginLeft: "auto" }}>Pending: <span>{total - made.length}</span></span>
        </div>
        <div style={{ padding: "0 16px 4px", overflowX: "auto" }}>
          <table className="oa-dec-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Category</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {ALL_COMPONENTS.map((c) => {
                const p = picks[c.key];
                return (
                  <tr key={c.key}>
                    <td>{c.name}</td>
                    <td><span className="oa-cat-badge" style={{ margin: 0 }}>{c.category}</span></td>
                    <td>
                      {p ? (
                        <span style={{
                          fontSize: 11.5, fontWeight: 600,
                          color: p === "current" ? "rgba(15,23,42,0.65)" : p === "proposed" ? "var(--agent-coral)" : "rgb(150,115,5)",
                        }}>
                          {p === "current" ? "Keep current" : p === "proposed" ? "Use canonical" : "Modify proposal"}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "rgba(15,23,42,0.25)", fontStyle: "italic" }}>pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="oa-card-body" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12, paddingBottom: 12 }}>
          <button type="button" className="oa-trigger ghost"
            onClick={() => { void navigator.clipboard.writeText(generateMarkdown()); }}>
            Copy decisions as Markdown
          </button>
          <span className="oa-note-pill">paste in chat → Claude writes overlay-standards-decisions.md</span>
        </div>
      </div>
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

  const [picks, setPicksState] = useState<Record<string, PickVal>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("overlay-audit-picks") ?? "{}"); }
    catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem("overlay-audit-picks", JSON.stringify(picks)); }
    catch { /* noop */ }
  }, [picks]);

  const setPick = (key: string, val: PickVal) => setPicksState((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".agent-shell-root");
    if (!shell) return;
    const prevTheme = shell.getAttribute("data-theme") ?? "sunset";
    const prevNight = shell.hasAttribute("data-night");
    shell.setAttribute("data-theme", theme);
    if (night) shell.setAttribute("data-night", ""); else shell.removeAttribute("data-night");
    return () => {
      shell.setAttribute("data-theme", prevTheme);
      if (prevNight) shell.setAttribute("data-night", ""); else shell.removeAttribute("data-night");
    };
  }, [theme, night]);

  useEffect(() => {
    if (solid) document.documentElement.setAttribute("data-solid", "");
    else document.documentElement.removeAttribute("data-solid");
    return () => { document.documentElement.removeAttribute("data-solid"); };
  }, [solid]);

  const made = Object.keys(picks).filter((k) => ALL_COMPONENTS.some((c) => c.key === k)).length;

  return (
    <PicksCtx.Provider value={{ picks, setPick }}>
      <ToastProvider>
        <style>{CSS}</style>
        <div data-theme={theme} data-night={night ? "" : undefined} data-rm={rm ? "1" : "0"} style={{ minHeight: "100vh" }}>

          <div className="oa-bar">
            <span className="oa-label">theme</span>
            {THEMES.map((t) => (
              <button key={t} type="button" className={`oa-pill${theme === t ? " on" : ""}`} onClick={() => setTheme(t)}>{t}</button>
            ))}
            <span className="oa-sep" />
            <button type="button" className={`oa-pill${solid ? " on" : ""}`} onClick={() => setSolid((v) => !v)}>solid</button>
            <button type="button" className={`oa-pill${night ? " on" : ""}`} onClick={() => setNight((v) => !v)}>night</button>
            <button type="button" className={`oa-pill${rm ? " on" : ""}`} onClick={() => setRm((v) => !v)}>rm</button>
            <span className="oa-sep" />
            <span className="oa-label" style={{ marginLeft: "auto" }}>
              35 components · {made}/35 picked
            </span>
          </div>

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
            <DecisionsSummary />
          </div>

        </div>
      </ToastProvider>
    </PicksCtx.Provider>
  );
}
