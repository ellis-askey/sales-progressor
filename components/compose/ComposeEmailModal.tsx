"use client";

// Agent email composer (critique 2026-10-05). A centred modal: search a sale,
// add people to To/Cc/Bcc (real role-coloured avatars, picked from a dropdown
// that drops each person once added), write a rich-text email with your
// signature inside the body, and send from your own address — logged to the file.
//
// Phase 1: compose + send now. Schedule-send (Phase 2) and AI Refine (Phase 3)
// are layered on without changing this shape.
// WhatsApp: email-only for now; add a channel toggle once the official WhatsApp
// send-path is live.

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ContactAvatar, UserAvatar } from "@/components/ui/Avatar";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { extractFirstName } from "@/lib/contacts/displayName";
import {
  searchComposeSales, getComposeContextAction, sendComposedEmail,
  type ComposeSaleResult, type ComposeContextWithPhoto, type ComposeAttachmentInput,
} from "@/app/actions/compose";
import type { ComposeRecipient } from "@/lib/services/compose-recipients";

type Field = "to" | "cc" | "bcc";
type Token = { email: string; name: string; rec: ComposeRecipient | null };
const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

function RecAvatar({ rec, size }: { rec: ComposeRecipient | null; size: number }) {
  if (!rec) return (
    <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
      background: "linear-gradient(135deg,#FAEEDA,#FAC775)", color: "#633806", fontWeight: 700, fontSize: Math.round(size * 0.44) }}>@</span>
  );
  if (rec.kind === "team") return <UserAvatar user={{ name: rec.name, image: rec.avatarUrl }} size={size} />;
  if (rec.kind === "solicitor") return <ContactAvatar contact={{ name: rec.name, roleType: "solicitor" }} sideTint={rec.side ?? undefined} size={size} image={rec.avatarUrl} />;
  return <ContactAvatar contact={{ name: rec.name, roleType: rec.kind }} size={size} image={rec.avatarUrl} />;
}

export function ComposeEmailModal({
  open, onClose, initialTransactionId,
}: { open: boolean; onClose: () => void; initialTransactionId?: string | null }) {
  const { theme } = usePortalTheme();
  const { toast } = useAgentToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // sale
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ComposeSaleResult[]>([]);
  const [ctx, setCtx] = useState<ComposeContextWithPhoto | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);

  // recipients
  const [tokens, setTokens] = useState<Record<Field, Token[]>>({ to: [], cc: [], bcc: [] });
  const [openField, setOpenField] = useState<Field | null>(null);
  const [fieldQuery, setFieldQuery] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // body
  const [subject, setSubject] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingBodyRef = useRef<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [attachments, setAttachments] = useState<(ComposeAttachmentInput & { size: number })[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isSending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // reset on open/close
  useEffect(() => {
    if (!open) return;
    setQuery(""); setResults([]); setCtx(null); setTokens({ to: [], cc: [], bcc: [] });
    setOpenField(null); setFieldQuery(""); setShowCc(false); setShowBcc(false);
    setSubject(""); setAttachments([]); setError(null);
    if (editorRef.current) editorRef.current.innerHTML = "";
    if (initialTransactionId) void selectSale(initialTransactionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTransactionId]);

  // sale search (debounced-ish on each keystroke; server scopes the list)
  useEffect(() => {
    if (!open || ctx) return;
    let cancelled = false;
    searchComposeSales(query).then((r) => { if (!cancelled) setResults(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [query, open, ctx]);

  // Write the staged body once the editor has actually mounted (it only renders
  // after a sale is picked), then clear the staging ref.
  useEffect(() => {
    if (ctx && editorRef.current && pendingBodyRef.current != null) {
      editorRef.current.innerHTML = pendingBodyRef.current;
      pendingBodyRef.current = null;
      updateCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  async function selectSale(id: string) {
    setLoadingSale(true);
    try {
      const c = await getComposeContextAction(id);
      if (!c) { toast.error("Couldn't open that sale."); return; }
      // sensible default: first client (seller) on the To line
      const firstClient = c.recipients.find((r) => r.group === "sale") ?? null;
      const greet = firstClient ? extractFirstName(firstClient.name) : "there";
      let sigHtml = `<p>Kind regards,</p><p>${c.fromEmail.replace(/\s*<[^>]+>$/, "")}</p>`;
      try {
        const res = await fetch(`/api/agent/compose-signature-preview?transactionId=${id}`);
        if (res.ok) { const j = await res.json(); if (j?.html) sigHtml = j.html; }
      } catch { /* fall back to the plain sign-off */ }
      // Stage the body; the effect below writes it once the editor has mounted.
      pendingBodyRef.current = `<p>Hi ${greet},</p><p><br></p><p><br></p>${sigHtml}`;
      setTokens({ to: firstClient ? [{ email: firstClient.email, name: firstClient.name, rec: firstClient }] : [], cc: [], bcc: [] });
      setSubject(`Update on your sale of ${c.sale.line1}`);
      setCtx(c);
    } finally { setLoadingSale(false); }
  }

  function clearSale() {
    setCtx(null); setTokens({ to: [], cc: [], bcc: [] }); setSubject(""); setShowCc(false); setShowBcc(false);
    setAttachments([]); setError(null); if (editorRef.current) editorRef.current.innerHTML = ""; setQuery("");
  }

  const usedEmails = new Set([...tokens.to, ...tokens.cc, ...tokens.bcc].map((t) => t.email.toLowerCase()));
  function candidates(): ComposeRecipient[] {
    if (!ctx) return [];
    const q = fieldQuery.trim().toLowerCase();
    return ctx.recipients.filter((r) => !usedEmails.has(r.email.toLowerCase())
      && (!q || r.name.toLowerCase().includes(q) || r.roleLabel.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)));
  }
  function addRecipient(field: Field, rec: ComposeRecipient) {
    setJustAdded(rec.email);
    setTimeout(() => setJustAdded(null), 320);
    setTokens((prev) => ({ ...prev, [field]: [...prev[field], { email: rec.email, name: rec.name, rec }] }));
    setFieldQuery("");
  }
  function addFree(field: Field, email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (usedEmails.has(email.toLowerCase())) { setFieldQuery(""); return; }
    setTokens((prev) => ({ ...prev, [field]: [...prev[field], { email, name: email, rec: null }] }));
    setFieldQuery("");
  }
  function removeToken(field: Field, email: string) {
    setTokens((prev) => ({ ...prev, [field]: prev[field].filter((t) => t.email !== email) }));
  }

  function updateCount() { setCharCount((editorRef.current?.innerText ?? "").replace(/\s+$/, "").length); }
  function exec(cmd: string) {
    if (cmd === "createLink") { const u = prompt("Link URL", "https://"); if (u) document.execCommand(cmd, false, u); }
    else document.execCommand(cmd, false, undefined);
    editorRef.current?.focus();
  }
  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      if (attachments.reduce((s, a) => s + a.size, 0) + f.size > MAX_ATTACH_BYTES) { toast.error("Attachments are capped at 10 MB total."); break; }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        setAttachments((prev) => [...prev, { filename: f.name, contentBase64: base64, type: f.type || "application/octet-stream", size: f.size }]);
      };
      reader.readAsDataURL(f);
    }
  }

  function send() {
    if (!ctx) return;
    setError(null);
    const bodyHtml = editorRef.current?.innerHTML ?? "";
    startSend(async () => {
      const res = await sendComposedEmail({
        transactionId: ctx.sale.id,
        to: tokens.to.map((t) => t.email),
        cc: tokens.cc.map((t) => t.email),
        bcc: tokens.bcc.map((t) => t.email),
        subject,
        bodyHtml,
        attachments: attachments.map(({ filename, contentBase64, type }) => ({ filename, contentBase64, type })),
      });
      if (res.ok) { toast.success("Email sent"); onClose(); }
      else setError(res.error);
    });
  }

  if (!open || !mounted) return null;

  const field = (name: Field, label: string, placeholder: string) => (
    <div className="cem-recrow">
      <span className="cem-reclabel">{label}</span>
      <div className="cem-field">
        <div className={`cem-chipbox${openField === name ? " focus" : ""}`} onClick={() => { setOpenField(name); }}>
          {tokens[name].map((t) => (
            <span key={t.email} className="cem-pill" style={{ animation: justAdded === t.email ? "cemPop .22s cubic-bezier(.34,1.56,.64,1) both" : undefined }}>
              <RecAvatar rec={t.rec} size={20} />
              <span>{t.rec ? extractFirstName(t.name) : t.email}</span>
              <span className="cem-x" onClick={(e) => { e.stopPropagation(); removeToken(name, t.email); }}>✕</span>
            </span>
          ))}
          <input value={openField === name ? fieldQuery : ""} placeholder={tokens[name].length ? "" : placeholder}
            onFocus={() => setOpenField(name)} onChange={(e) => { setOpenField(name); setFieldQuery(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && fieldQuery.includes("@")) { e.preventDefault(); addFree(name, fieldQuery.trim()); }
              if (e.key === "Backspace" && !fieldQuery && tokens[name].length) removeToken(name, tokens[name][tokens[name].length - 1].email);
            }} />
        </div>
        {openField === name && (
          <div className="cem-menu" onMouseDown={(e) => e.preventDefault()}>
            {(() => {
              const list = candidates();
              const sale = list.filter((r) => r.group === "sale");
              const team = list.filter((r) => r.group === "team");
              const q = fieldQuery.trim().toLowerCase();
              const showFree = q.includes("@") && !list.some((r) => r.email.toLowerCase() === q);
              if (!sale.length && !team.length && !showFree) return <div className="cem-mgroup" style={{ padding: "12px 10px" }}>Everyone's already added.</div>;
              return (
                <>
                  {sale.length > 0 && <div className="cem-mgroup">On this sale</div>}
                  {sale.map((r) => <RecRow key={r.id} rec={r} onPick={() => addRecipient(name, r)} />)}
                  {team.length > 0 && <div className="cem-mgroup">Your team</div>}
                  {team.map((r) => <RecRow key={r.id} rec={r} onPick={() => addRecipient(name, r)} />)}
                  {showFree && (
                    <button className="cem-mi" onClick={() => addFree(name, fieldQuery.trim())}>
                      <RecAvatar rec={null} size={26} />
                      <span className="cem-nm"><span className="cem-n" style={{ color: "var(--agent-coral-deep)" }}>Add “{fieldQuery.trim()}”</span><span className="cem-r">Send to this address</span></span>
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
      {name === "to" && (
        <div className="cem-ccbcc">
          {!showCc && <button onClick={() => setShowCc(true)}>Cc</button>}
          {!showBcc && <button onClick={() => setShowBcc(true)}>Bcc</button>}
        </div>
      )}
    </div>
  );

  return createPortal(
    <div className="cem-backdrop" data-theme={theme} onClick={() => setOpenField(null)}>
      <style>{CEM_CSS}</style>
      <div className="cem-modal" role="dialog" aria-label="New email" onClick={(e) => e.stopPropagation()}>
        <div className="cem-hdr">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>New email</h1>
            <p>Sent from your own address · logged to the file</p>
          </div>
          <button className="cem-xbtn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="cem-body">
          <div className="cem-row">
            <p className="cem-eyebrow">Sale</p>
            {ctx ? (
              <div className="cem-sale-selected">
                <span className="cem-pthumb">{ctx.photoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ctx.photoUrl} alt="" /> : <PropFallback />}</span>
                <span className="cem-addr"><span className="cem-a">{ctx.sale.line1}</span><span className="cem-b">{ctx.sale.location}</span></span>
                <button className="cem-clearx" title="Change sale" onClick={clearSale}>✕</button>
              </div>
            ) : (
              <div className="cem-posrel">
                <div className="cem-sale-search">
                  <span className="cem-sicon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg></span>
                  <input autoFocus value={query} placeholder="Search your sales by address…" onChange={(e) => setQuery(e.target.value)} />
                </div>
                {(results.length > 0 || loadingSale) && (
                  <div className="cem-menu">
                    {results.map((r) => (
                      <button key={r.id} className="cem-mi" onClick={() => selectSale(r.id)}>
                        <span className="cem-pthumb sm">{r.photoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.photoUrl} alt="" /> : <PropFallback />}</span>
                        <span className="cem-nm"><span className="cem-n">{r.line1}</span><span className="cem-r">{r.location}</span></span>
                      </button>
                    ))}
                    {!results.length && <div className="cem-mgroup" style={{ padding: "12px 10px" }}>No sales match.</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {ctx && (
            <>
              <div className="cem-row">
                {field("to", "To", "Add people or type an email…")}
                {showCc && <div style={{ marginTop: 9 }}>{field("cc", "Cc", "Add people…")}</div>}
                {showBcc && <div style={{ marginTop: 9 }}>{field("bcc", "Bcc", "Add people…")}</div>}
              </div>

              <div className="cem-row">
                <p className="cem-eyebrow">Subject</p>
                <input className="cem-subject" value={subject} placeholder="Subject" onChange={(e) => setSubject(e.target.value)} />
              </div>

              <div className="cem-row">
                <p className="cem-eyebrow">Message</p>
                <div className="cem-editor-wrap">
                  <div ref={editorRef} className="cem-editor" contentEditable suppressContentEditableWarning
                    onInput={updateCount} />
                  <div className="cem-toolbar">
                    <button className="cem-tb" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><b>B</b></button>
                    <button className="cem-tb" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><i>I</i></button>
                    <span className="cem-tbsep" />
                    <button className="cem-tb" title="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>•</button>
                    <button className="cem-tb" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>1.</button>
                    <span className="cem-tbsep" />
                    <button className="cem-tb" title="Insert link" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("createLink")}>🔗</button>
                    <button className="cem-tb" title="Attach a file" onMouseDown={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()}>📎</button>
                    <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={onPickFiles} />
                    <span className="cem-tbspace" />
                    <span className="cem-count">{charCount} characters</span>
                  </div>
                </div>
                {attachments.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                    {attachments.map((a, i) => (
                      <span key={i} className="cem-attach"><span style={{ color: "var(--agent-coral-deep)" }}>📄</span>{a.filename}<span style={{ color: "var(--agent-text-muted)" }}>· {(a.size / 1024).toFixed(0)} KB</span>
                        <span className="cem-x" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>✕</span></span>
                    ))}
                  </div>
                )}
                {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--agent-danger)", fontWeight: 600 }}>{error}</div>}
              </div>
            </>
          )}
        </div>

        {ctx && (
          <div className="cem-foot">
            <span className="cem-fromline">From <b>{ctx.fromEmail}</b></span>
            <button className="cem-send" disabled={isSending} onClick={send}>
              {isSending ? "Sending…" : <>➤ Send</>}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function RecRow({ rec, onPick }: { rec: ComposeRecipient; onPick: () => void }) {
  return (
    <button className="cem-mi" onClick={onPick}>
      <RecAvatar rec={rec} size={26} />
      <span className="cem-nm"><span className="cem-n">{rec.name}</span><span className="cem-r">{rec.roleLabel}</span></span>
      <span className="cem-em">{rec.email}</span>
    </button>
  );
}

function PropFallback(): ReactNode {
  return <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block" }}><rect width="100" height="100" fill="#FDE5CF" /><polygon points="50,26 80,52 20,52" fill="#D9774A" /><rect x="30" y="52" width="40" height="26" fill="#F0A878" /><rect x="44" y="62" width="12" height="16" rx="1" fill="#FBEFE4" /></svg>;
}

const CEM_CSS = `
.cem-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(45,24,16,0.34);backdrop-filter:blur(3px)}
.cem-modal{width:min(640px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;background:var(--agent-surface-elevated,#fff);border:1px solid rgba(255,255,255,0.5);border-top:2px solid var(--agent-coral-deep,#FF6B4A);border-radius:16px;box-shadow:0 24px 70px rgba(45,24,16,0.28);animation:cemModalin .34s cubic-bezier(.34,1.56,.64,1) both}
@keyframes cemModalin{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}
@keyframes cemPop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}
@keyframes cemMenuin{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.cem-hdr{flex-shrink:0;display:flex;align-items:center;gap:12px;padding:14px 22px;color:#fff;background:linear-gradient(180deg,var(--agent-coral,#FF8A65) 0%,var(--agent-coral-deep,#FF6B4A) 100%)}
.cem-hdr h1{margin:0;font-size:16px;font-weight:680;letter-spacing:-.01em}
.cem-hdr p{margin:2px 0 0;font-size:11.5px;opacity:.85;font-weight:500}
.cem-xbtn{width:30px;height:30px;border-radius:8px;border:none;background:rgba(255,255,255,0.16);color:#fff;cursor:pointer;font-size:15px;display:grid;place-items:center;transition:background .14s}
.cem-xbtn:hover{background:rgba(255,255,255,0.28)}
.cem-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden}
.cem-row{padding:13px 22px;border-bottom:1px solid var(--agent-border-subtle,rgba(45,24,16,.06))}
.cem-eyebrow{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--agent-text-muted);margin:0 0 7px}
.cem-posrel{position:relative}
.cem-sale-search,.cem-chipbox,.cem-subject,.cem-editor-wrap{border:1px solid var(--agent-border-default,rgba(45,24,16,.1));transition:border-color .15s ease}
.cem-sale-search:hover,.cem-chipbox:hover,.cem-subject:hover,.cem-editor-wrap:hover{border-color:var(--agent-coral,#FF8A65)}
.cem-sale-search.focus,.cem-chipbox.focus,.cem-subject:focus,.cem-editor-wrap:focus-within{border-color:var(--agent-coral-deep,#FF6B4A)}
.cem-sale-search{display:flex;align-items:center;gap:9px;background:var(--agent-surface-elevated,#fff);border-radius:12px;padding:10px 13px}
.cem-sicon{color:var(--agent-text-muted);display:flex}
.cem-sale-search input{flex:1;border:none;outline:none;background:none;font-family:inherit;font-size:13.5px;color:var(--agent-text-primary)}
.cem-sale-selected{display:flex;align-items:center;gap:12px;background:var(--agent-surface-elevated,#fff);border:1px solid var(--agent-border-default);border-radius:12px;padding:9px 11px;animation:cemPop .26s cubic-bezier(.34,1.56,.64,1) both}
.cem-pthumb{width:44px;height:44px;border-radius:9px;flex-shrink:0;overflow:hidden;background:#FDE5CF}
.cem-pthumb.sm{width:34px;height:34px;border-radius:8px}
.cem-pthumb img{width:100%;height:100%;object-fit:cover;display:block}
.cem-addr{flex:1;min-width:0}
.cem-a{display:block;font-size:13.5px;font-weight:650;color:var(--agent-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cem-b{display:block;font-size:11.5px;color:var(--agent-text-muted);margin-top:1px}
.cem-clearx{width:28px;height:28px;border-radius:8px;border:1px solid var(--agent-border-default);background:#fff;color:var(--agent-text-muted);cursor:pointer;font-size:13px;display:grid;place-items:center;flex-shrink:0;transition:all .14s}
.cem-clearx:hover{border-color:var(--agent-danger);color:var(--agent-danger)}
.cem-recrow{display:flex;align-items:flex-start;gap:10px}
.cem-reclabel{width:34px;flex-shrink:0;font-size:12.5px;font-weight:600;color:var(--agent-text-secondary);padding-top:9px}
.cem-field{flex:1;min-width:0;position:relative}
.cem-chipbox{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:38px;background:var(--agent-surface-elevated,#fff);border-radius:10px;padding:5px 8px;cursor:text}
.cem-chipbox input{flex:1;min-width:90px;border:none;outline:none;background:none;font-family:inherit;font-size:12.5px;color:var(--agent-text-primary);padding:4px 2px}
.cem-ccbcc{display:flex;gap:10px;padding-top:9px}
.cem-ccbcc button{background:none;border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;color:var(--agent-text-muted);padding:0;transition:color .14s}
.cem-ccbcc button:hover{color:var(--agent-coral-deep)}
.cem-pill{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--agent-border-strong,rgba(45,24,16,.18));border-radius:999px;padding:3px 7px 3px 4px;font-size:12px;font-weight:550;color:var(--agent-text-primary);box-shadow:0 1px 3px rgba(45,24,16,0.07)}
.cem-pill .cem-x{cursor:pointer;color:var(--agent-text-muted);font-size:13px;width:15px;height:15px;display:grid;place-items:center;border-radius:50%;transition:background .12s,color .12s}
.cem-pill .cem-x:hover{background:rgba(199,62,62,0.12);color:var(--agent-danger)}
.cem-menu{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:40;background:#fff;border:1px solid var(--agent-border-default);border-radius:12px;padding:5px;max-height:280px;overflow-y:auto;box-shadow:0 14px 40px rgba(45,24,16,0.16);animation:cemMenuin .16s ease both}
.cem-mgroup{font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--agent-text-muted);padding:8px 9px 4px}
.cem-mi{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:none;background:none;cursor:pointer;padding:7px 9px;border-radius:9px;font-family:inherit;transition:background .12s}
.cem-mi:hover{background:rgba(255,138,101,0.09)}
.cem-nm{flex:1;min-width:0}
.cem-n{display:block;font-size:13px;font-weight:600;color:var(--agent-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cem-r{display:block;font-size:11px;color:var(--agent-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cem-em{font-size:11px;color:var(--agent-text-muted);flex-shrink:0;max-width:36%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cem-subject{width:100%;background:var(--agent-surface-elevated,#fff);border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13.5px;font-weight:550;color:var(--agent-text-primary);outline:none}
.cem-editor-wrap{border-radius:10px;overflow:hidden;background:var(--agent-surface-elevated,#fff)}
.cem-editor{min-height:150px;max-height:290px;overflow-y:auto;padding:13px 14px;font-size:13.5px;line-height:1.6;color:var(--agent-text-primary);outline:none;border-bottom:1px solid var(--agent-border-subtle)}
.cem-editor p{margin:0 0 10px}.cem-editor a{color:var(--agent-coral-deep)}
.cem-toolbar{display:flex;align-items:center;gap:2px;flex-wrap:wrap;padding:5px;background:var(--agent-bg-paper,#FFFBF5)}
.cem-tb{width:30px;height:30px;border:none;background:none;border-radius:7px;cursor:pointer;color:var(--agent-text-secondary);font-size:14px;display:grid;place-items:center;transition:background .12s,color .12s}
.cem-tb:hover{background:rgba(45,24,16,0.06);color:var(--agent-text-primary)}
.cem-tbsep{width:1px;height:18px;background:var(--agent-border-default);margin:0 4px}
.cem-tbspace{flex:1}
.cem-count{font-size:10.5px;color:var(--agent-text-muted);padding:0 8px;font-variant-numeric:tabular-nums}
.cem-attach{display:inline-flex;align-items:center;gap:8px;background:var(--agent-bg-paper,#FFFBF5);border:1px solid var(--agent-border-default);border-radius:8px;padding:6px 9px;font-size:11.5px;color:var(--agent-text-secondary)}
.cem-attach .cem-x{cursor:pointer;color:var(--agent-text-muted);font-size:13px}.cem-attach .cem-x:hover{color:var(--agent-danger)}
.cem-foot{flex-shrink:0;display:flex;align-items:center;gap:10px;padding:12px 20px 16px;border-top:1px solid var(--agent-border-subtle);background:var(--agent-surface-elevated,#fff)}
.cem-fromline{font-size:11px;color:var(--agent-text-muted);margin-right:auto}.cem-fromline b{color:var(--agent-text-secondary);font-weight:600}
.cem-send{border:none;cursor:pointer;color:#fff;font-family:inherit;font-size:14px;font-weight:650;padding:0 20px;height:40px;display:inline-flex;align-items:center;gap:8px;border-radius:10px;background:linear-gradient(135deg,var(--agent-coral-deep,#FF6B4A),var(--agent-coral-light,#FFB18F));box-shadow:0 4px 16px rgba(255,107,74,0.28);transition:filter .12s}
.cem-send:hover{filter:brightness(1.05)}.cem-send:disabled{opacity:.6;cursor:default}
`;
