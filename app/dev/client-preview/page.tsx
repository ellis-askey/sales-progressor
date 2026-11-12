"use client";

// /dev/client-preview — sandbox for the "show me what the client will see"
// preview toasts. Mirrors the two real flows:
//   • Draft an update — a Seller update + a Buyer update (+ an internal file
//     note that clients never see). Each side that has text gets its OWN preview
//     toast, stacked bottom-right; clear one side and its toast animates out.
//   • Add a checkpoint — one toast showing the portal "Things to confirm" card.
// The toasts REUSE the real portal components (see ./preview), so they're
// pixel-faithful. Dev-only; no queries, no writes, nothing leaves the page.

import { useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { UpdatePreviewCard, CheckpointPreviewCard, PreviewStack, type ToastSpec } from "./preview";

type Tab = "update" | "checkpoint";

// Mock client names, mirroring the real modal's "To Rodney / To Alex" chips.
const SELLER = "Rodney";
const BUYER = "Alex";

function fmtNeededBy(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ClientPreviewLab() {
  if (process.env.NODE_ENV === "production") notFound();

  const [tab, setTab] = useState<Tab>("update");

  // Draft-an-update flow (two sides + an internal note).
  const [sellerText, setSellerText] = useState("");
  const [buyerText, setBuyerText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [sellerSent, setSellerSent] = useState<string | null>(null);
  const [buyerSent, setBuyerSent] = useState<string | null>(null);

  // Checkpoint flow.
  const [cpLabel, setCpLabel] = useState("");
  const [cpDate, setCpDate] = useState("");
  const [cpSent, setCpSent] = useState<string | null>(null);

  function sendSeller() {
    if (!sellerText.trim()) return;
    setSellerSent(`Sent to ${SELLER}`);
    window.setTimeout(() => { setSellerText(""); setSellerSent(null); }, 1400);
  }
  function sendBuyer() {
    if (!buyerText.trim()) return;
    setBuyerSent(`Sent to ${BUYER}`);
    window.setTimeout(() => { setBuyerText(""); setBuyerSent(null); }, 1400);
  }
  function addCheckpoint() {
    if (!cpLabel.trim()) return;
    setCpSent("Added — they'll be asked to confirm");
    window.setTimeout(() => { setCpLabel(""); setCpDate(""); setCpSent(null); }, 1600);
  }

  // The live toasts for the active flow.
  const items: ToastSpec[] = [];
  if (tab === "update") {
    if (sellerText.trim() || sellerSent) items.push({ key: "seller", title: `In ${SELLER}'s portal (seller)`, sent: sellerSent, content: <UpdatePreviewCard content={sellerText} /> });
    if (buyerText.trim() || buyerSent) items.push({ key: "buyer", title: `In ${BUYER}'s portal (buyer)`, sent: buyerSent, content: <UpdatePreviewCard content={buyerText} /> });
  } else {
    if (cpLabel.trim() || cpSent) items.push({ key: "checkpoint", title: "In their “Things to confirm”", sent: cpSent, content: <CheckpointPreviewCard label={cpLabel} neededBy={fmtNeededBy(cpDate)} /> });
  }

  return (
    <div className="cpv-root">
      <header className="cpv-top">
        <h1>Client send preview</h1>
        <p>Compose below. A toast in the bottom-right shows exactly what lands in each client&apos;s portal, live, before you send. Update both sides and you get one toast each.</p>
      </header>

      <div className="cpv-tabs" role="tablist" aria-label="Flow">
        <button role="tab" aria-selected={tab === "update"} className={tab === "update" ? "on" : ""} onClick={() => setTab("update")}>Draft an update</button>
        <button role="tab" aria-selected={tab === "checkpoint"} className={tab === "checkpoint" ? "on" : ""} onClick={() => setTab("checkpoint")}>Add a checkpoint</button>
      </div>

      {tab === "update" ? (
        <div className="cpv-stack-forms">
          <Side label="Seller update" to={SELLER} value={sellerText} onChange={setSellerText} onSend={sendSeller} placeholder="e.g. The draft contract pack has been issued today. Your solicitor will review this and be in touch with any questions." />
          <Side label="Buyer update" to={BUYER} value={buyerText} onChange={setBuyerText} onSend={sendBuyer} placeholder="e.g. The draft contract pack has been issued today. Your solicitor will review this and guide you through the next steps." />
          <section className="cpv-card cpv-card-note">
            <div className="cpv-side-head"><span className="cpv-lab">File note (internal only)</span></div>
            <textarea className="cpv-textarea" rows={2} placeholder="A private note for the file…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <p className="cpv-note-hint">Internal only — your client never sees this, so there&apos;s no preview.</p>
          </section>
        </div>
      ) : (
        <section className="cpv-card" aria-label="Add a checkpoint">
          <label className="cpv-lab" htmlFor="cpv-label">What do you need them to confirm?</label>
          <input id="cpv-label" className="cpv-input" placeholder="e.g. Confirm you're happy with the fixtures & fittings list" value={cpLabel} onChange={(e) => setCpLabel(e.target.value)} />
          <div className="cpv-row">
            <span className="cpv-lab">Needed by (optional)</span>
            <input type="date" className="cpv-input cpv-date" value={cpDate} onChange={(e) => setCpDate(e.target.value)} />
          </div>
          <div className="cpv-actions">
            <button type="button" className="cpv-send" disabled={!cpLabel.trim()} onClick={addCheckpoint}>Add checkpoint</button>
          </div>
        </section>
      )}

      <PreviewStack items={items} />

      {/* Faux existing bottom chrome (stand-ins) so you can see the preview clears them. */}
      <div className="cpv-faux-dock" aria-hidden><span>✎ New note</span><span className="cpv-faux-sep" /><span>➤ New email</span></div>
      <button className="cpv-faux-help" aria-hidden tabIndex={-1}>?</button>

      <style>{CSS}</style>
    </div>
  );
}

function Side({ label, to, value, onChange, onSend, placeholder }: { label: string; to: string; value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string }) {
  return (
    <section className="cpv-card" aria-label={label}>
      <div className="cpv-side-head"><span className="cpv-lab">{label}</span></div>
      <textarea className="cpv-textarea" rows={3} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="cpv-side-foot">
        <span className="cpv-to">To <b>{to}</b></span>
        <button type="button" className="cpv-send cpv-send-sm" disabled={!value.trim()} onClick={onSend}>Send update</button>
      </div>
    </section>
  );
}

const CSS = `
.cpv-root{ min-height:100vh; box-sizing:border-box; padding:48px 24px 160px; max-width:720px; margin:0 auto;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;
  --ink:#1b1f27; --muted:#6a7180; --faint:#9aa1ad; --line:rgba(16,20,32,0.1); --surface:#fff; --surface-2:#f5f6f9; --accent:#FF6B4A; --accent-deep:#ec4e2c;
  color:var(--ink); background:radial-gradient(1100px 700px at 80% -10%, #eef1f8, #f7f8fc) fixed; }
.cpv-root *{ box-sizing:border-box; }
.cpv-top h1{ font-size:24px; font-weight:680; letter-spacing:-.02em; margin:0 0 6px; }
.cpv-top p{ font-size:14px; color:var(--muted); margin:0 0 22px; line-height:1.5; max-width:56ch; }
.cpv-tabs{ display:inline-flex; gap:3px; padding:3px; background:var(--surface-2); border:1px solid var(--line); border-radius:12px; margin-bottom:18px; }
.cpv-tabs button{ border:none; background:none; font:inherit; font-size:13.5px; font-weight:560; color:var(--muted); padding:8px 14px; border-radius:9px; cursor:pointer; transition:background .15s,color .15s; }
.cpv-tabs button:hover{ color:var(--ink); }
.cpv-tabs button.on{ background:var(--surface); color:var(--ink); box-shadow:0 1px 2px rgba(20,16,10,.08); font-weight:640; }
.cpv-stack-forms{ display:flex; flex-direction:column; gap:14px; }
.cpv-card{ background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:18px; box-shadow:0 12px 34px rgba(24,30,54,.08); }
.cpv-card-note{ background:var(--surface-2); box-shadow:none; }
.cpv-side-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
.cpv-lab{ display:block; font-size:12.5px; font-weight:620; color:var(--muted); }
.cpv-textarea,.cpv-input{ width:100%; font:inherit; font-size:14px; color:var(--ink); background:var(--surface-2); border:1px solid var(--line); border-radius:11px; padding:11px 13px; outline:none; transition:border-color .15s,box-shadow .15s; }
.cpv-card-note .cpv-textarea{ background:var(--surface); }
.cpv-textarea{ resize:vertical; line-height:1.5; min-height:72px; }
.cpv-textarea:focus,.cpv-input:focus{ border-color:color-mix(in srgb,var(--accent) 55%,var(--line)); box-shadow:0 0 0 3px rgba(255,107,74,.12); }
.cpv-side-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; }
.cpv-to{ font-size:13px; color:var(--muted); } .cpv-to b{ color:var(--ink); font-weight:620; background:rgba(255,107,74,.1); padding:2px 9px; border-radius:999px; }
.cpv-note-hint{ font-size:12px; color:var(--faint); margin:9px 0 0; }
.cpv-row{ display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:16px; flex-wrap:wrap; }
.cpv-date{ width:auto; }
.cpv-actions{ display:flex; justify-content:flex-end; margin-top:18px; }
.cpv-send{ border:none; font:inherit; font-size:14px; font-weight:620; color:#fff; background:linear-gradient(135deg,var(--accent),var(--accent-deep)); padding:10px 20px; border-radius:11px; cursor:pointer; box-shadow:0 6px 18px rgba(255,92,61,.3); transition:transform .18s,filter .18s,opacity .18s; }
.cpv-send-sm{ font-size:13px; padding:8px 16px; }
.cpv-send:hover:not(:disabled){ transform:translateY(-1px); filter:brightness(1.04); }
.cpv-send:disabled{ opacity:.4; cursor:not-allowed; box-shadow:none; }

/* The preview toast stack styles live in the shared module
   (components/client-preview/client-preview.css), imported by ClientPreviewStack. */

/* ── Faux existing bottom chrome (stand-ins to check clearance) ── */
.cpv-faux-dock{ position:fixed; left:50%; bottom:24px; transform:translateX(-50%); z-index:40; display:inline-flex; align-items:center; gap:10px;
  padding:11px 16px; border-radius:16px; background:rgba(255,255,255,.82); -webkit-backdrop-filter:blur(20px); backdrop-filter:blur(20px);
  border:1px solid var(--line); box-shadow:0 10px 30px rgba(24,30,54,.14); font-size:13px; font-weight:560; color:var(--muted); }
.cpv-faux-sep{ width:1px; height:18px; background:var(--line); }
.cpv-faux-help{ position:fixed; right:24px; bottom:24px; z-index:41; width:46px; height:46px; border-radius:50%; border:none; cursor:default;
  background:#1b1f27; color:#fff; font-size:18px; font-weight:700; box-shadow:0 10px 26px rgba(24,30,54,.28); }

@media (prefers-reduced-motion: reduce){ .cpv-toast{ animation-duration:.01ms; } .cpv-item{ transition:opacity .15s; } }
@media (max-width:520px){ .cpv-stack{ right:12px; left:12px; width:auto; } }
`;
