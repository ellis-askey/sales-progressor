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
  CaretLeft, CaretRight, X, CheckCircle, Circle, Check, UsersThree,
  Headset, ArrowSquareOut, Flag, Scales, Phone, EnvelopeSimple, NotePencil,
} from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { withFrom } from "@/lib/agent/back-nav";
import { DateMenu } from "@/components/completions/CompletionCardMenus";
import { completeFileAction } from "@/app/actions/completions";
import { ContactAvatar, UserAvatar } from "@/components/ui/Avatar";
import { AgentFeeInline } from "@/components/transaction/AgentFeeInline";
import { Popover } from "@/components/ui/Popover";
import { getFilePreviewExtras, type FilePreviewExtras } from "@/app/actions/file-preview";
import { ComposeEmailModal, type ComposePrefill } from "@/components/compose/ComposeEmailModal";
import { AddNoteModal } from "@/components/activity/AddNoteModal";
import { extractFirstName } from "@/lib/contacts/displayName";
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
// A duration in days, shown as "N days" under a week, else "N week(s) N day(s)".
function fmtDuration(days: number | null): string {
  if (days == null) return "—";
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"}`;
  const w = Math.floor(days / 7), d = days % 7;
  const wk = `${w} ${w === 1 ? "week" : "weeks"}`;
  return d === 0 ? wk : `${wk} ${d} ${d === 1 ? "day" : "days"}`;
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

  // Lazy contact details (phone + email for clients, solicitors and staff) — the
  // SAME access-scoped action the All-Files drawer uses, so the call/email logic
  // matches. Names/avatars render immediately from the row; buttons appear once
  // this resolves.
  const [extras, setExtras] = useState<FilePreviewExtras | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailPrefill, setEmailPrefill] = useState<ComposePrefill | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  useEffect(() => {
    if (!open || !id) return;
    let live = true;
    setExtras(null);
    getFilePreviewExtras(id, { contactsOnly: true }).then((res) => { if (live && res.ok) setExtras(res); }).catch(() => {});
    return () => { live = false; };
  }, [id, open]);

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
  const fileId = f.id;
  function openEmail(toEmail: string, toName: string) {
    setEmailPrefill({ transactionId: fileId, to: [{ email: toEmail, name: toName }], subject: addr.line, bodyHtml: `<p>Hi ${extractFirstName(toName)},</p><p><br></p>` });
    setEmailOpen(true);
  }
  // Call/email buttons for a person — guard each (contacts have nullable email/
  // phone, unlike staff whose email is guaranteed). Matches the All-Files drawer.
  const actions = (name: string, email: string | null | undefined, phone: string | null | undefined) => (
    email || phone ? (
      <span className="cdp-person-actions">
        {phone && <a className="cdp-ic-sm" href={`tel:${phone}`} aria-label={`Call ${name}`} onClick={(e) => e.stopPropagation()}><Phone size={14} weight="regular" /></a>}
        {email && <button type="button" className="cdp-ic-sm" aria-label={`Email ${name}`} onClick={(e) => { e.stopPropagation(); openEmail(email, name); }}><EnvelopeSimple size={14} weight="regular" /></button>}
      </span>
    ) : null
  );
  const st = completionStatus(f.completionDateIso);
  const exToComp = daysBetween(f.exchangedAtIso, f.completionDateIso);
  // When overdue, the "real" elapsed exchange→today is the honest figure.
  const elapsed = f.exchangedAtIso ? daysBetween(f.exchangedAtIso, new Date().toISOString()) : null;
  const exToCompDisplay = completed ? exToComp : (st.rel != null && st.rel < 0 ? elapsed : exToComp);
  const addedToExchange = daysBetween(f.instructedAtIso, f.exchangedAtIso);

  // The people on the file: who added it (agent / client manager) + the progressor
  // looking after it. Deduped when they are the same person.
  const people: { name: string; image: string | null; role: string }[] = [];
  if (f.agentUserName) people.push({ name: f.agentUserName, image: f.agentUserImage ?? null, role: "Agent" });
  if (f.assignedUserName && f.assignedUserName !== f.agentUserName) people.push({ name: f.assignedUserName, image: f.assignedUserImage ?? null, role: "Progressor" });
  const feeStr = fmtMoney(f.agentFeeAmount);
  const priceStr = f.purchasePrice != null ? "£" + Math.round(f.purchasePrice / 100).toLocaleString("en-GB") : null;

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

          {/* Journey — a gradient ribbon (green → coral). Each milestone's date
              sits above its node; each leg's elapsed time sits centred below.
              Added → Exchanged → Completion. */}
          <div className="cdp-tl">
            <div className="cdp-tl-dates">
              <span className="cdp-tl-date cdp-tl-date--l"><span className="cdp-tl-lbl">Added</span><span className="cdp-tl-d">{fmtTiny(f.instructedAtIso)}</span></span>
              <span className="cdp-tl-date cdp-tl-date--c"><span className="cdp-tl-lbl">Exchanged</span><span className="cdp-tl-d">{fmtTiny(f.exchangedAtIso)}</span></span>
              <span className="cdp-tl-date cdp-tl-date--r"><span className="cdp-tl-lbl">Completion</span><span className="cdp-tl-d">{fmtTiny(f.completionDateIso)}</span></span>
            </div>
            <div className="cdp-tl-track">
              <span
                className="cdp-tl-fill"
                style={completed
                  ? { width: "100%", background: "linear-gradient(90deg, var(--agent-success), var(--agent-coral-deep))" }
                  : { width: "50%", background: "var(--agent-success)" }}
                aria-hidden
              />
              <span className="cdp-tl-node" style={{ left: "0%", transform: "translateY(-50%)" }}><Check size={12} weight="bold" style={{ color: "var(--agent-success)" }} /></span>
              <span className="cdp-tl-node" style={{ left: "50%", transform: "translate(-50%,-50%)" }}><Check size={12} weight="bold" style={{ color: "var(--agent-success)" }} /></span>
              <span className={`cdp-tl-node${completed ? "" : " cdp-tl-node--todo"}`} style={{ left: "100%", transform: "translate(-100%,-50%)" }}>{completed && <Check size={12} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />}</span>
            </div>
            <div className="cdp-tl-durs">
              <span className="cdp-tl-dur">{fmtDuration(addedToExchange)}</span>
              <span className="cdp-tl-dur" style={{ color: completed ? undefined : st.color }}>{fmtDuration(exToCompDisplay)}</span>
            </div>
          </div>

          {/* People / Clients / Solicitors — one group, no containers, separated
              by neat dividing lines. */}
          <div className="cdp-people-group">
          {/* People — who added it (agent / client manager) + the progressor.
              Call/email appear once the lazy contact details resolve. */}
          <div className="cdp-people-card">
            <span className="cdp-card-lab"><Headset size={13} weight="regular" /> People</span>
            {(extras?.people.length ?? people.length) > 0 ? (
              <div className="cdp-people">
                {extras?.people
                  ? extras.people.map((p) => (
                      <div key={p.id} className="cdp-person">
                        <UserAvatar user={{ name: p.name, image: p.image }} size={28} />
                        <span className="cdp-person-txt"><span className="cdp-person-name">{p.name}</span><span className="cdp-person-role">{p.jobTitle ?? (p.slot === "assigned" ? "Progressor" : "Agent")}</span></span>
                        {actions(p.name, p.email, p.phone)}
                      </div>
                    ))
                  : people.map((p, i) => (
                      <div key={i} className="cdp-person">
                        <UserAvatar user={{ name: p.name, image: p.image }} size={28} />
                        <span className="cdp-person-txt"><span className="cdp-person-name">{p.name}</span><span className="cdp-person-role">{p.role}</span></span>
                      </div>
                    ))}
              </div>
            ) : <span className="cdp-people-empty">Not recorded</span>}
          </div>

          {/* Clients — a column, each with a colour-coded avatar + call/email */}
          <div className="cdp-people-card">
            <span className="cdp-card-lab"><UsersThree size={13} weight="regular" /> Clients</span>
            {(extras?.clients.length ?? f.purchasers.length) > 0 ? (
              <div className="cdp-people">
                {extras?.clients
                  ? extras.clients.map((c) => (
                      <div key={c.id} className="cdp-person">
                        <ContactAvatar contact={{ name: c.name, roleType: c.role }} size={28} />
                        <span className="cdp-person-txt"><span className="cdp-person-name">{c.name}</span><span className="cdp-person-role">{c.role === "vendor" ? "Seller" : "Buyer"}</span></span>
                        {actions(c.name, c.email, c.phone)}
                      </div>
                    ))
                  : f.purchasers.map((name, i) => (
                      <div key={i} className="cdp-person">
                        <ContactAvatar contact={{ name, roleType: "purchaser" }} size={28} />
                        <span className="cdp-person-txt"><span className="cdp-person-name">{name}</span><span className="cdp-person-role">Buyer</span></span>
                      </div>
                    ))}
              </div>
            ) : <span className="cdp-people-empty">Not recorded</span>}
          </div>

          {/* Solicitors — each firm with a side-tinted avatar + call/email on the
              handler (seller blue, buyer green) */}
          <div className="cdp-people-card">
            <span className="cdp-card-lab"><Scales size={13} weight="regular" /> Solicitors</span>
            {(extras?.solicitors.length ?? (f.vendorSolicitorName || f.purchaserSolicitorName ? 1 : 0)) > 0 ? (
              <div className="cdp-people">
                {extras?.solicitors
                  ? extras.solicitors.map((s) => {
                      const label = s.firmName ?? s.name ?? "Not set";
                      return (
                        <div key={s.side} className="cdp-person">
                          <ContactAvatar contact={{ name: label, roleType: "solicitor" }} sideTint={s.side} size={28} />
                          <span className="cdp-person-txt"><span className="cdp-person-name">{label}</span><span className="cdp-person-role">{s.side === "vendor" ? "Seller’s solicitor" : "Buyer’s solicitor"}{s.name && s.firmName ? ` · ${s.name}` : ""}</span></span>
                          {actions(s.name ?? label, s.email, s.phone)}
                        </div>
                      );
                    })
                  : (
                    <>
                      {f.vendorSolicitorName && (
                        <div className="cdp-person">
                          <ContactAvatar contact={{ name: f.vendorSolicitorName, roleType: "solicitor" }} sideTint="vendor" size={28} />
                          <span className="cdp-person-txt"><span className="cdp-person-name">{f.vendorSolicitorName}</span><span className="cdp-person-role">Seller&rsquo;s solicitor</span></span>
                        </div>
                      )}
                      {f.purchaserSolicitorName && (
                        <div className="cdp-person">
                          <ContactAvatar contact={{ name: f.purchaserSolicitorName, roleType: "solicitor" }} sideTint="purchaser" size={28} />
                          <span className="cdp-person-txt"><span className="cdp-person-name">{f.purchaserSolicitorName}</span><span className="cdp-person-role">Buyer&rsquo;s solicitor</span></span>
                        </div>
                      )}
                    </>
                  )}
              </div>
            ) : <span className="cdp-people-empty" style={{ color: "var(--agent-warning)" }}>None on file</span>}
          </div>
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
          {/* Completed files: Open file is the primary; the right slot is the
              Set fee button (+ "No fee set" subtext) until a fee is set, then it
              swaps to the email/note actions — same footprint, so the swap is
              seamless. */}
          {!completing && completed && (
            <div className="cdp-act-row cdp-act-footer">
              <Link href={withFrom(`${basePath}/${f.id}`, "/agent/completions")} className="cdp-primary cdp-primary--flex" onClick={onClose}>
                <ArrowSquareOut size={16} weight="bold" /> Open file
              </Link>
              {!f.hideFeeEdit && (
                feeStr ? (
                  <div className="cdp-act-icons">
                    <button type="button" className="cdp-iconbtn" aria-label="New email" onClick={() => { setEmailPrefill(null); setEmailOpen(true); }}><EnvelopeSimple size={17} weight="regular" /></button>
                    <button type="button" className="cdp-iconbtn" aria-label="Add note" onClick={() => setNoteOpen(true)}><NotePencil size={17} weight="regular" /></button>
                  </div>
                ) : (
                  <div className="cdp-fee-slot">
                    <Popover
                      preset="popover"
                      width={252}
                      placement="top-end"
                      trigger={<button type="button" className="cdp-setfee">Set fee</button>}
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
                    <span className="cdp-setfee-sub">No fee set</span>
                  </div>
                )
              )}
            </div>
          )}
          {!completing && !completed && (
            <div className="cdp-act-row">
              <DateMenu txId={f.id} currentIso={f.completionDateIso} hasDate={!!f.completionDateIso} />
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

  return (
    <>
      {createPortal(panel, document.body)}
      <ComposeEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} initialTransactionId={fileId} prefill={emailPrefill} elevated />
      <AddNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} initialTransactionId={fileId} />
    </>
  );
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

/* Journey — gradient ribbon. Dates above each node, elapsed time per leg below. */
.cdp-tl{ padding:4px 8px 2px; }
.cdp-tl-dates{ display:flex; margin-bottom:9px; }
.cdp-tl-date{ flex:1; display:flex; flex-direction:column; gap:1px; min-width:0; }
.cdp-tl-date--l{ align-items:flex-start; text-align:left; }
.cdp-tl-date--c{ align-items:center; text-align:center; }
.cdp-tl-date--r{ align-items:flex-end; text-align:right; }
.cdp-tl-lbl{ font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--agent-text-muted); }
.cdp-tl-d{ font-size:13.5px; font-weight:650; color:var(--agent-text-primary); font-variant-numeric:tabular-nums; }
.cdp-tl-track{ position:relative; height:12px; border-radius:99px;
  background:var(--agent-surface-nested, rgba(15,23,42,0.06)); box-shadow:inset 0 0 0 0.5px var(--agent-border-subtle); }
.cdp-tl-fill{ position:absolute; left:0; top:0; height:100%; border-radius:99px; }
.cdp-tl-node{ position:absolute; top:50%; display:flex; align-items:center; justify-content:center;
  width:20px; height:20px; border-radius:99px; background:#fff; box-shadow:0 1px 4px rgba(15,23,42,0.22); z-index:1; }
.cdp-tl-node--todo{ background:var(--agent-surface-elevated, #fff); box-shadow:none;
  border:2px solid var(--agent-border-strong, rgba(15,23,42,0.22)); }
.cdp-tl-durs{ display:flex; margin-top:9px; }
.cdp-tl-dur{ flex:1; text-align:center; font-size:11.5px; font-weight:600; color:var(--agent-text-muted); font-variant-numeric:tabular-nums; }

/* Info grid */
.cdp-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.cdp-card{ display:flex; flex-direction:column; gap:3px; padding:12px 13px; border-radius:13px;
  background:var(--agent-surface-nested, rgba(15,23,42,0.035)); border:0.5px solid var(--agent-border-subtle); min-width:0; }
.cdp-card-lab{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:var(--agent-text-muted); }
.cdp-card-val{ font-size:18px; font-weight:700; color:var(--agent-text-primary); line-height:1.2; letter-spacing:-0.01em; font-variant-numeric:tabular-nums; }
.cdp-card-val--sm{ font-size:13px; font-weight:600; letter-spacing:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cdp-card-sub{ font-size:11px; color:var(--agent-text-muted); }

/* People / Clients / Solicitors — no containers, just neat dividing lines. */
.cdp-people-group{ display:flex; flex-direction:column; }
.cdp-people-card{ display:flex; flex-direction:column; gap:10px; padding:14px 0; }
.cdp-people-group .cdp-people-card:first-child{ padding-top:0; }
.cdp-people-group .cdp-people-card:last-child{ padding-bottom:0; }
.cdp-people-group .cdp-people-card + .cdp-people-card{ border-top:0.5px solid var(--agent-border-subtle); }
.cdp-people{ display:flex; flex-direction:column; gap:9px; }
.cdp-person{ display:flex; align-items:center; gap:10px; min-width:0; }
.cdp-person-txt{ flex:1 1 auto; display:flex; flex-direction:column; line-height:1.2; min-width:0; }
.cdp-person-name{ font-size:13.5px; font-weight:600; color:var(--agent-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cdp-person-role{ font-size:11px; color:var(--agent-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cdp-person-actions{ display:inline-flex; gap:5px; flex-shrink:0; }
.cdp-ic-sm{ width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; cursor:pointer; text-decoration:none;
  border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff); color:var(--agent-text-secondary); transition:border-color .15s, color .15s; }
.cdp-ic-sm:hover{ border-color:var(--agent-coral); color:var(--agent-coral-deep); }
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
/* Completed footer: Open file primary (left) + a fee slot / email+note on the
   right. Both right-side states are the SAME 96px width so the swap is seamless. */
/* The completed footer aligns to the top so the Set fee button lines up with
   the top of the primary; its subtext hangs below. */
.cdp-act-footer{ align-items:flex-start; }
.cdp-primary--flex{ width:auto; flex:1; }
.cdp-act-icons{ display:flex; gap:8px; flex-shrink:0; animation:cdpFade .25s ease; }
.cdp-iconbtn{ width:44px; height:44px; display:inline-flex; align-items:center; justify-content:center; border-radius:12px; cursor:pointer;
  border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff); color:var(--agent-text-secondary);
  transition:border-color .15s, color .15s; }
.cdp-iconbtn:hover{ border-color:var(--agent-coral); color:var(--agent-coral-deep); }
.cdp-fee-slot{ display:flex; flex-direction:column; gap:4px; width:96px; flex-shrink:0; animation:cdpFade .25s ease; }
/* Popover wraps the trigger in an inline-flex anchor; make it fill the slot so
   the button isn't content-width. */
.cdp-fee-slot > .ui-pop-anchor{ display:block; width:100%; }
.cdp-setfee{ width:100%; height:40px; display:inline-flex; align-items:center; justify-content:center; padding:0 12px;
  border-radius:11px; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:700;
  border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff); color:var(--agent-text-secondary);
  transition:border-color .15s, color .15s; }
.cdp-setfee:hover{ border-color:var(--agent-coral); color:var(--agent-coral-deep); }
.cdp-setfee-sub{ font-size:10.5px; color:var(--agent-text-muted); text-align:center; line-height:1.1; }
@keyframes cdpFade{ from{ opacity:0 } to{ opacity:1 } }
@media (prefers-reduced-motion:reduce){ .cdp-act-icons,.cdp-fee-slot{ animation:none } }

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
