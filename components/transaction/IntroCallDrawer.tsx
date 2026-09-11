"use client";

import { useState, useRef, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, PhoneCall, CheckCircle, Plus, CaretLeft, Phone, EnvelopeSimple } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useOverlayChrome } from "@/lib/agent/use-overlay-chrome";
import {
  saveClientCostsAgentAction,
  saveMoveInfoAgentAction,
  completeIntroCallAction,
  type IntroCallData,
} from "@/app/actions/intro-call";
import { formatUKPhone } from "@/lib/utils/address";
import { savePurchaseTypeAction } from "@/app/actions/transactions";
import { updateContactAction } from "@/app/actions/contacts";
import { setOnwardTypeFactsAction } from "@/app/actions/onward";
import { saveChainIntelAction } from "@/app/actions/chain-intel";
import { SolicitorSection } from "@/components/solicitors/SolicitorSection";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import type { ChainNodeIntelInput } from "@/lib/chain/intel";
import type { MoveInfo } from "@/lib/services/portal-info";
import type { PurchaseType, Tenure } from "@prisma/client";

type CostsPatch = {
  depositGBP?: number | null;
  mortgageGBP?: number | null;
  otherFundsGBP?: number | null;
  firstTimeBuyer?: boolean | null;
  additionalProperty?: boolean | null;
};

// ── The script (talking points for the team to deliver) ──────────────────────
// Copy is Ellis-approved (voice rules apply). Kept as data so it's easy to tune.
const SCRIPT_POINTS: { title: string; body: string; note: string }[] = [
  { title: "Keep in touch with your solicitor", body: "Try to speak to them at least once a fortnight, and follow up on anything they're waiting for from you.", note: "We'll do plenty of chasing too, but keeping that direct relationship going really helps." },
  { title: "Keep us in the loop", body: "If anything changes, tell us. A survey issue, a change of plan, something your solicitor has mentioned, even something that seems minor.", note: "The more we know, the more useful we can be." },
  { title: "We'll tell you when we need you", body: "You don't need to constantly wonder what you should be doing next. When something needs your attention, we'll let you know what it is and what you need to do.", note: "Until then, you can get on with everything else." },
  { title: "Make the most of your portal", body: "Your portal is the easiest place to see where things stand, what's happened and what comes next.", note: "And if something doesn't make sense, just ask us. That's what we're here for." },
  { title: "If something feels stuck, tell us", body: "Don't assume we already know. If you've been waiting too long, can't get an answer or something just doesn't feel right, let us know.", note: "We'd much rather you tell us early, so we can look into it and help move things forward." },
];

// ── field primitives ─────────────────────────────────────────────────────────
const labelStyle: CSSProperties = { display: "grid", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" };
// Sizing only — colour, border, coral hover/focus come from the `.agent-field`
// class the fields carry (so they behave like every other input, in dark too).
const inputStyle: CSSProperties = {
  fontSize: 13, fontWeight: 400, padding: "8px 10px", borderRadius: 8,
  width: "100%", fontFamily: "inherit",
};
// Read-only display box styled like a field (no interaction → no coral states).
const readonlyFieldStyle: CSSProperties = {
  ...inputStyle, display: "flex", alignItems: "center",
  color: "var(--agent-text-primary)", background: "var(--agent-surface-subtle)",
  border: "0.5px solid var(--agent-border-strong)",
};

function TextField({ label, initial, onSave, placeholder, type = "text", format, icon }: { label: string; initial: string; onSave: (v: string) => void; placeholder?: string; type?: string; format?: (v: string) => string; icon?: ReactNode }) {
  const [v, setV] = useState(initial);
  const last = useRef(initial);
  return (
    <label style={labelStyle}>
      {label}
      <div style={{ position: "relative" }}>
        {icon && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "inline-flex", color: "var(--agent-text-muted)", pointerEvents: "none" }}>{icon}</span>}
        <input type={type} value={v} placeholder={placeholder} className="agent-field" style={{ ...inputStyle, ...(icon ? { paddingLeft: 32 } : {}) }}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { const out = format && v.trim() ? format(v) : v; if (out !== v) setV(out); if (out !== last.current) { last.current = out; onSave(out); } }} />
      </div>
    </label>
  );
}

// Dimensional number chip shared by the script + question sections.
const sectionCircleStyle: CSSProperties = {
  width: 26, height: 26, borderRadius: 99, flexShrink: 0,
  background: "radial-gradient(circle at 50% 32%, #ffffff 0%, var(--agent-coral-bg-tint) 100%)",
  border: "1px solid rgba(var(--agent-coral-rgb), 0.30)",
  boxShadow: "0 1px 3px rgba(var(--agent-coral-rgb), 0.22), inset 0 1px 0 rgba(255,255,255,0.85)",
  color: "var(--agent-coral-deep)", fontSize: 11.5, fontWeight: 800,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

// One numbered question section (circle + title + description + fields).
function QSection({ n, title, desc, first, children }: { n: number; title: string; desc: string; first?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 13, paddingTop: first ? 0 : 22, paddingBottom: 22, borderTop: first ? "none" : "1px solid var(--agent-border-subtle)" }}>
      <span style={sectionCircleStyle}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.4 }}>{desc}</p>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}

// Responsive field grid. Packs as many equal columns as fit, then collapses to
// more rows (eventually a single column) as the drawer narrows — no media
// queries. `n` is the intended column count on a wide drawer; it sets the
// per-column min-width so wide screens still show the full row and narrow ones
// stack. min(100%, …) keeps a single column from overflowing very small widths.
function Cols({ n = 2, children }: { n?: number; children: ReactNode }) {
  const min = n >= 4 ? 148 : n === 3 ? 162 : 200;
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 12 }}>{children}</div>;
}

// Small progress ring for the "N of M captured" header pill.
function ProgressRing({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? filled / total : 0;
  const r = 9, c = 2 * Math.PI * r;
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx={12} cy={12} r={r} fill="none" stroke="var(--agent-border-default)" strokeWidth={3} />
      <circle cx={12} cy={12} r={r} fill="none" stroke="var(--agent-coral-deep)" strokeWidth={3} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 12 12)" style={{ transition: "stroke-dashoffset 300ms ease" }} />
    </svg>
  );
}

// Per-side completeness gauge — only the questions that apply to THIS side.
function computeSideProgress(d: IntroCallData, side: "vendor" | "purchaser"): { filled: number; total: number } {
  const items: (unknown | null | undefined)[] = [];
  if (side === "purchaser") {
    items.push(d.purchaseType, d.costs.depositGBP, d.movePurchaser.fundsSource, d.movePurchaser.fundsInPlace, d.costs.firstTimeBuyer, d.costs.additionalProperty, d.movePurchaser.preferredCompletionDate, d.movePurchaser.flexibility, d.movePurchaser.noticePeriod, d.movePurchaser.removalStatus, d.movePurchaser.sellingRelated);
    if (d.purchaseType !== "cash_buyer") items.push(d.costs.mortgageGBP, d.movePurchaser.mortgageOfferExpiry);
  } else {
    items.push(d.moveVendor.buyingOnward, d.moveVendor.vacantBeforeCompletion, d.moveVendor.preferredCompletionDate, d.moveVendor.flexibility, d.moveVendor.noticePeriod, d.moveVendor.removalStatus);
    if (d.chainLinkId) items.push(d.chainIntel?.breakChainStance);
  }
  const filled = items.filter((v) => v !== null && v !== undefined && v !== "").length;
  return { filled, total: items.length };
}

function MoneyField({ label, initial, onSave }: { label: string; initial: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(initial != null ? String(initial) : "");
  const last = useRef(v);
  return (
    <label style={labelStyle}>
      {label}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 10, top: 8, fontSize: 13, color: "var(--agent-text-muted)" }}>£</span>
        <input inputMode="numeric" value={v} className="agent-field" style={{ ...inputStyle, paddingLeft: 22 }}
          onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => { if (v !== last.current) { last.current = v; onSave(v === "" ? null : Number(v)); } }} />
      </div>
    </label>
  );
}

function SelectField({ label, initial, options, onSave, placeholder }: { label: string; initial: string | null; options: { value: string; label: string }[]; onSave: (v: string | null) => void; placeholder?: string }) {
  const [v, setV] = useState(initial ?? "");
  return (
    <label style={labelStyle}>
      {label}
      <select value={v} className="agent-field" style={inputStyle} onChange={(e) => { setV(e.target.value); onSave(e.target.value || null); }}>
        <option value="">{placeholder ?? "Not set"}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function ToggleField({ label, initial, onSave }: { label: string; initial: boolean | null; onSave: (v: boolean) => void }) {
  const [v, setV] = useState<boolean | null>(initial);
  const btn = (val: boolean, text: string): CSSProperties => ({
    flex: 1, padding: "8px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    borderRadius: 8, border: "1px solid " + (v === val ? "transparent" : "var(--agent-border-default)"),
    background: v === val ? "var(--agent-coral)" : "var(--agent-surface)",
    color: v === val ? "#fff" : "var(--agent-text-secondary)",
  });
  return (
    <div style={labelStyle}>
      {label}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={btn(true, "Yes")} onClick={() => { setV(true); onSave(true); }}>Yes</button>
        <button type="button" style={btn(false, "No")} onClick={() => { setV(false); onSave(false); }}>No</button>
      </div>
    </div>
  );
}

function AreaField({ label, initial, onSave, placeholder }: { label: string; initial: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(initial);
  const last = useRef(initial);
  return (
    <label style={labelStyle}>
      {label}
      <textarea value={v} rows={3} placeholder={placeholder} className="agent-field" style={{ ...inputStyle, resize: "vertical" }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== last.current) { last.current = v; onSave(v); } }} />
    </label>
  );
}

type Range = { start: string; end?: string | null };
function AvailabilityField({ label, initial, onSave }: { label: string; initial: Range[]; onSave: (v: Range[]) => void }) {
  const [ranges, setRanges] = useState<Range[]>(initial);
  const commit = (next: Range[]) => { setRanges(next); onSave(next.filter((r) => r.start)); };
  return (
    <div style={labelStyle}>
      {label}
      <div style={{ display: "grid", gap: 8 }}>
        {ranges.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={r.start} className="agent-field" style={inputStyle} onChange={(e) => commit(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
            <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>to</span>
            <input type="date" value={r.end ?? ""} className="agent-field" style={inputStyle} onChange={(e) => commit(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value || null } : x)))} />
            <button type="button" aria-label="Remove" onClick={() => commit(ranges.filter((_, j) => j !== i))} className="chain-act-link chain-act-danger" style={{ fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => commit([...ranges, { start: "", end: null }])} className="chain-act-link chain-act-primary" style={{ fontWeight: 600, justifySelf: "start" }}>+ Add dates they can&rsquo;t do</button>
      </div>
    </div>
  );
}

// ── option sets ──────────────────────────────────────────────────────────────
const POSITION_OPTS = [
  { value: "mortgage", label: "Buying with a mortgage" },
  { value: "cash_buyer", label: "Cash buyer" },
  { value: "cash_from_proceeds", label: "Cash from a sale" },
];
const FLEX_OPTS = [{ value: "very", label: "Very flexible" }, { value: "somewhat", label: "Somewhat flexible" }, { value: "not", label: "Not flexible" }];
const FUNDS_SOURCE_OPTS = [{ value: "savings", label: "Savings" }, { value: "lisa", label: "Lifetime ISA" }, { value: "gift", label: "Gift" }, { value: "sale", label: "From a sale" }, { value: "other", label: "Other" }];
const FUNDS_IN_PLACE_OPTS = [{ value: "yes", label: "Yes, in place" }, { value: "not_yet", label: "Not yet" }, { value: "not_sure", label: "Not sure" }];
const NOTICE_OPTS = [{ value: "1m", label: "1 month" }, { value: "2m", label: "2 months" }, { value: "other", label: "Other" }];
const REMOVAL_OPTS = [{ value: "not_started", label: "Not started" }, { value: "getting_quotes", label: "Getting quotes" }, { value: "provisional", label: "Provisionally booked" }, { value: "confirmed", label: "Confirmed" }];
const VACANT_OPTS = [{ value: "yes", label: "Yes, vacant" }, { value: "no", label: "No" }, { value: "not_sure", label: "Not sure" }];
const TENURE_OPTS = [{ value: "freehold", label: "Freehold" }, { value: "leasehold", label: "Leasehold" }];
const STANCE_OPTS = [{ value: "PREPARED", label: "Prepared to break the chain" }, { value: "IF_REQUIRED", label: "Would break if required" }, { value: "UNWILLING", label: "Not willing to break the chain" }];

// ── the drawer ───────────────────────────────────────────────────────────────
export function IntroCallDrawer({ data, onClose, onCompleted, focusSide = null }: { data: IntroCallData; onClose: () => void; onCompleted: () => void; focusSide?: "vendor" | "purchaser" | null }) {
  const { theme, isNight } = usePortalTheme();
  const [page, setPage] = useState<"script" | "questions">("script");
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  // Guard via a ref, not `closing` state, so doClose stays stable. If it
  // depended on `closing`, setClosing(true) would recreate doClose, re-run the
  // keydown effect below, and its cleanup would clear the pending close timer —
  // leaving the blurred backdrop stuck on screen after a click-off.
  const doClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 200);
  }, [onClose]);

  useOverlayChrome(doClose);

  // Clear the close timer only on unmount, never on a doClose change.
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const run = (fn: () => Promise<unknown>) => {
    setErr(null);
    fn().catch(() => setErr("Couldn't save that. Check your connection and try again."));
  };

  const tx = data.transactionId;
  const saveMove = (side: "vendor" | "purchaser", patch: Partial<MoveInfo>) => run(() => saveMoveInfoAgentAction(tx, side, patch));
  const saveCosts = (patch: CostsPatch) => run(() => saveClientCostsAgentAction(tx, patch));

  // Chain intel is saved as a whole object; keep a live copy.
  const [intel, setIntel] = useState(data.chainIntel);
  const saveIntel = (next: NonNullable<IntroCallData["chainIntel"]>) => {
    setIntel(next);
    if (data.chainLinkId) {
      run(() => saveChainIntelAction(data.chainLinkId as string, {
        breakChainStance: (next.breakChainStance as ChainNodeIntelInput["breakChainStance"]) ?? null,
        breakChainConditions: next.breakChainConditions,
        expectedTimescale: next.expectedTimescale,
        chainNotes: next.chainNotes,
        lastChainCheckAt: next.lastChainCheckAt,
      }));
    }
  };

  // Onward tracker setup (seller): both facts needed before we open it.
  const [onwardTenure, setOnwardTenure] = useState<string>("");
  const [onwardMethod, setOnwardMethod] = useState<string>("");
  const maybeSetupOnward = (tenure: string, method: string) => {
    if (tenure && method) {
      run(() => setOnwardTypeFactsAction({ transactionId: tx, tenure: tenure as Tenure, purchaseType: method as PurchaseType, isShareOfFreehold: false }));
    }
  };

  async function complete() {
    setCompleting(true);
    try {
      await completeIntroCallAction(tx, side);
      onCompleted();
    } catch {
      setErr("Couldn't mark it complete. Try again.");
      setCompleting(false);
    }
  }

  // When launched from a specific contact card, focusSide scopes the drawer to
  // just that side (vendor card -> seller sections, buyer card -> buyer
  // sections). No focusSide (fallback) shows both. Either way it's one intro
  // record; this only controls what's on screen.
  // The intro is per-side: whichever contact launched it fixes the side. The
  // drawer shows only that side; there is no in-drawer buyer/seller toggle.
  const side: "vendor" | "purchaser" = focusSide ?? (data.hasPurchaser ? "purchaser" : "vendor");
  const isBuyerSide = side === "purchaser";
  const isCashBuyer = data.purchaseType === "cash_buyer";
  const prog = computeSideProgress(data, side);

  // Add a sale into the chain (onward above / related sale below), reusing the
  // exact chain flow. Creates a chain first if the file isn't in one yet.
  const [addNode, setAddNode] = useState<{ chainId: string; direction: "above" | "below" } | null>(null);
  const [preparingChain, setPreparingChain] = useState(false);
  async function openAddSale(direction: "above" | "below") {
    setPreparingChain(true);
    setErr(null);
    try {
      let chainId = data.chainId;
      if (!chainId) {
        const res = await fetch("/api/chains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: tx }),
        });
        const body = await res.json().catch(() => ({}));
        chainId = body?.chain?.id ?? null;
      }
      if (!chainId) { setErr("Couldn't set up the chain. Try again."); return; }
      setAddNode({ chainId, direction });
    } catch {
      setErr("Couldn't set up the chain. Try again.");
    } finally {
      setPreparingChain(false);
    }
  }
  const addSaleBtnStyle: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8,
    fontSize: 12.5, fontWeight: 600, cursor: preparingChain ? "wait" : "pointer",
    border: "1px solid var(--agent-border-default)", background: "var(--agent-surface)", color: "var(--agent-text-secondary)",
    justifySelf: "start",
  };

  return createPortal(
    <div data-theme={theme} data-night={isNight ? "" : undefined} className={`fixed inset-0 flex justify-end${isNight ? " nv2-night" : ""}`} style={{ zIndex: 1000 }}>
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={doClose} />
      <div
        role="dialog"
        aria-label="Intro call"
        className="relative z-10 flex flex-col h-full"
        style={{
          width: "min(880px, 100vw)",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards" : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header — address full width with the close top-right, then the
            Script/Questions toggle beneath it, bottom-right. Reads the same at
            every width (the address wraps instead of fighting the toggle). */}
        <div style={{ ...SHEET_BAND_STYLE, display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SheetBandHeader kicker="Intro call" title={data.address} icon={<PhoneCall size={18} weight="fill" />} />
            </div>
            <button
              onClick={doClose}
              aria-label="Close"
              className="agent-icon-btn agent-icon-btn-sm"
              style={{ color: "rgba(255,255,255,0.85)", background: "transparent", flexShrink: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X size={14} weight="bold" />
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.18)", borderRadius: 99, padding: 3 }}>
              {(["script", "questions"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPage(p)}
                  style={{
                    padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 99, cursor: "pointer", border: "none",
                    background: page === p ? "var(--agent-surface-elevated)" : "transparent",
                    color: page === p ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
                    boxShadow: page === p ? "0 1px 2px rgba(0,0,0,.12)" : "none",
                  }}>
                  {p === "script" ? "Script" : "Questions"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sliding track (two pages) */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{ display: "flex", width: "200%", height: "100%", transform: page === "script" ? "translateX(0)" : "translateX(-50%)", transition: "transform 0.28s cubic-bezier(0.25,0,0,1)" }}>
            {/* Page 1 — script */}
            <div style={{ width: "50%", height: "100%", overflowY: "auto", padding: "22px 24px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>A few things that make a real difference</p>
              <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                We'll keep an eye on the bigger picture and help keep things moving. There are a few simple things you can do along the way that really help us get you to exchange.
              </p>
              <div>
                {SCRIPT_POINTS.map((s, i) => {
                  const last = i === SCRIPT_POINTS.length - 1;
                  return (
                    <div key={i} style={{ display: "flex", gap: 14 }}>
                      {/* Number + connector — a timeline down the left edge */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <span style={{
                          width: 30, height: 30, borderRadius: 99, flexShrink: 0,
                          background: "radial-gradient(circle at 50% 32%, #ffffff 0%, var(--agent-coral-bg-tint) 100%)",
                          border: "1px solid rgba(var(--agent-coral-rgb), 0.30)",
                          boxShadow: "0 1px 3px rgba(var(--agent-coral-rgb), 0.22), inset 0 1px 0 rgba(255,255,255,0.85)",
                          color: "var(--agent-coral-deep)", fontSize: 12.5, fontWeight: 800,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}>{i + 1}</span>
                        {!last && (
                          <span aria-hidden style={{ flex: 1, width: 1.5, minHeight: 10, marginTop: 6, borderRadius: 2, background: "rgba(var(--agent-coral-rgb), 0.18)" }} />
                        )}
                      </div>
                      {/* Text — hairline divider between items, no card behind it */}
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 4, paddingBottom: last ? 2 : 18, borderBottom: last ? "none" : "1px solid var(--agent-border-subtle)" }}>
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{s.title}</p>
                        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{s.body}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>{s.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => setPage("questions")} className="agent-btn-color-primary"
                style={{ marginTop: 20, padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600 }}>
                On to the questions <LinkArrow />
              </button>
            </div>

            {/* Page 2 — questions (single side, fixed by focusSide) */}
            <div style={{ width: "50%", height: "100%", display: "flex", flexDirection: "column" }}>
              {/* Sub-header: back to script + progress up top */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: "1px solid var(--agent-border-subtle)" }}>
                <button type="button" onClick={() => setPage("script")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--agent-text-secondary)" }}>
                  <CaretLeft size={15} weight="bold" /> Back
                </button>
                {prog.total > 0 && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <div style={{ textAlign: "right", lineHeight: 1.15 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{prog.filled} of {prog.total}</div>
                      <div style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>captured</div>
                    </div>
                    <ProgressRing filled={prog.filled} total={prog.total} />
                  </div>
                )}
              </div>

              {/* Scrollable sections */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 28px" }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--agent-text-primary)" }}>{isBuyerSide ? "Buyer" : "Seller"}</p>
                <p style={{ margin: "2px 0 18px", fontSize: 12.5, color: "var(--agent-text-muted)" }}>
                  {isBuyerSide ? "Their position, funding and plans." : "Their onward position, timing and logistics."}
                </p>

                {isBuyerSide ? (
                  <>
                    <QSection first n={1} title="Contact" desc="Who we're speaking to">
                      <Cols n={3}>
                        <label style={labelStyle}>Name(s)
                          <div style={readonlyFieldStyle}>{data.purchaser?.name ?? "—"}</div>
                        </label>
                        <TextField label="Phone" icon={<Phone size={14} />} initial={data.purchaser?.phone ?? ""} type="tel" format={formatUKPhone}
                          onSave={(v) => { if (data.purchaser) run(() => updateContactAction({ id: data.purchaser!.id, transactionId: tx, name: data.purchaser!.name, phone: v || null, email: data.purchaser!.email })); }} />
                        <TextField label="Email" icon={<EnvelopeSimple size={14} />} initial={data.purchaser?.email ?? ""} type="email" format={v => v.trim().toLowerCase()}
                          onSave={(v) => { if (data.purchaser) run(() => updateContactAction({ id: data.purchaser!.id, transactionId: tx, name: data.purchaser!.name, phone: data.purchaser!.phone, email: v || null })); }} />
                      </Cols>
                    </QSection>

                    <QSection n={2} title="Buying position" desc="How they're buying and any related sale.">
                      <Cols n={3}>
                        <SelectField label="How they're buying" initial={data.purchaseType} options={POSITION_OPTS} placeholder="Not set"
                          onSave={(v) => { if (v) run(() => savePurchaseTypeAction(tx, v as PurchaseType)); }} />
                        <ToggleField label="First-time buyer?" initial={data.costs.firstTimeBuyer} onSave={(v) => saveCosts({ firstTimeBuyer: v })} />
                        <ToggleField label="Will own another property after?" initial={data.costs.additionalProperty} onSave={(v) => saveCosts({ additionalProperty: v })} />
                      </Cols>
                    </QSection>

                    <QSection n={3} title="Funding" desc="Deposit, mortgage and source of funds.">
                      <Cols n={isCashBuyer ? 3 : 4}>
                        <MoneyField label="Deposit" initial={data.costs.depositGBP} onSave={(v) => saveCosts({ depositGBP: v })} />
                        {!isCashBuyer && <MoneyField label="Mortgage amount" initial={data.costs.mortgageGBP} onSave={(v) => saveCosts({ mortgageGBP: v })} />}
                        <SelectField label="Where the money's coming from" initial={data.movePurchaser.fundsSource} options={FUNDS_SOURCE_OPTS} onSave={(v) => saveMove("purchaser", { fundsSource: v })} />
                        <SelectField label="Are the funds in place?" initial={data.movePurchaser.fundsInPlace} options={FUNDS_IN_PLACE_OPTS} onSave={(v) => saveMove("purchaser", { fundsInPlace: v })} />
                      </Cols>
                      {!isCashBuyer && (
                        <TextField label="Mortgage offer expiry (if they have one)" initial={data.movePurchaser.mortgageOfferExpiry ?? ""} type="date"
                          onSave={(v) => saveMove("purchaser", { mortgageOfferExpiry: v || null })} />
                      )}
                    </QSection>

                    <QSection n={4} title="Related sale" desc="Are they also selling another property?">
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "0 0 220px", minWidth: 180 }}>
                          <ToggleField label="Are they also selling?" initial={data.movePurchaser.sellingRelated} onSave={(v) => saveMove("purchaser", { sellingRelated: v })} />
                        </div>
                        {!isCashBuyer && (
                          <button type="button" onClick={() => void openAddSale("below")} disabled={preparingChain} style={addSaleBtnStyle}>
                            <Plus size={13} weight="bold" /> Add their related sale to the chain
                          </button>
                        )}
                      </div>
                    </QSection>

                    <QSection n={5} title="Timing & logistics" desc="Their preferred dates and any constraints.">
                      <Cols n={3}>
                        <TextField label="Preferred completion date" initial={data.movePurchaser.preferredCompletionDate ?? ""} type="date" onSave={(v) => saveMove("purchaser", { preferredCompletionDate: v || null })} />
                        <SelectField label="How flexible?" initial={data.movePurchaser.flexibility} options={FLEX_OPTS} onSave={(v) => saveMove("purchaser", { flexibility: v })} />
                        <ToggleField label="No completion preference yet?" initial={data.movePurchaser.noCompletionPreference} onSave={(v) => saveMove("purchaser", { noCompletionPreference: v })} />
                      </Cols>
                      <Cols n={3}>
                        <SelectField label="Notice to give?" initial={data.movePurchaser.noticePeriod} options={NOTICE_OPTS} onSave={(v) => saveMove("purchaser", { noticePeriod: v, needsNotice: v ? true : null })} />
                        <ToggleField label="Notice given?" initial={data.movePurchaser.noticeGiven} onSave={(v) => saveMove("purchaser", { noticeGiven: v })} />
                        <TextField label="Notice ends" initial={data.movePurchaser.noticeEndDate ?? ""} type="date" onSave={(v) => saveMove("purchaser", { noticeEndDate: v || null })} />
                      </Cols>
                      <Cols n={2}>
                        <SelectField label="Removals" initial={data.movePurchaser.removalStatus} options={REMOVAL_OPTS} onSave={(v) => saveMove("purchaser", { removalStatus: v })} />
                        <TextField label="Removal company" initial={data.movePurchaser.removalCompany ?? ""} onSave={(v) => saveMove("purchaser", { removalCompany: v || null })} />
                      </Cols>
                      <AvailabilityField label="Any dates they can't do?" initial={data.movePurchaser.unavailableDates} onSave={(v) => saveMove("purchaser", { unavailableDates: v })} />
                      <AreaField label="Anything else about the buyer?" initial={data.movePurchaser.progressorNote ?? ""} placeholder="Notes only your team sees…" onSave={(v) => saveMove("purchaser", { progressorNote: v || null })} />
                    </QSection>

                    <QSection n={6} title="Solicitor" desc="Their solicitor acting on this transaction.">
                      <SolicitorSection transactionId={tx} vendor={data.solVendor} purchaser={data.solPurchaser} referredFirmId={data.referredFirmId} referralFee={data.referralFee} address={data.address} contacts={data.contactRoles} onlySide="purchaser" hideHeader briefcaseIcon embedded />
                    </QSection>
                  </>
                ) : (
                  <>
                    <QSection first n={1} title="Contact" desc="Who we're speaking to">
                      <Cols n={3}>
                        <label style={labelStyle}>Name
                          <div style={readonlyFieldStyle}>{data.vendor?.name ?? "—"}</div>
                        </label>
                        <TextField label="Phone" icon={<Phone size={14} />} initial={data.vendor?.phone ?? ""} type="tel" format={formatUKPhone}
                          onSave={(v) => { if (data.vendor) run(() => updateContactAction({ id: data.vendor!.id, transactionId: tx, name: data.vendor!.name, phone: v || null, email: data.vendor!.email })); }} />
                        <TextField label="Email" icon={<EnvelopeSimple size={14} />} initial={data.vendor?.email ?? ""} type="email" format={v => v.trim().toLowerCase()}
                          onSave={(v) => { if (data.vendor) run(() => updateContactAction({ id: data.vendor!.id, transactionId: tx, name: data.vendor!.name, phone: data.vendor!.phone, email: v || null })); }} />
                      </Cols>
                    </QSection>

                    <QSection n={2} title="Onward position" desc="What they're doing next.">
                      <ToggleField label="Are they buying onward?" initial={data.moveVendor.buyingOnward} onSave={(v) => saveMove("vendor", { buyingOnward: v })} />
                      {!data.onward.typeFactsSet ? (
                        <Cols n={3}>
                          <SelectField label="Onward: freehold or leasehold?" initial={onwardTenure || null} options={TENURE_OPTS}
                            onSave={(v) => { setOnwardTenure(v ?? ""); maybeSetupOnward(v ?? "", onwardMethod); }} />
                          <SelectField label="Onward: how they're funding it" initial={onwardMethod || null} options={POSITION_OPTS}
                            onSave={(v) => { setOnwardMethod(v ?? ""); maybeSetupOnward(onwardTenure, v ?? ""); }} />
                          <SelectField label="Onward ready to exchange?" initial={data.moveVendor.onwardReadyToExchange} options={FUNDS_IN_PLACE_OPTS} onSave={(v) => saveMove("vendor", { onwardReadyToExchange: v })} />
                        </Cols>
                      ) : (
                        <>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>Onward tracker is set up. Manage its steps from the file.</p>
                          <Cols n={2}>
                            <SelectField label="Onward ready to exchange?" initial={data.moveVendor.onwardReadyToExchange} options={FUNDS_IN_PLACE_OPTS} onSave={(v) => saveMove("vendor", { onwardReadyToExchange: v })} />
                          </Cols>
                        </>
                      )}
                      <Cols n={2}>
                        <TextField label="Onward mortgage offer expiry" initial={data.moveVendor.onwardMortgageOfferExpiry ?? ""} type="date" onSave={(v) => saveMove("vendor", { onwardMortgageOfferExpiry: v || null })} />
                        <div style={{ display: "flex", alignItems: "flex-end" }}>
                          <button type="button" onClick={() => void openAddSale("above")} disabled={preparingChain} style={addSaleBtnStyle}>
                            <Plus size={13} weight="bold" /> Add the onward property to the chain
                          </button>
                        </div>
                      </Cols>
                    </QSection>

                    <QSection n={3} title="Timing & logistics" desc="Completion, notice and moving details.">
                      <Cols n={3}>
                        <TextField label="Preferred completion date" initial={data.moveVendor.preferredCompletionDate ?? ""} type="date" onSave={(v) => saveMove("vendor", { preferredCompletionDate: v || null })} />
                        <SelectField label="How flexible?" initial={data.moveVendor.flexibility} options={FLEX_OPTS} onSave={(v) => saveMove("vendor", { flexibility: v })} />
                        <ToggleField label="No completion preference yet?" initial={data.moveVendor.noCompletionPreference} onSave={(v) => saveMove("vendor", { noCompletionPreference: v })} />
                      </Cols>
                      <Cols n={3}>
                        <SelectField label="Vacant before completion?" initial={data.moveVendor.vacantBeforeCompletion} options={VACANT_OPTS} onSave={(v) => saveMove("vendor", { vacantBeforeCompletion: v })} />
                        <SelectField label="Notice to give?" initial={data.moveVendor.noticePeriod} options={NOTICE_OPTS} onSave={(v) => saveMove("vendor", { noticePeriod: v, needsNotice: v ? true : null })} />
                        <ToggleField label="Notice given?" initial={data.moveVendor.noticeGiven} onSave={(v) => saveMove("vendor", { noticeGiven: v })} />
                      </Cols>
                      <Cols n={3}>
                        <TextField label="Notice ends" initial={data.moveVendor.noticeEndDate ?? ""} type="date" onSave={(v) => saveMove("vendor", { noticeEndDate: v || null })} />
                        <SelectField label="Removals" initial={data.moveVendor.removalStatus} options={REMOVAL_OPTS} onSave={(v) => saveMove("vendor", { removalStatus: v })} />
                        <TextField label="Removal company" initial={data.moveVendor.removalCompany ?? ""} onSave={(v) => saveMove("vendor", { removalCompany: v || null })} />
                      </Cols>
                      <AvailabilityField label="Dates they can't do" initial={data.moveVendor.unavailableDates} onSave={(v) => saveMove("vendor", { unavailableDates: v })} />
                      <AreaField label="Anything else about the seller?" initial={data.moveVendor.progressorNote ?? ""} placeholder="Notes only your team sees…" onSave={(v) => saveMove("vendor", { progressorNote: v || null })} />
                    </QSection>

                    {data.chainLinkId && intel && (
                      <QSection n={4} title="Chain" desc="Their position in the chain.">
                        <SelectField label="Will they break the chain?" initial={intel.breakChainStance} options={STANCE_OPTS} onSave={(v) => saveIntel({ ...intel, breakChainStance: v })} />
                        <Cols n={2}>
                          <TextField label="Conditions around breaking" initial={intel.breakChainConditions ?? ""} onSave={(v) => saveIntel({ ...intel, breakChainConditions: v || null })} />
                          <TextField label="Expected timescale / delays" initial={intel.expectedTimescale ?? ""} onSave={(v) => saveIntel({ ...intel, expectedTimescale: v || null })} />
                        </Cols>
                        <AreaField label="Chain notes" initial={intel.chainNotes ?? ""} onSave={(v) => saveIntel({ ...intel, chainNotes: v || null })} />
                      </QSection>
                    )}

                    <QSection n={data.chainLinkId && intel ? 5 : 4} title="Solicitor" desc="Their solicitor acting on this transaction.">
                      <SolicitorSection transactionId={tx} vendor={data.solVendor} purchaser={data.solPurchaser} referredFirmId={data.referredFirmId} referralFee={data.referralFee} address={data.address} contacts={data.contactRoles} onlySide="vendor" hideHeader briefcaseIcon embedded />
                    </QSection>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: "14px 20px", borderTop: "1px solid rgba(0,0,0,0.08)", background: "var(--agent-surface)" }}>
          {err && <p role="alert" style={{ margin: "0 0 8px", fontSize: 12, color: "var(--agent-danger)" }}>{err}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--agent-text-muted)", flex: 1 }}>
              Answers save as you go.
            </p>
            <button type="button" onClick={() => void complete()} disabled={completing} className="agent-btn-color-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, opacity: completing ? 0.6 : 1, cursor: completing ? "wait" : "pointer", transition: "transform 140ms ease, filter 180ms ease, box-shadow 180ms ease" }}>
              <CheckCircle size={16} weight="fill" />
              {completing ? "Saving…" : "Mark introduction complete"}
            </button>
          </div>
        </div>
      </div>

      {/* Add-sale reuses the exact chain flow; it portals over this drawer. */}
      {addNode && (
        <AddNodeDrawer
          chainId={addNode.chainId}
          transactionId={tx}
          direction={addNode.direction}
          onClose={() => setAddNode(null)}
          onSaved={() => setAddNode(null)}
        />
      )}
    </div>,
    document.body,
  );
}
