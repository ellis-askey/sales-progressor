"use client";

import { useState, useRef, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, PhoneCall, ClipboardText, CheckCircle } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import {
  getIntroCallDataAction,
  saveClientCostsAgentAction,
  saveMoveInfoAgentAction,
  completeIntroCallAction,
  type IntroCallData,
} from "@/app/actions/intro-call";
import { savePurchaseTypeAction } from "@/app/actions/transactions";
import { updateContactAction } from "@/app/actions/contacts";
import { setOnwardTypeFactsAction } from "@/app/actions/onward";
import { saveChainIntelAction } from "@/app/actions/chain-intel";
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
const SCRIPT_POINTS: { title: string; body: string }[] = [
  { title: "Speak to your solicitor regularly", body: "At least once a fortnight, and chase anything you're waiting on. It keeps things moving." },
  { title: "Keep us in the loop", body: "Tell us the moment anything changes your end, however small. The more we know, the more we can do." },
  { title: "We'll tell you when to act", body: "Watch for our nudges. When something needs you, we'll let you know exactly what and when." },
  { title: "Use the portal, and use us", body: "Everything's in one place, and we're on hand. The more you use both, the smoother this goes." },
  { title: "If it's stuck, tell us", body: "Sorting the hold-ups is what we're here for. Nothing's too small to flag." },
];

// ── field primitives ─────────────────────────────────────────────────────────
const labelStyle: CSSProperties = { display: "grid", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" };
const inputStyle: CSSProperties = {
  fontSize: 13, fontWeight: 400, padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--agent-border-default)", background: "var(--agent-surface)",
  color: "var(--agent-text-primary)", width: "100%", fontFamily: "inherit",
};

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}

function TextField({ label, initial, onSave, placeholder, type = "text" }: { label: string; initial: string; onSave: (v: string) => void; placeholder?: string; type?: string }) {
  const [v, setV] = useState(initial);
  const last = useRef(initial);
  return (
    <label style={labelStyle}>
      {label}
      <input type={type} value={v} placeholder={placeholder} style={inputStyle}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== last.current) { last.current = v; onSave(v); } }} />
    </label>
  );
}

function MoneyField({ label, initial, onSave }: { label: string; initial: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(initial != null ? String(initial) : "");
  const last = useRef(v);
  return (
    <label style={labelStyle}>
      {label}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 10, top: 8, fontSize: 13, color: "var(--agent-text-muted)" }}>£</span>
        <input inputMode="numeric" value={v} style={{ ...inputStyle, paddingLeft: 22 }}
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
      <select value={v} style={inputStyle} onChange={(e) => { setV(e.target.value); onSave(e.target.value || null); }}>
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
      <textarea value={v} rows={3} placeholder={placeholder} style={{ ...inputStyle, resize: "vertical" }}
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
            <input type="date" value={r.start} style={inputStyle} onChange={(e) => commit(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
            <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>to</span>
            <input type="date" value={r.end ?? ""} style={inputStyle} onChange={(e) => commit(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value || null } : x)))} />
            <button type="button" aria-label="Remove" onClick={() => commit(ranges.filter((_, j) => j !== i))} className="chain-act-link chain-act-danger" style={{ fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => commit([...ranges, { start: "", end: null }])} className="chain-act-link chain-act-primary" style={{ fontWeight: 600, justifySelf: "start" }}>+ Add dates they can&rsquo;t do</button>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

// Rough completeness gauge for the footer: of the questions that apply to this
// file, how many already have an answer. Computed from the loaded snapshot.
function computeProgress(d: IntroCallData): { filled: number; total: number } {
  const items: (unknown | null | undefined)[] = [];
  if (d.hasPurchaser) {
    items.push(d.purchaseType, d.costs.depositGBP, d.movePurchaser.fundsSource, d.movePurchaser.fundsInPlace, d.costs.firstTimeBuyer, d.costs.additionalProperty, d.movePurchaser.preferredCompletionDate, d.movePurchaser.flexibility, d.movePurchaser.noticePeriod, d.movePurchaser.removalStatus);
    if (d.purchaseType !== "cash_buyer") items.push(d.costs.mortgageGBP, d.movePurchaser.mortgageOfferExpiry);
  }
  if (d.hasVendor) {
    items.push(d.moveVendor.buyingOnward, d.moveVendor.vacantBeforeCompletion, d.moveVendor.preferredCompletionDate, d.moveVendor.flexibility, d.moveVendor.noticePeriod, d.moveVendor.removalStatus);
  }
  if (d.chainLinkId) items.push(d.chainIntel?.breakChainStance);
  const filled = items.filter((v) => v !== null && v !== undefined && v !== "").length;
  return { filled, total: items.length };
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
export function IntroCallDrawer({ data, onClose, onCompleted }: { data: IntroCallData; onClose: () => void; onCompleted: () => void }) {
  const { theme } = usePortalTheme();
  const [page, setPage] = useState<"script" | "questions">("script");
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 200);
  }, [closing, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") doClose(); }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [doClose]);

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
      await completeIntroCallAction(tx);
      onCompleted();
    } catch {
      setErr("Couldn't mark it complete. Try again.");
      setCompleting(false);
    }
  }

  const showBuyer = data.hasPurchaser;
  const showSeller = data.hasVendor;
  const isCashBuyer = data.purchaseType === "cash_buyer";
  const prog = computeProgress(data);

  return createPortal(
    <div data-theme={theme} className="fixed inset-0 flex justify-end" style={{ zIndex: 1000 }}>
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={doClose} />
      <div
        role="dialog"
        aria-label="Intro call"
        className="relative z-10 flex flex-col h-full"
        style={{
          width: "min(760px, 100vw)",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards" : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header + page tabs */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,0.08)", gap: 12, flexShrink: 0 }}>
          <PhoneCall size={18} weight="fill" style={{ color: "var(--agent-coral)" }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", flex: 1 }}>Intro call</p>
          <div style={{ display: "inline-flex", background: "var(--agent-border-subtle)", borderRadius: 99, padding: 3 }}>
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
          <button onClick={doClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm"><X size={14} weight="bold" /></button>
        </div>

        {/* Sliding track (two pages) */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{ display: "flex", width: "200%", height: "100%", transform: page === "script" ? "translateX(0)" : "translateX(-50%)", transition: "transform 0.28s cubic-bezier(0.25,0,0,1)" }}>
            {/* Page 1 — script */}
            <div style={{ width: "50%", height: "100%", overflowY: "auto", padding: "22px 24px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Set the tone</p>
              <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                The key things to get across so they know how this works and how to get the best from us.
              </p>
              <div style={{ display: "grid", gap: 12 }}>
                {SCRIPT_POINTS.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--agent-hover-tint)", border: "1px solid var(--agent-border-subtle)", borderRadius: 12, padding: "12px 14px" }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: "var(--agent-coral-bg-tint)", color: "var(--agent-coral-darker)", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>{s.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setPage("questions")} className="agent-btn-color-primary"
                style={{ marginTop: 20, padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600 }}>
                On to the questions →
              </button>
            </div>

            {/* Page 2 — questions */}
            <div style={{ width: "50%", height: "100%", overflowY: "auto", padding: "22px 24px" }}>
              <div style={{ display: "grid", gap: 24 }}>
                {/* Contacts */}
                {(data.vendor || data.purchaser) && (
                  <Group title="Who we're speaking to">
                    {data.vendor && (
                      <Row>
                        <TextField label={`Seller phone (${data.vendor.name})`} initial={data.vendor.phone ?? ""} type="tel"
                          onSave={(v) => run(() => updateContactAction({ id: data.vendor!.id, transactionId: tx, name: data.vendor!.name, phone: v || null, email: data.vendor!.email }))} />
                        <TextField label="Seller email" initial={data.vendor.email ?? ""} type="email"
                          onSave={(v) => run(() => updateContactAction({ id: data.vendor!.id, transactionId: tx, name: data.vendor!.name, phone: data.vendor!.phone, email: v || null }))} />
                      </Row>
                    )}
                    {data.purchaser && (
                      <Row>
                        <TextField label={`Buyer phone (${data.purchaser.name})`} initial={data.purchaser.phone ?? ""} type="tel"
                          onSave={(v) => run(() => updateContactAction({ id: data.purchaser!.id, transactionId: tx, name: data.purchaser!.name, phone: v || null, email: data.purchaser!.email }))} />
                        <TextField label="Buyer email" initial={data.purchaser.email ?? ""} type="email"
                          onSave={(v) => run(() => updateContactAction({ id: data.purchaser!.id, transactionId: tx, name: data.purchaser!.name, phone: data.purchaser!.phone, email: v || null }))} />
                      </Row>
                    )}
                  </Group>
                )}

                {/* Buyer */}
                {showBuyer && (
                  <Group title="The buyer">
                    <SelectField label="How they're buying" initial={data.purchaseType} options={POSITION_OPTS} placeholder="Not set"
                      onSave={(v) => { if (v) run(() => savePurchaseTypeAction(tx, v as PurchaseType)); }} />
                    <Row>
                      <MoneyField label="Deposit" initial={data.costs.depositGBP} onSave={(v) => saveCosts({ depositGBP: v })} />
                      {!isCashBuyer && <MoneyField label="Mortgage amount" initial={data.costs.mortgageGBP} onSave={(v) => saveCosts({ mortgageGBP: v })} />}
                    </Row>
                    <Row>
                      <SelectField label="Where the money's coming from" initial={data.movePurchaser.fundsSource} options={FUNDS_SOURCE_OPTS} onSave={(v) => saveMove("purchaser", { fundsSource: v })} />
                      <SelectField label="Are the funds in place?" initial={data.movePurchaser.fundsInPlace} options={FUNDS_IN_PLACE_OPTS} onSave={(v) => saveMove("purchaser", { fundsInPlace: v })} />
                    </Row>
                    <Row>
                      <ToggleField label="First-time buyer?" initial={data.costs.firstTimeBuyer} onSave={(v) => saveCosts({ firstTimeBuyer: v })} />
                      <ToggleField label="Will own another property after?" initial={data.costs.additionalProperty} onSave={(v) => saveCosts({ additionalProperty: v })} />
                    </Row>
                    {!isCashBuyer && (
                      <TextField label="Mortgage offer expiry (if they have one)" initial={data.movePurchaser.mortgageOfferExpiry ?? ""} type="date"
                        onSave={(v) => saveMove("purchaser", { mortgageOfferExpiry: v || null })} />
                    )}
                  </Group>
                )}

                {/* Seller */}
                {showSeller && (
                  <Group title="The seller">
                    <ToggleField label="Are they buying onward?" initial={data.moveVendor.buyingOnward} onSave={(v) => saveMove("vendor", { buyingOnward: v })} />
                    {!data.onward.typeFactsSet ? (
                      <Row>
                        <SelectField label="Onward: freehold or leasehold?" initial={onwardTenure || null} options={TENURE_OPTS}
                          onSave={(v) => { setOnwardTenure(v ?? ""); maybeSetupOnward(v ?? "", onwardMethod); }} />
                        <SelectField label="Onward: how they're funding it" initial={onwardMethod || null} options={POSITION_OPTS}
                          onSave={(v) => { setOnwardMethod(v ?? ""); maybeSetupOnward(onwardTenure, v ?? ""); }} />
                      </Row>
                    ) : (
                      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>Onward tracker is set up. Manage its steps from the file.</p>
                    )}
                    <Row>
                      <SelectField label="Onward ready to exchange?" initial={data.moveVendor.onwardReadyToExchange} options={FUNDS_IN_PLACE_OPTS} onSave={(v) => saveMove("vendor", { onwardReadyToExchange: v })} />
                      <TextField label="Onward mortgage offer expiry" initial={data.moveVendor.onwardMortgageOfferExpiry ?? ""} type="date" onSave={(v) => saveMove("vendor", { onwardMortgageOfferExpiry: v || null })} />
                    </Row>
                    <SelectField label="Vacant before completion?" initial={data.moveVendor.vacantBeforeCompletion} options={VACANT_OPTS} onSave={(v) => saveMove("vendor", { vacantBeforeCompletion: v })} />
                  </Group>
                )}

                {/* Timescales & logistics — per present side */}
                {showSeller && (
                  <Group title="Seller: timing & logistics">
                    <Row>
                      <TextField label="Preferred completion date" initial={data.moveVendor.preferredCompletionDate ?? ""} type="date" onSave={(v) => saveMove("vendor", { preferredCompletionDate: v || null })} />
                      <SelectField label="How flexible?" initial={data.moveVendor.flexibility} options={FLEX_OPTS} onSave={(v) => saveMove("vendor", { flexibility: v })} />
                    </Row>
                    <ToggleField label="No completion preference yet?" initial={data.moveVendor.noCompletionPreference} onSave={(v) => saveMove("vendor", { noCompletionPreference: v })} />
                    <Row>
                      <SelectField label="Notice to give?" initial={data.moveVendor.noticePeriod} options={NOTICE_OPTS} onSave={(v) => saveMove("vendor", { noticePeriod: v, needsNotice: v ? true : null })} />
                      <SelectField label="Removals" initial={data.moveVendor.removalStatus} options={REMOVAL_OPTS} onSave={(v) => saveMove("vendor", { removalStatus: v })} />
                    </Row>
                    <Row>
                      <ToggleField label="Notice given?" initial={data.moveVendor.noticeGiven} onSave={(v) => saveMove("vendor", { noticeGiven: v })} />
                      <TextField label="Notice ends" initial={data.moveVendor.noticeEndDate ?? ""} type="date" onSave={(v) => saveMove("vendor", { noticeEndDate: v || null })} />
                    </Row>
                    <TextField label="Removal company" initial={data.moveVendor.removalCompany ?? ""} onSave={(v) => saveMove("vendor", { removalCompany: v || null })} />
                    <AvailabilityField label="Dates they can't do" initial={data.moveVendor.unavailableDates} onSave={(v) => saveMove("vendor", { unavailableDates: v })} />
                    <AreaField label="Anything else about the seller" initial={data.moveVendor.progressorNote ?? ""} placeholder="Notes only your team sees…" onSave={(v) => saveMove("vendor", { progressorNote: v || null })} />
                  </Group>
                )}
                {showBuyer && (
                  <Group title="Buyer: timing & logistics">
                    <Row>
                      <TextField label="Preferred completion date" initial={data.movePurchaser.preferredCompletionDate ?? ""} type="date" onSave={(v) => saveMove("purchaser", { preferredCompletionDate: v || null })} />
                      <SelectField label="How flexible?" initial={data.movePurchaser.flexibility} options={FLEX_OPTS} onSave={(v) => saveMove("purchaser", { flexibility: v })} />
                    </Row>
                    <ToggleField label="No completion preference yet?" initial={data.movePurchaser.noCompletionPreference} onSave={(v) => saveMove("purchaser", { noCompletionPreference: v })} />
                    <Row>
                      <SelectField label="Notice to give?" initial={data.movePurchaser.noticePeriod} options={NOTICE_OPTS} onSave={(v) => saveMove("purchaser", { noticePeriod: v, needsNotice: v ? true : null })} />
                      <SelectField label="Removals" initial={data.movePurchaser.removalStatus} options={REMOVAL_OPTS} onSave={(v) => saveMove("purchaser", { removalStatus: v })} />
                    </Row>
                    <Row>
                      <ToggleField label="Notice given?" initial={data.movePurchaser.noticeGiven} onSave={(v) => saveMove("purchaser", { noticeGiven: v })} />
                      <TextField label="Notice ends" initial={data.movePurchaser.noticeEndDate ?? ""} type="date" onSave={(v) => saveMove("purchaser", { noticeEndDate: v || null })} />
                    </Row>
                    <TextField label="Removal company" initial={data.movePurchaser.removalCompany ?? ""} onSave={(v) => saveMove("purchaser", { removalCompany: v || null })} />
                    <AvailabilityField label="Dates they can't do" initial={data.movePurchaser.unavailableDates} onSave={(v) => saveMove("purchaser", { unavailableDates: v })} />
                    <AreaField label="Anything else about the buyer" initial={data.movePurchaser.progressorNote ?? ""} placeholder="Notes only your team sees…" onSave={(v) => saveMove("purchaser", { progressorNote: v || null })} />
                  </Group>
                )}

                {/* Chain intel */}
                {data.chainLinkId && intel && (
                  <Group title="Chain">
                    <SelectField label="Will they break the chain?" initial={intel.breakChainStance} options={STANCE_OPTS} onSave={(v) => saveIntel({ ...intel, breakChainStance: v })} />
                    <TextField label="Conditions around breaking" initial={intel.breakChainConditions ?? ""} onSave={(v) => saveIntel({ ...intel, breakChainConditions: v || null })} />
                    <TextField label="Expected timescale / delays" initial={intel.expectedTimescale ?? ""} onSave={(v) => saveIntel({ ...intel, expectedTimescale: v || null })} />
                    <AreaField label="Chain notes" initial={intel.chainNotes ?? ""} onSave={(v) => saveIntel({ ...intel, chainNotes: v || null })} />
                  </Group>
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
              {prog.total > 0 && <strong style={{ color: "var(--agent-text-secondary)" }}>Captured {prog.filled} of {prog.total}. </strong>}
              Answers save as you go.
            </p>
            <button type="button" onClick={() => void complete()} disabled={completing} className="agent-btn-color-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, opacity: completing ? 0.6 : 1, cursor: completing ? "wait" : "pointer" }}>
              <CheckCircle size={16} weight="fill" />
              {completing ? "Saving…" : "Introduction complete"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── the opener (lives on the client card) ────────────────────────────────────
// Fetches its own state; shows "Start intro call" only while the file's intro
// isn't done (one-time per file). Internal-team gating is the caller's job.
export function IntroCallLauncher({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<IntroCallData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getIntroCallDataAction(transactionId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => { void load(); }, [load]);

  async function openDrawer() {
    // Refresh to prefill from the latest saved values.
    await load();
    setOpen(true);
  }

  if (!data || data.introDone) return null;

  return (
    <>
      <button type="button" onClick={() => void openDrawer()} disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9,
          fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          border: "1px solid var(--agent-coral)", background: "var(--agent-coral-bg-tint)", color: "var(--agent-coral-darker)",
        }}>
        <ClipboardText size={15} weight="fill" />
        Start intro call
      </button>
      {open && data && (
        <IntroCallDrawer
          data={data}
          onClose={() => setOpen(false)}
          onCompleted={() => { setOpen(false); setData((d) => (d ? { ...d, introDone: true } : d)); }}
        />
      )}
    </>
  );
}
