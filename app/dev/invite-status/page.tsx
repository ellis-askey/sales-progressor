"use client";

// /dev/invite-status — faithful preview of the proposed "honest status" for
// portal invites, so the UI can be reviewed before it's wired. Mirrors the real
// Client-portal tab (components/transaction/ClientPortalPreview.tsx): the
// "Add another client" card and the "On the portal" list. The NEW part is the
// per-client status on each row — Sending… / Invite sent / Couldn't send —
// plus how the two Activity lines read. Mock only: nothing is wired.

import { useState } from "react";
import { notFound } from "next/navigation";

/* ─── little building blocks ─────────────────────────────────────────────── */

function Avatar({ side, name }: { side: "seller" | "buyer"; name: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={`iv-av iv-av--${side}`} aria-hidden>
      {initials}
    </span>
  );
}

function Spinner() {
  return <span className="iv-spin" aria-hidden />;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" />
    </svg>
  );
}

type RowState = "sending" | "sent-now" | "sent-earlier" | "failed";

function PortalRow({ side, name, state }: { side: "seller" | "buyer"; name: string; state: RowState }) {
  return (
    <div className="iv-row">
      <span className="iv-who">
        <Avatar side={side} name={name} />
        <span className="iv-name">{name}</span>
      </span>

      {state === "sending" && (
        <span className="iv-status iv-status--muted"><Spinner /> Sending invite…</span>
      )}

      {state === "sent-now" && (
        <span className="iv-status-wrap">
          <span className="iv-status iv-status--ok"><CheckIcon /> Invite sent <span className="iv-dim">· just now</span></span>
          <button className="iv-resend" type="button">Resend</button>
        </span>
      )}

      {state === "sent-earlier" && (
        <span className="iv-status-wrap">
          <span className="iv-status iv-status--ok"><CheckIcon /> Invite sent <span className="iv-dim">· 2 days ago</span></span>
          <button className="iv-resend" type="button">Resend</button>
        </span>
      )}

      {state === "failed" && (
        <span className="iv-status-wrap">
          <span className="iv-status iv-status--bad"><AlertIcon /> Couldn&apos;t send</span>
          <button className="iv-resend iv-resend--cta" type="button">Resend</button>
        </span>
      )}
    </div>
  );
}

/* ─── the add-client card (faithful to InviteCard) ───────────────────────── */

function AddCard({ sending }: { sending?: boolean }) {
  const [role, setRole] = useState<"seller" | "buyer">("seller");
  return (
    <div className="iv-card">
      <span className="iv-eyebrow">Portal access</span>
      <h3 className="iv-card-title">Add another client</h3>
      <p className="iv-card-sub">
        A live view of their {role === "seller" ? "sale" : "purchase"} — progress, updates, and the option to confirm their own steps.
        Sent from you, stays on your file, never shared with other agents.
      </p>

      <label className="iv-label">They&apos;re the…</label>
      <div className="iv-seg" role="tablist" aria-label="Client side">
        {(["seller", "buyer"] as const).map((r) => (
          <button key={r} role="tab" aria-selected={role === r} className={`iv-seg-btn${role === r ? " on" : ""}`} onClick={() => setRole(r)}>{r}</button>
        ))}
      </div>

      <div className="iv-fields">
        <input className="iv-input" placeholder="Client name" defaultValue={sending ? "Sophie Bennett" : ""} readOnly={sending} />
        <input className="iv-input" placeholder="Email" defaultValue={sending ? "sophie@example.co.uk" : ""} readOnly={sending} />
      </div>

      <button className="iv-primary" disabled={sending} aria-busy={sending || undefined}>
        {sending ? <><Spinner /> Sending…</> : "Add & send portal invite"}
      </button>
      <p className="iv-hint"><span aria-hidden>✓</span> Saves them to this file&apos;s contacts and sends their portal link</p>
    </div>
  );
}

/* ─── activity lines ─────────────────────────────────────────────────────── */

function ActivityLine({ text, time }: { text: React.ReactNode; time: string }) {
  return (
    <div className="iv-act">
      <span className="iv-act-dot" aria-hidden />
      <span className="iv-act-body">
        <span className="iv-act-text">{text}</span>
        <span className="iv-act-time">{time}</span>
      </span>
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export default function InviteStatusDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [dark, setDark] = useState(false);

  return (
    <div className={`iv-page${dark ? " dark" : ""}`}>
      <div className="iv-wrap">
        <header className="iv-head">
          <div>
            <h1 className="iv-h1">Portal invite — honest status</h1>
            <p className="iv-lede">
              Preview of step 2. The client lands in the list the instant you press the button, carrying a status that
              tells the truth: <b>Sending…</b> → <b>Invite sent</b>, or <b>Couldn&apos;t send</b> with Resend right there.
              Mock — nothing is wired.
            </p>
          </div>
          <button className="iv-theme" onClick={() => setDark((v) => !v)} type="button">{dark ? "Light" : "Dark"}</button>
        </header>

        {/* Section 1 — the add-client card, resting + sending */}
        <p className="iv-section">The add-client card</p>
        <div className="iv-two">
          <div>
            <p className="iv-cap">Resting</p>
            <AddCard />
          </div>
          <div>
            <p className="iv-cap">While sending</p>
            <AddCard sending />
          </div>
        </div>

        {/* Section 2 — the On the portal list with all statuses */}
        <p className="iv-section">“On the portal” — every status on one list</p>
        <div className="iv-list-card">
          <p className="iv-list-head">On the portal</p>
          <PortalRow side="seller" name="Sophie Bennett" state="sending" />
          <PortalRow side="buyer" name="James Okafor" state="sent-now" />
          <PortalRow side="seller" name="Priya Shah" state="sent-earlier" />
          <PortalRow side="buyer" name="Daniel Carter" state="failed" />
        </div>
        <p className="iv-foot">
          No colour wash on the rows — status is carried by a small icon + label + a quiet Resend, so a failure stands
          out without shouting. Seller = blue avatar, buyer = green (unchanged from today).
        </p>

        {/* Section 3 — the Activity tab */}
        <p className="iv-section">What shows on the Activity tab (now refreshes instantly — step 1)</p>
        <div className="iv-list-card">
          <ActivityLine text={<><b>You</b> sent Sophie Bennett their portal invite</>} time="just now" />
          <ActivityLine text={<><b>You</b> added Sophie Bennett to the file</>} time="just now" />
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.iv-page{
  --tp:#2D1810; --ts:#5A3A28; --tm:rgba(45,24,16,0.55);
  --coral:#FF8A65; --coral-deep:#FF6B4A; --coral-rgb:255,107,74;
  --ok:#1F8A4A; --ok-rgb:31,138,74; --bad:#C73E3E; --bad-rgb:199,62,62;
  --surface:#FFFFFF; --bsub:rgba(45,24,16,0.08); --bdef:rgba(45,24,16,0.13);
  --bg:#F3EEEA; --seller:#3B7DE0; --buyer:#0F9D6B;
  min-height:100vh; background:var(--bg); color:var(--tp);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  padding:40px 20px;
}
.iv-page.dark{
  --tp:#F5EDE8; --ts:#CDBAAE; --tm:rgba(245,237,232,0.5);
  --coral:#FF8A65; --coral-deep:#FF7A58; --coral-rgb:255,122,88;
  --ok:#35C06A; --ok-rgb:53,192,106; --bad:#F08A8A; --bad-rgb:240,138,138;
  --surface:#1C1917; --bsub:rgba(255,255,255,0.08); --bdef:rgba(255,255,255,0.14);
  --bg:#141110; --seller:#6AA0F0; --buyer:#2FC58A;
}
.iv-wrap{ max-width:860px; margin:0 auto; }
.iv-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:30px; }
.iv-h1{ margin:0; font-size:23px; font-weight:780; letter-spacing:-0.02em; }
.iv-lede{ margin:7px 0 0; font-size:13.5px; line-height:1.55; color:var(--ts); max-width:66ch; }
.iv-lede b{ color:var(--tp); font-weight:680; }
.iv-theme{ flex-shrink:0; border:1px solid var(--bdef); background:var(--surface); color:var(--ts); border-radius:9px; padding:7px 14px; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; }

.iv-section{ font-size:12px; font-weight:750; text-transform:uppercase; letter-spacing:0.05em; color:var(--tm); margin:34px 0 12px; }
.iv-cap{ font-size:11.5px; font-weight:650; color:var(--tm); margin:0 0 8px 2px; }
.iv-two{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }
@media (max-width:680px){ .iv-two{ grid-template-columns:1fr; } }
.iv-foot, .iv-cap-note{ font-size:12px; line-height:1.55; color:var(--tm); margin:11px 2px 0; max-width:64ch; }

/* add-client card — faithful to InviteCard */
.iv-card{ border:1px solid rgba(var(--coral-rgb),0.35); background:linear-gradient(180deg, rgba(var(--coral-rgb),0.05), var(--surface)); border-radius:16px; padding:20px; }
.iv-eyebrow{ font-size:11px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:var(--coral-deep); }
.iv-card-title{ margin:7px 0 6px; font-size:17px; font-weight:740; color:var(--tp); }
.iv-card-sub{ margin:0 0 15px; font-size:13px; line-height:1.5; color:var(--tm); }
.iv-label{ display:block; font-size:11px; font-weight:700; color:var(--ts); margin-bottom:5px; }
.iv-seg{ display:inline-flex; gap:2px; padding:3px; border-radius:10px; background:rgba(120,120,130,0.10); border:1px solid var(--bdef); margin-bottom:12px; }
.iv-seg-btn{ border:0; cursor:pointer; padding:7px 20px; border-radius:8px; font:inherit; font-size:12.5px; font-weight:700; background:transparent; color:var(--tm); text-transform:capitalize; transition:color .18s, background .18s; }
.iv-seg-btn.on{ color:var(--tp); background:var(--surface); box-shadow:0 1px 3px rgba(15,23,42,0.14); }
.iv-fields{ display:flex; flex-direction:column; gap:9px; }
.iv-input{ font:inherit; font-size:13.5px; padding:9px 11px; border-radius:9px; border:1px solid var(--bdef); background:var(--surface); color:var(--tp); }
.iv-input::placeholder{ color:var(--tm); }
.iv-primary{ margin-top:14px; width:100%; border:1px solid transparent; border-radius:10px; padding:11px 18px; font:inherit; font-size:13.5px; font-weight:700; color:#fff; background:linear-gradient(180deg, var(--coral), var(--coral-deep)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.28); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.iv-primary:disabled{ opacity:0.75; cursor:default; }
.iv-hint{ margin:10px 0 0; font-size:11.5px; color:var(--ok); font-weight:600; display:flex; align-items:center; gap:6px; }

/* on-the-portal list */
.iv-list-card{ border:1px solid var(--bsub); background:var(--surface); border-radius:14px; padding:6px 16px; }
.iv-list-head{ font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:var(--tm); margin:12px 0 4px; }
.iv-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 0; border-top:0.5px solid var(--bsub); }
.iv-row:first-of-type{ border-top:none; }
.iv-who{ display:inline-flex; align-items:center; gap:9px; min-width:0; }
.iv-av{ width:24px; height:24px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; font-size:9.5px; font-weight:800; color:#fff; letter-spacing:0.02em; }
.iv-av--seller{ background:var(--seller); }
.iv-av--buyer{ background:var(--buyer); }
.iv-name{ font-size:13.5px; color:var(--tp); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.iv-status-wrap{ display:inline-flex; align-items:center; gap:12px; flex-shrink:0; }
.iv-status{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; flex-shrink:0; }
.iv-status--muted{ color:var(--tm); }
.iv-status--ok{ color:var(--ts); }
.iv-status--ok svg{ color:var(--ok); }
.iv-status--bad{ color:var(--bad); }
.iv-dim{ color:var(--tm); font-weight:500; }

.iv-resend{ border:0; background:none; font:inherit; font-size:12.5px; font-weight:600; color:var(--tm); cursor:pointer; padding:0; transition:color .15s; }
.iv-resend:hover{ color:var(--coral-deep); }
.iv-resend--cta{ color:#fff; background:linear-gradient(180deg, var(--coral), var(--coral-deep)); padding:6px 13px; border-radius:8px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.25); }
.iv-resend--cta:hover{ filter:brightness(1.05); color:#fff; }

/* spinner */
.iv-spin{ width:13px; height:13px; border-radius:50%; border:2px solid rgba(var(--coral-rgb),0.25); border-top-color:var(--coral-deep); display:inline-block; animation:iv-rot 0.7s linear infinite; }
.iv-primary .iv-spin{ border-color:rgba(255,255,255,0.4); border-top-color:#fff; }
@keyframes iv-rot{ to{ transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce){ .iv-spin{ animation-duration:1.6s; } }

/* activity */
.iv-act{ display:flex; align-items:flex-start; gap:11px; padding:12px 0; border-top:0.5px solid var(--bsub); }
.iv-act:first-of-type{ border-top:none; }
.iv-act-dot{ width:7px; height:7px; border-radius:50%; background:var(--coral-deep); margin-top:6px; flex-shrink:0; }
.iv-act-body{ display:flex; flex-direction:column; gap:2px; }
.iv-act-text{ font-size:13.5px; color:var(--tp); }
.iv-act-text b{ font-weight:700; }
.iv-act-time{ font-size:11.5px; color:var(--tm); }
`;
