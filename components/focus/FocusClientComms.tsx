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
import { Phone, EnvelopeSimple, WhatsappLogo, WarningCircle } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { ComposeEmailModal } from "@/components/compose/ComposeEmailModal";
import { SentEmailModal, type OpenEmail } from "@/components/transaction/SentEmailModal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { markSideNotRequiredThisWeek, logSideCall, logSideEmailed } from "@/app/actions/weekly-touch";
import type { FocusSide, FocusEmailState } from "@/lib/services/focus";

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

const STATE_META: Record<FocusEmailState, { label: string; color: string }> = {
  sent: { label: "sent", color: "var(--agent-text-muted)" },
  delivered: { label: "delivered", color: "var(--agent-info)" },
  opened: { label: "opened", color: "var(--agent-success)" },
  clicked: { label: "clicked", color: "var(--agent-success)" },
  bounced: { label: "bounced", color: "var(--agent-danger)" },
  failed: { label: "failed", color: "var(--agent-danger)" },
};

function agoShort(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function FocusClientComms({ files, totalSides, doneSides }: { files: FocusCommsFile[]; totalSides: number; doneSides: number }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [composeTx, setComposeTx] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState<string | null>(null);
  const [openEmail, setOpenEmail] = useState<OpenEmail | null>(null);

  const key = (tx: string, side: string) => `${tx}:${side}`;
  const localDone = doneSides + resolved.size;
  const pct = totalSides ? Math.round((localDone / totalSides) * 100) : 100;
  const left = Math.max(0, totalSides - localDone);
  const today = Math.min(left, Math.ceil(totalSides / 5));
  const quietCount = files.reduce((n, f) => n + f.sides.filter((s) => s.quiet && !resolved.has(key(f.transactionId, s.side))).length, 0);

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
          <div className="fc-eyebrow">Client communications</div>
          <h1 className="fc-h1">Keep every client in the loop</h1>
          <p className="fc-sub">Both sides of every active file, touched each week. See what's reached them and act right here. Resets Monday.</p>

          <div className="fc-bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="fc-barlbl">
            <span><b>{localDone}</b> of {totalSides} sides moved this week{today > 0 && left > 0 ? ` · ${today} to aim for today` : ""}</span>
            <Pill glass tone={quietCount > 0 ? "danger" : "success"} size="sm">{quietCount > 0 ? `${quietCount} gone quiet` : "all caught up"}</Pill>
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
                    <span className="fc-loc">{f.townPostcode}</span>
                  </span>
                </button>

                {f.sides.map((s) => (
                  <SideBlock
                    key={s.side}
                    file={f}
                    side={s}
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
  file, side, callOpen, onCall, onCallCancel, onCallSave, onCompose, onMarkEmailed, onNotRequired, onOpenEmail,
}: {
  file: FocusCommsFile;
  side: FocusSide;
  callOpen: boolean;
  onCall: () => void;
  onCallCancel: () => void;
  onCallSave: (note: string) => void;
  onCompose: () => void;
  onMarkEmailed: () => void;
  onNotRequired: () => void;
  onOpenEmail: (id: string) => void;
}) {
  const label = side.side === "vendor" ? "Seller" : "Buyer";
  const names = side.contacts.length ? side.contacts.map((c) => c.name).join(" & ") : side.name;
  const avatars = side.contacts.length ? side.contacts : [{ id: side.primaryContactId, name: side.name }];
  const auto = side.lastAutoEmail;

  return (
    <div className={`fc-side ${side.side}`}>
      <div className="fc-side-top">
        <span className="fc-avs">
          {avatars.map((c) => (
            <span className="fc-av" key={c.id}><ContactAvatar contact={{ name: c.name, roleType: side.side }} size={28} /></span>
          ))}
        </span>
        <span className="fc-who">
          <span className="fc-names" title={names}>{names}</span>
          <span className="fc-role">{label}</span>
        </span>

        {side.bounced ? (
          <Pill glass tone="danger" size="sm" style={{ flexShrink: 0 }}>Email bounced</Pill>
        ) : (
          <Pill glass tone={side.quiet ? "warning" : "muted"} size="sm" style={{ flexShrink: 0 }}>
            {side.quiet ? (side.daysSince != null ? `Quiet ${side.daysSince}d` : "Never contacted") : "To touch"}
          </Pill>
        )}

        <span className="fc-sp" />

        {callOpen ? (
          <CallForm onSave={onCallSave} onCancel={onCallCancel} />
        ) : (
          <span className="fc-acts">
            <button className="fc-ib email" title={`Email ${label.toLowerCase()}`} onClick={onCompose}><EnvelopeSimple size={16} /></button>
            <button className="fc-ib call" title="Log a call" onClick={onCall}><Phone size={16} /></button>
            <button className="fc-ib wa" title={`WhatsApp ${label.toLowerCase()}`} disabled={!side.phone} onClick={() => side.phone && window.open(`https://wa.me/${toWaDigits(side.phone)}`, "_blank", "noopener")}><WhatsappLogo size={16} /></button>
            <span className="fc-txt-acts">
              <button className="fc-txt" onClick={onMarkEmailed}>Emailed</button>
              <span className="fc-dot-sep" aria-hidden>·</span>
              <button className="fc-txt" onClick={onNotRequired}>Not required</button>
            </span>
          </span>
        )}
      </div>

      {side.bounced ? (
        <div className="fc-auto bounce">
          <WarningCircle size={13} weight="fill" />
          <span>Their email bounced. They aren't receiving anything, so reach them another way.</span>
        </div>
      ) : auto ? (
        <button type="button" className="fc-auto" onClick={() => onOpenEmail(auto.id)} title="Open the exact email we sent">
          <EnvelopeSimple size={13} weight="regular" />
          <span className="fc-auto-txt">
            Auto: {auto.kind}{auto.subject ? ` · ${auto.subject}` : ""}
          </span>
          <span className="fc-auto-state" style={{ color: STATE_META[auto.state].color }}>
            <span className="fc-auto-dot" style={{ background: STATE_META[auto.state].color }} aria-hidden />
            {STATE_META[auto.state].label}
          </span>
          <span className="fc-auto-ago">{agoShort(auto.sentAt)}</span>
        </button>
      ) : null}
    </div>
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
.fc { display:flex; flex-direction:column; }
.fc-hd { margin-bottom:16px; }
.fc-eyebrow { font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--agent-coral-deep); display:inline-flex; align-items:center; gap:7px; }
.fc-eyebrow::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--agent-coral-deep); box-shadow:0 0 0 3px rgba(var(--agent-coral-rgb),0.18); }
.fc-h1 { font-size:23px; font-weight:800; letter-spacing:-0.02em; margin:8px 0 3px; color:var(--agent-text-primary); }
.fc-sub { margin:0 0 16px; font-size:13.5px; color:var(--agent-text-secondary); max-width:60ch; }
.fc-bar { height:8px; border-radius:99px; background:rgba(var(--agent-coral-rgb),0.10); overflow:hidden; }
.fc-bar i { display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,var(--agent-coral),var(--agent-coral-deep)); transition:width .55s cubic-bezier(.22,1,.36,1); }
.fc-barlbl { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:8px; font-size:12px; color:var(--agent-text-muted); }
.fc-barlbl b { color:var(--agent-text-primary); font-weight:700; font-variant-numeric:tabular-nums; }

.fc-list { display:flex; flex-direction:column; gap:10px; }
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
.fc-role { font-size:9.5px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; line-height:1.2; margin-top:1px; }
.fc-side.vendor .fc-role { color:#0C447C; }
.fc-side.purchaser .fc-role { color:#085041; }
.fc-sp { flex:1 1 4px; min-width:0; }

.fc-acts { display:inline-flex; align-items:center; gap:6px; flex-shrink:0; }
.fc-ib { width:32px; height:32px; border-radius:9px; border:1px solid var(--agent-border-default); background:var(--agent-surface-glass); color:var(--agent-text-secondary); display:grid; place-items:center; cursor:pointer; transition:background .14s,color .14s,transform .14s,box-shadow .14s,border-color .14s; }
.fc-ib:hover:not(:disabled) { color:#fff; transform:translateY(-1px); box-shadow:0 3px 9px rgba(45,24,16,0.16); }
.fc-ib:disabled { opacity:0.4; cursor:not-allowed; }
.fc-ib.email:hover:not(:disabled) { background:#3b6ef0; border-color:#3b6ef0; }
.fc-ib.call:hover:not(:disabled) { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); }
.fc-ib.wa:hover:not(:disabled) { background:#25a75a; border-color:#25a75a; }
.fc-ib svg { display:block; }
.fc-txt-acts { display:inline-flex; align-items:center; gap:7px; margin-left:3px; }
.fc-txt { border:none; background:none; cursor:pointer; font-family:inherit; font-size:11px; font-weight:600; color:var(--agent-text-muted); padding:3px 0; white-space:nowrap; transition:color .14s; }
.fc-txt:hover { color:var(--agent-coral-deep); }
.fc-dot-sep { color:var(--agent-border-strong); font-size:11px; }

/* Secondary line: what automation last sent this side, openable. Quiet by design. */
.fc-auto { display:flex; align-items:center; gap:7px; width:100%; margin-top:8px; padding:6px 9px; border-radius:9px; border:1px solid transparent; background:var(--agent-surface-subtle); color:var(--agent-text-muted); font-family:inherit; font-size:11.5px; text-align:left; cursor:pointer; transition:background .14s,border-color .14s; }
.fc-auto:hover { background:var(--agent-surface-glass); border-color:var(--agent-border-default); }
.fc-auto > svg { flex-shrink:0; color:var(--agent-text-muted); }
.fc-auto-txt { min-width:0; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--agent-text-secondary); }
.fc-auto-state { display:inline-flex; align-items:center; gap:5px; flex-shrink:0; font-weight:700; }
.fc-auto-dot { width:5px; height:5px; border-radius:50%; }
.fc-auto-ago { flex-shrink:0; color:var(--agent-text-muted); font-variant-numeric:tabular-nums; }
.fc-auto.bounce { cursor:default; background:rgba(var(--agent-danger-rgb),0.07); border-color:rgba(var(--agent-danger-rgb),0.25); color:var(--agent-danger); }
.fc-auto.bounce > svg { color:var(--agent-danger); }
.fc-auto.bounce span { color:var(--agent-danger); }

.fc-callform { display:flex; align-items:center; gap:7px; flex:1 1 220px; min-width:0; }
.fc-callform input { flex:1; min-width:0; height:32px; border:1px solid var(--agent-coral-deep); border-radius:9px; padding:0 10px; font-family:inherit; font-size:12.5px; color:var(--agent-text-primary); outline:none; background:var(--agent-surface-glass); }
.fc-sv { border:none; background:var(--agent-coral-deep); color:#fff; border-radius:9px; height:32px; padding:0 12px; font-family:inherit; font-size:12px; font-weight:650; cursor:pointer; white-space:nowrap; }
.fc-cx { border:none; background:none; color:var(--agent-text-muted); cursor:pointer; font-size:14px; padding:0 3px; }

.fc-done { text-align:center; padding:40px 20px; border-radius:16px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); }
.fc-done-h { font-size:15px; font-weight:700; color:var(--agent-success); }
.fc-done-p { font-size:12.5px; color:var(--agent-text-muted); margin-top:4px; }
@media (prefers-reduced-motion:reduce){ .fc-bar i,.fc-ib,.fc-auto{ transition:none; } }
@media (max-width:520px){ .fc-side-top{ gap:8px; } .fc-txt-acts{ width:100%; justify-content:flex-start; } }
`;
