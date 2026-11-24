"use client";

// /dev/log-update-v2 — proposed rebuild of the "Log an update" modal. One clean
// screen with progressive reveal: write what happened (or dictate), pick how it
// was communicated, and for a comm add direction + who it was with, then
// optionally share it to the client portal. Solid TSP surfaces (no faded-white
// slop), everything animates in. Fully interactive mock, no backend.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ContactAvatar } from "@/components/ui/Avatar";
import { AnchoredPanel } from "@/components/ui/Popover";
import { NotePencil, Phone, EnvelopeSimple, WhatsappLogo, ChatText, Package, Voicemail, Microphone, Sparkle, CaretDown, X, Check, DotsThree, Stop } from "@phosphor-icons/react";

// ── mock data ────────────────────────────────────────────────────────────────
const PROPERTY = { line1: "21 Mandelyns", location: "Northchurch, Berkhamsted, HP4 3XH" };
type C = { id: string; name: string; roleType: "vendor" | "purchaser" };
const SELLERS: C[] = [
  { id: "s1", name: "Mary Parsons", roleType: "vendor" },
  { id: "s2", name: "Nick Parsons", roleType: "vendor" },
  { id: "s3", name: "Zain Jarral", roleType: "vendor" },
];
const BUYERS: C[] = [
  { id: "b1", name: "Oliver Fradgley", roleType: "purchaser" },
  { id: "b2", name: "Candice Fradgley", roleType: "purchaser" },
  { id: "b3", name: "Michael Atkins", roleType: "purchaser" },
];
const ALL = [...SELLERS, ...BUYERS];
const first = (n: string) => n.split(" ")[0];

type Method = "note" | "call" | "email" | "whatsapp" | "sms" | "post" | "voicemail";
const METHODS: { key: Method; label: string; icon: ReactNode }[] = [
  { key: "note", label: "Note", icon: <NotePencil size={15} /> },
  { key: "call", label: "Call", icon: <Phone size={15} /> },
  { key: "email", label: "Email", icon: <EnvelopeSimple size={15} /> },
  { key: "whatsapp", label: "WhatsApp", icon: <WhatsappLogo size={15} /> },
];
const MORE: { key: Method; label: string; icon: ReactNode }[] = [
  { key: "sms", label: "Text (SMS)", icon: <ChatText size={16} /> },
  { key: "post", label: "Post", icon: <Package size={16} /> },
  { key: "voicemail", label: "Voicemail", icon: <Voicemail size={16} /> },
];
const methodWord = (m: Method) => (m === "call" ? "call" : m === "email" ? "email" : m === "whatsapp" ? "WhatsApp" : m === "sms" ? "text" : m === "post" ? "letter" : m === "voicemail" ? "voicemail" : "update");

// ── small atoms ──────────────────────────────────────────────────────────────
function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 8 }}>{children}</div>;
}
function Reveal({ children }: { children: ReactNode }) {
  return <div className="lu-reveal">{children}</div>;
}

// ── the modal ────────────────────────────────────────────────────────────────
function LogUpdate() {
  const [method, setMethod] = useState<Method>("note");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [who, setWho] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const [share, setShare] = useState(false);
  const [sides, setSides] = useState({ seller: true, buyer: false });
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const whoRef = useRef<HTMLDivElement>(null);
  const moreWrapRef = useRef<HTMLDivElement>(null);

  const isComm = method !== "note";

  // dictation timer
  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);
  function toggleRec() {
    if (rec) {
      setRec(false);
      setContent((c) => (c ? c + " " : "") + "Spoke to the buyer's solicitor this morning. They've received the enquiries and expect to respond by Friday.");
    } else {
      setSecs(0);
      setRec(true);
    }
  }
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const selected = ALL.filter((c) => who.includes(c.id));
  const activeMore = MORE.find((m) => m.key === method);

  return (
    <div style={{ width: "min(560px, 100%)", background: "var(--agent-surface)", borderRadius: 18, border: "0.5px solid var(--agent-border-default)", boxShadow: "0 24px 70px -20px rgba(0,0,0,0.35)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px" }}>
        <h2 style={{ flex: 1, margin: 0, fontSize: 16.5, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>Log an update</h2>
        <button type="button" className="agent-icon-btn agent-icon-btn-sm" aria-label="Close"><X size={15} weight="bold" /></button>
      </div>

      <div style={{ padding: "0 18px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* property tile */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 12, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)" }}>
          <PropertyThumb photoUrl={null} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--agent-text-primary)" }}>{PROPERTY.line1}</div>
            <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{PROPERTY.location}</div>
          </div>
          <button type="button" className="agent-icon-btn agent-icon-btn-sm" aria-label="Change property"><X size={13} weight="bold" /></button>
        </div>

        {/* what happened */}
        <div>
          <Label>What happened?</Label>
          <div className={`lu-field${rec ? " rec" : ""}`}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add an update, or tap the microphone to dictate…"
              rows={3}
              className="lu-ta"
            />
            <div className="lu-micwrap">
              {rec && (
                <span className="lu-rectag">
                  <span className="lu-wave">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.11}s` }} />)}</span>
                  Recording… {mmss}
                </span>
              )}
              <button type="button" onClick={toggleRec} className={`lu-mic${rec ? " on" : ""}`} aria-label={rec ? "Stop recording" : "Dictate"}>
                {rec ? <Stop size={14} weight="fill" /> : <Microphone size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* how communicated */}
        <div>
          <Label>How was it communicated?</Label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", position: "relative" }}>
            {METHODS.map((m) => (
              <MethodBtn key={m.key} active={method === m.key} onClick={() => { setMethod(m.key); setMoreOpen(false); }} icon={m.icon} label={m.label} />
            ))}
            <div ref={moreWrapRef} style={{ position: "relative" }}>
              <MethodBtn active={!!activeMore} onClick={() => setMoreOpen((v) => !v)} icon={activeMore ? activeMore.icon : <DotsThree size={16} weight="bold" />} label={activeMore ? activeMore.label : "More"} caret />
              <AnchoredPanel anchorRef={moreWrapRef} open={moreOpen} onClose={() => setMoreOpen(false)} placement="bottom-end" width={200} bare>
                {MORE.map((m) => (
                  <button key={m.key} type="button" className="ui-pop-pick" onClick={() => { setMethod(m.key); setMoreOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ display: "inline-flex" }}>{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </AnchoredPanel>
            </div>
          </div>
        </div>

        {/* comm-only: direction + who */}
        {isComm && (
          <Reveal>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label>Direction</Label>
                <DirectionSeg value={direction} onChange={setDirection} />
              </div>

              <div ref={whoRef} style={{ position: "relative" }}>
                <Label>Who was this {methodWord(method)} with?</Label>
                <button type="button" className="lu-whotrigger" onClick={() => setWhoOpen((v) => !v)}>
                  {selected.length === 0 ? (
                    <span style={{ color: "var(--agent-text-muted)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <ContactAvatar contact={{ name: "", roleType: "" }} size={18} /> Select contact(s)
                    </span>
                  ) : (
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {selected.map((c) => (
                        <span key={c.id} className="lu-chip">
                          <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={18} />
                          {first(c.name)}
                          <span className="lu-chipx" onClick={(e) => { e.stopPropagation(); setWho((w) => w.filter((x) => x !== c.id)); }}><X size={10} weight="bold" /></span>
                        </span>
                      ))}
                    </span>
                  )}
                  <CaretDown size={13} weight="bold" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                </button>

                <AnchoredPanel anchorRef={whoRef} open={whoOpen} onClose={() => setWhoOpen(false)} placement="bottom-start" matchWidth bare>
                  <div className="lu-pophead">
                    <span style={{ fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)" }}>Who was this {methodWord(method)} with?</span>
                    <button type="button" className="agent-icon-btn agent-icon-btn-sm" onClick={() => setWhoOpen(false)} aria-label="Close"><X size={13} weight="bold" /></button>
                  </div>
                  <div style={{ padding: "4px 6px 2px", overflowY: "auto", maxHeight: 280 }}>
                    {[{ label: "Seller's side", people: SELLERS }, { label: "Buyer's side", people: BUYERS }].map((grp) => (
                      <div key={grp.label} style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 650, color: "var(--agent-text-muted)", padding: "7px 8px 4px" }}>{grp.label}</div>
                        {grp.people.map((c) => {
                          const on = who.includes(c.id);
                          return (
                            <button key={c.id} type="button" className="lu-pickrow" onClick={() => setWho((w) => (on ? w.filter((x) => x !== c.id) : [...w, c.id]))}>
                              <span className={`lu-cbx${on ? " on" : ""}`}>{on && <Check size={11} weight="bold" />}</span>
                              <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={26} />
                              <span style={{ fontSize: 13, color: "var(--agent-text-primary)" }}>{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 8, borderTop: "0.5px solid var(--agent-border-subtle)" }}>
                    <button type="button" className="agent-btn agent-btn-sm agent-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setWhoOpen(false)}>
                      Done{who.length ? ` · ${who.length} selected` : ""}
                    </button>
                  </div>
                </AnchoredPanel>
              </div>
            </div>
          </Reveal>
        )}

        {/* share */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
            <button type="button" role="switch" aria-checked={share} className={`lu-switch${share ? " on" : ""}`} onClick={() => setShare((v) => !v)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Share with clients</div>
              <div style={{ fontSize: 12, color: "var(--agent-text-muted)", marginTop: 1 }}>{share ? "Choose who can see this update in their portal." : "Only your team can see this update."}</div>
            </div>
          </div>
          {share && (
            <Reveal>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {[{ key: "seller" as const, label: "Seller's side", people: SELLERS }, { key: "buyer" as const, label: "Buyer's side", people: BUYERS }].map((grp) => {
                  const on = sides[grp.key];
                  return (
                    <button key={grp.key} type="button" className={`lu-sidecard lu-${grp.key}${on ? " on" : ""}`} onClick={() => setSides((s) => ({ ...s, [grp.key]: !s[grp.key] }))}>
                      <span className="lu-cbx">{on && <Check size={11} weight="bold" />}</span>
                      <span style={{ display: "flex", marginLeft: 2 }}>
                        {grp.people.slice(0, 3).map((c, i) => (
                          <span key={c.id} style={{ marginLeft: i ? -8 : 0, borderRadius: 999, boxShadow: `0 0 0 2px ${on ? "rgba(255,255,255,.9)" : "var(--agent-surface)"}`, lineHeight: 0, transition: "box-shadow .15s" }}>
                            <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={24} />
                          </span>
                        ))}
                      </span>
                      <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: on ? "#fff" : "var(--agent-text-primary)" }}>{grp.label}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: on ? "rgba(255,255,255,.82)" : "var(--agent-text-muted)" }}>{grp.people.map((c) => first(c.name)).join(" and ")}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Reveal>
          )}
        </div>
      </div>

      {/* footer */}
      <div style={{ display: "flex", gap: 10, padding: "14px 18px", borderTop: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface)" }}>
        <button type="button" className="agent-btn agent-btn-md agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Sparkle size={15} weight="fill" style={{ color: "var(--agent-coral-deep)" }} /> Draft client updates
        </button>
        <button type="button" className="agent-btn agent-btn-md agent-btn-primary" style={{ flex: 1, justifyContent: "center" }}>Save update</button>
      </div>
    </div>
  );
}

function DirectionSeg({ value, onChange }: { value: "outbound" | "inbound"; onChange: (v: "outbound" | "inbound") => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-v="${value}"]`) as HTMLElement | null;
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);
  return (
    <div ref={ref} className="lu-seg" style={{ position: "relative" }}>
      {thumb && <span className="lu-segthumb" style={{ left: thumb.left, width: thumb.width }} />}
      {(["outbound", "inbound"] as const).map((v) => (
        <button key={v} type="button" data-v={v} className={value === v ? "on" : ""} onClick={() => onChange(v)} style={{ position: "relative", zIndex: 1 }}>
          {v === "outbound" ? "Outbound (made)" : "Inbound (received)"}
        </button>
      ))}
    </div>
  );
}

function MethodBtn({ active, onClick, icon, label, caret }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; caret?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`lu-method${active ? " on" : ""}`}>
      <span style={{ display: "inline-flex" }}>{icon}</span>
      {label}
      {caret && <CaretDown size={11} weight="bold" style={{ opacity: 0.7 }} />}
    </button>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} style={{ padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? "var(--agent-coral)" : "var(--agent-border-default)"}`, background: active ? "var(--agent-coral-bg-tint)" : "var(--agent-surface-elevated)", color: active ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)" }}>{children}</button>;
}

export default function Page() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "custom";
    return () => { document.documentElement.dataset.theme = "custom"; };
  }, [dark]);

  return (
    <div style={{ minHeight: "100vh", padding: "28px 20px 80px", position: "relative", zIndex: 1 }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 620, margin: "0 auto 20px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: "0 0 4px" }}>Log an update — rebuild</h1>
        <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
          One clean screen. Pick a method (Note / Call / Email / WhatsApp / More), and for a comm it reveals Direction + Who. Toggle Share to choose portal visibility. Dictation, the Who-picker and the More menu are all live. Solid surfaces, no faded slop.
        </p>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--agent-text-muted)", marginRight: 4 }}>Theme</span>
          <SegBtn active={!dark} onClick={() => setDark(false)}>Light</SegBtn>
          <SegBtn active={dark} onClick={() => setDark(true)}>Dark</SegBtn>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <LogUpdate />
      </div>
    </div>
  );
}

const CSS = `
@keyframes lu-reveal { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
.lu-reveal { animation: lu-reveal .22s cubic-bezier(.22,1,.36,1) both; }
@keyframes lu-pop { from { opacity:0; transform:translateY(-6px) scale(.98); } to { opacity:1; transform:none; } }

.lu-field { position:relative; border:1px solid var(--agent-border-default); border-radius:11px; background:var(--agent-surface-elevated); transition:border-color .16s, box-shadow .16s; }
.lu-field:focus-within { border-color:var(--agent-coral-deep); }
.lu-field.rec { border-color:var(--agent-coral-deep); box-shadow:0 0 0 3px rgba(var(--agent-coral-rgb),.12); }
.lu-ta { width:100%; box-sizing:border-box; border:0; background:transparent; resize:vertical; padding:11px 48px 11px 13px; font:inherit; font-size:13.5px; line-height:1.55; color:var(--agent-text-primary); outline:none; min-height:72px; }
.lu-ta::placeholder { color:var(--agent-text-muted); }
.lu-micwrap { position:absolute; right:9px; bottom:9px; display:flex; align-items:center; gap:8px; }
.lu-rectag { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--agent-coral-deep); }
.lu-wave { display:inline-flex; align-items:center; gap:2px; height:15px; }
.lu-wave span { width:2.5px; height:30%; border-radius:999px; background:var(--agent-coral-deep); animation:lu-wav .9s ease-in-out infinite; }
@keyframes lu-wav { 0%,100%{height:28%} 50%{height:100%} }
.lu-mic { width:32px; height:32px; border-radius:999px; display:grid; place-items:center; cursor:pointer; border:1px solid var(--agent-border-default); background:var(--agent-surface); color:var(--agent-text-secondary); transition:all .15s; }
.lu-mic:hover { border-color:var(--agent-coral); color:var(--agent-coral-deep); }
.lu-mic.on { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); color:#fff; }

.lu-method { display:inline-flex; align-items:center; gap:6px; font:inherit; font-size:12.5px; font-weight:600; padding:7px 12px; border-radius:9px; cursor:pointer; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated); color:var(--agent-text-secondary); transition:all .15s; }
.lu-method:hover { border-color:var(--agent-coral); color:var(--agent-text-primary); }
.lu-method.on { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); color:#fff; box-shadow:0 2px 8px rgba(var(--agent-coral-rgb),.28); }

.lu-menu { position:absolute; top:calc(100% + 6px); right:0; min-width:180px; background:var(--agent-surface-elevated); border:0.5px solid var(--agent-border-default); border-radius:11px; box-shadow:0 12px 30px rgba(0,0,0,.16); padding:5px; animation:lu-pop .14s ease both; }
.lu-menuitem { display:flex; align-items:center; gap:10px; width:100%; padding:9px 10px; border:0; border-radius:8px; background:transparent; font:inherit; font-size:13px; font-weight:550; color:var(--agent-text-primary); cursor:pointer; text-align:left; transition:background .12s; }
.lu-menuitem:hover { background:var(--agent-hover-shade); }

.lu-seg { display:inline-flex; gap:3px; padding:3px; border-radius:10px; background:var(--agent-surface-nested, rgba(15,23,42,.05)); border:1px solid var(--agent-border-subtle); }
.lu-seg button { border:0; background:transparent; font:inherit; font-size:12.5px; font-weight:600; color:var(--agent-text-muted); padding:6px 13px; border-radius:7px; cursor:pointer; transition:all .15s; }
.lu-seg button.on { color:#fff; }
.lu-seg button:hover:not(.on) { color:var(--agent-text-primary); }
.lu-segthumb { position:absolute; top:3px; bottom:3px; border-radius:7px; background:var(--agent-coral-deep); box-shadow:0 1px 3px rgba(var(--agent-coral-rgb),.3); transition:left .24s cubic-bezier(.4,0,.2,1), width .24s cubic-bezier(.4,0,.2,1); z-index:0; }

.lu-whotrigger { display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; min-height:42px; padding:7px 11px; border-radius:11px; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated); font:inherit; font-size:13px; cursor:pointer; text-align:left; transition:border-color .15s; }
.lu-whotrigger:hover { border-color:var(--agent-border-strong); }
.lu-chip { display:inline-flex; align-items:center; gap:6px; padding:3px 7px 3px 4px; border-radius:999px; background:var(--agent-surface); border:1px solid var(--agent-border-default); font-size:12.5px; font-weight:600; color:var(--agent-text-primary); }
.lu-chipx { display:inline-flex; width:16px; height:16px; border-radius:999px; align-items:center; justify-content:center; color:var(--agent-text-muted); transition:background .12s,color .12s; }
.lu-chipx:hover { background:var(--agent-hover-shade); color:var(--agent-text-primary); }

.lu-pop { position:absolute; top:calc(100% + 8px); left:0; right:0; z-index:5; background:var(--agent-surface-elevated); border:0.5px solid var(--agent-border-default); border-radius:14px; box-shadow:0 16px 40px rgba(0,0,0,.2); overflow:hidden; animation:lu-pop .16s ease both; }
.lu-pophead { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 12px 10px; border-bottom:0.5px solid var(--agent-border-subtle); }
.lu-pickrow { display:flex; align-items:center; gap:10px; width:100%; padding:7px 8px; border:0; border-radius:9px; background:transparent; font:inherit; cursor:pointer; text-align:left; transition:background .12s; }
.lu-pickrow:hover { background:var(--agent-hover-shade); }
.lu-cbx { width:19px; height:19px; border-radius:6px; border:1.5px solid var(--agent-border-strong); display:grid; place-items:center; color:#fff; flex:0 0 auto; transition:all .14s; }
.lu-cbx.on { background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); }

.lu-switch { position:relative; width:38px; height:22px; flex:0 0 auto; border-radius:999px; border:0; cursor:pointer; background:var(--agent-border-strong); transition:background .18s; padding:0; margin-top:1px; }
.lu-switch.on { background:var(--agent-coral-deep); }
.lu-switch::after { content:""; position:absolute; top:2.5px; left:2.5px; width:17px; height:17px; border-radius:999px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.25); transition:transform .18s; }
.lu-switch.on::after { transform:translateX(16px); }

.lu-sidecard { display:flex; align-items:center; gap:11px; width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--agent-border-default); background:transparent; cursor:pointer; font:inherit; transition:border-color .15s, background .15s, box-shadow .15s; }
.lu-sidecard:hover { border-color:var(--agent-coral); }
.lu-sidecard.lu-seller.on { background:linear-gradient(180deg,#2E6DB4,#0C447C); border-color:#0C447C; box-shadow:0 8px 18px -8px rgba(12,68,124,.5); }
.lu-sidecard.lu-buyer.on { background:linear-gradient(180deg,#1E9273,#085041); border-color:#085041; box-shadow:0 8px 18px -8px rgba(8,80,65,.5); }
.lu-sidecard.on .lu-cbx { background:#fff; border-color:#fff; }
.lu-sidecard.lu-seller.on .lu-cbx { color:#0C447C; }
.lu-sidecard.lu-buyer.on .lu-cbx { color:#085041; }
`;
