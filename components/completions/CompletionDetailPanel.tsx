"use client";

// Completions → floating detail panel. Opens from the right when a completion
// row is selected; a floating, inset, rounded glass panel (NOT a full-height
// edge drawer, NO dark backdrop — the list stays live behind it). It is the
// Completions sibling of components/transactions/FloatingFilePreview: same shell
// (portal + portal-theming + keep-mounted exit animation + Escape + focus
// restore + prev/next), different body. Every figure is fed straight from the
// already-loaded CompletionFileRow; the actions reuse the real production
// handlers (completeFileAction / DateMenu / FeeMenu), so this is drop-in.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CaretLeft, CaretRight, X, CheckCircle, Circle, CalendarBlank, UsersThree,
  Buildings, ArrowSquareOut, Flag, Scales, Timer,
} from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { withFrom } from "@/lib/agent/back-nav";
import { DateMenu } from "@/components/completions/CompletionCardMenus";
import { completeFileAction } from "@/app/actions/completions";
import { ContactAvatar } from "@/components/ui/Avatar";
import { AgentFeeInline } from "@/components/transaction/AgentFeeInline";
import { Popover } from "@/components/ui/Popover";
import type { CompletionFileRow } from "@/components/completions/CompletionFileRowView";

// ── helpers ────────────────────────────────────────────────────────────────
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { line: address, location: "" };
  return { line: parts.slice(0, -2).join(", ") || parts[0], location: parts.slice(-2).join(", ") };
}
function fmtShort(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTiny(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtMoney(pence?: number | null): string | null {
  if (pence == null) return null;
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}
function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}
// Days-to-completion status — the single source of the overdue/upcoming tone.
export function completionStatus(iso: string | null | undefined): { label: string; color: string; rel: number | null } {
  if (!iso) return { label: "No date set", color: "var(--agent-text-muted)", rel: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const rel = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (rel < 0) return { label: `${Math.abs(rel)} days overdue`, color: "var(--agent-danger)", rel };
  if (rel === 0) return { label: "Completing today", color: "var(--agent-warning)", rel };
  if (rel === 1) return { label: "Completing tomorrow", color: "var(--agent-warning)", rel };
  if (rel <= 7) return { label: `${rel} days to go`, color: "var(--agent-warning)", rel };
  return { label: `${rel} days to go`, color: "var(--agent-text-secondary)", rel };
}

// The one derived "next step" line — mirrors what the file would be chased for.
// Display only (an open dot, not an action): we never invent a new control.
function nextStep(file: CompletionFileRow): string {
  const st = completionStatus(file.completionDateIso);
  if (!file.vendorSolicitorName && !file.purchaserSolicitorName) return "Add the solicitors on both sides.";
  if (st.rel != null && st.rel < 0) return "Chase completion and confirm a new target date.";
  if (file.internal && !(file.completionFundsSent === true || file.fundsInPlace === "yes")) return "Confirm completion funds are in place.";
  if (!file.completionDateIso) return "Set a completion date.";
  return "On track. Keep both sides moving to the date.";
}

type JourneyState = "done" | "now" | "todo";
function JourneyNode({ label, date, state }: { label: string; date: string; state: JourneyState }) {
  const done = state === "done";
  return (
    <div className="cdp-jnode">
      <span className={`cdp-jdot cdp-jdot--${state}`}>
        {done ? <CheckCircle size={20} weight="fill" /> : <Circle size={20} weight={state === "now" ? "bold" : "regular"} />}
      </span>
      <span className="cdp-jlabel">{label}</span>
      <span className="cdp-jdate">{date}</span>
    </div>
  );
}

export function CompletionDetailPanel({
  file, open, completed = false, basePath = "/agent/transactions",
  onClose, onPrev, onNext, hasPrev, hasNext,
}: {
  file: CompletionFileRow | null;
  open: boolean;
  completed?: boolean;
  basePath?: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const { theme, isNight } = usePortalTheme();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // Keep-mounted exit animation (mirrors FloatingFilePreview / Drawer).
  const [rendered, setRendered] = useState(open);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (open) { setRendered(true); setExiting(false); return; }
    if (!rendered) return;
    setExiting(true);
    const t = setTimeout(() => { setRendered(false); setExiting(false); }, 220);
    return () => clearTimeout(t);
  }, [open, rendered]);

  const [photoFailed, setPhotoFailed] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeDate, setCompleteDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const id = file?.id ?? null;
  useEffect(() => { setPhotoFailed(false); setCompleting(false); setCompleteDate(file?.completionDateIso ? file.completionDateIso.split("T")[0] : ""); }, [id, file?.completionDateIso]);

  // Escape closes; focus restored on close.
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { e.preventDefault(); onClose(); } }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prevFocus.current?.focus?.(); };
  }, [open, onClose]);
  useEffect(() => { if (open && panelRef.current) panelRef.current.focus(); }, [open]);

  // Retain the last file through the close animation.
  const lastFile = useRef<CompletionFileRow | null>(null);
  if (file) lastFile.current = file;
  const f = file ?? lastFile.current;

  if (!rendered || typeof window === "undefined" || !f) return null;

  const addr = splitAddress(f.propertyAddress);
  const st = completionStatus(f.completionDateIso);
  const exToComp = daysBetween(f.exchangedAtIso, f.completionDateIso);
  // When overdue, the "real" elapsed exchange→today is the honest figure.
  const elapsed = f.exchangedAtIso ? daysBetween(f.exchangedAtIso, new Date().toISOString()) : null;
  const exToCompDisplay = completed ? exToComp : (st.rel != null && st.rel < 0 ? elapsed : exToComp);

  const agents = f.agencyName ?? f.assignedUserName ?? "Not recorded";
  const feeStr = fmtMoney(f.agentFeeAmount);
  const priceStr = f.purchasePrice != null ? "£" + Math.round(f.purchasePrice / 100).toLocaleString("en-GB") : null;

  // Journey states — exchanged is always done here (these files have exchanged);
  // completion is done only on the Completed tab.
  const compState: JourneyState = completed ? "done" : "now";

  async function doComplete() {
    if (!completeDate) return;
    setSaving(true);
    try { await completeFileAction(f!.id, completeDate); onClose(); router.refresh(); }
    catch { /* visual prototype / scope-guarded in prod — surfaced via toast there */ }
    finally { setSaving(false); }
  }

  const panel = (
    <div className={`cdp-root${exiting ? " cdp-exiting" : ""}`} data-theme={theme} data-night={isNight ? "" : undefined}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Completion: ${addr.line}`}
        className={`cdp-panel${exiting ? " cdp-out" : " cdp-in"}`}
      >
        {/* Nav */}
        <div className="cdp-nav">
          <div className="cdp-nav-arrows">
            <button type="button" className="cdp-ic" aria-label="Previous file" disabled={!hasPrev} onClick={onPrev}><CaretLeft size={16} weight="bold" /></button>
            <button type="button" className="cdp-ic" aria-label="Next file" disabled={!hasNext} onClick={onNext}><CaretRight size={16} weight="bold" /></button>
          </div>
          <button type="button" className="cdp-ic" aria-label="Close panel" onClick={onClose}><X size={16} weight="bold" /></button>
        </div>

        <div className="cdp-scroll">
          {/* Hero */}
          {f.photoUrl && !photoFailed
            ? <img className="cdp-photo" src={f.photoUrl} alt="" onError={() => setPhotoFailed(true)} />
            : <span className="cdp-photo property-photo-fallback" aria-hidden />}

          {/* Head: address + price + status */}
          <div className="cdp-head">
            <div className="cdp-head-main">
              <h2 className="cdp-addr">{addr.line}</h2>
              {addr.location && <p className="cdp-town">{addr.location}</p>}
            </div>
            {priceStr && <p className="cdp-price">{priceStr}</p>}
          </div>
          {/* Active files show the overdue/countdown tone here. For completed files
              the date already lives in the timeline below, so we don't repeat it. */}
          {!completed && <span className="cdp-status" style={{ color: st.color }}>{st.label}</span>}

          {/* Journey — Added (date on the system) → Exchanged → Completion */}
          <div className="cdp-journey">
            <JourneyNode label="Added" date={fmtTiny(f.instructedAtIso)} state="done" />
            <span className="cdp-jline cdp-jline--done" aria-hidden />
            <JourneyNode label="Exchanged" date={fmtTiny(f.exchangedAtIso)} state="done" />
            <span className={`cdp-jline${completed ? " cdp-jline--done" : " cdp-jline--todo"}`} aria-hidden />
            <JourneyNode label="Completion" date={fmtTiny(f.completionDateIso)} state={compState} />
          </div>

          {/* Stat cards */}
          <div className="cdp-grid">
            <div className="cdp-card">
              <span className="cdp-card-lab"><Timer size={13} weight="regular" /> Exchange to completion</span>
              <span className="cdp-card-val" style={{ color: completed ? "var(--agent-text-primary)" : st.color }}>
                {exToCompDisplay != null ? `${exToCompDisplay} days` : "—"}
              </span>
              <span className="cdp-card-sub">Target: 12-14 days</span>
            </div>
            <div className="cdp-card">
              <span className="cdp-card-lab"><Buildings size={13} weight="regular" /> Agents</span>
              <span className="cdp-card-val cdp-card-val--sm">{agents}</span>
            </div>
          </div>

          {/* Clients — a column, each with a colour-coded avatar */}
          <div className="cdp-people-card">
            <span className="cdp-card-lab"><UsersThree size={13} weight="regular" /> Clients</span>
            {f.purchasers.length > 0 ? (
              <div className="cdp-people">
                {f.purchasers.map((name, i) => (
                  <div key={i} className="cdp-person">
                    <ContactAvatar contact={{ name, roleType: "purchaser" }} size={28} />
                    <span className="cdp-person-name">{name}</span>
                  </div>
                ))}
              </div>
            ) : <span className="cdp-people-empty">Not recorded</span>}
          </div>

          {/* Solicitors — a column, each firm with a colour-coded avatar (tinted
              to the side it acts for: seller blue, buyer green) */}
          <div className="cdp-people-card">
            <span className="cdp-card-lab"><Scales size={13} weight="regular" /> Solicitors</span>
            {f.vendorSolicitorName || f.purchaserSolicitorName ? (
              <div className="cdp-people">
                <div className="cdp-person">
                  <ContactAvatar contact={{ name: f.vendorSolicitorName ?? "Not set", roleType: "solicitor" }} sideTint="vendor" size={28} />
                  <span className="cdp-person-txt"><span className="cdp-person-name">{f.vendorSolicitorName ?? "Not set"}</span><span className="cdp-person-role">Seller&rsquo;s solicitor</span></span>
                </div>
                <div className="cdp-person">
                  <ContactAvatar contact={{ name: f.purchaserSolicitorName ?? "Not set", roleType: "solicitor" }} sideTint="purchaser" size={28} />
                  <span className="cdp-person-txt"><span className="cdp-person-name">{f.purchaserSolicitorName ?? "Not set"}</span><span className="cdp-person-role">Buyer&rsquo;s solicitor</span></span>
                </div>
              </div>
            ) : <span className="cdp-people-empty" style={{ color: "var(--agent-warning)" }}>None on file</span>}
          </div>

          {/* Readiness pips */}
          {(() => {
            const completionMs = f.completionDateIso ? new Date(f.completionDateIso).setHours(0, 0, 0, 0) : null;
            const offerMs = f.mortgageOfferExpiryIso ? new Date(f.mortgageOfferExpiryIso).setHours(0, 0, 0, 0) : null;
            const offerValid = offerMs == null ? null : completionMs == null ? true : offerMs >= completionMs;
            const fundsOk = f.internal ? f.completionFundsSent === true || f.fundsInPlace === "yes" : null;
            const pips: { tone: "ok" | "bad"; label: string }[] = [];
            if (f.internal) pips.push(fundsOk ? { tone: "ok", label: "Funds confirmed" } : { tone: "bad", label: "Funds not confirmed" });
            if (offerValid !== null) pips.push(offerValid ? { tone: "ok", label: "Mortgage offer valid" } : { tone: "bad", label: "Offer expires before completion" });
            if ((f.chainSize ?? 1) > 1) pips.push({ tone: "ok", label: `Chain of ${f.chainSize}` });
            if (pips.length === 0) return null;
            return (
              <div className="cdp-pips">
                {pips.map((p, i) => (
                  <span key={i} className={`cdp-pip cdp-pip--${p.tone}`}>
                    <span className="cdp-pip-dot" />{p.label}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Next steps — display-only (an open dot, not a control) */}
          {!completed && (
            <div className="cdp-next">
              <span className="cdp-next-lab"><Flag size={13} weight="regular" /> Next step</span>
              <div className="cdp-next-row">
                <Circle size={16} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0, marginTop: 1 }} />
                <span className="cdp-next-txt">{nextStep(f)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="cdp-actions">
          {!completed && !completing && (
            <button type="button" className="cdp-primary" onClick={() => setCompleting(true)}>
              <CheckCircle size={17} weight="bold" /> Mark completed
            </button>
          )}
          {!completed && completing && (
            <div className="cdp-complete">
              <span className="cdp-complete-lab">Completed as of</span>
              <input type="date" value={completeDate} onChange={(e) => setCompleteDate(e.target.value)} className="cdp-complete-date" />
              <button type="button" className="cdp-primary cdp-primary--sm" disabled={!completeDate || saving} onClick={doComplete}>{saving ? "Completing…" : "Complete file"}</button>
              <button type="button" className="cdp-ghost" onClick={() => setCompleting(false)}>Cancel</button>
            </div>
          )}
          {!completing && (
            <div className="cdp-act-row">
              {!completed && <DateMenu txId={f.id} currentIso={f.completionDateIso} hasDate={!!f.completionDateIso} />}
              {!f.hideFeeEdit && (
                <Popover
                  preset="popover"
                  width={252}
                  placement="bottom-end"
                  trigger={<button type="button" className="comp-menu-trigger">{feeStr ? "Edit fee" : "+ Add fee"}</button>}
                >
                  {(close) => (
                    <AgentFeeInline
                      transactionId={f.id}
                      agentFeeAmount={f.agentFeeAmount}
                      agentFeePercent={f.agentFeePercent}
                      agentFeeIsVatInclusive={f.agentFeeIsVatInclusive}
                      purchasePrice={f.purchasePrice}
                      defaultEditing
                      onDone={() => { close(); router.refresh(); }}
                      label={f.internal ? "Agent fee" : "Your commission"}
                    />
                  )}
                </Popover>
              )}
              <span className="cdp-fee-glance">{feeStr ? `Fee ${feeStr}` : "No fee set"}</span>
              <Link href={withFrom(`${basePath}/${f.id}`, "/agent/completions")} className="cdp-open" onClick={onClose}>
                <ArrowSquareOut size={15} weight="bold" /> Open file
              </Link>
            </div>
          )}
        </div>
      </div>
      <style>{CDP_CSS}</style>
    </div>
  );

  return createPortal(panel, document.body);
}

const CDP_CSS = `
.cdp-root{ position:fixed; inset:0; z-index:70; pointer-events:none; }
.cdp-panel{ pointer-events:auto; position:fixed; top:76px; right:16px; bottom:16px;
  width:min(524px, calc(100vw - 32px)); display:flex; flex-direction:column; overflow:hidden;
  border-radius:22px; outline:none;
  border:1px solid rgba(255,255,255,0.5);
  background:rgba(255,255,255,0.86); -webkit-backdrop-filter:blur(34px) saturate(1.7); backdrop-filter:blur(34px) saturate(1.7);
  box-shadow:0 30px 80px rgba(24,30,54,0.26), 0 4px 14px rgba(24,30,54,0.12); }
.cdp-root[data-night] .cdp-panel{ border-color:rgba(255,255,255,0.08); background:rgba(20,27,42,0.9); box-shadow:0 30px 80px rgba(0,0,0,0.6); }
.cdp-in{ animation:cdpIn .34s cubic-bezier(.22,1,.36,1) both; }
.cdp-out{ animation:cdpOut .2s ease both; }
@keyframes cdpIn{ from{ opacity:0; transform:translateX(24px) } to{ opacity:1; transform:none } }
@keyframes cdpOut{ from{ opacity:1; transform:none } to{ opacity:0; transform:translateX(24px) } }
@media (prefers-reduced-motion:reduce){ .cdp-in,.cdp-out{ animation:none } }

.cdp-nav{ flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:12px 12px 6px; }
.cdp-nav-arrows{ display:inline-flex; gap:4px; }
.cdp-ic{ width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border:none; border-radius:9px;
  background:var(--agent-surface-nested, rgba(15,23,42,0.05)); color:var(--agent-text-secondary); cursor:pointer;
  transition:background .15s, color .15s; }
.cdp-ic:hover{ background:var(--agent-surface-overlay, rgba(15,23,42,0.09)); color:var(--agent-text-primary); }
.cdp-ic:disabled{ opacity:.38; cursor:default; }

.cdp-scroll{ flex:1; min-height:0; overflow-y:auto; padding:4px 20px 18px; display:flex; flex-direction:column; gap:15px; }
.cdp-photo{ width:100%; height:176px; border-radius:16px; object-fit:cover; display:block; flex-shrink:0; }

.cdp-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
.cdp-head-main{ min-width:0; }
.cdp-addr{ margin:0; font-size:21px; font-weight:700; letter-spacing:-0.02em; line-height:1.15; color:var(--agent-text-primary); }
.cdp-town{ margin:3px 0 0; font-size:13px; color:var(--agent-text-secondary); }
.cdp-price{ margin:2px 0 0; font-size:17px; font-weight:700; color:var(--agent-text-primary); white-space:nowrap; letter-spacing:-0.01em; }
.cdp-status{ font-size:12.5px; font-weight:700; margin-top:-6px; }

/* Journey */
.cdp-journey{ display:flex; align-items:flex-start; justify-content:space-between; padding:14px 2px 16px; border-bottom:0.5px solid var(--agent-border-subtle); }
.cdp-jnode{ display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; width:92px; text-align:center; }
.cdp-jdot{ display:inline-flex; }
.cdp-jdot--done{ color:var(--agent-success); }
.cdp-jdot--now{ color:var(--agent-danger); }
.cdp-jdot--todo{ color:var(--agent-text-muted); }
.cdp-jlabel{ font-size:10.5px; color:var(--agent-text-muted); font-weight:600; }
.cdp-jdate{ font-size:12.5px; font-weight:600; color:var(--agent-text-primary); }
.cdp-jline{ flex:1; height:2px; border-radius:2px; margin-top:9px; min-width:16px; }
.cdp-jline--done{ background:var(--agent-success); }
.cdp-jline--todo{ background:transparent; border-top:2px dashed var(--agent-border-strong, rgba(15,23,42,0.22)); height:0; }

/* Info grid */
.cdp-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.cdp-card{ display:flex; flex-direction:column; gap:3px; padding:12px 13px; border-radius:13px;
  background:var(--agent-surface-nested, rgba(15,23,42,0.035)); border:0.5px solid var(--agent-border-subtle); min-width:0; }
.cdp-card-lab{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:var(--agent-text-muted); }
.cdp-card-val{ font-size:18px; font-weight:700; color:var(--agent-text-primary); line-height:1.2; letter-spacing:-0.01em; font-variant-numeric:tabular-nums; }
.cdp-card-val--sm{ font-size:13px; font-weight:600; letter-spacing:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cdp-card-sub{ font-size:11px; color:var(--agent-text-muted); }

/* People lists (Clients / Solicitors) — a column of colour-coded avatars. */
.cdp-people-card{ display:flex; flex-direction:column; gap:10px; padding:12px 13px; border-radius:13px;
  background:var(--agent-surface-nested, rgba(15,23,42,0.035)); border:0.5px solid var(--agent-border-subtle); }
.cdp-people{ display:flex; flex-direction:column; gap:9px; }
.cdp-person{ display:flex; align-items:center; gap:10px; min-width:0; }
.cdp-person-txt{ display:flex; flex-direction:column; line-height:1.2; min-width:0; }
.cdp-person-name{ font-size:13.5px; font-weight:600; color:var(--agent-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cdp-person-role{ font-size:11px; color:var(--agent-text-muted); }
.cdp-people-empty{ font-size:13px; color:var(--agent-text-muted); }

/* Pips */
.cdp-pips{ display:flex; flex-wrap:wrap; gap:6px; }
.cdp-pip{ display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600; padding:4px 10px; border-radius:999px; }
.cdp-pip-dot{ width:6px; height:6px; border-radius:999px; flex-shrink:0; background:currentColor; }
.cdp-pip--ok{ background:var(--agent-success-bg, rgba(16,185,129,0.12)); color:var(--agent-success); }
.cdp-pip--bad{ background:rgba(var(--agent-danger-rgb,220,38,38),0.12); color:var(--agent-danger); }

/* Next step */
.cdp-next{ display:flex; flex-direction:column; gap:7px; }
.cdp-next-lab{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:var(--agent-text-muted); }
.cdp-next-row{ display:flex; align-items:flex-start; gap:9px; padding:11px 13px; border-radius:12px; background:var(--agent-surface-nested, rgba(15,23,42,0.035)); border:0.5px solid var(--agent-border-subtle); }
.cdp-next-txt{ font-size:13px; line-height:1.45; color:var(--agent-text-primary); }

/* Actions */
.cdp-actions{ flex-shrink:0; display:flex; flex-direction:column; gap:10px; padding:12px 16px 14px; border-top:0.5px solid var(--agent-border-subtle);
  background:var(--agent-surface-elevated, rgba(255,255,255,0.4)); }
.cdp-root[data-night] .cdp-actions{ background:rgba(20,27,42,0.5); }
.cdp-primary{ display:inline-flex; align-items:center; justify-content:center; gap:8px; height:44px; border-radius:12px; width:100%;
  text-decoration:none; font-size:14px; font-weight:700; color:#fff; cursor:pointer; border:none; font-family:inherit;
  background:linear-gradient(180deg, var(--agent-coral,#FF8A65), var(--agent-coral-deep,#FF6B4A)); box-shadow:0 2px 8px rgba(var(--agent-coral-rgb),0.3); }
.cdp-primary:hover{ filter:brightness(1.03); }
.cdp-primary:disabled{ opacity:.55; cursor:default; }
.cdp-primary--sm{ width:auto; height:36px; padding:0 14px; font-size:12.5px; border-radius:10px; flex-shrink:0; }
.cdp-complete{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.cdp-complete-lab{ font-size:12px; font-weight:600; color:var(--agent-text-secondary); }
.cdp-complete-date{ flex:1; min-width:120px; height:36px; border-radius:10px; padding:0 10px; font-family:inherit; font-size:13px;
  border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff); color:var(--agent-text-primary); }
.cdp-ghost{ border:none; background:none; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600; color:var(--agent-text-muted); }
.cdp-ghost:hover{ color:var(--agent-text-secondary); }
.cdp-act-row{ display:flex; align-items:center; gap:12px; }
.cdp-fee-glance{ flex:1; font-size:12px; font-weight:600; color:var(--agent-text-muted); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cdp-open{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:var(--agent-text-secondary); text-decoration:none; flex-shrink:0; }
.cdp-open:hover{ color:var(--agent-coral-deep); }

/* Tablet / mobile: full-width sheet, then bottom sheet. */
@media (max-width:1023px){ .cdp-panel{ top:12px; right:12px; bottom:12px; left:12px; width:auto; } }
@media (max-width:560px){
  .cdp-panel{ top:auto; bottom:0; left:0; right:0; border-radius:20px 20px 0 0; max-height:92vh; }
  .cdp-in{ animation:cdpUp .34s cubic-bezier(.22,1,.36,1) both; }
  @keyframes cdpUp{ from{ opacity:0; transform:translateY(40px) } to{ opacity:1; transform:none } }
  .cdp-out{ animation:cdpDown .24s ease both; }
  @keyframes cdpDown{ from{ opacity:1; transform:none } to{ opacity:0; transform:translateY(40px) } }
}
`;

export default CompletionDetailPanel;
