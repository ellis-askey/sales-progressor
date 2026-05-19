"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext, forwardRef } from "react";
import { createPortal } from "react-dom";

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
import { AgentGlobalSearch } from "@/components/layout/AgentGlobalSearch";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { SubmissionOverlay } from "@/components/transactions-v2/SubmissionOverlay";
import { ChangelogDropdown } from "@/components/layout/ChangelogDropdown";
import type { UndoImpact } from "@/lib/services/milestones";
import type { HealthRaw } from "@/components/transactions/TransactionRowView";
import type { SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import type { BrokerSelection } from "@/components/brokers/BrokerPicker";

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes avr-drawer-in  { from { transform:translateX(100%); opacity:0 } to { transform:none; opacity:1 } }
  @keyframes avr-drawer-out { from { transform:none; opacity:1 } to { transform:translateX(100%); opacity:0 } }
  @keyframes avr-modal-out  { from { transform:none; opacity:1 } to { transform:translateY(14px) scale(.97); opacity:0 } }
  @keyframes avr-toast-r    { from { transform:translateX(110%); opacity:0 } to { transform:none; opacity:1 } }
  @keyframes avr-toast-up   { from { transform:translateY(20px); opacity:0 } to { transform:none; opacity:1 } }
  @keyframes avr-toast-dn   { from { transform:translateY(-20px); opacity:0 } to { transform:none; opacity:1 } }
  @keyframes avr-scale-bounce { 0%{opacity:0;transform:scale(.82)} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  @keyframes avr-dd-slide   { from { transform:translateY(-6px); opacity:0 } to { transform:none; opacity:1 } }
  @keyframes avr-dd-scale   { from { transform:scale(.92); opacity:0; transform-origin:top left } to { transform:scale(1); opacity:1; transform-origin:top left } }
  @keyframes avr-dd-fade    { from { opacity:0 } to { opacity:1 } }
  @keyframes avr-dd-out     { from { opacity:1 } to { opacity:0 } }
  @keyframes avr-progress   { from { width:100% } to { width:0% } }
  @keyframes avr-fs-slide   { from { transform:translateY(24px); opacity:0 } to { transform:none; opacity:1 } }

  [data-rm="1"] *,[data-rm="1"] *::before,[data-rm="1"] *::after {
    animation-duration:0ms!important; transition-duration:0ms!important;
  }

  /* control bar */
  .oa-bar { display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,.06);background:rgba(255,255,255,.55);backdrop-filter:blur(12px);position:sticky;top:0;z-index:10; }
  .oa-pill { padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid rgba(0,0,0,.10);background:rgba(255,255,255,.6);color:rgba(15,23,42,.55);transition:all 120ms;user-select:none; }
  .oa-pill.on { background:rgba(15,23,42,.85);color:#fff;border-color:transparent; }
  .oa-pill:hover:not(.on) { background:rgba(255,255,255,.9);color:rgba(15,23,42,.80); }
  .oa-sep { width:1px;height:20px;background:rgba(0,0,0,.08);margin:0 4px; }
  .oa-label { font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(15,23,42,.30);margin-right:2px; }
  .oa-trigger { padding:6px 14px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;background:var(--agent-coral,#ff6b4a);color:#fff;border:none;transition:opacity 100ms; }
  .oa-trigger:hover { opacity:.85; }
  .oa-trigger.ghost { background:transparent;border:1.5px solid rgba(0,0,0,.12);color:rgba(15,23,42,.60); }
  .oa-trigger.ghost:hover { background:rgba(0,0,0,.04); }
  .oa-state-btn { padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid rgba(0,0,0,.10);background:transparent;color:rgba(15,23,42,.45);transition:all 100ms; }
  .oa-state-btn.on { background:rgba(var(--agent-coral-base-rgb,255,107,74),.10);border-color:rgba(var(--agent-coral-base-rgb,255,107,74),.30);color:var(--agent-coral,#ff6b4a); }
  .oa-note-pill { font-size:11px;color:rgba(15,23,42,.35);font-style:italic; }

  /* layout */
  .oa-content { padding:28px 20px 80px;display:flex;flex-direction:column;gap:40px;max-width:1020px;margin:0 auto; }

  /* category block */
  .oa-cat { border:1px solid rgba(0,0,0,.07);border-radius:18px;overflow:hidden;background:rgba(255,255,255,.45); }
  .oa-cat-hdr { display:flex;align-items:center;gap:12px;padding:18px 22px 14px;border-bottom:1px solid rgba(0,0,0,.07); }
  .oa-cat-num { width:26px;height:26px;border-radius:50%;background:var(--agent-coral,#ff6b4a);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
  .oa-cat-title { font-size:16px;font-weight:700;color:rgba(15,23,42,.85); }
  .oa-cat-sub { font-size:12px;color:rgba(15,23,42,.40);margin-left:auto; }

  /* variant tabs */
  .oa-vtabs { display:flex;border-bottom:1px solid rgba(0,0,0,.06);padding:0 22px;background:rgba(0,0,0,.015);overflow-x:auto; }
  .oa-vtab { padding:9px 14px;font-size:12px;font-weight:600;letter-spacing:.03em;color:rgba(15,23,42,.38);cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;transition:all .12s;user-select:none;border-top:none;border-left:none;border-right:none;background:transparent; }
  .oa-vtab.cur:hover:not(.active) { color:rgba(15,23,42,.65);border-bottom-color:rgba(15,23,42,.22); }
  .oa-vtab.var:hover:not(.active) { color:rgba(var(--agent-coral-base-rgb,255,107,74),.75);border-bottom-color:rgba(var(--agent-coral-base-rgb,255,107,74),.35); }
  .oa-vtab.cur.active { color:rgba(15,23,42,.82);border-bottom-color:rgba(15,23,42,.55); }
  .oa-vtab.var.active { color:var(--agent-coral,#ff6b4a);border-bottom-color:var(--agent-coral,#ff6b4a); }

  /* variant description */
  .oa-vdesc { padding:12px 22px;background:rgba(var(--agent-coral-base-rgb,255,107,74),.04);border-bottom:1px solid rgba(0,0,0,.05);display:flex;align-items:flex-start;gap:9px;font-size:12.5px;color:rgba(15,23,42,.55);line-height:1.5; }
  .oa-vdesc.cur { background:rgba(0,0,0,.02); }
  .oa-vdesc-badge { padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;background:var(--agent-coral,#ff6b4a);color:#fff;flex-shrink:0;margin-top:2px; }
  .oa-vdesc-badge.cur { background:rgba(15,23,42,.45); }

  /* demo area */
  .oa-demo { padding:20px 22px;display:flex;flex-direction:column;gap:12px; }
  .oa-demo-row { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
  .oa-demo-sub { font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:rgba(15,23,42,.30); }

  /* decision row */
  .oa-dec-row { padding:12px 22px;border-top:1px solid rgba(0,0,0,.07);background:rgba(0,0,0,.015);display:flex;align-items:center;gap:9px;flex-wrap:wrap; }
  .oa-dec-label { font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:rgba(15,23,42,.30);margin-right:2px; }
  .oa-dec-btn { padding:4px 14px;border-radius:999px;border:1.5px solid rgba(0,0,0,.10);background:transparent;font-size:12px;font-weight:600;cursor:pointer;color:rgba(15,23,42,.50);transition:all .12s; }
  .oa-dec-btn:hover { border-color:var(--agent-coral,#ff6b4a);color:var(--agent-coral,#ff6b4a); }
  .oa-dec-btn.picked { background:var(--agent-coral,#ff6b4a);color:#fff;border-color:transparent; }

  /* decisions summary */
  .oa-ds-wrap { border:1px solid rgba(0,0,0,.07);border-radius:16px;overflow:hidden;background:rgba(255,255,255,.45); }
  .oa-ds-hdr { padding:14px 20px;background:rgba(0,0,0,.03);border-bottom:1px solid rgba(0,0,0,.07);display:flex;align-items:center;justify-content:space-between; }
  .oa-ds-title { font-size:14px;font-weight:700;color:rgba(15,23,42,.75); }
  .oa-ds-copy { padding:5px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid rgba(0,0,0,.12);background:transparent;color:rgba(15,23,42,.55);transition:all .12s; }
  .oa-ds-copy:hover { background:rgba(0,0,0,.05); }
  .oa-ds-table { width:100%;border-collapse:collapse;font-size:13px; }
  .oa-ds-table th { padding:8px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:rgba(15,23,42,.35);background:rgba(0,0,0,.02);border-bottom:1px solid rgba(0,0,0,.07); }
  .oa-ds-table td { padding:9px 16px;border-bottom:1px solid rgba(0,0,0,.04);color:rgba(15,23,42,.70); }
  .oa-ds-table tr:last-child td { border-bottom:none; }
  .oa-ds-pending { color:rgba(15,23,42,.28);font-style:italic; }
  .oa-ds-picked { color:var(--agent-coral,#ff6b4a);font-weight:700; }

  /* variant overlay primitives used inside portals */
  .avr-close { width:30px;height:30px;border-radius:8px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(15,23,42,.45);transition:background .12s,color .12s;flex-shrink:0; }
  .avr-close:hover { background:rgba(0,0,0,.07);color:rgba(15,23,42,.80); }
  .avr-close:focus-visible { outline:var(--agent-focus-ring,2px solid #ff6b4a);outline-offset:2px; }
  .avr-btn { padding:9px 20px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;border:none;transition:opacity .12s; }
  .avr-btn:focus-visible { outline:var(--agent-focus-ring,2px solid #ff6b4a);outline-offset:2px; }
  .avr-btn.primary { background:var(--agent-coral,#ff6b4a);color:#fff; }
  .avr-btn.primary:hover { opacity:.88; }
  .avr-btn.secondary { background:rgba(0,0,0,.07);color:rgba(15,23,42,.80); }
  .avr-btn.secondary:hover { background:rgba(0,0,0,.11); }
  .avr-btn.danger { background:#dc2626;color:#fff; }
  .avr-btn.danger:hover { opacity:.88; }
  .avr-dd-item { display:flex;align-items:center;gap:9px;padding:9px 13px;width:100%;border:none;background:transparent;cursor:pointer;font-size:13px;color:rgba(15,23,42,.80);text-align:left;transition:background .08s; }
  .avr-dd-item:hover,.avr-dd-item[data-active="true"] { background:rgba(0,0,0,.05); }
  .avr-dd-item:focus-visible { outline:var(--agent-focus-ring,2px solid #ff6b4a);outline-offset:-2px; }

  /* ── Night-mode overrides ── */
  [data-night] .oa-bar { background:rgba(15,23,42,.92);border-color:rgba(255,255,255,.07); }
  [data-night] .oa-pill { background:rgba(255,255,255,.07);color:rgba(255,255,255,.50);border-color:rgba(255,255,255,.10); }
  [data-night] .oa-pill.on { background:rgba(255,255,255,.85);color:rgba(15,23,42,.85);border-color:transparent; }
  [data-night] .oa-pill:hover:not(.on) { background:rgba(255,255,255,.12);color:rgba(255,255,255,.75); }
  [data-night] .oa-sep { background:rgba(255,255,255,.10); }
  [data-night] .oa-label { color:rgba(255,255,255,.30); }
  [data-night] .oa-cat { background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.08); }
  [data-night] .oa-cat-hdr { border-color:rgba(255,255,255,.07); }
  [data-night] .oa-cat-title { color:rgba(255,255,255,.80); }
  [data-night] .oa-cat-sub { color:rgba(255,255,255,.35); }
  [data-night] .oa-vtabs { background:rgba(255,255,255,.02);border-color:rgba(255,255,255,.06); }
  [data-night] .oa-vtab { color:rgba(255,255,255,.32); }
  [data-night] .oa-vtab.cur:hover:not(.active) { color:rgba(255,255,255,.60);border-bottom-color:rgba(255,255,255,.20); }
  [data-night] .oa-vtab.var:hover:not(.active) { color:rgba(var(--agent-coral-base-rgb,255,107,74),.80);border-bottom-color:rgba(var(--agent-coral-base-rgb,255,107,74),.40); }
  [data-night] .oa-vtab.cur.active { color:rgba(255,255,255,.80);border-bottom-color:rgba(255,255,255,.55); }
  [data-night] .oa-vdesc { background:rgba(var(--agent-coral-base-rgb,255,107,74),.07);border-color:rgba(255,255,255,.05);color:rgba(255,255,255,.55); }
  [data-night] .oa-vdesc.cur { background:rgba(255,255,255,.03); }
  [data-night] .oa-demo-sub { color:rgba(255,255,255,.28); }
  [data-night] .oa-note-pill { color:rgba(255,255,255,.38); }
  [data-night] .oa-trigger.ghost { border-color:rgba(255,255,255,.15);color:rgba(255,255,255,.55); }
  [data-night] .oa-trigger.ghost:hover { background:rgba(255,255,255,.07); }
  [data-night] .oa-state-btn { border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.40); }
  [data-night] .oa-state-btn.on { background:rgba(var(--agent-coral-base-rgb,255,107,74),.15);border-color:rgba(var(--agent-coral-base-rgb,255,107,74),.35); }
  [data-night] .oa-dec-row { background:rgba(255,255,255,.02);border-color:rgba(255,255,255,.07); }
  [data-night] .oa-dec-label { color:rgba(255,255,255,.28); }
  [data-night] .oa-dec-btn { border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.45); }
  [data-night] .oa-dec-btn:hover { border-color:var(--agent-coral,#ff6b4a);color:var(--agent-coral,#ff6b4a);background:rgba(var(--agent-coral-base-rgb,255,107,74),.07); }
  [data-night] .oa-dec-btn.picked { background:var(--agent-coral,#ff6b4a);color:#fff;border-color:transparent; }
  [data-night] .oa-ds-wrap { background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.08); }
  [data-night] .oa-ds-hdr { background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.07); }
  [data-night] .oa-ds-title { color:rgba(255,255,255,.70); }
  [data-night] .oa-ds-copy { border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.50); }
  [data-night] .oa-ds-copy:hover { background:rgba(255,255,255,.07); }
  [data-night] .oa-ds-table th { background:rgba(255,255,255,.02);border-color:rgba(255,255,255,.07);color:rgba(255,255,255,.30); }
  [data-night] .oa-ds-table td { border-color:rgba(255,255,255,.04);color:rgba(255,255,255,.65); }
  [data-night] .oa-ds-pending { color:rgba(255,255,255,.25); }
`;

// ─── Contexts ─────────────────────────────────────────────────────────────────

type ThemeCtxT = { theme: string; night: boolean };
const ThemeCtx = createContext<ThemeCtxT>({ theme: "sunset", night: false });
const RmCtx = createContext(false);
const usePortalTheme = () => useContext(ThemeCtx);
const useRm = () => useContext(RmCtx);

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const q = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    const all = el.querySelectorAll<HTMLElement>(q);
    const first = all[0];
    const last = all[all.length - 1];
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (!all.length) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    el.addEventListener("keydown", trap);
    (first ?? el).focus();
    return () => el.removeEventListener("keydown", trap);
  }, [active, ref]);
}

// ─── Mock data ────────────────────────────────────────────────────────────────

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
const MOCK_SOL_VAL: SolicitorSelection = {
  firmId: "sf1", firmName: "Grayson Law LLP", contactId: "sc1",
  contactName: "Sarah Mitchell", phone: "+447700900111", email: "s.mitchell@graysonlaw.co.uk",
};
const MOCK_BROKER_VAL: BrokerSelection = {
  firmId: "bf1", firmName: "Premier Mortgages Ltd", contactId: "bc1",
  contactName: "Daniel Webb", phone: "+447700900444", email: "d.webb@premiermortgages.co.uk",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type VKey = "current" | "v1" | "v2";
type Decision = "v1" | "v2" | null;
type Decisions = Record<string, Decision>;

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function StateBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`oa-state-btn${active ? " on" : ""}`} onClick={onClick}>{label}</button>;
}

const Trig = forwardRef<HTMLButtonElement, { label: string; onClick: () => void; ghost?: boolean }>(
  ({ label, onClick, ghost }, ref) => (
    <button ref={ref} type="button" className={`oa-trigger${ghost ? " ghost" : ""}`} onClick={onClick}>{label}</button>
  ),
);
Trig.displayName = "Trig";

function Placeholder({ rows = 4 }: { rows?: number }) {
  const ws = [82, 100, 65, 88, 72, 94].slice(0, rows);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {ws.map((w, i) => <div key={i} style={{ height: 11, borderRadius: 5, background: "rgba(0,0,0,.08)", width: `${w}%` }} />)}
    </div>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Portal shell ─────────────────────────────────────────────────────────────

function PortalRoot({ theme, night, rm, children }: { theme: string; night: boolean; rm: boolean; children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="agent-shell-root"
      data-theme={theme}
      {...(night ? { "data-night": "" } : {})}
      {...(rm ? { "data-rm": "1" } : {})}
    >
      {children}
    </div>,
    document.body,
  );
}

// ─── DrawerVariant ────────────────────────────────────────────────────────────

interface DrawerVariantProps {
  width: number;
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
}

function DrawerVariant({ width, title, onClose, children }: DrawerVariantProps) {
  const { theme, night } = usePortalTheme();
  const rm = useRm();
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(ref, true);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(onClose, rm ? 0 : 260);
  }, [closing, onClose, rm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  // clear timer only on unmount, not on every close-ref change
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <PortalRoot theme={theme} night={night} rm={rm}>
      <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
        <div
          style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.32)", animation: "agent-backdrop-in 180ms ease forwards" }}
          onClick={close}
          aria-hidden
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal
          aria-label={title}
          style={{
            position: "absolute", top: 0, right: 0, bottom: 0,
            width, maxWidth: "95vw",
            background: "var(--agent-surface-elevated)",
            boxShadow: "-8px 0 40px rgba(var(--agent-shadow-rgb,45,24,16),.18)",
            display: "flex", flexDirection: "column",
            animation: `${closing ? "avr-drawer-out" : "avr-drawer-in"} ${rm ? 0 : 280}ms cubic-bezier(.4,0,.2,1) forwards`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,.08)", flexShrink: 0, gap: 12 }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</span>
            <button type="button" onClick={close} className="avr-close" aria-label="Close drawer"><XIcon /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>{children ?? <Placeholder />}</div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,.08)", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
            <button type="button" className="avr-btn secondary" onClick={close}>Cancel</button>
            <button type="button" className="avr-btn primary">Save changes</button>
          </div>
        </div>
      </div>
    </PortalRoot>
  );
}

// ─── ModalVariant ─────────────────────────────────────────────────────────────

type ModalFooter = "right" | "center" | "stack-primary-top";
type ModalXPolicy = "always" | "2b-plus" | "never";
type ModalAccent = "info" | "warning" | "danger";

interface ModalVariantProps {
  footerAlign: ModalFooter;
  xPolicy: ModalXPolicy;
  accent?: ModalAccent;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel?: string;
  nonDismissible?: boolean;
  onClose: () => void;
}

function ModalVariant({ footerAlign, xPolicy, accent = "info", title, body, primaryLabel, secondaryLabel, nonDismissible, onClose }: ModalVariantProps) {
  const { theme, night } = usePortalTheme();
  const rm = useRm();
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(ref, true);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(onClose, rm ? 0 : 220);
  }, [closing, onClose, rm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showX = xPolicy === "always" || (xPolicy === "2b-plus" && accent !== "info");
  const btnVariant = accent === "danger" ? "danger" : "primary";

  const footer = footerAlign === "stack-primary-top"
    ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" className={`avr-btn ${btnVariant}`} style={{ width: "100%" }}>{primaryLabel}</button>
        {secondaryLabel && <button type="button" className="avr-btn secondary" onClick={close} style={{ width: "100%" }}>{secondaryLabel}</button>}
      </div>
    )
    : (
      <div style={{ display: "flex", justifyContent: footerAlign === "center" ? "center" : "flex-end", gap: 10 }}>
        {secondaryLabel && <button type="button" className="avr-btn secondary" onClick={close}>{secondaryLabel}</button>}
        <button type="button" className={`avr-btn ${btnVariant}`}>{primaryLabel}</button>
      </div>
    );

  return (
    <PortalRoot theme={theme} night={night} rm={rm}>
      <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
        <div
          style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.32)", animation: "agent-backdrop-in 180ms ease forwards" }}
          onClick={nonDismissible ? undefined : close}
          aria-hidden
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal
          aria-label={title}
          style={{
            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
            width: "min(460px,92vw)",
            background: "var(--agent-surface-elevated)",
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(var(--agent-shadow-rgb,45,24,16),.22)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            animation: `${closing ? "avr-modal-out" : "agent-modal-in"} ${rm ? 0 : 240}ms cubic-bezier(.4,0,.2,1) forwards`,
          }}
        >
          <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)", paddingTop: 1 }}>{title}</span>
            {showX && <button type="button" onClick={close} className="avr-close" aria-label="Close"><XIcon /></button>}
          </div>
          <div style={{ padding: "10px 20px 18px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>{body}</div>
          <div style={{ padding: "0 16px 16px" }}>{footer}</div>
        </div>
      </div>
    </PortalRoot>
  );
}

// ─── PopoverVariant ───────────────────────────────────────────────────────────

type PopoverPos = "bottom-end" | "bottom-start" | "top-end";
type PopoverDismiss = "click-outside" | "hover-out";

interface PopoverVariantProps {
  pos: PopoverPos;
  showArrow: boolean;
  dismiss: PopoverDismiss;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children?: React.ReactNode;
}

function PopoverVariant({ pos, showArrow, dismiss, anchorRef, onClose, children }: PopoverVariantProps) {
  const { theme, night } = usePortalTheme();
  const rm = useRm();
  const popRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const GAP = 8;
    if (pos === "bottom-end") setCoords({ top: r.bottom + GAP, left: r.right });
    else if (pos === "bottom-start") setCoords({ top: r.bottom + GAP, left: r.left });
    else setCoords({ top: r.top - GAP, left: r.right });
  }, [anchorRef, pos]);

  useEffect(() => {
    if (dismiss !== "click-outside") return;
    function onDown(e: MouseEvent) {
      if (!popRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dismiss, onClose, anchorRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const xform =
    pos === "bottom-end" ? "translateX(-100%)" :
    pos === "top-end"    ? "translate(-100%,-100%)" :
    undefined;

  const arrowStyle: React.CSSProperties = {
    position: "absolute", width: 10, height: 10,
    background: "var(--agent-surface-elevated)",
    border: "1px solid rgba(0,0,0,.08)",
    transform: "rotate(45deg)",
    top: pos.startsWith("bottom") ? -6 : undefined,
    bottom: pos.startsWith("top") ? -6 : undefined,
    right: pos.endsWith("end") ? 16 : undefined,
    left: pos.endsWith("start") ? 16 : undefined,
    borderRight: pos.startsWith("bottom") ? "none" : undefined,
    borderBottom: pos.startsWith("bottom") ? "none" : undefined,
    borderTop: pos.startsWith("top") ? "none" : undefined,
    borderLeft: pos.startsWith("top") ? "none" : undefined,
  };

  return (
    <PortalRoot theme={theme} night={night} rm={rm}>
      <div
        ref={popRef}
        style={{
          position: "fixed", top: coords.top, left: coords.left, transform: xform,
          zIndex: 1500, background: "var(--agent-surface-elevated)",
          borderRadius: 12, boxShadow: "0 8px 32px rgba(var(--agent-shadow-rgb,45,24,16),.16)",
          border: "1px solid rgba(0,0,0,.08)", padding: 14, minWidth: 220,
          animation: `agent-dropdown-in ${rm ? 0 : 140}ms ease forwards`,
        }}
        onMouseLeave={dismiss === "hover-out" ? onClose : undefined}
      >
        {showArrow && <div style={arrowStyle} />}
        {children ?? <Placeholder rows={3} />}
      </div>
    </PortalRoot>
  );
}

// ─── DropdownVariant ──────────────────────────────────────────────────────────

type DropAnim = "fade-slide" | "fade" | "scale";

interface DropItem { label: string; active?: boolean; }

interface DropdownVariantProps {
  anim: DropAnim;
  anchorRef: React.RefObject<HTMLElement | null>;
  items: DropItem[];
  onSelect: (item: DropItem) => void;
  onClose: () => void;
}

function DropdownVariant({ anim, anchorRef, items, onSelect, onClose }: DropdownVariantProps) {
  const { theme, night } = usePortalTheme();
  const rm = useRm();
  const [closing, setClosing] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) });
  }, [anchorRef]);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, rm ? 0 : 160);
  }, [onClose, rm]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && activeIdx >= 0) { onSelect(items[activeIdx]); close(); }
    }
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [close, items, activeIdx, onSelect, anchorRef]);

  const inAnim = anim === "fade-slide" ? "avr-dd-slide" : anim === "scale" ? "avr-dd-scale" : "avr-dd-fade";

  return (
    <PortalRoot theme={theme} night={night} rm={rm}>
      <div
        ref={ref}
        role="menu"
        style={{
          position: "fixed", top: coords.top, left: coords.left, minWidth: coords.width,
          zIndex: 1500, background: "var(--agent-surface-elevated)",
          borderRadius: 12, boxShadow: "0 8px 32px rgba(var(--agent-shadow-rgb,45,24,16),.16)",
          border: "1px solid rgba(0,0,0,.08)", overflow: "hidden",
          animation: `${closing ? "avr-dd-out" : inAnim} ${rm ? 0 : 160}ms ease forwards`,
          transformOrigin: "top left",
        }}
      >
        {items.map((item, idx) => (
          <button
            key={idx}
            type="button"
            role="menuitem"
            className="avr-dd-item"
            data-active={activeIdx === idx}
            onMouseEnter={() => setActiveIdx(idx)}
            onClick={() => { onSelect(item); close(); }}
          >
            {item.label}
            {item.active && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "var(--agent-coral,#ff6b4a)", flexShrink: 0 }} />}
          </button>
        ))}
      </div>
    </PortalRoot>
  );
}

// ─── VToast system ────────────────────────────────────────────────────────────

type ToastType2 = "success" | "info" | "warning" | "error";
type ToastPos = "bottom-right" | "bottom-center" | "top-center";

interface VToastCfg { pos: ToastPos; animIn: string; showProgress: boolean; largeIcon: boolean; duration: number; }
interface VToastMsg { id: string; msg: string; type: ToastType2; }

const VToastCtx = createContext<{ add: (msg: string, type?: ToastType2) => void }>({ add: () => {} });
const useVToast = () => useContext(VToastCtx);

const TOAST_ICON_COLOR: Record<ToastType2, string> = {
  success: "#16a34a", info: "var(--agent-coral,#ff6b4a)", warning: "#d97706", error: "#dc2626",
};

function ToastIcon({ type, size }: { type: ToastType2; size: number }) {
  const c = TOAST_ICON_COLOR[type];
  if (type === "success") return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={c} strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (type === "warning") return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 2L1.5 13h13L8 2z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>;
  if (type === "error")   return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={c} strokeWidth="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke={c} strokeWidth="1.5"/><path d="M8 7.5v3.5M8 5.5v.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

function VToastProvider({ cfg, children }: { cfg: VToastCfg; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<VToastMsg[]>([]);
  const add = useCallback((msg: string, type: ToastType2 = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t.slice(-3), { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), cfg.duration + 500);
  }, [cfg.duration]);

  const { theme, night } = usePortalTheme();
  const rm = useRm();

  const posS: React.CSSProperties =
    cfg.pos === "bottom-right" ? { bottom: 20, right: 20, alignItems: "flex-end" } :
    cfg.pos === "bottom-center" ? { bottom: 20, left: "50%", transform: "translateX(-50%)", alignItems: "center" } :
    { top: 20, left: "50%", transform: "translateX(-50%)", alignItems: "center" };

  const iconSz = cfg.largeIcon ? 24 : 16;

  return (
    <VToastCtx.Provider value={{ add }}>
      {children}
      {typeof document !== "undefined" && createPortal(
        <div className="agent-shell-root" data-theme={theme} {...(night ? { "data-night": "" } : {})} {...(rm ? { "data-rm": "1" } : {})}>
          <div style={{ position: "fixed", ...posS, zIndex: 2000, display: "flex", flexDirection: cfg.pos === "top-center" ? "column" : "column-reverse", gap: 8, pointerEvents: "none" }}>
            {toasts.map(t => (
              <div key={t.id} style={{
                pointerEvents: "all",
                animation: `${cfg.animIn} ${rm ? 0 : 240}ms ease forwards`,
                background: "var(--agent-surface-elevated)",
                borderRadius: 12,
                boxShadow: "0 4px 20px rgba(var(--agent-shadow-rgb,45,24,16),.15)",
                padding: cfg.largeIcon ? "14px 18px" : "10px 14px",
                display: "flex", alignItems: "flex-start", gap: 10,
                minWidth: 240, maxWidth: 340,
                position: "relative", overflow: "hidden",
              }}>
                <span style={{ flexShrink: 0, width: iconSz, height: iconSz, display: "flex", alignItems: "center", justifyContent: "center", marginTop: cfg.largeIcon ? 2 : 0 }}>
                  <ToastIcon type={t.type} size={iconSz} />
                </span>
                <span style={{ fontSize: cfg.largeIcon ? 14 : 13, fontWeight: 500, color: "var(--agent-text-primary)", flex: 1 }}>{t.msg}</span>
                {cfg.showProgress && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, height: 2.5, background: "rgba(0,0,0,.06)", width: "100%" }}>
                    <div style={{ height: "100%", background: TOAST_ICON_COLOR[t.type], animation: `avr-progress ${rm ? 0 : cfg.duration}ms linear forwards` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </VToastCtx.Provider>
  );
}

// ─── FullscreenVariant ────────────────────────────────────────────────────────

type FsBackdrop = "blur" | "dim" | "solid";
type FsEntry = "slide" | "fade" | "scale-bounce";

interface FullscreenVariantProps {
  backdrop: FsBackdrop;
  entry: FsEntry;
  clickOutside?: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

function FullscreenVariant({ backdrop, entry, clickOutside, onClose, children }: FullscreenVariantProps) {
  const { theme, night } = usePortalTheme();
  const rm = useRm();
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(ref, true);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(onClose, rm ? 0 : 260);
  }, [closing, onClose, rm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const bdStyle: React.CSSProperties = {
    position: "absolute", inset: 0,
    background: backdrop === "blur" ? "rgba(0,0,0,.28)" : backdrop === "dim" ? "rgba(0,0,0,.55)" : "#111",
    backdropFilter: backdrop === "blur" ? "blur(8px)" : undefined,
    WebkitBackdropFilter: backdrop === "blur" ? "blur(8px)" : undefined,
    animation: `agent-backdrop-in ${rm ? 0 : 200}ms ease forwards`,
  };

  const panelAnim =
    closing     ? "avr-modal-out" :
    entry === "slide"       ? "avr-fs-slide" :
    entry === "scale-bounce" ? "avr-scale-bounce" :
    "agent-modal-in";

  return (
    <PortalRoot theme={theme} night={night} rm={rm}>
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={bdStyle} onClick={clickOutside ? close : undefined} aria-hidden />
        <div
          ref={ref}
          role="dialog"
          aria-modal
          aria-label="Overlay"
          style={{
            position: "relative", zIndex: 1,
            width: "min(640px,90vw)", maxHeight: "80vh",
            background: "var(--agent-surface-elevated)",
            borderRadius: 16,
            boxShadow: "0 24px 80px rgba(var(--agent-shadow-rgb,45,24,16),.30)",
            overflow: "hidden", display: "flex", flexDirection: "column",
            animation: `${panelAnim} ${rm ? 0 : 280}ms cubic-bezier(.4,0,.2,1) forwards`,
          }}
        >
          {children ?? (
            <div style={{ padding: "20px 24px 24px" }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ height: 40, borderRadius: 10, background: "rgba(0,0,0,.06)", marginBottom: 12 }} />
              </div>
              <Placeholder rows={5} />
            </div>
          )}
        </div>
      </div>
    </PortalRoot>
  );
}

// ─── Shared layout components ─────────────────────────────────────────────────

function VarTabs({ active, onChange }: { active: VKey; onChange: (k: VKey) => void }) {
  return (
    <div className="oa-vtabs">
      {(["current", "v1", "v2"] as VKey[]).map(k => (
        <button
          key={k}
          type="button"
          className={`oa-vtab ${k === "current" ? "cur" : "var"}${active === k ? " active" : ""}`}
          onClick={() => onChange(k)}
        >
          {k === "current" ? "Current" : k.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function VDesc({ vkey, descriptions }: { vkey: VKey; descriptions: Record<VKey, string> }) {
  const isCur = vkey === "current";
  return (
    <div className={`oa-vdesc${isCur ? " cur" : ""}`}>
      <span className={`oa-vdesc-badge${isCur ? " cur" : ""}`}>{isCur ? "Current" : vkey.toUpperCase()}</span>
      {descriptions[vkey]}
    </div>
  );
}

function DecRow({ catKey, decision, onPick }: { catKey: string; decision: Decision; onPick: (d: Decision) => void }) {
  return (
    <div className="oa-dec-row">
      <span className="oa-dec-label">Direction</span>
      {(["v1", "v2"] as const).map(v => (
        <button
          key={v}
          type="button"
          className={`oa-dec-btn${decision === v ? " picked" : ""}`}
          onClick={() => onPick(decision === v ? null : v)}
        >
          {v.toUpperCase()}
        </button>
      ))}
      {decision && <span style={{ fontSize: 12, color: "rgba(15,23,42,.40)", fontStyle: "italic" }}>→ {decision.toUpperCase()} picked</span>}
    </div>
  );
}

// ─── Category 1 — Drawers ─────────────────────────────────────────────────────

// Shared chase drawer props used across all variant tabs
const CHASE_PROPS = {
  chaseTaskId: "ct-audit-001",
  transactionId: MOCK_TX_ID,
  propertyAddress: MOCK_ADDR,
  milestoneName: "Searches requested",
  contacts: MOCK_CONTACTS,
  milestones: MOCK_MILESTONES,
} as const;

function CategoryDrawers({ decision, onPick }: { decision: Decision; onPick: (d: Decision) => void }) {
  const [chaseCount, setChaseCount] = useState(1);
  const [nodeDir, setNodeDir] = useState<"above" | "below">("below");
  const [reconExchange, setReconExchange] = useState(true);
  const [chase, setChase] = useState(false);
  const [edit, setEdit] = useState(false);
  const [recon, setRecon] = useState(false);
  const [chain, setChain] = useState(false);
  const [node, setNode] = useState(false);

  const EDIT_SHARED = {
    transactionId: MOCK_TX_ID, propertyAddress: MOCK_ADDR, tenure: "freehold" as const,
    purchaseType: "mortgage" as const, purchasePrice: 38500000, agentFeeAmount: null,
    agentFeePercent: 1.5, agentFeeIsVatInclusive: false, referralFee: null,
    referredFirmName: null, referredFirmId: null, overridePredictedDate: null,
    predictedExchangeDate: new Date(Date.now() + 56 * 86400000), completionDate: null,
    exchangeConfirmed: false,
  };

  return (
    <div className="oa-cat">
      <div className="oa-cat-hdr">
        <span className="oa-cat-num">1</span>
        <span className="oa-cat-title">Drawers</span>
        <span className="oa-cat-sub">5 components · categories 1a / 1b / 1c</span>
      </div>
      <div className="oa-demo">
        <span className="oa-note-pill">V1 applied — 440px · neutral · crisp ease · exit animation added</span>
        <div className="oa-demo-row">
          <span className="oa-label">ChaseDrawer (1a)</span>
          {[1, 3, 6].map(n => <StateBtn key={n} label={`chase ×${n}`} active={chaseCount === n} onClick={() => setChaseCount(n)} />)}
          <Trig label="Open" onClick={() => setChase(true)} />
        </div>
        <div className="oa-demo-row">
          <span className="oa-label">EditSaleDetailsDrawer (1b)</span>
          <Trig label="Open" onClick={() => setEdit(true)} />
        </div>
        <div className="oa-demo-row">
          <span className="oa-label">ReconciliationDrawer (1b)</span>
          <StateBtn label="Exchange" active={reconExchange} onClick={() => setReconExchange(true)} />
          <StateBtn label="Completion" active={!reconExchange} onClick={() => setReconExchange(false)} />
          <Trig label="Open" onClick={() => setRecon(true)} />
        </div>
        <div className="oa-demo-row">
          <span className="oa-label">ChainDrawer (1c)</span>
          <Trig label="Open" onClick={() => setChain(true)} />
          <span className="oa-note-pill">loads empty — mock transaction ID</span>
        </div>
        <div className="oa-demo-row">
          <span className="oa-label">AddNodeDrawer (1a)</span>
          <StateBtn label="above" active={nodeDir === "above"} onClick={() => setNodeDir("above")} />
          <StateBtn label="below" active={nodeDir === "below"} onClick={() => setNodeDir("below")} />
          <Trig label="Open" onClick={() => setNode(true)} />
        </div>
        {chase && <ChaseDrawer {...CHASE_PROPS} chaseCount={chaseCount} onClose={() => setChase(false)} onSent={() => setChase(false)} />}
        {edit && <EditSaleDetailsDrawer {...EDIT_SHARED} onClose={() => setEdit(false)} />}
        {recon && <ReconciliationDrawer isExchangeFlow={reconExchange} outstanding={MOCK_RECON_ITEMS} initialEventDate={new Date().toISOString().split("T")[0]} onConfirm={() => setRecon(false)} onCancel={() => setRecon(false)} />}
        {chain && <ChainDrawer transactionId={MOCK_TX_ID} currentUserId={MOCK_USER_ID} onClose={() => setChain(false)} onOpenAddNode={(dir) => { setNodeDir(dir); setNode(true); }} />}
        {node && <AddNodeDrawer direction={nodeDir} onClose={() => setNode(false)} onSaved={() => setNode(false)} />}
      </div>
      <DecRow catKey="drawers" decision={decision} onPick={onPick} />
    </div>
  );
}

// ─── Category 2 — Modals ──────────────────────────────────────────────────────

function CategoryModals({ decision, onPick }: { decision: Decision; onPick: (d: Decision) => void }) {
  const [vkey, setVkey] = useState<VKey>("current");

  // Current tab state
  const [welcome, setWelcome] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoCascade, setUndoCascade] = useState(false);
  const [mortgage, setMortgage] = useState(false);
  const [surveyNr, setSurveyNr] = useState(false);
  const [addFirm, setAddFirm] = useState(false);
  const [addBroker, setAddBroker] = useState(false);
  const [dupAddr, setDupAddr] = useState(false);
  const [navAway, setNavAway] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // V1/V2/V3 tab state
  const [varOpen, setVarOpen] = useState(false);
  const [varAccent, setVarAccent] = useState<ModalAccent>("info");

  const DESCS: Record<VKey, string> = {
    current: "Production modals — mixed footer layouts, inconsistent X placement, varying widths. 11 modal components.",
    v1: "Right-aligned footer. X present on 2b (decision+impact) and 2c/2d categories; absent on 2a (forced-choice confirms). Widths: 400px (2a), 460px (2b/2c), 520px (2d).",
    v2: "Centred footer. X always present. Same widths as V1. Softens hierarchy — primary action no longer visually dominant.",
  };

  const varModalProps = {
    v1: { footerAlign: "right" as ModalFooter, xPolicy: "2b-plus" as ModalXPolicy },
    v2: { footerAlign: "center" as ModalFooter, xPolicy: "always" as ModalXPolicy },
  };

  const activeProps = vkey !== "current" ? varModalProps[vkey] : null;

  return (
    <div className="oa-cat">
      <div className="oa-cat-hdr">
        <span className="oa-cat-num">2</span>
        <span className="oa-cat-title">Modals / Dialogs</span>
        <span className="oa-cat-sub">11 components · categories 2a – 2e</span>
      </div>
      <VarTabs active={vkey} onChange={setVkey} />
      <VDesc vkey={vkey} descriptions={DESCS} />

      {vkey === "current" && (
        <div className="oa-demo">
          <div className="oa-demo-row">
            <span className="oa-label">WelcomeModal (2d)</span>
            <Trig label="Open" onClick={() => setWelcome(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">UndoMilestoneModal (2b)</span>
            <StateBtn label="no cascade" active={!undoCascade} onClick={() => setUndoCascade(false)} />
            <StateBtn label="cascade" active={undoCascade} onClick={() => setUndoCascade(true)} />
            <Trig label="Open" onClick={() => setUndoOpen(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">MortgageModal (2a)</span>
            <Trig label="Open" onClick={() => setMortgage(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">SurveyNrConfirmModal (2a)</span>
            <Trig label="Open" onClick={() => setSurveyNr(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">AddFirmModal (2c)</span>
            <Trig label="Open" onClick={() => setAddFirm(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">AddBrokerModal (2c)</span>
            <Trig label="Open" onClick={() => setAddBroker(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">DuplicateAddressModal (2b)</span>
            <Trig label="Open" onClick={() => setDupAddr(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">NavAwayModal (2b)</span>
            <Trig label="Open" onClick={() => setNavAway(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">ExchangeCelebration (2e)</span>
            <Trig label="Trigger" onClick={() => setCelebrate(true)} />
          </div>
          {welcome && <WelcomeModal name="Ellis" />}
          {undoOpen && <UndoMilestoneModal milestoneName="Searches requested" milestoneId="m-audit-001" undoData={undoCascade ? MOCK_UNDO_CASCADE : MOCK_UNDO_NO_CASCADE} isPending={false} onConfirm={() => setUndoOpen(false)} onCancel={() => setUndoOpen(false)} />}
          {mortgage && <MortgageModal onConfirmMortgage={() => setMortgage(false)} onConfirmReinstate={() => setMortgage(false)} onCancel={() => setMortgage(false)} />}
          {surveyNr && <SurveyNrConfirmModal onConfirm={() => setSurveyNr(false)} onCancel={() => setSurveyNr(false)} />}
          {addFirm && <AddFirmModal prefillName="" onClose={() => setAddFirm(false)} onCreated={() => setAddFirm(false)} />}
          {addBroker && <AddBrokerModal prefillName="" onClose={() => setAddBroker(false)} onCreated={() => setAddBroker(false)} />}
          {dupAddr && <DuplicateAddressModal address={MOCK_ADDR} duplicateId="dup-001" assignedTo={null} onClose={() => setDupAddr(false)} onForceCreate={() => setDupAddr(false)} />}
          {navAway && <NavAwayModal isSaving={false} onDiscard={() => setNavAway(false)} onStay={() => setNavAway(false)} onSave={async () => setNavAway(false)} />}
          {celebrate && <ExchangeCelebration address={MOCK_ADDR} onDismiss={() => setCelebrate(false)} />}
        </div>
      )}

      {activeProps && (
        <div className="oa-demo">
          <div className="oa-demo-row">
            <span className="oa-label">Accent</span>
            {(["info", "warning", "danger"] as ModalAccent[]).map(a => (
              <StateBtn key={a} label={a} active={varAccent === a} onClick={() => setVarAccent(a)} />
            ))}
            <Trig label="Open modal" onClick={() => setVarOpen(true)} />
          </div>
          <span className="oa-note-pill">{activeProps.xPolicy === "always" ? "X always shown" : activeProps.xPolicy === "2b-plus" ? `X shown for warning/danger, hidden for info` : "No X — forced choice"}</span>
          {varOpen && (
            <ModalVariant
              {...activeProps}
              accent={varAccent}
              title={varAccent === "danger" ? "Delete account?" : varAccent === "warning" ? "Undo: Searches requested" : "Confirm action"}
              body={varAccent === "danger" ? "This is permanent and cannot be undone. All data will be lost." : varAccent === "warning" ? "This will also undo 3 downstream steps. Progress: 68% → 51%." : "Are you sure you want to proceed? This action will take effect immediately."}
              primaryLabel={varAccent === "danger" ? "Delete account" : varAccent === "warning" ? "Undo step" : "Confirm"}
              secondaryLabel="Cancel"
              nonDismissible={varAccent !== "info"}
              onClose={() => setVarOpen(false)}
            />
          )}
        </div>
      )}

      <DecRow catKey="modals" decision={decision} onPick={onPick} />
    </div>
  );
}

// ─── Category 3 — Popovers / Pickers ─────────────────────────────────────────

function CategoryPopovers({ decision, onPick }: { decision: Decision; onPick: (d: Decision) => void }) {
  const [vkey, setVkey] = useState<VKey>("current");
  const [solVal, setSolVal] = useState<SolicitorSelection | null>(MOCK_SOL_VAL);
  const [brokerVal, setBrokerVal] = useState<BrokerSelection | null>(MOCK_BROKER_VAL);

  // V1/V2/V3
  const trigRef = useRef<HTMLButtonElement>(null);
  const [popOpen, setPopOpen] = useState(false);

  const DESCS: Record<VKey, string> = {
    current: "Production popover/picker components: RiskBadgeWithPopover (hover+click, dynamic repositioning), MissingFeeRow (desktop popover / mobile sheet), SolicitorPicker, BrokerPicker (combobox-style with portal dropdowns).",
    v1: "Anchored below-end. Arrow pointing up. Click-outside dismisses. Consistent across all 3a components. Standard interactive pattern.",
    v2: "Anchored below-start (aligns to trigger left edge). No arrow. Simpler — trades wayfinding for cleanliness. Works well when trigger is left-aligned.",
  };

  const popCfgs: Record<"v1"|"v2", { pos: PopoverPos; showArrow: boolean; dismiss: PopoverDismiss }> = {
    v1: { pos: "bottom-end", showArrow: true, dismiss: "click-outside" },
    v2: { pos: "bottom-start", showArrow: false, dismiss: "click-outside" },
  };

  return (
    <div className="oa-cat">
      <div className="oa-cat-hdr">
        <span className="oa-cat-num">3</span>
        <span className="oa-cat-title">Popovers / Pickers</span>
        <span className="oa-cat-sub">5 components · categories 3a / 3b / 3c</span>
      </div>
      <VarTabs active={vkey} onChange={setVkey} />
      <VDesc vkey={vkey} descriptions={DESCS} />

      {vkey === "current" && (
        <div className="oa-demo">
          <div className="oa-demo-row">
            <span className="oa-label">RiskBadgeWithPopover (3a)</span>
            <div style={{ display: "flex", gap: 10 }}>
              <RiskBadgeWithPopover raw={MOCK_HEALTH_LOW} />
              <RiskBadgeWithPopover raw={MOCK_HEALTH_HIGH} />
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,.06)", paddingTop: 14 }}>
            <div className="oa-demo-row" style={{ marginBottom: 8 }}>
              <span className="oa-label">MissingFeeRow (3a desktop / 3b mobile)</span>
            </div>
            <MissingFeeRow id="mf-audit-001" propertyAddress={MOCK_ADDR} ownerLine="Sarah Mitchell" awaitingAssignment={false} txBasePath="/agent/transactions/audit-demo-00000000" />
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,.06)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ maxWidth: 380 }}>
              <SolicitorPicker label="Solicitor" value={solVal} onChange={setSolVal} />
            </div>
            <div style={{ maxWidth: 380 }}>
              <BrokerPicker label="Broker" value={brokerVal} onChange={setBrokerVal} preferredBroker={null} />
            </div>
          </div>
        </div>
      )}

      {(vkey === "v1" || vkey === "v2") && (
        <div className="oa-demo">
          <div className="oa-demo-row">
            <Trig
              label={popOpen ? "Close popover" : "Open popover"}
              onClick={() => setPopOpen(o => !o)}
              ref={trigRef}
            />
            <span className="oa-note-pill">
              {vkey === "v1" ? "bottom-end · arrow · click-outside" :
               "bottom-start · no arrow · click-outside"}
            </span>
          </div>
          {popOpen && (
            <PopoverVariant
              {...popCfgs[vkey]}
              anchorRef={trigRef}
              onClose={() => setPopOpen(false)}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(15,23,42,.55)", marginBottom: 8 }}>Risk breakdown</div>
                <Placeholder rows={3} />
              </div>
            </PopoverVariant>
          )}
        </div>
      )}

      <DecRow catKey="popovers" decision={decision} onPick={onPick} />
    </div>
  );
}

// ─── Category 4 — Dropdowns ───────────────────────────────────────────────────

const DD_ITEMS: DropItem[] = [
  { label: "In progress", active: true },
  { label: "Exchanged" },
  { label: "Withdrawn" },
  { label: "Fallen through" },
];

const SNOOZE_ITEMS: DropItem[] = [
  { label: "1 hour" },
  { label: "Tomorrow morning" },
  { label: "In 3 days" },
  { label: "Next week" },
  { label: "In 2 weeks" },
];

function CategoryDropdowns({ decision, onPick }: { decision: Decision; onPick: (d: Decision) => void }) {
  const [vkey, setVkey] = useState<VKey>("current");
  const trigRef = useRef<HTMLButtonElement>(null);
  const [ddOpen, setDdOpen] = useState(false);
  const [ddItems, setDdItems] = useState<DropItem[]>(DD_ITEMS);
  const [selected, setSelected] = useState("In progress");

  const DESCS: Record<VKey, string> = {
    current: "Production dropdown components: StatusControlDropdown (portal, fixed positioned, optimistic update), ToneSelector (in ChaseDrawer), SolicitorPicker/BrokerPicker handler dropdowns, SideSnoozeMenu, RowSnoozeMenu (both use agent-dropdown-in/out keyframe).",
    v1: "Fade + slide down (avr-dd-slide). Panel translates 6px up-to-origin on open. Directional — suggests content dropped down. Matches existing agent-dropdown-in.",
    v2: "Simple fade (avr-dd-fade). No translate. Fast and neutral. Least distracting for frequent-use dropdowns like snooze menus.",
  };

  const animMap: Record<"v1"|"v2", DropAnim> = { v1: "fade-slide", v2: "fade" };

  return (
    <div className="oa-cat">
      <div className="oa-cat-hdr">
        <span className="oa-cat-num">4</span>
        <span className="oa-cat-title">Dropdown Menus</span>
        <span className="oa-cat-sub">6 components · categories 4a / 4b</span>
      </div>
      <VarTabs active={vkey} onChange={setVkey} />
      <VDesc vkey={vkey} descriptions={DESCS} />

      {vkey === "current" && (
        <div className="oa-demo">
          <div className="oa-demo-row">
            <span className="oa-label">StatusControl (4a)</span>
            <StatusControl transactionId={MOCK_TX_ID} currentStatus="active" />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">ChangelogDropdown (3c)</span>
            <ChangelogDropdown />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">ToneSelector (4a), SideSnoozeMenu / RowSnoozeMenu (4b)</span>
            <span className="oa-note-pill">Open ChaseDrawer (drawers section) or Work Queue page to see ToneSelector and snooze menus in context.</span>
          </div>
        </div>
      )}

      {(vkey === "v1" || vkey === "v2") && (
        <div className="oa-demo">
          <div className="oa-demo-row">
            <Trig
              label={`${selected} ▾`}
              onClick={() => setDdOpen(o => !o)}
              ref={trigRef}
            />
            <span className="oa-note-pill">{vkey === "v1" ? "fade + slide" : "simple fade"} · arrow-key nav · Escape closes</span>
          </div>
          {ddOpen && (
            <DropdownVariant
              anim={animMap[vkey]}
              anchorRef={trigRef}
              items={ddItems}
              onSelect={item => {
                setSelected(item.label);
                setDdItems(prev => prev.map(i => ({ ...i, active: i.label === item.label })));
              }}
              onClose={() => setDdOpen(false)}
            />
          )}
        </div>
      )}

      <DecRow catKey="dropdowns" decision={decision} onPick={onPick} />
    </div>
  );
}

function AgentToastTriggers() {
  const { toast } = useAgentToast();
  return (
    <div className="oa-demo-row">
      <span className="oa-label">AgentToaster (5a–5e)</span>
      <Trig label="success" onClick={() => toast.success("Chase sent to Sarah Mitchell")} />
      <Trig label="info" onClick={() => toast.info("Draft saved")} />
      <Trig label="warning" onClick={() => toast.warning("Exchange date overdue — check timeline")} />
      <Trig label="error" onClick={() => toast.error("Failed to send — try again")} />
    </div>
  );
}

// ─── Category 5 — Toasts ─────────────────────────────────────────────────────

const TOAST_CFGS: Record<"v1"|"v2", VToastCfg> = {
  v1: { pos: "bottom-right", animIn: "avr-toast-r",  showProgress: true,  largeIcon: false, duration: 4000 },
  v2: { pos: "bottom-center", animIn: "avr-toast-up", showProgress: false, largeIcon: false, duration: 4000 },
};

function ToastDemoInner({ vkey }: { vkey: "v1"|"v2" }) {
  const { add } = useVToast();
  return (
    <div className="oa-demo-row">
      <Trig label="success" onClick={() => add("Chase sent to Sarah Mitchell", "success")} />
      <Trig label="info"    onClick={() => add("Draft saved", "info")} />
      <Trig label="warning" onClick={() => add("Exchange date overdue", "warning")} />
      <Trig label="error"   onClick={() => add("Failed to send — retry", "error")} />
      <span className="oa-note-pill">
        {vkey === "v1" ? "bottom-right · slide-right · progress bar" :
         "bottom-centre · slide-up"}
      </span>
    </div>
  );
}

function CategoryToasts({ decision, onPick }: { decision: Decision; onPick: (d: Decision) => void }) {
  const [vkey, setVkey] = useState<VKey>("current");

  const DESCS: Record<VKey, string> = {
    current: "AgentToaster (production) — bottom-right stack, 4 types, max 4 visible, pause-on-hover, action button support. ToastContext (legacy) — simpler, bottom-right, 4s auto-dismiss. Decision 3 confirmed: retire ToastContext.",
    v1: "Bottom-right. Slides in from right. Progress bar shows remaining time. Compact icon. Familiar, unobtrusive. Closest to current AgentToaster position.",
    v2: "Bottom-centre. Slides up. No progress bar. Centred positioning draws more attention — suits lower-frequency important notifications.",
  };

  return (
    <div className="oa-cat">
      <div className="oa-cat-hdr">
        <span className="oa-cat-num">5</span>
        <span className="oa-cat-title">Toasts</span>
        <span className="oa-cat-sub">3 components · categories 5a – 5e · retire ToastContext</span>
      </div>
      <VarTabs active={vkey} onChange={setVkey} />
      <VDesc vkey={vkey} descriptions={DESCS} />

      {vkey === "current" && (
        <div className="oa-demo">
          <AgentToastTriggers />
        </div>
      )}

      {(vkey === "v1" || vkey === "v2") && (
        <div className="oa-demo">
          <VToastProvider cfg={TOAST_CFGS[vkey]}>
            <ToastDemoInner vkey={vkey} />
          </VToastProvider>
        </div>
      )}

      <DecRow catKey="toasts" decision={decision} onPick={onPick} />
    </div>
  );
}

// ─── Category 6 — Fullscreen / Search ────────────────────────────────────────

function CategoryFullscreen({ decision, onPick }: { decision: Decision; onPick: (d: Decision) => void }) {
  const [vkey, setVkey] = useState<VKey>("current");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [varOpen, setVarOpen] = useState(false);

  const DESCS: Record<VKey, string> = {
    current: "AgentGlobalSearch (6a) — full-screen centred panel, Cmd+K trigger, keyboard nav, debounced fetch. FeedbackWidget (6b) — role=dialog, fixed floating button. SubmissionOverlay (6c) — full-screen backdrop, z-index 3000, rotating loading messages.",
    v1: "Backdrop blur (blur 8px + rgba .28). Panel slides up (avr-fs-slide). Escape only dismisses — user explicitly opened it, should explicitly close. Softest backdrop.",
    v2: "Backdrop dim (rgba .55). Panel fades in (agent-modal-in). Escape dismisses. Higher contrast backdrop makes panel float more clearly against busy pages.",
  };

  const fsCfgs: Record<"v1"|"v2", { backdrop: FsBackdrop; entry: FsEntry; clickOutside?: boolean }> = {
    v1: { backdrop: "blur",  entry: "slide",  clickOutside: false },
    v2: { backdrop: "dim",   entry: "fade",   clickOutside: false },
  };

  return (
    <div className="oa-cat">
      <div className="oa-cat-hdr">
        <span className="oa-cat-num">6</span>
        <span className="oa-cat-title">Fullscreen Overlays</span>
        <span className="oa-cat-sub">3 components · categories 6a / 6b / 6c</span>
      </div>
      <VarTabs active={vkey} onChange={setVkey} />
      <VDesc vkey={vkey} descriptions={DESCS} />

      {vkey === "current" && (
        <div className="oa-demo">
          <div className="oa-demo-row">
            <span className="oa-label">AgentGlobalSearch (6a)</span>
            <span className="oa-note-pill">Always mounted — Cmd+K / Ctrl+K to open</span>
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">FeedbackWidget (6b)</span>
            <Trig label="Open feedback" onClick={() => setFeedbackOpen(true)} />
          </div>
          <div className="oa-demo-row">
            <span className="oa-label">SubmissionOverlay (6c)</span>
            <StateBtn label={submitting ? "visible" : "hidden"} active={submitting} onClick={() => setSubmitting(s => !s)} />
          </div>
          <AgentGlobalSearch />
          {feedbackOpen && <FeedbackWidget checklistAware={false} userId={MOCK_USER_ID} />}
          <SubmissionOverlay isVisible={submitting} />
        </div>
      )}

      {(vkey === "v1" || vkey === "v2") && (
        <div className="oa-demo">
          <div className="oa-demo-row">
            <Trig label="Open overlay" onClick={() => setVarOpen(true)} />
            <span className="oa-note-pill">
              {vkey === "v1" ? "blur backdrop · slide-up · escape only" :
               "dim backdrop · fade · escape only"}
            </span>
          </div>
          {varOpen && (
            <FullscreenVariant {...fsCfgs[vkey]} onClose={() => setVarOpen(false)}>
              <div style={{ padding: "20px 24px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 38, borderRadius: 10, background: "rgba(0,0,0,.07)" }} />
                  <button type="button" style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "rgba(0,0,0,.06)", cursor: "pointer", fontSize: 11, color: "rgba(15,23,42,.50)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setVarOpen(false)}>Esc</button>
                </div>
                <Placeholder rows={5} />
              </div>
            </FullscreenVariant>
          )}
        </div>
      )}

      <DecRow catKey="fullscreen" decision={decision} onPick={onPick} />
    </div>
  );
}

// ─── Decisions summary ────────────────────────────────────────────────────────

const CAT_NAMES: Record<string, string> = {
  drawers:    "Drawers (1a / 1b / 1c)",
  modals:     "Modals / Dialogs (2a–2e)",
  popovers:   "Popovers / Pickers (3a–3c)",
  dropdowns:  "Dropdown Menus (4a / 4b)",
  toasts:     "Toasts (5a–5e)",
  fullscreen: "Fullscreen Overlays (6a–6c)",
};

const V_DESC_SHORT: Record<string, Record<string, string>> = {
  drawers:    { v1: "440px all", v2: "420/520/480px by category" },
  modals:     { v1: "right footer · X on 2b+", v2: "centre footer · X always" },
  popovers:   { v1: "bottom-end · arrow · click-outside", v2: "bottom-start · no arrow" },
  dropdowns:  { v1: "fade + slide", v2: "simple fade" },
  toasts:     { v1: "bottom-right · progress bar", v2: "bottom-centre · slide-up" },
  fullscreen: { v1: "blur backdrop · slide", v2: "dim backdrop · fade" },
};

function DecisionsSummary({ decisions }: { decisions: Decisions }) {
  const cats = Object.keys(CAT_NAMES);
  const picked = cats.filter(c => decisions[c]);
  const pending = cats.length - picked.length;

  function copyMd() {
    const rows = cats.map(c => {
      const d = decisions[c];
      const desc = d ? V_DESC_SHORT[c]?.[d] ?? d.toUpperCase() : "— pending —";
      return `| ${CAT_NAMES[c]} | ${d ? d.toUpperCase() : "—"} | ${desc} |`;
    });
    const md = [
      "| Category | Decision | Notes |",
      "|---|---|---|",
      ...rows,
    ].join("\n");
    navigator.clipboard.writeText(md).catch(() => {});
  }

  return (
    <div className="oa-ds-wrap">
      <div className="oa-ds-hdr">
        <div>
          <span className="oa-ds-title">Decisions</span>
          <span style={{ fontSize: 12, color: "rgba(15,23,42,.40)", marginLeft: 12 }}>{picked.length}/{cats.length} picked{pending > 0 ? ` · ${pending} pending` : " · all done"}</span>
        </div>
        <button type="button" className="oa-ds-copy" onClick={copyMd}>Copy as Markdown</button>
      </div>
      <table className="oa-ds-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Pick</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {cats.map(c => {
            const d = decisions[c];
            return (
              <tr key={c}>
                <td>{CAT_NAMES[c]}</td>
                <td>{d ? <span className="oa-ds-picked">{d.toUpperCase()}</span> : <span className="oa-ds-pending">pending</span>}</td>
                <td style={{ color: "rgba(15,23,42,.50)", fontSize: 12 }}>{d ? (V_DESC_SHORT[c]?.[d] ?? "") : <span className="oa-ds-pending">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const THEMES = ["sunset", "coastal", "heritage", "slate", "emerald", "claret"] as const;
type Theme = typeof THEMES[number];

export default function OverlayAuditPage() {
  const [theme, setTheme] = useState<Theme>("sunset");
  const [night, setNight] = useState(false);
  const [solid, setSolid] = useState(false);
  const [rm, setRm] = useState(false);
  const [decisions, setDecisions] = useState<Decisions>({
    drawers: "v1", modals: "v1", popovers: "v2",
    dropdowns: "v2", toasts: "v1", fullscreen: "v1",
  });

  const pick = useCallback((cat: string, d: Decision) => {
    setDecisions(prev => ({ ...prev, [cat]: d }));
  }, []);

  // Sync theme / night / solid to the page shell
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".agent-shell-root");
    if (!root) return;
    const prevTheme = root.getAttribute("data-theme") ?? "";
    root.setAttribute("data-theme", theme);
    if (night) root.setAttribute("data-night", "");
    else root.removeAttribute("data-night");
    return () => { root.setAttribute("data-theme", prevTheme); root.removeAttribute("data-night"); };
  }, [theme, night]);

  useEffect(() => {
    if (solid) document.documentElement.setAttribute("data-solid", "");
    else document.documentElement.removeAttribute("data-solid");
    return () => document.documentElement.removeAttribute("data-solid");
  }, [solid]);

  return (
    <ThemeCtx.Provider value={{ theme, night }}>
      <RmCtx.Provider value={rm}>
        <style>{CSS}</style>

        {/* Control bar */}
        <div className="oa-bar" data-rm={rm ? "1" : undefined}>
          <span className="oa-label">Theme</span>
          {THEMES.map(t => (
            <button key={t} type="button" className={`oa-pill${theme === t ? " on" : ""}`} onClick={() => setTheme(t)}>
              {t}
            </button>
          ))}
          <span className="oa-sep" />
          <button type="button" className={`oa-pill${night ? " on" : ""}`} onClick={() => setNight(n => !n)}>Night</button>
          <button type="button" className={`oa-pill${solid ? " on" : ""}`} onClick={() => setSolid(s => !s)}>Solid</button>
          <button type="button" className={`oa-pill${rm ? " on" : ""}`} onClick={() => setRm(r => !r)}>Reduced motion</button>
        </div>

        <div className="oa-content">
          <CategoryDrawers    decision={decisions.drawers}    onPick={d => pick("drawers", d)} />
          <CategoryModals     decision={decisions.modals}     onPick={d => pick("modals", d)} />
          <CategoryPopovers   decision={decisions.popovers}   onPick={d => pick("popovers", d)} />
          <CategoryDropdowns  decision={decisions.dropdowns}  onPick={d => pick("dropdowns", d)} />
          <CategoryToasts     decision={decisions.toasts}     onPick={d => pick("toasts", d)} />
          <CategoryFullscreen decision={decisions.fullscreen} onPick={d => pick("fullscreen", d)} />
          <DecisionsSummary decisions={decisions} />
        </div>
      </RmCtx.Provider>
    </ThemeCtx.Provider>
  );
}
