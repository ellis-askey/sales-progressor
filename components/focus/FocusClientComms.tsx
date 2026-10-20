"use client";

// Focus → left column: the merged "client communications" cockpit (founder only).
// Fuses the two old Focus widgets: the weekly "touch both sides of every file"
// quota (progress bar, Monday reset, "not required" parking) AND the per-side
// act-now actions (email / call / WhatsApp). On top it layers what the client has
// actually received: the last AUTOMATED email with its live delivery/open status
// (click to open the exact email we sent), and a bounce flag when a client is
// unreachable. Human touches still drive the quiet clock; automated sends are a
// quiet secondary signal and never reset it.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, EnvelopeSimple, WhatsappLogo, CaretDown, Check, Prohibit } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { ComposeEmailModal } from "@/components/compose/ComposeEmailModal";
import { SentEmailModal, type OpenEmail } from "@/components/transaction/SentEmailModal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { markSideNotRequiredThisWeek, logSideCall, logSideEmailed } from "@/app/actions/weekly-touch";
import type { FocusSide, FocusChannel, FocusChannelContact, FocusContactState } from "@/lib/services/focus";

export type FocusCommsFile = {
  transactionId: string;
  addressLine: string;
  townPostcode: string;
  photoUrl: string | null;
  sides: FocusSide[];
  anyQuiet: boolean;
};

// UK number → wa.me digits (leading 0 → 44). Mirrors FilesCockpit.toWaDigits.
function toWaDigits(phone: string): string {
  let d = phone.replace(/[\s\-().+]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  return d;
}

// Per-state label + tone. Tone drives both the state word's colour and the pip.
type Tone = "ok" | "neutral" | "warn" | "danger";
const CONTACT_STATE: Record<FocusContactState, { label: string; tone: Tone }> = {
  opened: { label: "Opened", tone: "ok" },
  delivered: { label: "Delivered", tone: "neutral" },
  sent: { label: "Sent", tone: "neutral" },
  logged: { label: "Logged", tone: "warn" },
  bounced: { label: "Bounced", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
  replied: { label: "Replied", tone: "ok" },
  messaged: { label: "Messaged", tone: "neutral" },
  called: { label: "Called", tone: "neutral" },
};

const EMPTY_LABEL: Record<FocusChannel, string> = {
  email: "No email on record",
  whatsapp: "No WhatsApp on record",
  call: "No call logged",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDateTime(d: Date): string {
  const x = new Date(d);
  const hh = String(x.getHours()).padStart(2, "0");
  const mm = String(x.getMinutes()).padStart(2, "0");
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}, ${hh}:${mm}`;
}

// Calendar-day relative time: "today", "yesterday", "N days ago", then weeks.
function relWhen(at: Date): string {
  const a = new Date(at); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 56) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const CHANNEL_NAME: Record<FocusChannel, string> = { email: "Email", whatsapp: "WhatsApp", call: "Call" };

function dirLabel(c: FocusChannelContact): string {
  if (c.direction === "in") return "They";
  return c.automated ? "Auto" : "You";
}

export function FocusClientComms({ files, totalSides, doneSides, showWhatsApp }: { files: FocusCommsFile[]; totalSides: number; doneSides: number; showWhatsApp: boolean }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [composeTx, setComposeTx] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState<string | null>(null);
  const [openEmail, setOpenEmail] = useState<OpenEmail | null>(null);

  // Bar fills left-to-right on first paint: start at 0, flip to the real
  // percentage on the next frame so the width transition animates in.
  const [barIn, setBarIn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setBarIn(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const key = (tx: string, side: string) => `${tx}:${side}`;
  const localDone = doneSides + resolved.size;
  const pct = totalSides ? Math.round((localDone / totalSides) * 100) : 100;
  const left = Math.max(0, totalSides - localDone);
  const today = Math.min(left, Math.ceil(totalSides / 5));

  function resolve(tx: string, side: string, msg: string, action: () => Promise<unknown>) {
    setResolved((p) => new Set([...p, key(tx, side)]));
    setCallOpen(null);
    toast.success(msg);
    startTransition(async () => { await action().catch(() => {}); router.refresh(); });
  }

  const visibleFiles = files
    .map((f) => ({ ...f, sides: f.sides.filter((s) => !resolved.has(key(f.transactionId, s.side))) }))
    .filter((f) => f.sides.length > 0);

  return (
    <>
      <style>{CSS}</style>
      <section className="fc">
        <header className="fc-hd">
          <h1 className="fc-h1">Keep every client in the loop</h1>
          <p className="fc-sub">Every active sale, both sides, checked each week. See what's been sent, what's been received and take action right here. Resets every Monday.</p>

          <div className="fc-bar"><i style={{ width: `${barIn ? pct : 0}%` }} /></div>
          <div className="fc-barlbl">
            <span><b>{localDone}</b> of {totalSides} sides progressed this week{today > 0 && left > 0 ? ` · ${today} more to aim for today` : ""}</span>
          </div>
        </header>

        {visibleFiles.length === 0 ? (
          <div className="fc-done">
            <div className="fc-done-h">Both sides of every file touched</div>
            <div className="fc-done-p">Nothing's gone quiet. It resets Monday.</div>
          </div>
        ) : (
          <div className="fc-list">
            {visibleFiles.map((f) => (
              <article className="fc-card" key={f.transactionId}>
                <button type="button" className="fc-ph" onClick={() => router.push(`/agent/transactions/${f.transactionId}`)}>
                  <PropertyThumb photoUrl={f.photoUrl} size={42} />
                  <span className="fc-addr-wrap">
                    <span className="fc-addr">{f.addressLine}</span>
                    <span className="fc-loc">{f.townPostcode.replace(/ · /g, ", ")}</span>
                  </span>
                </button>

                {f.sides.map((s) => (
                  <SideBlock
                    key={s.side}
                    file={f}
                    side={s}
                    showWhatsApp={showWhatsApp}
                    callOpen={callOpen === key(f.transactionId, s.side)}
                    onCall={() => setCallOpen(key(f.transactionId, s.side))}
                    onCallCancel={() => setCallOpen(null)}
                    onCallSave={(note) => resolve(f.transactionId, s.side, `${s.side === "vendor" ? "Seller" : "Buyer"} · call logged`, () => logSideCall(f.transactionId, s.side, s.contactIds, note))}
                    onCompose={() => setComposeTx(f.transactionId)}
                    onMarkEmailed={() => resolve(f.transactionId, s.side, `${s.side === "vendor" ? "Seller" : "Buyer"} · emailed`, () => logSideEmailed(f.transactionId, s.side, s.contactIds))}
                    onNotRequired={() => resolve(f.transactionId, s.side, `${s.side === "vendor" ? "Seller" : "Buyer"} · parked this week`, () => markSideNotRequiredThisWeek(f.transactionId, s.side))}
                    onOpenEmail={(id) => setOpenEmail({ id, label: f.addressLine })}
                  />
                ))}
              </article>
            ))}
          </div>
        )}
      </section>

      <ComposeEmailModal open={!!composeTx} initialTransactionId={composeTx} onClose={() => { setComposeTx(null); router.refresh(); }} />
      <SentEmailModal email={openEmail} onClose={() => setOpenEmail(null)} />
    </>
  );
}

function SideBlock({
  file, side, showWhatsApp, callOpen, onCall, onCallCancel, onCallSave, onCompose, onMarkEmailed, onNotRequired, onOpenEmail,
}: {
  file: FocusCommsFile;
  side: FocusSide;
  showWhatsApp: boolean;
  callOpen: boolean;
  onCall: () => void;
  onCallCancel: () => void;
  onCallSave: (note: string) => void;
  onCompose: () => void;
  onMarkEmailed: () => void;
  onNotRequired: () => void;
  onOpenEmail: (id: string) => void;
}) {
  const router = useRouter();
  const label = side.side === "vendor" ? "Seller" : "Buyer";
  const names = side.contacts.length ? side.contacts.map((c) => c.name).join(" & ") : side.name;
  const avatars = side.contacts.length ? side.contacts : [{ id: side.primaryContactId, name: side.name }];
  const lc = side.lastContact;

  return (
    <div className={`fc-side ${side.side}`}>
      <div className="fc-side-top">
        <span className="fc-avs">
          {avatars.map((c) => (
            <span className="fc-av" key={c.id}><ContactAvatar contact={{ name: c.name, roleType: side.side }} size={28} /></span>
          ))}
        </span>
        <span className="fc-who">
          <span className="fc-role">{label}</span>
          <span className="fc-names" title={names}>{names}</span>
        </span>

        {side.quiet ? (
          <Pill glass tone="warning" size="sm" style={{ flexShrink: 0 }}>
            {side.daysSince != null ? `Quiet ${side.daysSince}d` : "Never contacted"}
          </Pill>
        ) : null}

        <span className="fc-sp" />

        {callOpen ? (
          <CallForm onSave={onCallSave} onCancel={onCallCancel} />
        ) : (
          <ContactMenu
            side={side}
            onCompose={onCompose}
            onCall={onCall}
            onMarkEmailed={onMarkEmailed}
            onNotRequired={onNotRequired}
          />
        )}
      </div>

      {/* Last contact per channel — icon, a status pip, and the true time. The
          full record (direction, state, exact time, subject/snippet) is one hover
          away. WhatsApp is dropped entirely when it isn't a live channel here. */}
      <div className="fc-led">
        <ChannelUnit channel="email" c={lc.email} onOpen={(c) => onOpenEmail(c.messageId)} />
        {showWhatsApp ? (
          <ChannelUnit channel="whatsapp" c={lc.whatsapp} onOpen={() => router.push(`/agent/transactions/${file.transactionId}/whatsapp`)} />
        ) : null}
        <ChannelUnit channel="call" c={lc.call} onOpen={() => router.push(`/agent/transactions/${file.transactionId}`)} />
      </div>
    </div>
  );
}

const CHANNEL_ICON: Record<FocusChannel, typeof EnvelopeSimple> = {
  email: EnvelopeSimple,
  whatsapp: WhatsappLogo,
  call: Phone,
};

// A bare channel glyph (no backer tile), a status pip, and the relative time.
// Hovering reveals the full record in a small popover. Empty channels show a
// dimmed glyph and read "none" on hover — never implied contact.
function ChannelUnit({ channel, c, onOpen }: { channel: FocusChannel; c: FocusChannelContact | null; onOpen: (c: FocusChannelContact) => void }) {
  const Icon = CHANNEL_ICON[channel];
  if (!c) {
    return (
      <span className={`fc-u ${channel} ghost`}>
        <span className="fc-ic"><Icon size={16} /></span>
        <span className="fc-ut">—</span>
        <span className="fc-tip" role="tooltip">
          <span className="fc-tip-h"><Icon size={13} /><b>{CHANNEL_NAME[channel]}</b></span>
          <span className="fc-tip-empty">{EMPTY_LABEL[channel]}</span>
        </span>
      </span>
    );
  }
  const meta = CONTACT_STATE[c.state];
  const detail = c.channel === "email" ? c.subject : c.preview;
  return (
    <button type="button" className={`fc-u ${channel}`} onClick={() => onOpen(c)}>
      <span className="fc-ic">
        <Icon size={16} />
        <span className={`fc-pip ${meta.tone}`} aria-hidden />
      </span>
      <span className="fc-ut">{relWhen(c.at)}</span>
      <span className="fc-tip" role="tooltip">
        <span className="fc-tip-h"><Icon size={13} /><b>{CHANNEL_NAME[channel]}</b></span>
        <span className={`fc-tip-state ${meta.tone}`}>{dirLabel(c)} · {meta.label}</span>
        <span className="fc-tip-when">{fmtDateTime(c.at)}</span>
        {detail ? <span className="fc-tip-snip">{detail}</span> : null}
      </span>
    </button>
  );
}

// One labelled "Contact" trigger opens every action for a side — three ways to
// reach them (email / call / WhatsApp) and two ways to settle the week (already
// emailed / not required). Keeps the side-row to a single control. Closes on
// outside click, Escape, or any selection.
function ContactMenu({
  side, onCompose, onCall, onMarkEmailed, onNotRequired,
}: {
  side: FocusSide;
  onCompose: () => void;
  onCall: () => void;
  onMarkEmailed: () => void;
  onNotRequired: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (fn: () => void) => { setOpen(false); fn(); };
  const hasPhone = !!side.phone;

  return (
    <span className={`fc-menu${open ? " open" : ""}`} ref={ref}>
      <button
        type="button"
        className="fc-trig"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Contact
        <CaretDown size={12} weight="bold" className="fc-cv" />
      </button>

      <div className="fc-pop" role="menu">
        <div className="fc-mlabel">Reach out</div>
        <button type="button" className="fc-mi email" role="menuitem" onClick={() => pick(onCompose)}>
          <span className="fc-mic"><EnvelopeSimple size={16} /></span>
          <span className="fc-mtext"><span className="fc-ml">Email</span></span>
        </button>
        <button type="button" className="fc-mi call" role="menuitem" onClick={() => pick(onCall)}>
          <span className="fc-mic"><Phone size={16} /></span>
          <span className="fc-mtext"><span className="fc-ml">Log a call</span></span>
        </button>
        <button
          type="button"
          className="fc-mi wa"
          role="menuitem"
          disabled={!hasPhone}
          onClick={() => hasPhone && side.phone && pick(() => window.open(`https://wa.me/${toWaDigits(side.phone!)}`, "_blank", "noopener"))}
        >
          <span className="fc-mic"><WhatsappLogo size={16} /></span>
          <span className="fc-mtext">
            <span className="fc-ml">WhatsApp</span>
            {!hasPhone ? <span className="fc-ms">No number on file</span> : null}
          </span>
        </button>

        <div className="fc-mdiv" />

        <div className="fc-mlabel">This week</div>
        <button type="button" className="fc-mi done" role="menuitem" onClick={() => pick(onMarkEmailed)}>
          <span className="fc-mic"><Check size={15} weight="bold" /></span>
          <span className="fc-mtext">
            <span className="fc-ml">Already emailed</span>
            <span className="fc-ms">Log it, no composer</span>
          </span>
        </button>
        <button type="button" className="fc-mi" role="menuitem" onClick={() => pick(onNotRequired)}>
          <span className="fc-mic"><Prohibit size={15} /></span>
          <span className="fc-mtext">
            <span className="fc-ml">Not required</span>
            <span className="fc-ms">Parks till Monday</span>
          </span>
        </button>
      </div>
    </span>
  );
}

function CallForm({ onSave, onCancel }: { onSave: (note: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [v, setV] = useState("");
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <span className="fc-callform">
      <input ref={ref} value={v} placeholder="What happened on the call? Internal only." onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onSave(v); if (e.key === "Escape") onCancel(); }} />
      <button className="fc-sv" onClick={() => onSave(v)}>Log call</button>
      <button className="fc-cx" aria-label="Cancel" onClick={onCancel}>✕</button>
    </span>
  );
}

const CSS = `
/* .fc dissolves into the page grid (display:contents) so the header can span
   the full width while the file list and the right rail sit side-by-side in the
   row beneath it. Grid areas are defined on .focus-page in the page. */
.fc { display:contents; }
.fc-hd { grid-area:header; margin-bottom:16px; }
.fc-h1 { font-size:var(--agent-text-h2); font-weight:600; letter-spacing:-0.02em; line-height:1.2; margin:0 0 4px; color:var(--agent-text-primary); }
.fc-sub { margin:0 0 16px; font-size:13px; color:var(--agent-text-muted); max-width:78ch; }
.fc-bar { height:8px; border-radius:99px; background:rgba(var(--agent-coral-rgb),0.10); overflow:hidden; }
.fc-bar i { display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,var(--agent-coral),var(--agent-coral-deep)); transition:width .55s cubic-bezier(.22,1,.36,1); }
.fc-barlbl { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:8px; font-size:12px; color:var(--agent-text-muted); }
.fc-barlbl b { color:var(--agent-text-primary); font-weight:700; font-variant-numeric:tabular-nums; }

.fc-list { grid-area:list; display:flex; flex-direction:column; gap:10px; }
.fc-card { padding:13px 15px 14px; border-radius:16px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); box-shadow:0 1px 2px rgba(45,24,16,0.03),0 6px 20px rgba(45,24,16,0.045); }
.fc-ph { display:flex; align-items:center; gap:11px; width:100%; border:none; background:none; padding:0; margin:0 0 10px; cursor:pointer; font-family:inherit; text-align:left; }
.fc-addr-wrap { min-width:0; }
.fc-addr { display:block; font-size:14.5px; font-weight:720; letter-spacing:-0.01em; color:var(--agent-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .14s; }
.fc-loc { display:block; font-size:11.5px; color:var(--agent-text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fc-ph:hover .fc-addr { color:var(--agent-coral-deep); }

.fc-side { padding:9px 0 2px; }
.fc-side + .fc-side { border-top:1px solid var(--agent-border-subtle); }
.fc-side-top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.fc-avs { display:inline-flex; align-items:center; flex-shrink:0; }
.fc-av { display:inline-flex; border-radius:50%; box-shadow:0 0 0 2px var(--agent-surface-elevated); }
.fc-av + .fc-av { margin-left:-12px; }
.fc-who { min-width:0; flex:1 1 130px; display:flex; flex-direction:column; }
.fc-names { font-size:13px; font-weight:650; color:var(--agent-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.25; }
.fc-role { font-size:10px; font-weight:700; line-height:1.2; margin-bottom:1px; }
.fc-side.vendor .fc-role { color:#0C447C; }
.fc-side.purchaser .fc-role { color:#085041; }
.fc-sp { flex:1 1 4px; min-width:0; }

/* One labelled "Contact" dropdown stands in for all five actions. The trigger is
   a quiet bordered pill; it fills coral on hover/open. The menu floats below-right,
   grouped into "Reach out" and "This week" with a channel-tinted icon per row. */
.fc-menu { position:relative; flex-shrink:0; }
.fc-trig { display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 11px; border:1px solid var(--agent-border-default); border-radius:9px; background:var(--agent-surface-glass); color:var(--agent-text-secondary); font-family:inherit; font-size:12px; font-weight:650; cursor:pointer; white-space:nowrap; transition:background .14s,border-color .14s,color .14s,transform .14s; }
.fc-trig:hover { color:var(--agent-text-primary); border-color:var(--agent-border-strong); }
.fc-menu:not(.open) .fc-trig:hover { transform:translateY(-1px); }
.fc-menu.open .fc-trig { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); color:#fff; }
.fc-cv { transition:transform .16s ease; }
.fc-menu.open .fc-cv { transform:rotate(180deg); }
.fc-pop { position:absolute; top:calc(100% + 6px); right:0; z-index:40; min-width:214px; padding:6px; border-radius:12px; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated); box-shadow:0 14px 34px rgba(0,0,0,0.22); opacity:0; transform:translateY(-4px) scale(0.98); transform-origin:top right; pointer-events:none; transition:opacity .14s ease,transform .14s ease; }
.fc-menu.open .fc-pop { opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }
.fc-mlabel { padding:5px 8px 3px; font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--agent-text-muted); }
.fc-mi { display:flex; align-items:center; gap:10px; width:100%; padding:7px 8px; border:none; border-radius:8px; background:none; color:var(--agent-text-primary); font-family:inherit; text-align:left; cursor:pointer; transition:background .12s; }
.fc-mi:hover:not(:disabled) { background:var(--agent-surface-glass); }
.fc-mi:disabled { opacity:0.5; cursor:not-allowed; }
.fc-mic { width:28px; height:28px; flex-shrink:0; display:grid; place-items:center; border-radius:8px; background:var(--agent-surface-subtle); color:var(--agent-text-secondary); transition:background .12s,color .12s; }
.fc-mi svg { display:block; }
.fc-mi.email:hover:not(:disabled) .fc-mic { background:#3b6ef0; color:#fff; }
.fc-mi.call:hover:not(:disabled) .fc-mic { background:var(--agent-coral-deep); color:#fff; }
.fc-mi.wa:hover:not(:disabled) .fc-mic { background:#25a75a; color:#fff; }
.fc-mi.done:hover:not(:disabled) .fc-mic { background:var(--agent-success); color:#fff; }
.fc-mtext { display:flex; flex-direction:column; gap:1px; min-width:0; }
.fc-ml { font-size:12.5px; font-weight:600; line-height:1.25; }
.fc-ms { font-size:10.5px; color:var(--agent-text-muted); line-height:1.2; }
.fc-mdiv { height:1px; margin:5px 6px; background:var(--agent-border-default); }
/* Last-contact readout (minimal): a bare channel glyph, a status pip, and the
   true time — no backer tile behind the icon. Direction, state word, exact time
   and subject/snippet all live in the hover popover. */
.fc-led { display:flex; flex-wrap:wrap; align-items:center; gap:7px 22px; margin:9px 0 2px 39px; }
.fc-u { position:relative; display:inline-flex; align-items:center; gap:8px; padding:3px 1px; background:none; border:0; font-family:inherit; font-size:12px; color:var(--agent-text-secondary); cursor:pointer; transition:transform .14s ease; }
.fc-u:hover:not(.ghost) { transform:translateY(-1px); }
.fc-u.ghost { cursor:default; }
.fc-ic { position:relative; display:inline-flex; }
.fc-ic svg { display:block; }
.fc-u.email .fc-ic svg { color:#3b6ef0; }
.fc-u.whatsapp .fc-ic svg { color:#1fa855; }
.fc-u.call .fc-ic svg { color:var(--agent-coral-deep); }
.fc-u.ghost .fc-ic svg { color:var(--agent-border-strong); }
.fc-pip { position:absolute; right:-3px; bottom:-3px; width:9px; height:9px; border-radius:50%; border:2px solid var(--agent-surface-elevated); }
.fc-pip.ok { background:var(--agent-success); }
.fc-pip.neutral { background:var(--agent-text-muted); }
.fc-pip.warn { background:var(--agent-warning); }
.fc-pip.danger { background:var(--agent-danger); }
.fc-ut { font-variant-numeric:tabular-nums; color:var(--agent-text-secondary); }
.fc-u.ghost .fc-ut { color:var(--agent-text-muted); }
.fc-u:hover:not(.ghost) .fc-ut { color:var(--agent-text-primary); }

/* Hover tooltip — the full record. Distinct class from the Contact dropdown's
   .fc-pop so the two never collide. */
.fc-tip { position:absolute; bottom:calc(100% + 9px); left:-6px; z-index:40; width:212px; padding:11px 12px; border-radius:12px; border:1px solid var(--agent-border-strong); background:var(--agent-surface-elevated); box-shadow:0 10px 30px rgba(45,24,16,0.18); text-align:left; opacity:0; transform:translateY(4px); pointer-events:none; transition:opacity .13s ease,transform .13s ease; }
.fc-u:hover .fc-tip, .fc-u:focus-visible .fc-tip { opacity:1; transform:translateY(0); }
.fc-tip::after { content:""; position:absolute; top:100%; left:16px; width:9px; height:9px; margin-top:-5px; transform:rotate(45deg); background:var(--agent-surface-elevated); border-right:1px solid var(--agent-border-strong); border-bottom:1px solid var(--agent-border-strong); }
.fc-tip-h { display:flex; align-items:center; gap:6px; font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--agent-text-muted); margin-bottom:6px; }
.fc-tip-h svg { color:var(--agent-text-muted); }
.fc-tip-state { display:block; font-size:13px; font-weight:750; letter-spacing:-0.01em; }
.fc-tip-state.ok { color:var(--agent-success); }
.fc-tip-state.neutral { color:var(--agent-text-primary); }
.fc-tip-state.warn { color:var(--agent-warning); }
.fc-tip-state.danger { color:var(--agent-danger); }
.fc-tip-when { display:block; font-size:11.5px; color:var(--agent-text-muted); font-variant-numeric:tabular-nums; margin-top:2px; }
.fc-tip-snip { display:block; margin-top:8px; padding:7px 9px; border-radius:8px; background:var(--agent-surface-subtle); font-size:11.5px; color:var(--agent-text-secondary); line-height:1.45; }
.fc-tip-empty { display:block; font-size:12.5px; color:var(--agent-text-muted); }

.fc-callform { display:flex; align-items:center; gap:7px; flex:1 1 220px; min-width:0; }
.fc-callform input { flex:1; min-width:0; height:32px; border:1px solid var(--agent-coral-deep); border-radius:9px; padding:0 10px; font-family:inherit; font-size:12.5px; color:var(--agent-text-primary); outline:none; background:var(--agent-surface-glass); }
.fc-sv { border:none; background:var(--agent-coral-deep); color:#fff; border-radius:9px; height:32px; padding:0 12px; font-family:inherit; font-size:12px; font-weight:650; cursor:pointer; white-space:nowrap; }
.fc-cx { border:none; background:none; color:var(--agent-text-muted); cursor:pointer; font-size:14px; padding:0 3px; }

.fc-done { grid-area:list; text-align:center; padding:40px 20px; border-radius:16px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); }
.fc-done-h { font-size:15px; font-weight:700; color:var(--agent-success); }
.fc-done-p { font-size:12.5px; color:var(--agent-text-muted); margin-top:4px; }
@media (prefers-reduced-motion:reduce){ .fc-bar i,.fc-u,.fc-trig,.fc-cv,.fc-pop,.fc-tip{ transition:none; } }
@media (max-width:560px){ .fc-side-top{ gap:8px; } .fc-led{ margin-left:0; gap:7px 18px; } .fc-tip{ display:none; } }
`;
