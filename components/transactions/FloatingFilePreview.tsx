"use client";

// All Files → floating property preview. Opens from the right when a file row is
// clicked; a floating, inset, rounded glass panel (NOT a full-height edge drawer,
// and NO dark backdrop — the list stays live behind it). Reuses the Drawer's
// proven patterns (portal + portal-theming + keep-mounted exit animation + Escape
// + focus restore) without touching the Drawer primitive, plus the shared glass
// material + tokens. Most content is fed straight from the already-loaded list
// row; the latest note, next reminder and the handling team's contact details
// come from one read-only, access-scoped action (getFilePreviewExtras).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CaretLeft, CaretRight, X, House, NotePencil, CalendarBlank, Target, ListChecks, Flag,
  Phone, EnvelopeSimple, ArrowSquareOut, TrendUp, TrendDown, Minus, PauseCircle,
  CheckCircle, Prohibit,
} from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { withFrom } from "@/lib/agent/back-nav";
import { formatDate } from "@/lib/utils";
import { formatTimeToExchange } from "@/lib/utils/format-time-to-exchange";
import { UserAvatar } from "@/components/ui/Avatar";
import { JourneyBar } from "./JourneyBar";
import { ComposeEmailModal } from "@/components/compose/ComposeEmailModal";
import { AddNoteModal } from "@/components/activity/AddNoteModal";
import { DISPLAY_STAGES } from "@/lib/milestones/display-stages";
import { getFilePreviewExtras, type FilePreviewExtras } from "@/app/actions/file-preview";
import type { TransactionRow } from "./TransactionRowView";

// ── small helpers ──
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { line: address, location: "" };
  return { line: parts.slice(0, -2).join(", ") || parts[0], location: parts.slice(-2).join(", ") };
}
function roleLabel(jobTitle: string | null, slot: "agent" | "assigned"): string | null {
  const t = jobTitle?.trim();
  if (t && !/^(director|negotiator)$/i.test(t)) return t;
  return slot === "assigned" ? "Progressor" : null;
}
function dateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, "").toLowerCase();
  return `${date} · ${time}`;
}

const ON_TRACK: Record<string, { label: string; color: string; Icon: typeof TrendUp }> = {
  on_track: { label: "On track", color: "var(--agent-success)", Icon: TrendUp },
  at_risk: { label: "At risk", color: "var(--agent-warning)", Icon: Minus },
  off_track: { label: "Off track", color: "var(--agent-danger)", Icon: TrendDown },
  on_hold: { label: "On hold", color: "var(--agent-text-muted)", Icon: PauseCircle },
};
const STATUS_MARK: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
  completed: { label: "Completed", color: "#2563a8", Icon: CheckCircle },
  withdrawn: { label: "Withdrawn", color: "#64748b", Icon: Prohibit },
  on_hold: { label: "On hold", color: "var(--agent-warning)", Icon: PauseCircle },
};
const REMINDER_TONE: Record<string, string> = {
  overdue: "var(--agent-danger)", escalated: "var(--agent-danger)",
  due_today: "var(--agent-warning)", upcoming: "var(--agent-text-primary)",
  snoozed: "var(--agent-text-muted)", inactive: "var(--agent-text-muted)",
};

export function FloatingFilePreview({
  row, open, basePath, onClose, onPrev, onNext, hasPrev, hasNext,
}: {
  row: TransactionRow | null;
  open: boolean;
  basePath: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const { theme, isNight } = usePortalTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // Keep-mounted exit animation (mirrors Drawer): render through the close.
  const [rendered, setRendered] = useState(open);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (open) { setRendered(true); setExiting(false); return; }
    if (!rendered) return;
    setExiting(true);
    const t = setTimeout(() => { setRendered(false); setExiting(false); }, 220);
    return () => clearTimeout(t);
  }, [open, rendered]);

  // Lazy extras per file. Refetch whenever the selected id changes.
  const [extras, setExtras] = useState<FilePreviewExtras | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteClamped, setNoteClamped] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const noteBodyRef = useRef<HTMLParagraphElement>(null);
  const id = row?.id ?? null;
  useEffect(() => {
    if (!open || !id) return;
    let live = true;
    setExtras(null); setFailed(false); setLoading(true);
    getFilePreviewExtras(id)
      .then((res) => { if (!live) return; if (res.ok) setExtras(res); else setFailed(true); })
      .catch(() => { if (live) setFailed(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, open]);

  // Reset per-file UI (note expand, photo-failure) when the file changes.
  useEffect(() => { setNoteExpanded(false); setPhotoFailed(false); }, [id]);
  // Measure whether the collapsed note overflows, to decide Show more / less.
  useEffect(() => {
    const el = noteBodyRef.current;
    if (!noteExpanded && el) setNoteClamped(el.scrollHeight > el.clientHeight + 2);
  }, [extras, noteExpanded]);

  // Escape closes; focus is restored on close. (Prev/next are the on-screen
  // arrow buttons — not bound to the keyboard, so ↑/↓ keep scrolling the panel.)
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prevFocus.current?.focus?.(); };
  }, [open, onClose]);

  // Move initial focus into the panel when it opens.
  useEffect(() => {
    if (open && panelRef.current) panelRef.current.focus();
  }, [open]);

  const [emailOpen, setEmailOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // Retain the last row through the close animation — `row` clears the instant
  // the selection does, but the panel still needs it to slide OUT.
  const lastRow = useRef<TransactionRow | null>(null);
  if (row) lastRow.current = row;
  const r = row ?? lastRow.current;

  if (!rendered || typeof window === "undefined" || !r) return null;

  const addr = splitAddress(r.propertyAddress);
  const stageIdx = r.boardStage ? DISPLAY_STAGES.findIndex((s) => s.key === r.boardStage) : -1;
  const total = DISPLAY_STAGES.length;
  const terminal = r.status === "completed" || r.status === "withdrawn";
  const statusMark = STATUS_MARK[r.status];
  const track = !terminal && r.health?.onTrack ? ON_TRACK[r.health.onTrack] : null;

  // Exchange card content, status-aware (no active forecast on a terminal file).
  const effExchange = r.overridePredictedDate ?? r.expectedExchangeDate ?? null;
  let exchangeValue: string;
  let exchangeSub: string | null = null;
  if (r.exchangedAt && r.completionDate) { exchangeValue = formatDate(new Date(r.completionDate)); exchangeSub = "Completion"; }
  else if (r.status === "completed") { exchangeValue = r.completionDate ? formatDate(new Date(r.completionDate)) : "Completed"; exchangeSub = "Completed"; }
  else if (r.status === "withdrawn") { exchangeValue = "Not proceeding"; }
  else if (effExchange) { exchangeValue = formatDate(new Date(effExchange)); exchangeSub = formatTimeToExchange(new Date(effExchange), 0).text; }
  else { exchangeValue = "Not set"; }

  const nextMilestone = r.health?.nextMilestoneLabel ?? (stageIdx >= 0 ? DISPLAY_STAGES[stageIdx]?.name ?? null : null);

  const panel = (
    <div
      className={`ffp-root${exiting ? " ffp-exiting" : ""}`}
      data-theme={theme}
      data-night={isNight ? "" : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Preview: ${addr.line}`}
        className={`ffp-panel${exiting ? " ffp-out" : " ffp-in"}`}
      >
        {/* Nav bar */}
        <div className="ffp-nav">
          <div className="ffp-nav-arrows">
            <button type="button" className="ffp-ic" aria-label="Previous file" disabled={!hasPrev} onClick={onPrev}><CaretLeft size={16} weight="bold" /></button>
            <button type="button" className="ffp-ic" aria-label="Next file" disabled={!hasNext} onClick={onNext}><CaretRight size={16} weight="bold" /></button>
          </div>
          <button type="button" className="ffp-ic" aria-label="Close preview" onClick={onClose}><X size={16} weight="bold" /></button>
        </div>

        <div className="ffp-scroll">
          {/* Hero photo — reuse the shared .property-photo-fallback art on a
              missing OR a failed load, so it never shows a broken image. */}
          {r.photoUrl && !photoFailed
            ? <img className="ffp-photo" src={r.photoUrl} alt="" onError={() => setPhotoFailed(true)} />
            : <span className="ffp-photo property-photo-fallback" aria-hidden />}

          {/* Address */}
          <div className="ffp-head">
            <h2 className="ffp-addr">{addr.line}</h2>
            {addr.location && <p className="ffp-town">{addr.location}</p>}
          </div>

          {/* Stage + progress + on-track. boardStage is only resolved for active
              + withdrawn files, so on-hold / completed fall back to their status
              rather than a misleading "Not started". */}
          <div className="ffp-stage">
            <span className="ffp-stage-ic"><House size={16} weight="regular" /></span>
            <div className="ffp-stage-bar">
              {r.boardStage
                ? <JourneyBar stage={r.boardStage} />
                : statusMark
                  ? <span className="ffp-stage-status" style={{ color: statusMark.color }}><statusMark.Icon size={15} weight="fill" /> {statusMark.label}</span>
                  : <span className="ffp-muted">Not started</span>}
            </div>
            {r.boardStage && track && <span className="ffp-track" style={{ color: track.color }}><track.Icon size={14} weight="bold" />{track.label}</span>}
            {r.boardStage && terminal && statusMark && <span className="ffp-track" style={{ color: statusMark.color }}><statusMark.Icon size={14} weight="fill" />{statusMark.label}</span>}
          </div>

          {/* Latest note */}
          <section className="ffp-note">
            <div className="ffp-note-head">
              <span className="ffp-note-lab"><NotePencil size={15} weight="regular" /> Latest note</span>
              {extras?.note && <span className="ffp-note-when">{dateTime(extras.note.at)}</span>}
            </div>
            {loading && !extras
              ? <div className="ffp-skel ffp-skel-lines" />
              : extras?.note
                ? <>
                    <p ref={noteBodyRef} className={`ffp-note-body${noteExpanded ? " expanded" : ""}`}>{extras.note.body}</p>
                    {(noteClamped || noteExpanded) && (
                      <button type="button" className="ffp-note-more" onClick={() => setNoteExpanded((v) => !v)}>
                        {noteExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                    {extras.note.author && <p className="ffp-note-auth">{extras.note.author}</p>}
                  </>
                : failed
                  ? <p className="ffp-empty">Couldn&rsquo;t load the latest note.</p>
                  : <p className="ffp-empty">No notes yet.</p>}
          </section>

          {/* Info grid */}
          <div className="ffp-grid">
            {r.status === "on_hold"
              ? <InfoCard Icon={PauseCircle} label="On hold"
                  value={r.health?.holdInfo?.review
                    ? `Review ${formatDate(new Date(r.health.holdInfo.review))}`
                    : (r.health?.holdInfo ? `Paused ${r.health.holdInfo.days} day${r.health.holdInfo.days === 1 ? "" : "s"}` : "Paused")}
                  valueColor={r.health?.holdInfo?.reviewOverdue ? "var(--agent-danger)" : undefined} />
              : <InfoCard Icon={CalendarBlank} label="Next reminder"
                  value={loading && !extras ? null : failed ? "—"
                    : extras?.reminder ? formatDate(new Date(extras.reminder.dueAt)) : (terminal ? "None" : "None scheduled")}
                  valueColor={extras?.reminder ? REMINDER_TONE[extras.reminder.state] : undefined} />}
            <InfoCard Icon={Target} label="Exchange forecast" value={exchangeValue} sub={exchangeSub} />
            <InfoCard Icon={Flag} label="Outstanding" value={nextMilestone ?? "Nothing outstanding"} />
            <InfoCard Icon={ListChecks} label="Progress"
              value={stageIdx >= 0 ? `${stageIdx + 1} of ${total} milestones`
                : r.status === "completed" ? "Sale complete"
                : r.status === "on_hold" ? "Paused"
                : "Not started"} />
          </div>

          {/* People */}
          <section className="ffp-people">
            <p className="ffp-sec-lab">People</p>
            {loading && !extras
              ? <div className="ffp-skel ffp-skel-person" />
              : failed
                ? <p className="ffp-empty">Couldn&rsquo;t load the team.</p>
                : extras && extras.people.length > 0
                ? extras.people.map((p) => {
                    const label = roleLabel(p.jobTitle, p.slot);
                    return (
                      <div key={p.id} className="ffp-person">
                        <UserAvatar user={{ name: p.name, image: p.image }} size={34} />
                        <span className="ffp-person-txt">
                          <span className="ffp-person-name">{p.name}</span>
                          {label && <span className="ffp-person-role">{label}</span>}
                        </span>
                        <span className="ffp-person-actions">
                          {p.phone && <a className="ffp-ic ffp-ic-sm" href={`tel:${p.phone}`} aria-label={`Call ${p.name}`}><Phone size={15} weight="regular" /></a>}
                          <a className="ffp-ic ffp-ic-sm" href={`mailto:${p.email}`} aria-label={`Email ${p.name}`}><EnvelopeSimple size={15} weight="regular" /></a>
                        </span>
                      </div>
                    );
                  })
                : <p className="ffp-empty">No one assigned yet.</p>}
          </section>
        </div>

        {/* Quick actions */}
        <div className="ffp-actions">
          <Link href={withFrom(`${basePath}/${r.id}`, basePath)} className="ffp-open" onClick={onClose}>
            <ArrowSquareOut size={16} weight="bold" /> Open property file
          </Link>
          <button type="button" className="ffp-act" aria-label="New email" onClick={() => setEmailOpen(true)}><EnvelopeSimple size={17} weight="regular" /></button>
          <button type="button" className="ffp-act" aria-label="Add note" onClick={() => setNoteOpen(true)}><NotePencil size={17} weight="regular" /></button>
        </div>
      </div>

      <style>{FFP_CSS}</style>
    </div>
  );

  return (
    <>
      {createPortal(panel, document.body)}
      <ComposeEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} initialTransactionId={r.id} />
      <AddNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} initialTransactionId={r.id} />
    </>
  );
}

function InfoCard({ Icon, label, value, sub, valueColor }: { Icon: typeof CalendarBlank; label: string; value: string | null; sub?: string | null; valueColor?: string }) {
  return (
    <div className="ffp-card">
      <span className="ffp-card-lab"><Icon size={14} weight="regular" /> {label}</span>
      {value === null
        ? <span className="ffp-skel ffp-skel-val" />
        : <span className="ffp-card-val" style={valueColor ? { color: valueColor } : undefined}>{value}</span>}
      {sub && <span className="ffp-card-sub">{sub}</span>}
    </div>
  );
}

const FFP_CSS = `
.ffp-root{ position:fixed; inset:0; z-index:70; pointer-events:none; }
.ffp-panel{ pointer-events:auto; position:fixed; top:76px; right:16px; bottom:16px;
  width:min(520px, calc(100vw - 32px)); display:flex; flex-direction:column; overflow:hidden;
  border-radius:22px; outline:none;
  border:1px solid rgba(255,255,255,0.5); border-top:2px solid var(--agent-coral-deep,#FF6B4A);
  background:rgba(255,255,255,0.86); -webkit-backdrop-filter:blur(34px) saturate(1.7); backdrop-filter:blur(34px) saturate(1.7);
  box-shadow:0 30px 80px rgba(24,30,54,0.26), 0 4px 14px rgba(24,30,54,0.12); }
.ffp-root[data-night] .ffp-panel{ border-color:rgba(255,255,255,0.08); background:rgba(20,27,42,0.9); box-shadow:0 30px 80px rgba(0,0,0,0.6); }
.ffp-in{ animation:ffpIn .34s cubic-bezier(.22,1,.36,1) both; }
.ffp-out{ animation:ffpOut .2s ease both; }
@keyframes ffpIn{ from{ opacity:0; transform:translateX(24px) } to{ opacity:1; transform:none } }
@keyframes ffpOut{ from{ opacity:1; transform:none } to{ opacity:0; transform:translateX(24px) } }
@media (prefers-reduced-motion:reduce){ .ffp-in,.ffp-out{ animation:none } }

.ffp-nav{ flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:12px 12px 6px; }
.ffp-nav-arrows{ display:inline-flex; gap:4px; }
.ffp-ic{ width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border:none; border-radius:9px;
  background:var(--agent-surface-nested, rgba(15,23,42,0.05)); color:var(--agent-text-secondary); cursor:pointer; text-decoration:none;
  transition:background .15s, color .15s; }
.ffp-ic:hover{ background:var(--agent-surface-overlay, rgba(15,23,42,0.09)); color:var(--agent-text-primary); }
.ffp-ic:disabled{ opacity:.38; cursor:default; }
.ffp-ic-sm{ width:30px; height:30px; }

.ffp-scroll{ flex:1; min-height:0; overflow-y:auto; padding:4px 20px 16px; display:flex; flex-direction:column; gap:16px; }
.ffp-photo{ width:100%; height:188px; border-radius:16px; object-fit:cover; display:block; flex-shrink:0; }
.ffp-head{ }
.ffp-addr{ margin:0; font-size:22px; font-weight:750; letter-spacing:-0.02em; line-height:1.15; color:var(--agent-text-primary); }
.ffp-town{ margin:3px 0 0; font-size:14px; color:var(--agent-text-secondary); }

.ffp-stage{ display:flex; align-items:center; gap:11px; padding-bottom:16px; border-bottom:0.5px solid var(--agent-border-subtle); }
.ffp-stage-ic{ color:var(--agent-text-muted); flex-shrink:0; }
.ffp-stage-bar{ flex:1; min-width:0; }
.ffp-track{ display:inline-flex; align-items:center; gap:4px; font-size:12.5px; font-weight:650; flex-shrink:0; }
.ffp-muted{ font-size:12.5px; color:var(--agent-text-muted); }
.ffp-stage-status{ display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:650; }

.ffp-note-head{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:7px; }
.ffp-note-lab{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:var(--agent-text-secondary); }
.ffp-note-when{ font-size:11.5px; color:var(--agent-text-muted); white-space:nowrap; flex-shrink:0; }
.ffp-note-body{ margin:0; font-size:13.5px; line-height:1.55; color:var(--agent-text-primary); white-space:pre-wrap;
  display:-webkit-box; -webkit-line-clamp:5; -webkit-box-orient:vertical; overflow:hidden; }
.ffp-note-body.expanded{ -webkit-line-clamp:unset; display:block; overflow:visible; }
.ffp-note-more{ margin:6px 0 0; padding:0; border:none; background:none; cursor:pointer; font-family:inherit;
  font-size:12px; font-weight:650; color:var(--agent-coral-deep); }
.ffp-note-more:hover{ text-decoration:underline; }
.ffp-note-auth{ margin:6px 0 0; font-size:11.5px; font-weight:600; color:var(--agent-text-muted); }
.ffp-empty{ margin:0; font-size:12.5px; color:var(--agent-text-muted); }

.ffp-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.ffp-card{ display:flex; flex-direction:column; gap:3px; padding:12px 13px; border-radius:13px;
  background:var(--agent-surface-nested, rgba(15,23,42,0.035)); border:0.5px solid var(--agent-border-subtle); }
.ffp-card-lab{ display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:var(--agent-text-muted); }
.ffp-card-val{ font-size:14px; font-weight:700; color:var(--agent-text-primary); line-height:1.25; }
.ffp-card-sub{ font-size:11.5px; color:var(--agent-text-muted); }

.ffp-sec-lab{ margin:0 0 8px; font-size:12.5px; font-weight:700; color:var(--agent-text-secondary); }
.ffp-person{ display:flex; align-items:center; gap:11px; padding:7px 0; }
.ffp-person-txt{ flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.2; }
.ffp-person-name{ font-size:13.5px; font-weight:650; color:var(--agent-text-primary); }
.ffp-person-role{ font-size:11.5px; color:var(--agent-text-muted); }
.ffp-person-actions{ display:inline-flex; gap:5px; }

.ffp-actions{ flex-shrink:0; display:flex; align-items:center; gap:8px; padding:12px 16px 14px; border-top:0.5px solid var(--agent-border-subtle);
  background:var(--agent-surface-elevated, rgba(255,255,255,0.4)); }
.ffp-root[data-night] .ffp-actions{ background:rgba(20,27,42,0.5); }
.ffp-open{ flex:1; display:inline-flex; align-items:center; justify-content:center; gap:8px; height:44px; border-radius:12px;
  text-decoration:none; font-size:14px; font-weight:650; color:#fff; cursor:pointer; border:none;
  background:linear-gradient(180deg, var(--agent-coral,#FF8A65), var(--agent-coral-deep,#FF6B4A)); box-shadow:0 2px 8px rgba(var(--agent-coral-rgb),0.3); }
.ffp-open:hover{ filter:brightness(1.03); }
.ffp-act{ width:44px; height:44px; display:inline-flex; align-items:center; justify-content:center; border-radius:12px; cursor:pointer;
  border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff); color:var(--agent-text-secondary);
  transition:border-color .15s, color .15s; }
.ffp-act:hover{ border-color:var(--agent-coral); color:var(--agent-coral-deep); }

.ffp-skel{ display:block; border-radius:7px; background:linear-gradient(90deg, rgba(15,23,42,0.06), rgba(15,23,42,0.11), rgba(15,23,42,0.06)); background-size:200% 100%; animation:ffpShimmer 1.3s linear infinite; }
.ffp-root[data-night] .ffp-skel{ background:linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1), rgba(255,255,255,0.05)); background-size:200% 100%; }
.ffp-skel-lines{ height:60px; }
.ffp-skel-person{ height:40px; }
.ffp-skel-val{ width:70%; height:15px; margin-top:2px; }
@keyframes ffpShimmer{ from{ background-position:200% 0 } to{ background-position:-200% 0 } }
@media (prefers-reduced-motion:reduce){ .ffp-skel{ animation:none } }

/* Tablet / mobile: full-width sheet from the right. */
@media (max-width:1023px){
  .ffp-panel{ top:12px; right:12px; bottom:12px; left:12px; width:auto; }
}
@media (max-width:560px){
  .ffp-panel{ top:auto; bottom:0; left:0; right:0; border-radius:20px 20px 0 0; max-height:92vh; }
  /* Bottom sheet: open slides UP, close slides back DOWN (reverse direction). */
  .ffp-in{ animation:ffpUp .34s cubic-bezier(.22,1,.36,1) both; }
  @keyframes ffpUp{ from{ opacity:0; transform:translateY(40px) } to{ opacity:1; transform:none } }
  .ffp-out{ animation:ffpDown .24s ease both; }
  @keyframes ffpDown{ from{ opacity:1; transform:none } to{ opacity:0; transform:translateY(40px) } }
}
`;

export default FloatingFilePreview;
