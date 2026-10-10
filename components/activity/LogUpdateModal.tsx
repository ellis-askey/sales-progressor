"use client";

// The unified "Log an update" surface (docs/active/log-an-update/SPEC.md). One
// button opens a centred modal (desktop) / up-sliding drawer (tablet+mobile)
// that does everything the old CommsEntry composer did — Draft for everyone,
// log a comm, paste a WhatsApp chat, and add a note — reusing the exact same
// panels + actions. The record → review flow lands in Phase 3; its button is
// deliberately absent until it's real (no dead controls).

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { DraftForEveryonePanel } from "./DraftForEveryonePanel";
import { PasteWhatsAppPanel, type ImportableContact } from "./PasteWhatsAppPanel";
import { VoiceNotePanel } from "./VoiceNotePanel";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { logCommAction } from "@/app/actions/comms";
import { ContactAvatar } from "@/components/ui/Avatar";
import { extractFirstName } from "@/lib/contacts/displayName";
import type { CommType, CommMethod } from "@prisma/client";

type Contact = { id: string; name: string; roleType: string; phone?: string | null };
type Solicitor = { id: string; name: string; role: string; phone?: string | null };

type Props = {
  transactionId: string;
  contacts: Contact[];
  solicitors?: Solicitor[];
  canPasteChat?: boolean;
  emailConnected?: boolean;
  canMarkPrivate?: boolean;
  onOptimisticAdd?: (type: CommType, method: CommMethod | null, content: string, contactIds: string[]) => void;
};

type Screen = "home" | "draft" | "record" | "whatsapp" | "log" | "note";
type LogChannel = "email" | "phone" | "sms" | "voicemail" | "post";

type LogItem = { key: LogChannel | "note" | "whatsapp"; title: string; sub: string; icon: string };

// Phosphor-ish stroke icon paths (no emoji markers).
const IC = {
  email: '<path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
  phone: '<path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  sms: '<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/>',
  voicemail: '<circle cx="6.5" cy="13" r="3.5"/><circle cx="17.5" cy="13" r="3.5"/><path d="M6.5 16.5h11"/>',
  post: '<path d="M3 7h18v12H3zM3 7l9 6 9-6"/>',
  whatsapp: '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><path d="M8.5 8.5c0 4 3 7 7 7"/>',
  note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  sparkle: '<path d="M12 3l1.9 4.7L19 9l-4.3 2.9L15.8 17 12 14.2 8.2 17l1.1-5.1L5 9l5.1-1.3z"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
};
function svg(path: string, size = 18, sw = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export function LogUpdateModal(props: Props) {
  const { transactionId, contacts, solicitors = [], canPasteChat, emailConnected, canMarkPrivate, onOptimisticAdd } = props;

  const { toast } = useAgentToast();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [channel, setChannel] = useState<LogChannel>("phone");
  const [moreOpen, setMoreOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // log/note form state
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [share, setShare] = useState(false);
  const [priv, setPriv] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function openModal() { resetForm(); setScreen("home"); setMoreOpen(false); setClosing(false); setOpen(true); }
  // Animate out (reverse of the entry), then unmount on animationend.
  function close() { if (closing) return; setMoreOpen(false); setClosing(true); }
  function reallyClose() { setOpen(false); setClosing(false); }
  function goHome() { setMoreOpen(false); setScreen("home"); }
  function resetForm() { setDirection("outbound"); setSelected([]); setContent(""); setShare(false); setPriv(true); setErr(null); }

  const whatsappContacts: ImportableContact[] = [
    ...contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, roleLabel: c.roleType === "vendor" ? "Vendor" : c.roleType === "purchaser" ? "Purchaser" : "Contact" })),
    ...solicitors.map((s) => ({ id: s.id, name: s.name, phone: s.phone ?? null, roleLabel: s.role })),
  ];

  const LOG_ITEMS: LogItem[] = [
    ...(!emailConnected ? ([{ key: "email", title: "Log an email", sub: "One you sent or received", icon: IC.email }] as LogItem[]) : []),
    { key: "phone", title: "Log a call", sub: "A call you made or took", icon: IC.phone },
    { key: "sms", title: "Log a text", sub: "An SMS to a number", icon: IC.sms },
    { key: "note", title: "Add a note", sub: "Just for your team", icon: IC.note },
    { key: "post", title: "Log post", sub: "A letter sent or received", icon: IC.post },
    ...(canPasteChat ? ([{ key: "whatsapp", title: "Paste a WhatsApp chat", sub: "From outside the tracked chat", icon: IC.whatsapp }] as LogItem[]) : []),
    { key: "voicemail", title: "Log a voicemail", sub: "A message you left", icon: IC.voicemail },
  ];

  function pick(key: LogItem["key"]) {
    setMoreOpen(false);
    if (key === "whatsapp") { setScreen("whatsapp"); return; }
    if (key === "note") { resetForm(); setScreen("note"); return; }
    resetForm();
    setChannel(key);
    setScreen("log");
  }

  function toggleSel(id: string) {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function saveLog(isNote: boolean) {
    const text = content.trim();
    if (!text) { setErr("Add a short note of what was said."); return; }
    if (!isNote && selected.length === 0) { setErr("Pick who this was with."); return; }
    setSaving(true); setErr(null);
    const type: CommType = (isNote ? "internal_note" : direction === "outbound" ? "outbound" : "inbound") as CommType;
    const method: CommMethod | null = isNote ? null : (channel as CommMethod);
    try {
      await logCommAction({
        transactionId,
        type,
        method,
        contactIds: isNote ? [] : selected,
        content: text,
        visibleToClient: isNote ? false : share,
        businessOnly: isNote && canMarkPrivate ? priv : false,
      });
      onOptimisticAdd?.(type, method, text, isNote ? [] : selected);
      close();
    } catch {
      setErr("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const titles: Record<Screen, string> = { home: "Log an update", draft: "Updates for each side", record: "Record a note", whatsapp: "Paste a WhatsApp chat", log: titleForChannel(channel), note: "Add a note" };

  function finishVoice(s: { milestones: number; todos: number; sends: number; enquiry: boolean }) {
    close();
    const bits: string[] = [];
    if (s.sends) bits.push(`sent ${s.sends} update${s.sends === 1 ? "" : "s"}`);
    const fileCount = s.milestones + s.todos + (s.enquiry ? 1 : 0);
    if (fileCount) bits.push(`made ${fileCount} change${fileCount === 1 ? "" : "s"} to the file`);
    const sentence = bits.join(", ").replace(/^./, (c) => c.toUpperCase());
    toast.success(bits.length ? `${sentence}.` : "Saved to the file.");
  }

  const clients = contacts;

  return (
    <>
      {/* Styles live here (always mounted) so the trigger button is styled even
          when the modal is closed. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lum-launch">
        <button type="button" className="lum-trigger" onClick={openModal}>
          <span dangerouslySetInnerHTML={{ __html: svg(IC.sparkle, 16, 2) }} />
          Log an update
        </button>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div className="lum-ov" role="dialog" aria-modal="true" aria-label="Log an update" data-closing={closing ? "1" : undefined}>
          <div className="lum-bg" onClick={close} />
          <div className={"lum-sheet" + (closing ? " lum-closing" : "")} data-tall={moreOpen ? "1" : undefined} onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) reallyClose(); }}>
            <div className="lum-grab" />
            <div className="lum-head">
              {screen !== "home" && (
                <button className="lum-ic" onClick={goHome} aria-label="Back" dangerouslySetInnerHTML={{ __html: svg(IC.back, 16, 2.2) }} />
              )}
              <h2 className="lum-title">{titles[screen]}</h2>
              <button className="lum-ic lum-ic-x" onClick={close} aria-label="Close" dangerouslySetInnerHTML={{ __html: svg(IC.x, 15, 2.2) }} />
            </div>

            <div className="lum-body">
              {screen === "home" && (
                <div className="lum-fade">
                  <p className="lum-eyebrow">Tell your clients, or log what happened</p>
                  <div className="lum-rowwrap">
                    <div className="lum-row">
                      <button className="lum-btn lum-primary" onClick={() => setScreen("draft")}>
                        <span dangerouslySetInnerHTML={{ __html: svg(IC.sparkle, 15, 2) }} /> Draft for everyone
                      </button>
                      <button className="lum-btn lum-more" onClick={(e) => { e.stopPropagation(); setMoreOpen((v) => !v); }}>
                        <span dangerouslySetInnerHTML={{ __html: svg(IC.list, 15, 2) }} /> Log <span dangerouslySetInnerHTML={{ __html: svg(IC.chevron, 12, 2.4) }} />
                      </button>
                      <button className="lum-btn lum-record" onClick={() => setScreen("record")}>
                        <span className="lum-recava" dangerouslySetInnerHTML={{ __html: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>' }} />
                        <span className="lum-rectxt">Record it</span>
                      </button>
                    </div>
                    {moreOpen && (
                      <div className="lum-menu">
                        {LOG_ITEMS.map((it) => (
                          <button key={it.key} className="lum-mm" onClick={() => pick(it.key)}>
                            <span className="lum-mmic" dangerouslySetInnerHTML={{ __html: svg(it.icon, 18) }} />
                            <span><span className="lum-mmt">{it.title}</span><span className="lum-mms">{it.sub}</span></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="lum-help">Draft turns one sentence into the right update for each side and a file note. Nothing goes out until you send.</p>
                  <div className="lum-logsection">
                    <div className="lum-divider" />
                    <p className="lum-eyebrow">Or log something that's happened</p>
                    <div className="lum-grid">
                      {LOG_ITEMS.map((it) => (
                        <button key={it.key} className="lum-tile" onClick={() => pick(it.key)}>
                          <span className="lum-tileic" dangerouslySetInnerHTML={{ __html: svg(it.icon, 20) }} />
                          <span className="lum-tilet">{it.title}</span>
                          <span className="lum-tiles">{it.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {screen === "draft" && (
                <div className="lum-fade">
                  <DraftForEveryonePanel transactionId={transactionId} contacts={clients} onClose={close} />
                </div>
              )}

              {screen === "record" && (
                <VoiceNotePanel transactionId={transactionId} contacts={clients} onDone={finishVoice} />
              )}

              {screen === "whatsapp" && (
                <div className="lum-fade">
                  <PasteWhatsAppPanel transactionId={transactionId} contacts={whatsappContacts} onClose={goHome} />
                </div>
              )}

              {(screen === "log" || screen === "note") && (
                <div className="lum-fade">
                  {screen === "log" && (
                    <>
                      <p className="lum-eyebrow">Direction</p>
                      <div className="lum-seg">
                        <button aria-pressed={direction === "outbound"} onClick={() => setDirection("outbound")}>Outbound (sent)</button>
                        <button aria-pressed={direction === "inbound"} onClick={() => setDirection("inbound")}>Inbound (received)</button>
                      </div>
                      <p className="lum-eyebrow" style={{ marginTop: 18 }}>Who</p>
                      {clients.length > 0 && (
                        <div className="lum-pillgroup">
                          <span className="lum-grouplab">Clients</span>
                          <div className="lum-pills">
                            {clients.map((c) => (
                              <button key={c.id} className="lum-pill" aria-pressed={selected.includes(c.id)} onClick={() => toggleSel(c.id)}>
                                <span className="lum-av"><ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={22} /><span className="lum-chk" dangerouslySetInnerHTML={{ __html: svg('<path d="M20 6 9 17l-5-5"/>', 9, 3.2) }} /></span>
                                {extractFirstName(c.name)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {solicitors.length > 0 && (
                        <div className="lum-pillgroup">
                          <span className="lum-grouplab">Solicitors</span>
                          <div className="lum-pills">
                            {solicitors.map((s) => (
                              <button key={s.id} className="lum-pill" aria-pressed={selected.includes(s.id)} onClick={() => toggleSel(s.id)}>
                                <span className="lum-av"><ContactAvatar contact={{ name: s.name, roleType: "solicitor" }} sideTint={s.role === "Vendor solicitor" ? "vendor" : "purchaser"} size={22} /><span className="lum-chk" dangerouslySetInnerHTML={{ __html: svg('<path d="M20 6 9 17l-5-5"/>', 9, 3.2) }} /></span>
                                {s.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="lum-eyebrow" style={{ marginTop: 18 }}>What was said</p>
                    </>
                  )}
                  <textarea className="lum-ta" value={content} onChange={(e) => setContent(e.target.value)} placeholder={screen === "note" ? "Add an internal note…" : "What was discussed or communicated?"} rows={screen === "note" ? 4 : 3} />
                  {screen === "log" && (
                    <div className="lum-togline">
                      <button className="lum-sw" aria-pressed={share} onClick={() => setShare((v) => !v)} />
                      <span className="lum-swlab">{share ? "Visible in client portal" : "Share with client"}</span>
                    </div>
                  )}
                  {screen === "note" && canMarkPrivate && (
                    <div className="lum-togline">
                      <button className="lum-sw" aria-pressed={priv} onClick={() => setPriv((v) => !v)} />
                      <span className="lum-swlab">{priv ? "Private to your team" : "Visible to the agent"}</span>
                    </div>
                  )}
                  {err && <p className="lum-err">{err}</p>}
                  <div className="lum-sendbar">
                    <button className="lum-btn lum-primary lum-wide" disabled={saving} onClick={() => saveLog(screen === "note")}>
                      {saving ? "Saving…" : screen === "note" ? "Save note" : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function titleForChannel(c: LogChannel): string {
  return c === "email" ? "Log an email" : c === "phone" ? "Log a call" : c === "sms" ? "Log a text" : c === "voicemail" ? "Log a voicemail" : "Log post";
}

const CSS = `
.lum-ov { position:fixed; inset:0; z-index:60; font-family:var(--font-geist-sans, -apple-system, system-ui, sans-serif); }
.lum-bg { position:absolute; inset:0; background:rgba(45,24,16,.42); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); animation:lum-bgf .26s ease both; }
@keyframes lum-bgf { from { opacity:0 } to { opacity:1 } }
.lum-sheet { position:absolute; display:flex; flex-direction:column; overflow:hidden; background:linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.66)), var(--agent-bg-paper, #FFFBF5); border:1px solid rgba(255,255,255,.5); box-shadow:0 24px 70px -24px rgba(40,24,16,.5), 0 8px 24px rgba(45,24,16,.12); }
/* Desktop: centred modal */
.lum-sheet { top:50%; left:50%; width:min(600px, calc(100vw - 48px)); max-height:min(88vh,760px); border-radius:16px; transform:translate(-50%,-48%) scale(.97); opacity:0; animation:lum-in .3s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes lum-in { to { transform:translate(-50%,-50%) scale(1); opacity:1 } }
.lum-grab { display:none; }
/* Tablet + mobile: bottom drawer */
@media (max-width:1024px) {
  .lum-sheet { top:auto; left:0; right:0; bottom:0; width:100%; max-width:none; max-height:92vh; border-radius:18px 18px 0 0; transform:translateY(100%); opacity:1; animation:lum-up .36s cubic-bezier(.22,1,.36,1) forwards; transition:min-height .32s cubic-bezier(.22,1,.36,1); }
  @keyframes lum-up { to { transform:translateY(0) } }
  .lum-sheet[data-tall="1"] { min-height:76vh; }
  .lum-grab { display:block; width:40px; height:4px; border-radius:999px; background:var(--agent-border-strong, rgba(45,24,16,.18)); margin:9px auto 2px; }
}
.lum-head { display:flex; align-items:center; gap:10px; padding:16px 18px 12px; }
.lum-title { font-size:17px; font-weight:700; letter-spacing:-.01em; margin:0; flex:1; color:var(--agent-text-primary,#2D1810); }
.lum-ic { width:30px; height:30px; border-radius:999px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); background:rgba(255,255,255,.6); display:grid; place-items:center; cursor:pointer; color:var(--agent-text-secondary,#5A3A28); flex:0 0 auto; transition:background .14s, color .14s; }
.lum-ic:hover { background:#fff; color:var(--agent-text-primary,#2D1810); }
.lum-body { padding:4px 18px 20px; overflow-y:auto; }
@media (max-width:1024px) { .lum-body { padding-bottom:calc(20px + env(safe-area-inset-bottom)); } }
.lum-fade { animation:lum-fade .24s ease both; }
@keyframes lum-fade { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
.lum-eyebrow { font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin:0 0 10px; }
.lum-help { font-size:12px; color:var(--agent-text-muted,rgba(45,24,16,.55)); line-height:1.55; margin:12px 0 0; }
.lum-divider { height:1px; background:var(--agent-border-subtle,rgba(45,24,16,.06)); margin:20px 0; }
.lum-trigger { display:inline-flex; align-items:center; gap:9px; font:inherit; font-size:14px; font-weight:600; color:#fff; border:0; cursor:pointer; padding:11px 18px; border-radius:12px; background:linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%); box-shadow:0 2px 0 #C63E20, 0 6px 16px rgba(240,78,44,.30), inset 0 1px 0 rgba(255,255,255,.3); transition:filter .14s, transform .14s; }
.lum-trigger:hover { filter:brightness(1.04); } .lum-trigger:active { transform:translateY(1px); }
.lum-rowwrap { position:relative; }
.lum-row { display:flex; gap:9px; flex-wrap:wrap; }
.lum-btn { display:inline-flex; align-items:center; gap:8px; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; padding:10px 15px; border-radius:8px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); background:rgba(255,255,255,.6); color:var(--agent-text-primary,#2D1810); transition:all .14s; }
.lum-btn:hover { background:#fff; border-color:var(--agent-border-strong,rgba(45,24,16,.18)); }
.lum-primary { color:#fff; border-color:transparent; background:linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%); box-shadow:0 2px 0 #C63E20, 0 6px 16px rgba(240,78,44,.30), inset 0 1px 0 rgba(255,255,255,.3); }
.lum-primary:hover { filter:brightness(1.04); background:linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%); }
.lum-primary:disabled { opacity:.5; cursor:not-allowed; filter:none; }
.lum-wide { width:100%; justify-content:center; padding:13px; font-size:14.5px; }
.lum-more { display:none; }
@media (max-width:1024px) { .lum-more { display:inline-flex; } .lum-logsection { display:none; } }
.lum-menu { margin-top:10px; background:var(--agent-surface-elevated,#fff); border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; box-shadow:0 8px 24px rgba(45,24,16,.12); overflow:hidden; animation:lum-fade .18s ease both; }
.lum-mm { display:flex; align-items:center; gap:12px; width:100%; padding:12px 14px; border:0; background:transparent; font:inherit; text-align:left; cursor:pointer; border-bottom:1px solid var(--agent-border-subtle,rgba(45,24,16,.06)); }
.lum-mm:last-child { border-bottom:0; } .lum-mm:hover { background:var(--agent-coral-bg-tint,rgba(255,138,101,.08)); }
.lum-mmic { color:var(--agent-text-secondary,#5A3A28); display:grid; place-items:center; flex:0 0 auto; }
.lum-mmt { font-size:13.5px; font-weight:600; display:block; color:var(--agent-text-primary,#2D1810); } .lum-mms { font-size:11.5px; color:var(--agent-text-muted,rgba(45,24,16,.55)); }
.lum-grid { display:grid; grid-template-columns:repeat(12,1fr); gap:8px; }
.lum-grid .lum-tile:nth-child(-n+4) { grid-column:span 3; }
.lum-grid .lum-tile:nth-child(n+5) { grid-column:span 4; }
.lum-tile { display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:13px 12px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; background:rgba(255,255,255,.5); cursor:pointer; text-align:left; font:inherit; transition:all .14s; }
.lum-tile:hover { background:#fff; border-color:var(--agent-coral,#FF8A65); transform:translateY(-1px); box-shadow:0 4px 12px rgba(255,138,101,.12); }
.lum-tileic { color:var(--agent-text-secondary,#5A3A28); display:grid; place-items:center; }
.lum-tilet { font-size:12.5px; font-weight:600; line-height:1.25; color:var(--agent-text-primary,#2D1810); }
.lum-tiles { font-size:11px; color:var(--agent-text-muted,rgba(45,24,16,.55)); line-height:1.35; }
.lum-seg { display:inline-flex; background:rgba(255,255,255,.5); border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:999px; padding:3px; gap:2px; }
.lum-seg button { border:0; background:transparent; font:inherit; font-size:12.5px; font-weight:600; color:var(--agent-text-muted,rgba(45,24,16,.55)); padding:6px 13px; border-radius:999px; cursor:pointer; transition:all .16s; }
.lum-seg button[aria-pressed="true"] { background:#fff; color:var(--agent-text-primary,#2D1810); box-shadow:0 1px 3px rgba(0,0,0,.08); }
.lum-seg button:hover:not([aria-pressed="true"]) { color:var(--agent-text-primary,#2D1810); }
.lum-pillgroup { margin-top:10px; }
.lum-grouplab { display:block; font-size:12px; font-weight:600; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin-bottom:7px; }
.lum-pills { display:flex; gap:7px; flex-wrap:wrap; }
.lum-pill { display:inline-flex; align-items:center; gap:8px; font:inherit; font-size:12.5px; font-weight:600; padding:4px 13px 4px 4px; border-radius:999px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); background:#fff; color:var(--agent-text-primary,#2D1810); cursor:pointer; transition:border-color .14s, transform .14s, box-shadow .14s; }
.lum-pill:hover { border-color:var(--agent-coral-deep,#FF6B4A); }
.lum-pill[aria-pressed="true"] { border-color:var(--agent-coral-deep,#FF6B4A); transform:translateY(-1px); box-shadow:0 3px 10px rgba(255,138,101,.2); }
.lum-av { position:relative; display:grid; place-items:center; flex:0 0 auto; }
.lum-chk { position:absolute; right:-4px; bottom:-4px; width:14px; height:14px; border-radius:999px; background:var(--agent-coral-deep,#FF6B4A); border:1.5px solid #fff; display:grid; place-items:center; color:#fff; }
.lum-pill[aria-pressed="false"] .lum-chk { display:none; }
.lum-ta { width:100%; margin-top:6px; background:rgba(255,255,255,.55); border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:8px; padding:11px 13px; color:var(--agent-text-primary,#2D1810); font:inherit; font-size:14px; line-height:1.55; resize:vertical; box-sizing:border-box; }
.lum-ta:hover:not(:focus) { border-color:var(--agent-border-strong,rgba(45,24,16,.18)); }
.lum-ta:focus { outline:none; border-color:var(--agent-coral-deep,#FF6B4A); background:rgba(255,255,255,.8); }
.lum-ta::placeholder { color:var(--agent-text-disabled,rgba(45,24,16,.35)); }
.lum-togline { display:flex; align-items:center; gap:10px; margin-top:14px; }
.lum-swlab { font-size:13px; color:var(--agent-text-secondary,#5A3A28); }
.lum-sw { position:relative; width:40px; height:23px; border-radius:999px; background:var(--agent-border-strong,rgba(45,24,16,.18)); border:0; cursor:pointer; flex:0 0 auto; transition:background .18s; padding:0; }
.lum-sw[aria-pressed="true"] { background:linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%); }
.lum-sw::after { content:""; position:absolute; top:2.5px; left:2.5px; width:18px; height:18px; border-radius:999px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.25); transition:transform .18s; }
.lum-sw[aria-pressed="true"]::after { transform:translateX(17px); }
.lum-sw:hover { filter:brightness(1.06); }
.lum-err { margin:10px 0 0; font-size:12.5px; color:#c0392b; }
.lum-sendbar { position:sticky; bottom:0; background:linear-gradient(180deg, rgba(255,251,245,0), var(--agent-bg-paper,#FFFBF5) 32%); padding:14px 0 2px; margin-top:8px; }
.lum-ov :focus-visible { outline:2px solid var(--agent-coral-deep,#FF6B4A); outline-offset:2px; }
.lum-ta:focus-visible { outline:none; }
.lum-record:hover { border-color:#294A73; background:#fff; }
.lum-recava { width:22px; height:22px; border-radius:999px; display:grid; place-items:center; color:#fff; background:linear-gradient(180deg,#294A73 0%,#163152 100%); box-shadow:inset 0 1px 0 rgba(255,255,255,.18); flex:0 0 auto; }
.lum-rectxt { color:#163152; }
.lum-rec { text-align:center; }
.lum-listen { display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; letter-spacing:.01em; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin:6px auto 8px; }
.lum-listen[data-on="1"] { color:#C63E20; }
.lum-blip { width:10px; height:10px; border-radius:999px; background:radial-gradient(circle at 34% 30%, #ffffff 0%, rgba(255,255,255,.55) 20%, #c9b9af 62%, #a7968c 100%); box-shadow:inset 0 0 0 .5px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.18); }
.lum-listen[data-on="1"] .lum-blip { background:radial-gradient(circle at 34% 28%, #ffffff 0%, rgba(255,255,255,.7) 16%, #FF6F4E 44%, #F04E2C 100%); box-shadow:inset 0 0 0 .5px rgba(255,255,255,.5), 0 0 0 4px rgba(240,78,44,.14), 0 1px 3px rgba(240,78,44,.4); animation:lum-blip 1.2s ease-in-out infinite; }
@keyframes lum-blip { 0%,100%{opacity:1} 50%{opacity:.25} }
.lum-rectime { font-size:34px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--agent-text-primary,#2D1810); margin:2px 0; }
.lum-wave { display:flex; align-items:center; justify-content:center; gap:3px; height:40px; margin:6px 0; }
.lum-wave span { width:3px; border-radius:999px; background:var(--agent-coral,#FF8A65); opacity:.85; height:12%; }
.lum-wave.on span { animation:lum-wav .9s ease-in-out infinite; }
@keyframes lum-wav { 0%,100%{height:14%} 50%{height:82%} }
.lum-recbtns { display:flex; gap:9px; margin-top:14px; justify-content:center; }
.lum-shimmer { width:40px; height:40px; border-radius:999px; margin:0 auto; border:3px solid var(--agent-coral-bg-tint,rgba(255,138,101,.18)); border-top-color:#F04E2C; animation:lum-spin .8s linear infinite; }
@keyframes lum-spin { to { transform:rotate(360deg) } }
.lum-checkrow { display:flex; align-items:flex-start; gap:11px; padding:11px 12px; border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; margin-top:8px; background:rgba(255,255,255,.5); cursor:pointer; transition:border-color .14s, background .14s; }
.lum-checkrow:hover { border-color:var(--agent-coral,#FF8A65); background:#fff; }
.lum-checkrow .lum-cbx { width:21px; height:21px; border-radius:6px; border:1.5px solid var(--agent-border-strong,rgba(45,24,16,.18)); display:grid; place-items:center; color:#fff; flex:0 0 auto; margin-top:1px; transition:all .14s; }
.lum-checkrow[aria-pressed="true"] .lum-cbx { background:#10B981; border-color:#10B981; }
.lum-checkrow[aria-pressed="false"] .lum-cbx svg { display:none; }
.lum-checkrow[aria-pressed="false"] { opacity:.6; }
.lum-cr-t { font-size:13.5px; font-weight:600; color:var(--agent-text-primary,#2D1810); }
.lum-cr-s { font-size:12px; color:var(--agent-text-muted,rgba(45,24,16,.55)); font-weight:500; }
.lum-sidecard { border:1px solid var(--agent-border-default,rgba(45,24,16,.1)); border-radius:12px; padding:14px; margin-top:12px; background:rgba(255,255,255,.5); transition:opacity .2s; }
.lum-sidecard.off { opacity:.55; }
.lum-sc-head { display:flex; align-items:center; gap:8px; margin-bottom:9px; }
.lum-sc-eye { font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
.lum-sc-eye.seller { color:#4F46E5; } .lum-sc-eye.buyer { color:#BE185D; } .lum-sc-eye.note { color:var(--agent-text-tertiary,#7A4A2E); }
.lum-sub { text-align:center; font-size:11.5px; color:var(--agent-text-muted,rgba(45,24,16,.55)); margin:8px 0 0; }
/* Close (X) — tinted hover + the X rotates. */
.lum-ic-x svg { transition:transform .2s ease; }
.lum-ic-x:hover { background:var(--agent-coral-bg-tint,rgba(255,138,101,.12)); color:#C63E20; border-color:var(--agent-coral,#FF8A65); }
.lum-ic-x:hover svg { transform:rotate(90deg); }
/* Start-recording button: border lights coral, mic icon pulses on hover. */
.lum-recbtn:hover { border-color:var(--agent-coral,#FF8A65); color:#C63E20; }
.lum-recbtn svg { transition:transform .18s ease; }
.lum-recbtn:hover svg { animation:lum-mic 1s ease-in-out infinite; }
@keyframes lum-mic { 0%,100%{transform:scale(1)} 50%{transform:scale(1.16)} }
/* Exit animation — reverse of the entry. */
.lum-sheet.lum-closing { animation:lum-out .24s cubic-bezier(.4,0,1,1) forwards; }
@keyframes lum-out { from { transform:translate(-50%,-50%) scale(1); opacity:1 } to { transform:translate(-50%,-48%) scale(.97); opacity:0 } }
@media (max-width:1024px) { .lum-sheet.lum-closing { animation:lum-down .3s cubic-bezier(.4,0,1,1) forwards; } }
@keyframes lum-down { from { transform:translateY(0) } to { transform:translateY(100%) } }
.lum-ov[data-closing="1"] .lum-bg { animation:lum-bgout .24s ease forwards; }
@keyframes lum-bgout { to { opacity:0 } }
@media (prefers-reduced-motion:reduce) { .lum-ov * { animation-duration:.001ms !important; transition-duration:.001ms !important; } }
`;
