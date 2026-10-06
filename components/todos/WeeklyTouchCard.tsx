"use client";

// Weekly "touch every file" card (critique 2026-10-05, reworked 2026-10-06). Both
// sides (seller + buyer) of every active file should be touched each week. Each
// outstanding side shows the side-coloured contact avatar(s) + name(s), a glassy
// status pill, and the actions: Call (jot a note, logged as a phone call), Email
// (opens the composer), an "I've already emailed" shortcut in the chevron menu,
// and "Not required" (parks the side till Monday). The photo + address is a link
// to the file.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { ComposeEmailModal } from "@/components/compose/ComposeEmailModal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { extractFirstName } from "@/lib/contacts/displayName";
import { markSideNotRequiredThisWeek, logSideCall, logSideEmailed } from "@/app/actions/weekly-touch";
import type { WeeklyTouchSide } from "@/lib/services/hub";

export type WeeklyTouchFileView = {
  transactionId: string;
  addressLine: string;
  townPostcode: string;
  photoUrl: string | null;
  sides: WeeklyTouchSide[];
  anyQuiet: boolean;
};

const ENV = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
const PHONE = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const TICK = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1F8A4A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;

export function WeeklyTouchCard({ files, totalSides, doneSides }: { files: WeeklyTouchFileView[]; totalSides: number; doneSides: number }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [resolved, setResolved] = useState<Set<string>>(new Set()); // "txId:side" hidden optimistically
  const [composeTx, setComposeTx] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState<string | null>(null); // "txId:side"
  const [emenuOpen, setEmenuOpen] = useState<string | null>(null);
  const menuWrapRef = useRef<HTMLSpanElement>(null);

  // Close the chevron menu on click-outside / Escape (not on mouse-leave — that
  // killed it as the cursor crossed the gap toward an option).
  useEffect(() => {
    if (!emenuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) setEmenuOpen(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setEmenuOpen(null); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [emenuOpen]);

  const key = (tx: string, side: string) => `${tx}:${side}`;
  const localDone = doneSides + resolved.size;
  const pct = totalSides ? Math.round((localDone / totalSides) * 100) : 100;
  const left = Math.max(0, totalSides - localDone);
  const today = Math.min(left, Math.ceil(totalSides / 5));

  function resolve(tx: string, side: string, msg: string, action: () => Promise<unknown>) {
    setResolved((p) => new Set([...p, key(tx, side)]));
    setCallOpen(null); setEmenuOpen(null);
    toast.success(msg);
    startTransition(async () => { await action().catch(() => {}); router.refresh(); });
  }

  const visibleFiles = files
    .map((f) => ({ ...f, sides: f.sides.filter((s) => !resolved.has(key(f.transactionId, s.side))) }))
    .filter((f) => f.sides.length > 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="wtc">
        <div className="wtc-hd">
          <div className="wtc-hd-top">
            <span className="wtc-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></span>
            <div style={{ minWidth: 0 }}><h3>Keep every file moving</h3><p className="wtc-sub">Touch both sides of every file each week.</p></div>
            <div className="wtc-today"><div className="n">{today}</div><div className="l">sides today</div></div>
          </div>
          <div className="wtc-bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="wtc-barlbl"><span><b>{localDone}</b> of {totalSides} sides moved this week</span><span>{left ? `${left} to go` : "all done"}</span></div>
        </div>

        {visibleFiles.length === 0 ? (
          <div className="wtc-done">
            <div className="wtc-tickbox">{TICK}</div>
            <h4>Both sides of every file touched</h4>
            <p>Nice. It resets Monday.</p>
          </div>
        ) : (
          visibleFiles.map((f) => (
            <div className="wtc-prop" key={f.transactionId}>
              <button type="button" className="wtc-ph" onClick={() => router.push(`/agent/transactions/${f.transactionId}`)}>
                <PropertyThumb photoUrl={f.photoUrl} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div className="wtc-addr">{f.addressLine}</div>
                  <div className="wtc-loc">{f.townPostcode}</div>
                </div>
              </button>
              {f.sides.map((s) => {
                const k = key(f.transactionId, s.side);
                const label = s.side === "vendor" ? "Seller" : "Buyer";
                const names = s.contacts.length ? s.contacts.map((c) => c.name).join(" & ") : s.name;
                return (
                  <div className={`wtc-side ${s.side}`} key={s.side} style={emenuOpen === k ? { zIndex: 60 } : undefined}>
                    <span className="wtc-id">
                      <span className="wtc-avs">
                        {(s.contacts.length ? s.contacts : [{ id: s.primaryContactId, name: s.name }]).map((c) => (
                          <span className="wtc-av" key={c.id}><ContactAvatar contact={{ name: c.name, roleType: s.side }} size={26} /></span>
                        ))}
                      </span>
                      <span className="wtc-idtext">
                        <span className="wtc-names" title={names}>{names}</span>
                        <span className="wtc-role">{label}</span>
                      </span>
                    </span>
                    <Pill glass tone={s.quiet ? "warning" : "muted"} size="sm" style={{ flexShrink: 0 }}>
                      {s.quiet ? (s.daysSince != null ? `Quiet ${s.daysSince} days` : "Never contacted") : "Not touched"}
                    </Pill>
                    <span className="wtc-sp" />
                    {callOpen === k ? (
                      <CallForm who={s.name} onSave={(note) => resolve(f.transactionId, s.side, `${label} · call logged`, () => logSideCall(f.transactionId, s.side as "vendor" | "purchaser", s.contactIds, note))} onCancel={() => setCallOpen(null)} />
                    ) : (
                      <span className="wtc-acts">
                        <span className="wtc-split" ref={emenuOpen === k ? menuWrapRef : undefined}>
                          <button className="m" onClick={() => setComposeTx(f.transactionId)}>{ENV} Email</button>
                          <button className="c" aria-label="Email options" onClick={(e) => { e.stopPropagation(); setEmenuOpen(emenuOpen === k ? null : k); }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                          {emenuOpen === k && (
                            <div className="wtc-emenu">
                              <button onClick={() => resolve(f.transactionId, s.side, `${label} · emailed (logged)`, () => logSideEmailed(f.transactionId, s.side as "vendor" | "purchaser", s.contactIds))}>
                                <span className="mic">{ENV}</span><span><span className="ml">I&rsquo;ve already emailed</span><span className="ms">Sent it elsewhere, just log it</span></span>
                              </button>
                            </div>
                          )}
                        </span>
                        <button className="wtc-ib" title="Log a call" onClick={() => { setCallOpen(k); setEmenuOpen(null); }}>{PHONE}</button>
                        <button className="wtc-nr" onClick={() => resolve(f.transactionId, s.side, `${label} · parked this week`, () => markSideNotRequiredThisWeek(f.transactionId, s.side as "vendor" | "purchaser"))}>Not required</button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <ComposeEmailModal open={!!composeTx} initialTransactionId={composeTx} onClose={() => { setComposeTx(null); router.refresh(); }} />
    </>
  );
}

function CallForm({ who, onSave, onCancel }: { who: string; onSave: (note: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [v, setV] = useState("");
  return (
    <span className="wtc-callform">
      <input ref={ref} autoFocus value={v} placeholder="What happened on the call?" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onSave(v); if (e.key === "Escape") onCancel(); }} />
      <span className="wtc-withp">with <b>{extractFirstName(who)}</b></span>
      <button className="wtc-sv" onClick={() => onSave(v)}>Save</button>
      <button className="wtc-cx" aria-label="Cancel" onClick={onCancel}>✕</button>
    </span>
  );
}

const CSS = `
.wtc{background:var(--agent-surface-elevated,#fff);border:1px solid var(--agent-border-default);border-radius:16px;overflow:visible;box-shadow:0 1px 2px rgba(45,24,16,0.03),0 8px 26px rgba(45,24,16,0.05)}
.wtc-hd{padding:15px 16px 14px;border-bottom:1px solid var(--agent-border-subtle)}
.wtc-hd-top{display:flex;align-items:center;gap:10px}
.wtc-ic{display:grid;place-items:center;color:var(--agent-coral-deep);flex-shrink:0}
.wtc-hd h3{margin:0;font-size:14.5px;font-weight:680;letter-spacing:-0.01em;color:var(--agent-text-primary)}
.wtc-sub{margin:1px 0 0;font-size:11.5px;color:var(--agent-text-muted)}
.wtc-today{margin-left:auto;text-align:right;flex-shrink:0}
.wtc-today .n{font-size:17px;font-weight:760;color:var(--agent-coral-deep);line-height:1;font-variant-numeric:tabular-nums}
.wtc-today .l{font-size:10px;color:var(--agent-text-muted);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-top:2px}
.wtc-bar{margin-top:12px;height:8px;border-radius:99px;background:rgba(45,24,16,0.07);overflow:hidden}
.wtc-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--agent-coral-deep),var(--agent-coral-light));transition:width .5s cubic-bezier(.16,1,.3,1)}
.wtc-barlbl{display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--agent-text-muted)}
.wtc-barlbl b{color:var(--agent-text-primary);font-weight:650}
.wtc-prop{border-top:1px solid var(--agent-border-subtle);padding:11px 14px 12px}
.wtc-ph{display:flex;align-items:center;gap:10px;margin-bottom:9px;width:100%;border:none;background:none;padding:0;cursor:pointer;font-family:inherit;text-align:left}
.wtc-addr{font-size:13px;font-weight:650;color:var(--agent-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .13s}
.wtc-loc{font-size:11px;color:var(--agent-text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wtc-ph:hover .wtc-addr{color:var(--agent-coral-deep)}
.wtc-side{display:flex;align-items:center;gap:9px;padding:6px 8px 6px 10px;border-radius:9px;margin-left:48px;position:relative;min-height:44px}
.wtc-side + .wtc-side{margin-top:4px}
.wtc-id{display:inline-flex;align-items:center;gap:9px;min-width:0;flex:1}
.wtc-avs{display:inline-flex;align-items:center;flex-shrink:0}
.wtc-av{display:inline-flex;border-radius:50%;box-shadow:0 0 0 2px var(--agent-surface-elevated,#fff)}
.wtc-av + .wtc-av{margin-left:-13px}
.wtc-idtext{display:flex;flex-direction:column;min-width:0}
.wtc-names{font-size:12.5px;font-weight:650;color:var(--agent-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25}
.wtc-role{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;line-height:1.2;margin-top:1px}
.wtc-side.vendor .wtc-role{color:#0C447C}
.wtc-side.purchaser .wtc-role{color:#085041}
.wtc-sp{flex:0 1 8px;min-width:0}
.wtc-acts{display:flex;align-items:center;gap:5px;flex-shrink:0}
.wtc-split{display:inline-flex;align-items:stretch;border:1px solid var(--agent-border-default);border-radius:8px;overflow:visible;background:#fff;position:relative;transition:border-color .13s,box-shadow .13s,transform .13s}
.wtc-split:hover{border-color:var(--agent-coral);box-shadow:0 3px 10px rgba(45,24,16,0.10);transform:translateY(-1px)}
.wtc-split .m{border:none;background:none;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:600;color:var(--agent-text-secondary);padding:0 9px;height:28px;display:inline-flex;align-items:center;gap:5px;border-radius:7px 0 0 7px}
.wtc-split .m:hover{color:var(--agent-coral-deep)}
.wtc-split .c{border:none;border-left:1px solid var(--agent-border-default);background:none;cursor:pointer;color:var(--agent-text-muted);width:24px;display:grid;place-items:center}
.wtc-split .c:hover{color:var(--agent-coral-deep)}
.wtc-split svg{display:block}
.wtc-emenu{position:absolute;top:34px;right:0;z-index:70;width:224px;background:#fff;border:1px solid var(--agent-border-default);border-radius:11px;padding:5px;box-shadow:0 14px 40px rgba(45,24,16,0.17)}
.wtc-emenu button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:none;background:none;cursor:pointer;padding:8px 9px;border-radius:9px;font-family:inherit;transition:background .13s,transform .13s,box-shadow .13s}
.wtc-emenu button:hover{background:rgba(45,24,16,0.03);transform:translateY(-1px);box-shadow:0 3px 10px rgba(45,24,16,0.10)}
.wtc-emenu .mic{display:grid;place-items:center;color:var(--agent-coral-deep);flex-shrink:0}
.wtc-emenu .mic svg{width:18px;height:18px}
.wtc-emenu .ml{display:block;font-size:12.5px;font-weight:600;color:var(--agent-text-primary)}
.wtc-emenu .ms{display:block;font-size:10.5px;color:var(--agent-text-muted);margin-top:1px}
.wtc-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--agent-border-default);background:#fff;cursor:pointer;display:grid;place-items:center;color:var(--agent-text-secondary);transition:background .13s,transform .13s,box-shadow .13s,border-color .13s,color .13s}
.wtc-ib:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(45,24,16,0.10);border-color:var(--agent-coral);color:var(--agent-coral-deep)}
.wtc-ib svg{display:block}
.wtc-nr{border:none;background:none;cursor:pointer;font-family:inherit;font-size:10.5px;font-weight:600;color:var(--agent-text-muted);padding:5px 3px;white-space:nowrap;transition:color .13s}
.wtc-nr:hover{color:var(--agent-text-secondary)}
.wtc-callform{display:flex;align-items:center;gap:7px;flex:1;min-width:0}
.wtc-callform input{flex:1;min-width:0;height:28px;border:1px solid var(--agent-coral-deep);border-radius:8px;padding:0 9px;font-family:inherit;font-size:12px;color:var(--agent-text-primary);outline:none;background:#fff}
.wtc-withp{font-size:10.5px;color:var(--agent-text-muted);white-space:nowrap}
.wtc-withp b{color:var(--agent-text-primary);font-weight:650}
.wtc-sv{border:none;background:var(--agent-coral-deep);color:#fff;border-radius:8px;height:28px;padding:0 11px;font-family:inherit;font-size:11.5px;font-weight:650;cursor:pointer}
.wtc-cx{border:none;background:none;color:var(--agent-text-muted);cursor:pointer;font-size:14px;padding:0 2px}
.wtc-done{padding:28px 20px;text-align:center}
.wtc-tickbox{width:44px;height:44px;border-radius:50%;background:rgba(31,138,74,0.12);display:grid;place-items:center;margin:0 auto 11px}
.wtc-done h4{margin:0 0 3px;font-size:14px;font-weight:700;color:var(--agent-success,#1F8A4A)}
.wtc-done p{margin:0;font-size:12px;color:var(--agent-text-muted)}
@media(max-width:480px){.wtc-side{flex-wrap:wrap}.wtc-sp{flex-basis:100%;height:0;order:5}.wtc-acts{margin-left:0;order:6}}
`;
