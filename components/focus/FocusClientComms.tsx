"use client";

// Focus → left column: the merged "client communications" cockpit (founder only).
// Fuses the two old Focus widgets: the weekly "touch both sides of every file"
// quota (progress bar, Monday reset, "not required" parking) AND the per-side
// act-now actions (email / call / WhatsApp). On top it layers what the client has
// actually received: the last AUTOMATED email with its live delivery/open status
// (click to open the exact email we sent), and a bounce flag when a client is
// unreachable. Human touches still drive the quiet clock; automated sends are a
// quiet secondary signal and never reset it.

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Phone, EnvelopeSimple, WhatsappLogo, CaretDown, Check, Prohibit } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { TodoTabs } from "@/components/agent/TodoTabs";
import { ComposeEmailModal } from "@/components/compose/ComposeEmailModal";
import { SentEmailModal, type OpenEmail } from "@/components/transaction/SentEmailModal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { markSideNotRequiredThisWeek, logSideCall, logSideEmailed, addSideContactPhone } from "@/app/actions/weekly-touch";
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
  const [composeTo, setComposeTo] = useState<string[] | null>(null);
  const [openEmail, setOpenEmail] = useState<OpenEmail | null>(null);
  const [view, setView] = useState<FocusView>("touch");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");

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
    toast.success(msg);
    startTransition(async () => { await action().catch(() => {}); router.refresh(); });
  }

  // Effective "touched this week" = server truth OR an optimistic local resolve.
  const touched = (f: FocusCommsFile, s: FocusSide) => s.touchedThisWeek || resolved.has(key(f.transactionId, s.side));
  const matchSide = (s: FocusSide) => sideFilter === "all" || s.side === sideFilter;
  const inView = (f: FocusCommsFile, s: FocusSide) => {
    if (!matchSide(s)) return false;
    if (view === "touch") return !touched(f, s) && !s.parked;
    if (view === "awaiting") return s.awaitingReply;
    return true; // recent: every side
  };
  // Least-recently-contacted first (null = never = most stale).
  const staleness = (s: FocusSide) => s.daysSince ?? 100_000;
  const worst = (sides: FocusSide[]) => Math.max(...sides.map(staleness));

  const viewFiles = files
    .map((f) => ({ file: f, sides: f.sides.filter((s) => inView(f, s)) }))
    .filter((x) => x.sides.length > 0)
    .sort((a, b) => worst(b.sides) - worst(a.sides));

  // Tab counts respect the side filter but not the active view.
  const pool = files.flatMap((f) => f.sides.filter(matchSide).map((s) => ({ f, s })));
  const counts = {
    touch: pool.filter(({ f, s }) => !touched(f, s) && !s.parked).length,
    recent: pool.length,
    awaiting: pool.filter(({ s }) => s.awaitingReply).length,
  };
  const tabs = [
    { key: "touch", label: "To touch", count: counts.touch },
    { key: "recent", label: "Least contacted" }, // neutral list, not a to-do count
    { key: "awaiting", label: "Awaiting reply", count: counts.awaiting },
  ];
  const empty = EMPTY_VIEW[view];

  return (
    <>
      <style>{CSS}</style>
      <section className="fc">
        <header className="fc-hd">
          <h1 className="fc-h1">Keep every client in the loop</h1>
          <p key={view} className="fcl-sub">{SUB_COPY[view]}</p>

          <div className="fc-bar"><i style={{ width: `${barIn ? pct : 0}%` }} /></div>
          <div className="fc-barlbl">
            <span><b>{localDone}</b> of {totalSides} sides progressed this week{today > 0 && left > 0 ? ` · ${today} more to aim for today` : ""}</span>
          </div>
        </header>

        <div className="fc-main">
          <TodoTabs tabs={tabs} active={view} onChange={(k) => setView(k as FocusView)} action={<SideSeg value={sideFilter} onChange={setSideFilter} />}>
            {viewFiles.length === 0 ? (
              <div className="fc-done">
                <div className="fc-done-h">{empty.h}</div>
                <div className="fc-done-p">{empty.p}</div>
              </div>
            ) : (
              <div className="fc-list">
                {viewFiles.map(({ file: f, sides }) => (
                  <article className="fc-card" key={f.transactionId}>
                    <button type="button" className="fc-ph" onClick={() => router.push(`/agent/transactions/${f.transactionId}`)}>
                      <PropertyThumb photoUrl={f.photoUrl} size={42} />
                      <span className="fc-addr-wrap">
                        <span className="fc-addr">{f.addressLine}</span>
                        <span className="fc-loc">{f.townPostcode.replace(/ · /g, ", ")}</span>
                      </span>
                    </button>

                    {sides.map((s) => (
                      <SideBlock
                        key={s.side}
                        file={f}
                        side={s}
                        showWhatsApp={showWhatsApp}
                        done={view === "recent" && touched(f, s)}
                        onLogCall={(note, phone) => resolve(f.transactionId, s.side, `${s.side === "vendor" ? "Seller" : "Buyer"} · call logged`, async () => {
                          if (phone) await addSideContactPhone(f.transactionId, s.primaryContactId, phone).catch(() => {});
                          await logSideCall(f.transactionId, s.side, s.contactIds, note);
                        })}
                        onCompose={() => { setComposeTx(f.transactionId); setComposeTo(s.contactIds); }}
                        onMarkEmailed={() => resolve(f.transactionId, s.side, `${s.side === "vendor" ? "Seller" : "Buyer"} · emailed`, () => logSideEmailed(f.transactionId, s.side, s.contactIds))}
                        onNotRequired={() => resolve(f.transactionId, s.side, `${s.side === "vendor" ? "Seller" : "Buyer"} · parked this week`, () => markSideNotRequiredThisWeek(f.transactionId, s.side))}
                        onOpenEmail={(id) => setOpenEmail({ id, label: f.addressLine })}
                      />
                    ))}
                  </article>
                ))}
              </div>
            )}
          </TodoTabs>
        </div>
      </section>

      <ComposeEmailModal open={!!composeTx} initialTransactionId={composeTx} initialToContactIds={composeTo} onClose={() => { setComposeTx(null); setComposeTo(null); router.refresh(); }} />
      <SentEmailModal email={openEmail} onClose={() => setOpenEmail(null)} />
    </>
  );
}

type FocusView = "touch" | "recent" | "awaiting";
type SideFilter = "all" | "vendor" | "purchaser";

const EMPTY_VIEW: Record<FocusView, { h: string; p: string }> = {
  touch: { h: "Both sides of every file touched", p: "Nothing's gone quiet. It resets Monday." },
  recent: { h: "No active sales here", p: "Nothing to show for this filter." },
  awaiting: { h: "Nobody's left hanging", p: "Every message you've sent has had a reply." },
};

// Subtitle explains the active view; it cross-fades as you switch tabs.
const SUB_COPY: Record<FocusView, string> = {
  touch: "Every active sale, both sides, checked each week. This is who's still to hear from you. Resets every Monday.",
  recent: "Every active side, ordered by time since your last contact. The longest without a response appear first.",
  awaiting: "You've been in touch, but haven't heard back. These sides are still waiting to reply.",
};

// Compact animated Seller/Buyer filter — a sliding thumb with a spring settle,
// sitting in the tab row's action slot.
function SideSeg({ value, onChange }: { value: SideFilter; onChange: (v: SideFilter) => void }) {
  const opts: { k: SideFilter; label: string }[] = [
    { k: "all", label: "All" },
    { k: "vendor", label: "Seller" },
    { k: "purchaser", label: "Buyer" },
  ];
  const idx = Math.max(0, opts.findIndex((o) => o.k === value));
  return (
    <div className="fc-seg2" style={{ "--seg-count": opts.length, "--seg-idx": idx } as CSSProperties} role="tablist" aria-label="Side">
      <span className="fc-seg2-thumb" aria-hidden />
      {opts.map((o) => (
        <button key={o.k} type="button" role="tab" aria-selected={o.k === value} className={`fc-seg2-b${o.k === value ? " on" : ""}`} onClick={() => onChange(o.k)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SideBlock({
  file, side, showWhatsApp, done, onLogCall, onCompose, onMarkEmailed, onNotRequired, onOpenEmail,
}: {
  file: FocusCommsFile;
  side: FocusSide;
  showWhatsApp: boolean;
  done: boolean;
  onLogCall: (note: string, phone?: string) => void;
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
    <div className={`fc-side ${side.side}${done ? " done" : ""}`}>
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

        {done ? (
          <Pill glass tone="success" size="sm" style={{ flexShrink: 0 }}>Touched</Pill>
        ) : side.quiet ? (
          <Pill glass tone="warning" size="sm" style={{ flexShrink: 0 }}>
            {side.daysSince != null ? `Quiet ${side.daysSince}d` : "Never contacted"}
          </Pill>
        ) : null}

        <span className="fc-sp" />

        <ContactMenu
          side={side}
          whatsappConnected={showWhatsApp}
          onCompose={onCompose}
          onLogCall={onLogCall}
          onMarkEmailed={onMarkEmailed}
          onNotRequired={onNotRequired}
        />
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
        <span className="fcl-tip" role="tooltip">
          <span className="fcl-tip-h"><Icon size={13} /><b>{CHANNEL_NAME[channel]}</b></span>
          <span className="fcl-tip-empty">{EMPTY_LABEL[channel]}</span>
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
      <span className="fcl-tip" role="tooltip">
        <span className="fcl-tip-h"><Icon size={13} /><b>{CHANNEL_NAME[channel]}</b></span>
        <span className={`fcl-tip-state ${meta.tone}`}>{dirLabel(c)} · {meta.label}</span>
        <span className="fcl-tip-when">{fmtDateTime(c.at)}</span>
        {detail ? <span className="fcl-tip-snip">{detail}</span> : null}
      </span>
    </button>
  );
}

// One labelled "Contact" trigger opens every action for a side — three ways to
// reach them (email / call / WhatsApp) and two ways to settle the week (already
// emailed / not required). "Log a call" widens the popover into a note field in
// place. Closes on outside click, Escape, or any selection.
function ContactMenu({
  side, whatsappConnected, onCompose, onLogCall, onMarkEmailed, onNotRequired,
}: {
  side: FocusSide;
  whatsappConnected: boolean;
  onCompose: () => void;
  onLogCall: (note: string, phone?: string) => void;
  onMarkEmailed: () => void;
  onNotRequired: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "call">("menu");
  const [note, setNote] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [dialed, setDialed] = useState(false);
  const [coarse, setCoarse] = useState(false); // touch/mobile pointer → offer to dial
  const ref = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setCoarse(window.matchMedia?.("(pointer: coarse)")?.matches ?? false); }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { if (mode === "call") setMode("menu"); else setOpen(false); }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, mode]);

  // Reset to the menu (and clear the draft) whenever the popover closes.
  useEffect(() => { if (!open) { setMode("menu"); setNote(""); setPhoneDraft(""); setDialed(false); } }, [open]);
  // Focus the note field as the call step opens, AND when the user returns to the
  // tab after a dial (the OS hands back here when the call ends).
  useEffect(() => {
    if (mode !== "call") return;
    noteRef.current?.focus();
    function onVis() { if (document.visibilityState === "visible") noteRef.current?.focus(); }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [mode]);

  const pick = (fn: () => void) => { setOpen(false); fn(); };
  const hasPhone = !!side.phone;
  const waDisabled = whatsappConnected && !hasPhone; // connected but nothing to dial
  const willDial = coarse && hasPhone;               // mobile + a number → actually call
  const names = side.contacts.length ? side.contacts.map((c) => c.name).join(" & ") : side.name;

  function onWhatsApp() {
    if (!whatsappConnected) return pick(() => router.push("/agent/account/connections#whatsapp"));
    if (hasPhone && side.phone) return pick(() => window.open(`https://wa.me/${toWaDigits(side.phone!)}`, "_blank", "noopener"));
  }
  function onCallTap() {
    setMode("call");
    if (willDial && side.phone) {
      setDialed(true);
      window.location.href = `tel:${side.phone.replace(/[^\d+]/g, "")}`;
    }
  }
  function saveCall() {
    const p = !hasPhone && phoneDraft.trim() ? phoneDraft.trim() : undefined;
    onLogCall(note.trim(), p);
    setOpen(false);
  }

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

      <div className={`fc-pop${mode === "call" ? " note" : ""}`} role="menu">
        {mode === "call" ? (
          <div className="fc-note">
            <div className="fc-note-h">{dialed ? `How did the call with ${names} go?` : `Call with ${names}`}</div>
            <textarea
              ref={noteRef}
              className="fc-note-in"
              value={note}
              placeholder="What was said? Internal only."
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveCall(); }}
            />
            {!hasPhone ? (
              <input
                className="fc-note-phone"
                type="tel"
                inputMode="tel"
                value={phoneDraft}
                placeholder="+ Add a mobile number"
                onChange={(e) => setPhoneDraft(e.target.value)}
              />
            ) : null}
            <div className="fc-note-row">
              <button type="button" className="fc-note-back" onClick={() => setMode("menu")}>Back</button>
              <button type="button" className="fc-note-save" onClick={saveCall}>Save call</button>
            </div>
          </div>
        ) : (
          <>
            <div className="fc-mlabel">Reach out</div>
            <button type="button" className="fc-mi email" role="menuitem" onClick={() => pick(onCompose)}>
              <span className="fc-mic"><EnvelopeSimple size={16} /></span>
              <span className="fc-mtext"><span className="fc-ml">Email</span></span>
            </button>
            <button type="button" className="fc-mi call" role="menuitem" onClick={onCallTap}>
              <span className="fc-mic"><Phone size={16} /></span>
              <span className="fc-mtext">
                <span className="fc-ml">{willDial ? "Call" : "Log a call"}</span>
                {willDial ? <span className="fc-ms">We'll dial, then you add a note</span> : null}
              </span>
            </button>
            <button type="button" className="fc-mi wa" role="menuitem" disabled={waDisabled} onClick={onWhatsApp}>
              <span className="fc-mic"><WhatsappLogo size={16} /></span>
              <span className="fc-mtext">
                <span className="fc-ml">{whatsappConnected ? "WhatsApp" : "Connect to WhatsApp"}</span>
                {!whatsappConnected ? <span className="fc-ms">Set it up in settings</span> : waDisabled ? <span className="fc-ms">No number on file</span> : null}
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
            <button type="button" className="fc-mi skip" role="menuitem" onClick={() => pick(onNotRequired)}>
              <span className="fc-mic"><Prohibit size={15} /></span>
              <span className="fc-mtext">
                <span className="fc-ml">Not required</span>
                <span className="fc-ms">Parks till Monday</span>
              </span>
            </button>
          </>
        )}
      </div>
    </span>
  );
}

const CSS = `
/* .fc dissolves into the page grid (display:contents). At the two-column
   breakpoint the header spans the full width and the list sits beside the rail;
   below it (page stacks to one column) these take their natural flow order so
   the grid-area names — which only exist on the wide grid — can't mis-place them. */
.fc { display:contents; }
.fc-hd { margin-bottom:16px; }
.fc-h1 { font-size:var(--agent-text-h2); font-weight:600; letter-spacing:-0.02em; line-height:1.2; margin:0 0 4px; color:var(--agent-text-primary); }
.fcl-sub { margin:0 0 16px; font-size:13px; color:var(--agent-text-muted); max-width:78ch; animation:fcl-sub-fade .26s ease; }
@keyframes fcl-sub-fade { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
.fc-bar { height:8px; border-radius:99px; background:rgba(var(--agent-coral-rgb),0.10); overflow:hidden; }
.fc-bar i { display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,var(--agent-coral),var(--agent-coral-deep)); transition:width .55s cubic-bezier(.22,1,.36,1); }
.fc-barlbl { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:8px; font-size:12px; color:var(--agent-text-muted); }
.fc-barlbl b { color:var(--agent-text-primary); font-weight:700; font-variant-numeric:tabular-nums; }

/* The view tabs + list occupy the grid's list area; the tabs/list nest inside. */
.fc-main { min-width:0; }
.fc-list { display:flex; flex-direction:column; gap:10px; }
.fc-card { padding:13px 15px 14px; border-radius:16px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); box-shadow:0 1px 2px rgba(45,24,16,0.03),0 6px 20px rgba(45,24,16,0.045); }
.fc-ph { display:flex; align-items:center; gap:11px; width:100%; border:none; background:none; padding:0; margin:0 0 10px; cursor:pointer; font-family:inherit; text-align:left; }
.fc-addr-wrap { min-width:0; }
.fc-addr { display:block; font-size:14.5px; font-weight:720; letter-spacing:-0.01em; color:var(--agent-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .14s; }
.fc-loc { display:block; font-size:11.5px; color:var(--agent-text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fc-ph:hover .fc-addr { color:var(--agent-coral-deep); }

.fc-side { padding:9px 0 2px; transition:opacity .2s ease; }
.fc-side.done { opacity:0.6; }
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
.fc-trig { display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 11px; border:1px solid var(--agent-border-default); border-radius:9px; background:var(--agent-surface-glass); color:var(--agent-text-secondary); font-family:inherit; font-size:12px; font-weight:650; cursor:pointer; white-space:nowrap; transition:background .14s,border-color .14s,color .14s,box-shadow .14s; }
.fc-trig:hover { color:var(--agent-text-primary); border-color:var(--agent-border-strong); }
.fc-menu:not(.open) .fc-trig:hover { box-shadow:var(--agent-hover-lift); }
.fc-menu.open .fc-trig { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); color:#fff; }
.fc-cv { transition:transform .16s ease; }
.fc-menu.open .fc-cv { transform:rotate(180deg); }
.fc-pop { position:absolute; top:calc(100% + 6px); right:0; z-index:40; min-width:214px; padding:6px; border-radius:12px; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated); box-shadow:0 14px 34px rgba(0,0,0,0.22); opacity:0; transform:translateY(-4px) scale(0.98); transform-origin:top right; pointer-events:none; transition:opacity .14s ease,transform .14s ease,min-width .2s cubic-bezier(.3,.8,.3,1); }
.fc-menu.open .fc-pop { opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }
.fc-pop.note { min-width:308px; padding:8px; }
.fc-mlabel { padding:5px 8px 3px; font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--agent-text-muted); }
.fc-mi { display:flex; align-items:center; gap:10px; width:100%; padding:7px 8px; border:none; border-radius:8px; background:none; color:var(--agent-text-primary); font-family:inherit; text-align:left; cursor:pointer; transition:background .12s,box-shadow .12s; }
.fc-mi:hover:not(:disabled) { background:var(--agent-surface-glass); box-shadow:var(--agent-hover-lift); }
.fc-mi:disabled { opacity:0.5; cursor:not-allowed; }
.fc-mic { width:28px; height:28px; flex-shrink:0; display:grid; place-items:center; border-radius:8px; background:var(--agent-surface-subtle); color:var(--agent-text-secondary); transition:color .12s; }
.fc-mi svg { display:block; }
/* On hover the ICON takes the channel colour — the tile stays neutral. */
.fc-mi.email:hover:not(:disabled) .fc-mic { color:#3b6ef0; }
.fc-mi.call:hover:not(:disabled) .fc-mic { color:var(--agent-coral-deep); }
.fc-mi.wa:hover:not(:disabled) .fc-mic { color:#1fa855; }
.fc-mi.done:hover:not(:disabled) .fc-mic { color:var(--agent-success); }
.fc-mi.skip:hover:not(:disabled) .fc-mic { color:var(--agent-danger); }
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
.fcl-tip { position:absolute; bottom:calc(100% + 9px); left:-6px; z-index:40; width:212px; padding:11px 12px; border-radius:12px; border:1px solid var(--agent-border-strong); background:var(--agent-surface-elevated); box-shadow:0 10px 30px rgba(45,24,16,0.18); text-align:left; opacity:0; transform:translateY(4px); pointer-events:none; transition:opacity .13s ease,transform .13s ease; }
.fc-u:hover .fcl-tip, .fc-u:focus-visible .fcl-tip { opacity:1; transform:translateY(0); }
.fcl-tip::after { content:""; position:absolute; top:100%; left:16px; width:9px; height:9px; margin-top:-5px; transform:rotate(45deg); background:var(--agent-surface-elevated); border-right:1px solid var(--agent-border-strong); border-bottom:1px solid var(--agent-border-strong); }
.fcl-tip-h { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:700; letter-spacing:.01em; color:var(--agent-text-muted); margin-bottom:6px; }
.fcl-tip-h svg { color:var(--agent-text-muted); }
.fcl-tip-state { display:block; font-size:13px; font-weight:750; letter-spacing:-0.01em; }
.fcl-tip-state.ok { color:var(--agent-success); }
.fcl-tip-state.neutral { color:var(--agent-text-primary); }
.fcl-tip-state.warn { color:var(--agent-warning); }
.fcl-tip-state.danger { color:var(--agent-danger); }
.fcl-tip-when { display:block; font-size:11.5px; color:var(--agent-text-muted); font-variant-numeric:tabular-nums; margin-top:2px; }
.fcl-tip-snip { display:block; margin-top:8px; padding:7px 9px; border-radius:8px; background:var(--agent-surface-subtle); font-size:11.5px; color:var(--agent-text-secondary); line-height:1.45; }
.fcl-tip-empty { display:block; font-size:12.5px; color:var(--agent-text-muted); }

/* Log-a-call note step, shown in place of the menu list when the popover widens. */
.fc-note { display:flex; flex-direction:column; }
.fc-note-h { padding:4px 6px 7px; font-size:12.5px; font-weight:700; letter-spacing:-0.01em; color:var(--agent-text-primary); }
.fc-note-in { width:100%; box-sizing:border-box; min-height:88px; resize:vertical; border:1px solid var(--agent-border-default); border-radius:9px; padding:8px 10px; font-family:inherit; font-size:12.5px; line-height:1.45; color:var(--agent-text-primary); background:var(--agent-surface-glass); outline:none; transition:border-color .14s; }
.fc-note-in::placeholder { color:var(--agent-text-muted); }
.fc-note-in:focus { border-color:var(--agent-coral-deep); }
.fc-note-phone { width:100%; box-sizing:border-box; margin-top:7px; height:34px; border:1px solid var(--agent-border-default); border-radius:9px; padding:0 10px; font-family:inherit; font-size:12.5px; color:var(--agent-text-primary); background:var(--agent-surface-glass); outline:none; transition:border-color .14s; }
.fc-note-phone::placeholder { color:var(--agent-text-muted); }
.fc-note-phone:focus { border-color:var(--agent-coral-deep); }
.fc-note-row { display:flex; align-items:center; justify-content:space-between; margin-top:9px; }
.fc-note-back { border:none; background:none; font-family:inherit; font-size:12px; font-weight:650; color:var(--agent-text-muted); cursor:pointer; padding:7px 9px; border-radius:8px; transition:background .12s,color .12s; }
.fc-note-back:hover { color:var(--agent-text-primary); background:var(--agent-surface-glass); }
.fc-note-save { border:none; background:var(--agent-coral-deep); color:#fff; font-family:inherit; font-size:12px; font-weight:650; cursor:pointer; padding:8px 15px; border-radius:9px; transition:box-shadow .14s,filter .14s; }
.fc-note-save:hover { box-shadow:var(--agent-hover-lift); filter:brightness(1.04); }

.fc-done { text-align:center; padding:40px 20px; border-radius:16px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); }

/* Compact Seller/Buyer filter — sliding thumb with a spring settle. */
.fc-seg2 { position:relative; display:inline-grid; grid-template-columns:repeat(var(--seg-count),1fr); background:var(--agent-surface-subtle); border:1px solid var(--agent-border-default); border-radius:9px; padding:3px; }
.fc-seg2-thumb { position:absolute; top:3px; bottom:3px; left:3px; width:calc((100% - 6px)/var(--seg-count)); border-radius:7px; background:var(--agent-surface-elevated); box-shadow:0 1px 2px rgba(45,24,16,0.14); transform:translateX(calc(var(--seg-idx) * 100%)); transition:transform .24s cubic-bezier(.34,1.32,.5,1); }
.fc-seg2-b { position:relative; z-index:1; border:0; background:none; font-family:inherit; font-size:12px; font-weight:650; color:var(--agent-text-muted); padding:5px 13px; cursor:pointer; white-space:nowrap; transition:color .16s; }
.fc-seg2-b.on { color:var(--agent-text-primary); }
.fc-seg2-b:hover:not(.on) { color:var(--agent-text-secondary); }
.fc-done-h { font-size:15px; font-weight:700; color:var(--agent-success); }
.fc-done-p { font-size:12.5px; color:var(--agent-text-muted); margin-top:4px; }
/* Place the header + list into the wide grid's named areas ONLY where that grid
   (and its areas) exists — below the breakpoint they stack in natural order. Must
   live here, not in the page: .fc is display:contents, so these aren't matchable
   as direct children of .focus-page via a combinator. */
@media (min-width:1000px){ .fc-hd{ grid-area:header; } .fc-main{ grid-area:list; } }
@media (prefers-reduced-motion:reduce){ .fc-bar i,.fc-u,.fc-trig,.fc-cv,.fc-pop,.fcl-tip,.fc-seg2-thumb,.fc-side,.fc-mi{ transition:none; } .fcl-sub{ animation:none; } }
@media (max-width:560px){ .fc-side-top{ gap:8px; } .fc-led{ margin-left:0; gap:7px 18px; } .fcl-tip{ display:none; } }
`;
