"use client";

// Dev mock of components/progression/SenderDomainSection.tsx with ONE change:
// the "single-sent" (check your inbox) step is replaced by the proposed
// paste-the-link verification step. Everything else — overview, method chooser,
// address input, verified state — is copied verbatim so the new step can be judged
// in its real context. All network calls are replaced with timeouts; nothing here
// touches SendGrid or the DB.
//
// What the real build does on "Confirm address": POST the pasted link to a new
// `${base}/single` action ("confirm-link"); the server follows the SendGrid
// tracking redirect, extracts the token, calls GET /v3/verified_senders/verify/
// {token} with our API key, and flips the verified flag. No human login anywhere.

import { useState } from "react";
import {
  EnvelopeSimple,
  GlobeSimple,
  Clock,
  Sparkle,
  ArrowBendUpLeft,
  LinkSimple,
} from "@phosphor-icons/react";

type View =
  | "overview"
  | "method"
  | "single-input"
  | "single-verify"
  | "verified";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const s = parts.map((w) => w[0]?.toUpperCase() ?? "").join("");
  return s || "✉";
}

export function SenderVerifyPreview() {
  const [scope, setScope] = useState<"client" | "business">("client");
  const [simulateBadLink, setSimulateBadLink] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [chosen, setChosen] = useState<"single" | "domain" | null>(null);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const subjectName = scope === "client" ? "Wright & Co" : undefined;
  const previewName = subjectName ?? "Your business";
  const isClient = scope === "client";
  const theirPossessive = isClient ? `${subjectName}'s` : "your business's";
  const sampleDomain = isClient ? "theiragency.co.uk" : "yourbusiness.co.uk";
  const pendingAddr = email.trim() || `annalise@${sampleDomain}`;

  function note(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2600);
  }

  function mockSend() {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setLink("");
      setLinkError(false);
      setView("single-verify");
    }, 800);
  }

  function mockConfirm() {
    const pasted = link.trim();
    if (!pasted) return;
    setBusy(true);
    setLinkError(false);
    window.setTimeout(() => {
      setBusy(false);
      const looksRight = /^https?:\/\//i.test(pasted) && pasted.length > 20;
      if (simulateBadLink || !looksRight) {
        setLinkError(true);
        return;
      }
      setView("verified");
    }, 1100);
  }

  // ── Shared pieces (copied from SenderDomainSection) ─────────────────────────
  const Steps = ({ active }: { active: 1 | 2 | 3 }) => (
    <div className="sds-steps">
      {([["Choose", 1], ["Set up", 2], ["Verify", 3]] as const).map(([label, n], i) => (
        <div key={label} style={{ display: "contents" }}>
          <div className={`sds-st ${n < active ? "done" : n === active ? "on" : ""}`}>
            <span className="sds-bub">{n < active ? "✓" : n}</span>
            <span className="sds-lab">{label}</span>
          </div>
          {i < 2 && <span className="sds-sep" />}
        </div>
      ))}
    </div>
  );

  const Back = ({ to }: { to: View }) => (
    <button type="button" className="sds-back" onClick={() => setView(to)}>‹ Back</button>
  );

  const Mail = ({ addr, pill, pillKind }: { addr: string; pill: string; pillKind: "good" | "neutral" }) => (
    <div className="sds-mail">
      <div className="sds-mail-row">
        <span className="sds-avatar">{initials(previewName)}</span>
        <span className="sds-mail-id">
          <span className="sds-mail-name">{previewName}</span>
          <span className="sds-mail-addr">{addr}</span>
        </span>
        <span className={`sds-pill ${pillKind}`}>{pill}</span>
      </div>
    </div>
  );

  // ── Card body ────────────────────────────────────────────────────────────────
  function body() {
    switch (view) {
      case "overview":
        return (
          <>
            <h3 className="sds-h3">{isClient ? `Send your client updates from ${theirPossessive} own address` : "Send your client updates from your business's own address"}</h3>
            <p className="sds-body">
              {isClient
                ? `The automatic updates we send buyers and sellers already show ${subjectName} as the sender. You can also make those updates come from the agency's own email address.`
                : "The automatic updates we send buyers and sellers already show the agency as the sender. You can also make those updates come from your business's own email address, used for any client that hasn't got their own."}
            </p>
            <Mail addr="updates@thesalesprogressor.co.uk" pill="Default address" pillKind="neutral" />
            <div className="sds-ov-actions">
              <div className="sds-ann">
                <div><span className="sds-dot f" /><span><b>Sender name</b>{previewName}. Already set up for you.</span></div>
                <div><span className="sds-dot v" /><span><b>Email address</b>{isClient ? "Use their own address instead." : "Use your own address instead."}</span></div>
              </div>
              <button type="button" className="sds-btn" onClick={() => { setChosen(null); setView("method"); }}>
                {isClient ? "Set up their email address" : "Set up your email address"} <span className="arr">→</span>
              </button>
            </div>
            <div className="sds-note">
              <span className="sds-note-ic">💡</span>
              <span>{isClient
                ? "This is optional. Until it's set up, emails will continue sending as normal using your business's default address, or ours if you haven't added one. Buyers and sellers will still see the agency's name."
                : "This is optional. Until it's set up, emails send from a neutral address. Buyers and sellers will still see the agency's name."}</span>
            </div>
          </>
        );

      case "method":
        return (
          <>
            <div className="sds-topbar"><Back to="overview" /></div>
            <Steps active={1} />
            <h3 className="sds-h3">{isClient ? "How would you like to set up their email address?" : "How would you like to set up your email address?"}</h3>
            <p className="sds-body">There are two ways to do this, depending on what access you have. Choose whichever works for you.</p>

            <button type="button" className={`sds-opt ${chosen === "single" ? "on" : ""}`} onClick={() => setChosen("single")} aria-pressed={chosen === "single"}>
              <span className="sds-opt-radio">{chosen === "single" ? "✓" : ""}</span>
              <span className="sds-opt-top">
                <EnvelopeSimple size={21} weight="bold" className="sds-opt-ic" />
                <span className="sds-opt-ttl">{isClient ? "I have an email address for this agency" : "I have an email address for my business"}</span>
                <span className="sds-rec sds-rec-top">Easiest option</span>
              </span>
              <span className="sds-opt-sub">
                {isClient
                  ? <>The agency has given you an email address on their domain, such as <span className="sds-ex">you@{sampleDomain}</span>. We&rsquo;ll send a link to that inbox to confirm you can use it.</>
                  : <>You have an email address on your business&rsquo;s domain, such as <span className="sds-ex">you@{sampleDomain}</span>. We&rsquo;ll send a link to that inbox to confirm you can use it.</>}
              </span>
              <span className="sds-opt-facts">
                <span><Clock size={13} weight="bold" /> Around 2 minutes</span>
                <span><Sparkle size={13} weight="bold" /> No technical setup</span>
                <span><ArrowBendUpLeft size={13} weight="bold" /> Replies go to that email inbox</span>
              </span>
              <span className="sds-rec sds-rec-below">Easiest option</span>
            </button>

            <button type="button" className={`sds-opt ${chosen === "domain" ? "on" : ""}`} onClick={() => setChosen("domain")} aria-pressed={chosen === "domain"}>
              <span className="sds-opt-radio">{chosen === "domain" ? "✓" : ""}</span>
              <span className="sds-opt-top">
                <GlobeSimple size={21} weight="bold" className="sds-opt-ic" />
                <span className="sds-opt-ttl">{isClient ? "I can access their domain settings" : "I can access my domain settings"}</span>
              </span>
              <span className="sds-opt-sub">
                {isClient
                  ? <>You or the agency&rsquo;s IT team can add a few records to their domain settings. This lets us send emails using an address like <span className="sds-ex">updates@{sampleDomain}</span>, without needing a separate mailbox.</>
                  : <>You or your IT team can add a few records to your domain settings. This lets us send emails using an address like <span className="sds-ex">updates@{sampleDomain}</span>, without needing a separate mailbox.</>}
              </span>
              <span className="sds-opt-facts">
                <span><Clock size={13} weight="bold" /> Around 10 minutes to set up</span>
                <span><ArrowBendUpLeft size={13} weight="bold" /> You&rsquo;ll receive replies at your usual email address</span>
              </span>
            </button>

            <div className="sds-row sds-row-end">
              <button type="button" className="sds-btn" disabled={!chosen} onClick={() => {
                if (chosen === "domain") { note("Domain path is unchanged, it isn't part of this mock."); return; }
                setView("single-input");
              }}>
                Continue <span className="arr">→</span>
              </button>
            </div>
          </>
        );

      case "single-input":
        return (
          <>
            <div className="sds-topbar"><Back to="method" /></div>
            <Steps active={2} />
            <h3 className="sds-h3">{isClient ? "Which email address have they given you?" : "Which email address do you want to use?"}</h3>
            <p className="sds-body">
              {isClient
                ? `Enter the email address you've been given permission to use for ${subjectName}. You'll need access to its inbox to complete the setup.`
                : "Enter an email address on your business's domain. You'll need access to its inbox to complete the setup."}
            </p>
            <label className="sds-field" htmlFor="sds-addr">{isClient ? "Agency email address" : "Business email address"}</label>
            <input id="sds-addr" className="sds-input" type="email" autoComplete="off" autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) mockSend(); }}
              placeholder={`you@${sampleDomain}`} />
            <p className="sds-help">
              {isClient
                ? "This must be an address using the agency's own domain, rather than a personal Gmail, Outlook or similar account."
                : "This must be an address on your business's own domain, rather than a personal Gmail, Outlook or similar account."}
            </p>
            <div className="sds-row">
              <button type="button" className="sds-btn" onClick={mockSend} disabled={busy || !email.trim()}>
                {busy ? "Sending…" : "Send verification email"}
              </button>
              <button type="button" className="sds-link" onClick={() => setView("method")}>Choose another setup option</button>
            </div>
          </>
        );

      // ── THE NEW STEP ──────────────────────────────────────────────────────────
      case "single-verify":
        return (
          <>
            <Steps active={3} />
            <h3 className="sds-h3">Check your inbox</h3>
            <p className="sds-body">
              We&rsquo;ve sent a verification email to <b>{pendingAddr}</b>. It comes from
              Twilio SendGrid, the service that delivers email for us. Don&rsquo;t click
              the button inside it. Copy the button&rsquo;s link instead and paste it
              below, and we&rsquo;ll confirm the address for you.
            </p>

            <div className="sds-how">
              <div className="sds-how-h">
                <LinkSimple size={16} weight="bold" />
                <span>How to copy the link</span>
              </div>
              <ol className="sds-how-list">
                <li><span className="sds-how-n">1</span><span>Open the email called <b>Please Verify Your Single Sender</b>.</span></li>
                <li><span className="sds-how-n">2</span><span>Right-click the blue <b>Verify Single Sender</b> button. On a phone, press and hold it.</span></li>
                <li><span className="sds-how-n">3</span><span>Choose <b>Copy link</b>, then come back and paste it here.</span></li>
              </ol>
            </div>

            <label className="sds-field" htmlFor="sds-vlink">Verification link</label>
            <input id="sds-vlink" className={`sds-input ${linkError ? "err" : ""}`} type="url" autoComplete="off"
              value={link} onChange={(e) => { setLink(e.target.value); setLinkError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" && link.trim()) mockConfirm(); }}
              placeholder="Paste the copied link here" />
            {linkError ? (
              <p className="sds-help" style={{ color: "var(--agent-coral-deep, #E2452A)" }}>
                That doesn&rsquo;t look like the link from the email. Make sure you copy the link behind the Verify button itself, then paste the whole thing here.
              </p>
            ) : (
              <p className="sds-help">
                The button&rsquo;s own page asks for a login you won&rsquo;t have. Pasting the link here lets us confirm the address without one.
              </p>
            )}

            <div className="sds-row">
              <button type="button" className="sds-btn" onClick={mockConfirm} disabled={busy || !link.trim()}>
                {busy ? "Confirming…" : "Confirm address"}
              </button>
              <button type="button" className="sds-link" disabled={busy} onClick={() => note("Verification email sent again.")}>Resend email</button>
              <button type="button" className="sds-link" onClick={() => { setLink(""); setLinkError(false); setView("single-input"); }}>Use a different address</button>
            </div>
            <div className="sds-note">
              <span className="sds-note-ic">📩</span>
              <span>Not received it? Check the junk folder, or resend the email. If you get stuck, forward the whole email to <b>support@thesalesprogressor.co.uk</b> and we&rsquo;ll confirm it for you.</span>
            </div>
          </>
        );

      case "verified":
        return (
          <>
            <div className="sds-ok">
              <span className="sds-ok-ck">✓</span>
              <span><b>You&rsquo;re all set</b><span className="sds-ok-sub">{isClient
                ? `Emails for ${subjectName} will now send from the address they've given you.`
                : "Emails for your clients will now send from your business's email address."}</span></span>
            </div>
            <Mail addr={pendingAddr} pill="Verified" pillKind="good" />
            <p className="sds-body" style={{ marginTop: 16, marginBottom: 0 }}>
              {isClient
                ? "When someone replies, their email will arrive in the agency mailbox you've connected."
                : "When someone replies, their email will arrive in the mailbox you've connected."}
            </p>
            <div className="sds-row">
              <button type="button" className="sds-btn-ghost" onClick={() => { setEmail(""); setLink(""); setChosen(null); setView("method"); }}>Change email address</button>
            </div>
          </>
        );
    }
  }

  const jump = (v: View, label: string) => (
    <button key={v} type="button" className={`dv-jump ${view === v ? "on" : ""}`}
      onClick={() => { setLinkError(false); if (v === "single-verify" && !email) setEmail(`annalise@${sampleDomain}`); setView(v); }}>
      {label}
    </button>
  );

  return (
    <div className="dv-page">
      {/* ── Dev chrome ── */}
      <div className="dv-bar">
        <div className="dv-ttl">
          <b>Sending address · paste-the-link verify step</b>
          <span>Mock only. No SendGrid, no DB. The new step is &ldquo;Verify link&rdquo;; everything else is the live card, unchanged.</span>
        </div>
        <div className="dv-controls">
          <div className="dv-group">
            {jump("overview", "Overview")}
            {jump("method", "Choose method")}
            {jump("single-input", "Enter address")}
            {jump("single-verify", "Verify link")}
            {jump("verified", "Verified")}
          </div>
          <div className="dv-group">
            <button type="button" className={`dv-jump ${scope === "client" ? "on" : ""}`} onClick={() => setScope("client")}>Client scope</button>
            <button type="button" className={`dv-jump ${scope === "business" ? "on" : ""}`} onClick={() => setScope("business")}>Business scope</button>
          </div>
          <label className="dv-check">
            <input type="checkbox" checked={simulateBadLink} onChange={(e) => setSimulateBadLink(e.target.checked)} />
            Simulate a bad link
          </label>
        </div>
      </div>
      {flash && <div className="dv-flash">{flash}</div>}

      {/* ── The card, exactly as it sits in the agent app ── */}
      <div className="dv-stage">
        <div className="sds-shell">
          <div className="sds-shell-head">
            <h4 className="sds-shell-h">Sending address</h4>
            <p className="sds-shell-sub">The address {isClient ? `${subjectName}’s` : "your clients’"} emails come from.</p>
          </div>
          <div className="sds-swap" key={view}>{body()}</div>
        </div>
      </div>

      <style>{`
        /* ── Dev chrome (not part of the product UI) ─────────────────────────── */
        .dv-page { min-height: 100vh; background: #F6EFE7; padding: 26px 18px 60px; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: rgba(45, 24, 16, 0.55);
          --agent-coral: #FF8A65; --agent-coral-deep: #FF6B4A; --agent-success: #1F8A4A;
          --agent-border-subtle: rgba(45, 24, 16, 0.06); --agent-border-strong: rgba(45, 24, 16, 0.18);
          --agent-surface: rgba(255,255,255,0.82); }
        .dv-bar { max-width: 720px; margin: 0 auto 14px; background: #1E1912; color: #fff; border-radius: 14px; padding: 14px 16px; }
        .dv-ttl b { display: block; font-size: 13.5px; }
        .dv-ttl span { display: block; font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 3px; line-height: 1.45; }
        .dv-controls { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-top: 11px; }
        .dv-group { display: flex; flex-wrap: wrap; gap: 5px; }
        .dv-jump { appearance: none; cursor: pointer; font-size: 11.5px; font-weight: 650; color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); border-radius: 999px; padding: 5px 11px; transition: all .15s; }
        .dv-jump:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
        .dv-jump.on { background: #FF6B4A; border-color: #FF6B4A; color: #fff; }
        .dv-check { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 650; color: rgba(255,255,255,0.75); cursor: pointer; }
        .dv-check input { accent-color: #FF6B4A; }
        .dv-flash { max-width: 720px; margin: 0 auto 14px; background: #2D1810; color: #fff; font-size: 12.5px; font-weight: 600; border-radius: 10px; padding: 10px 14px; animation: sds-rise .2s ease both; }
        .dv-stage { max-width: 720px; margin: 0 auto; }

        /* ── Styles below are copied verbatim from SenderDomainSection ───────── */
        .sds-shell { background: var(--agent-surface, rgba(255,255,255,0.82)); -webkit-backdrop-filter: blur(14px) saturate(115%); backdrop-filter: blur(14px) saturate(115%); border: 0.5px solid rgba(0,0,0,0.07); border-radius: 16px; padding: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 6px 22px rgba(20,14,10,0.05); margin-top: 16px; }
        .sds-shell-head { margin-bottom: 16px; }
        .sds-shell-h { margin: 0; font-size: 15.5px; font-weight: 700; color: var(--agent-text-primary); letter-spacing: -0.01em; }
        .sds-shell-sub { margin: 3px 0 0; font-size: 13px; line-height: 1.5; color: var(--agent-text-muted); }
        .sds-swap { animation: sds-rise .26s cubic-bezier(.2,.7,.3,1) both; }
        @keyframes sds-rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .sds-swap { animation: none; } }

        .sds-muted { font-size: 13px; color: var(--agent-text-muted); margin: 0; }
        .sds-topbar { margin: 0 0 12px; }
        .sds-back { appearance: none; border: none; background: none; cursor: pointer; color: var(--agent-text-muted); font: inherit; font-size: 12px; font-weight: 700; letter-spacing: .04em; display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px; border-radius: 6px; transition: color .15s; }
        .sds-back:hover, .sds-back:focus-visible { color: var(--agent-text-primary); outline: none; }

        .sds-steps { display: flex; align-items: center; gap: 7px; margin: 0 0 18px; }
        .sds-st { display: flex; align-items: center; gap: 9px; }
        .sds-bub { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; flex-shrink: 0;
          background: linear-gradient(180deg, #f4f5f7, #e2e5e9); color: #9ca3af;
          box-shadow: inset 0 1.5px 1px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(15,23,42,0.18); }
        .sds-st.on .sds-bub, .sds-st.done .sds-bub { background: linear-gradient(180deg, #FF8A5C, #E2452A); color: #fff;
          box-shadow: inset 0 1.5px 1px rgba(255,255,255,0.45), inset 0 -2px 5px rgba(0,0,0,0.18), 0 3px 8px -2px rgba(255,107,74,0.55); }
        .sds-lab { font-size: 12.5px; font-weight: 650; color: var(--agent-text-muted); }
        .sds-st.on .sds-lab, .sds-st.done .sds-lab { color: var(--agent-text-primary); }
        .sds-sep { flex: 1; height: 1.5px; background: var(--agent-border-subtle); border-radius: 2px; min-width: 12px; }
        @media (max-width: 520px) { .sds-lab { display: none; } }

        .sds-h3 { font-size: 17px; line-height: 1.25; letter-spacing: -.01em; margin: 0 0 8px; font-weight: 750; color: var(--agent-text-primary); }
        .sds-body { font-size: 14px; color: var(--agent-text-secondary); margin: 0 0 18px; line-height: 1.6; }
        .sds-body b { color: var(--agent-text-primary); font-weight: 650; }

        .sds-mail { background: var(--agent-surface, rgba(255,255,255,0.6)); border: 1px solid var(--agent-border-subtle); border-radius: 13px; padding: 13px 15px; }
        .sds-mail-row { display: flex; align-items: center; gap: 12px; }
        .sds-avatar { flex: none; width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(145deg, #FF8A5C, #E2452A); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 13px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 6px -1px rgba(255,107,74,0.4); }
        .sds-mail-id { min-width: 0; display: flex; flex-direction: column; }
        .sds-mail-name { font-weight: 750; font-size: 14px; color: var(--agent-text-primary); line-height: 1.25; }
        .sds-mail-addr { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--agent-text-muted); margin-top: 2px; overflow-wrap: anywhere; }

        .sds-pill { margin-left: auto; flex: none; display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; padding: 5px 11px; border-radius: 999px;
          -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(15,23,42,0.05); }
        .sds-pill.neutral { background: rgba(255,255,255,0.5); color: var(--agent-text-muted); border: 1px solid var(--agent-border-subtle); }
        .sds-pill.good { background: rgba(47,125,83,0.14); color: var(--agent-success, #2F7D53); border: 1px solid rgba(47,125,83,0.24); }

        .sds-ov-actions { display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-top: 14px; }
        .sds-ann { display: flex; gap: 16px; flex-wrap: wrap; flex: 1; min-width: 240px; }
        .sds-ann > div { font-size: 12px; color: var(--agent-text-muted); display: flex; gap: 7px; align-items: flex-start; flex: 1; min-width: 150px; }
        .sds-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; }
        .sds-dot.f { background: var(--agent-text-muted); }
        .sds-dot.v { background: var(--agent-coral, #FF6B4A); }
        .sds-ann b { display: block; color: var(--agent-text-primary); font-weight: 700; }
        @media (max-width: 560px) { .sds-ov-actions .sds-btn { width: 100%; justify-content: center; } }

        .sds-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 18px; }
        .sds-row-end { justify-content: flex-end; }
        .sds-link { appearance: none; background: none; border: none; cursor: pointer; color: var(--agent-text-muted); font: inherit; font-size: 13px; font-weight: 600; padding: 8px 4px; transition: color .15s; }
        .sds-link:hover, .sds-link:focus-visible { color: var(--agent-text-primary); outline: none; }
        .sds-link:disabled { opacity: .5; cursor: default; }

        .sds-btn { font-size: 13px; font-weight: 700; color: #fff; border: none; border-radius: 10px; padding: 11px 19px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: linear-gradient(180deg, #FF7A5C, #E2452A); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 14px -5px rgba(255,107,74,0.5);
          transition: transform 120ms, box-shadow 150ms, filter 150ms; }
        .sds-btn:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 7px 18px -6px rgba(255,107,74,0.6); }
        .sds-btn:active:not(:disabled) { transform: scale(0.98); }
        .sds-btn:focus-visible { outline: 2px solid var(--agent-coral, #FF6B4A); outline-offset: 2px; }
        .sds-btn:disabled { background: rgba(0,0,0,0.08); color: #9ca3af; cursor: default; box-shadow: none; }
        .sds-btn .arr { display: inline-block; transition: transform 180ms cubic-bezier(.22,1,.36,1); }
        .sds-btn:hover:not(:disabled) .arr { transform: translateX(3px); }

        .sds-btn-ghost { font-size: 13px; font-weight: 650; color: var(--agent-text-secondary); background: transparent; border: 1.5px solid var(--agent-border-strong, rgba(0,0,0,0.16)); border-radius: 10px; padding: 9px 16px; cursor: pointer; transition: border-color .15s, color .15s; }
        .sds-btn-ghost:hover { border-color: var(--agent-coral, #FF6B4A); color: var(--agent-coral-deep, #E2452A); }

        .sds-note { display: flex; gap: 9px; background: var(--agent-surface, rgba(255,255,255,0.55)); border: 1px solid var(--agent-border-subtle); border-radius: 12px; padding: 12px 14px; font-size: 13px; color: var(--agent-text-secondary); line-height: 1.5; margin-top: 16px; }
        .sds-note-ic { flex: none; font-size: 14px; line-height: 1.3; }
        .sds-note b { color: var(--agent-text-primary); font-weight: 650; }

        .sds-opt { position: relative; display: block; width: 100%; text-align: left; appearance: none; cursor: pointer; color: inherit; background: var(--agent-surface, #fff); border: 1.5px solid var(--agent-border-subtle); border-radius: 15px; padding: 16px 44px 16px 16px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04); transition: transform .18s, box-shadow .18s, border-color .18s, background .18s; }
        .sds-opt + .sds-opt { margin-top: 11px; }
        .sds-opt:hover { border-color: rgba(255,107,74,0.5); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(26,29,41,0.08); }
        .sds-opt:active { transform: translateY(0); }
        .sds-opt:focus-visible { outline: 2px solid var(--agent-coral, #FF6B4A); outline-offset: 2px; }
        .sds-opt.on { background: linear-gradient(180deg, #FF7A5C, #E2452A); border-color: transparent; transform: none;
          box-shadow: 0 12px 26px -6px rgba(255,107,74,0.5), inset 0 1px 0 rgba(255,255,255,0.4); }
        .sds-opt-radio { position: absolute; top: 14px; right: 14px; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--agent-border-strong, rgba(0,0,0,0.18)); display: grid; place-items: center; font-size: 12px; font-weight: 800; color: transparent; transition: all .15s; }
        .sds-opt.on .sds-opt-radio { background: #fff; border-color: #fff; color: var(--agent-coral-deep, #E2452A); box-shadow: 0 1px 3px rgba(0,0,0,0.18); }
        .sds-opt-top { display: flex; align-items: center; gap: 10px; }
        .sds-opt-ic { flex: none; color: var(--agent-coral-deep, #E2452A); }
        .sds-opt.on .sds-opt-ic { color: #fff; }
        .sds-opt-ttl { font-weight: 750; font-size: 14.5px; color: var(--agent-text-primary); }
        .sds-opt.on .sds-opt-ttl { color: #fff; }
        .sds-rec { font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--agent-coral-deep, #E2452A);
          background: linear-gradient(180deg, #ffffff, #fdf1ec); border: 1px solid rgba(226,69,42,0.18); padding: 3px 8px; border-radius: 7px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(226,69,42,0.14); white-space: nowrap; }
        .sds-opt.on .sds-rec { border-color: transparent; }
        .sds-rec-below { display: none; }
        .sds-opt-sub { display: block; font-size: 13px; color: var(--agent-text-secondary); margin: 9px 0 0; line-height: 1.5; }
        .sds-opt.on .sds-opt-sub { color: rgba(255,255,255,0.92); }
        .sds-ex { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
        .sds-opt-facts { display: flex; flex-wrap: wrap; gap: 7px 16px; margin-top: 11px; }
        .sds-opt-facts span { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--agent-text-muted); }
        .sds-opt-facts svg { flex: none; opacity: .8; }
        .sds-opt.on .sds-opt-facts span { color: rgba(255,255,255,0.92); }
        .sds-opt.on .sds-opt-facts svg { opacity: 1; }

        .sds-field { display: block; font-size: 12.5px; font-weight: 700; color: var(--agent-text-primary); margin: 0 0 7px; }
        .sds-input { width: 100%; padding: 11px 13px; font-size: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--agent-text-primary); background: var(--agent-surface, #fff); border: 1.5px solid var(--agent-border-strong, rgba(0,0,0,0.16)); border-radius: 10px; outline: none; transition: border-color .15s; }
        .sds-input::placeholder { color: var(--agent-text-muted); }
        .sds-input:focus { border-color: var(--agent-coral, #FF6B4A); }
        .sds-input.err { border-color: var(--agent-coral-deep, #E2452A); }
        .sds-help { font-size: 12.5px; color: var(--agent-text-muted); margin: 9px 0 0; line-height: 1.5; }

        .sds-ok { display: flex; align-items: center; gap: 11px; background: rgba(47,125,83,0.10); border: 1px solid rgba(47,125,83,0.22); border-radius: 13px; padding: 13px 15px; margin-bottom: 16px; }
        .sds-ok-ck { flex: none; width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(180deg, #43b57e, #2F7D53); color: #fff; display: grid; place-items: center; font-size: 15px; font-weight: 800; box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px -1px rgba(47,125,83,0.4); }
        .sds-ok b { font-size: 13.5px; color: var(--agent-text-primary); font-weight: 750; }
        .sds-ok-sub { display: block; font-size: 12.5px; color: var(--agent-text-secondary); margin-top: 1px; }

        /* ── NEW: how-to-copy-the-link card (proposed addition to the real card) ── */
        .sds-how { background: var(--agent-surface, rgba(255,255,255,0.6)); border: 1px solid var(--agent-border-subtle); border-radius: 13px; padding: 14px 15px; margin-bottom: 18px; }
        .sds-how-h { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 750; color: var(--agent-text-primary); margin-bottom: 11px; }
        .sds-how-h svg { color: var(--agent-coral-deep, #E2452A); flex: none; }
        .sds-how-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .sds-how-list li { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--agent-text-secondary); line-height: 1.5; }
        .sds-how-list b { color: var(--agent-text-primary); font-weight: 650; }
        .sds-how-n { flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 10.5px; font-weight: 800; margin-top: 1px;
          background: linear-gradient(180deg, #f4f5f7, #e2e5e9); color: var(--agent-text-secondary);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -1.5px 3px rgba(0,0,0,0.07), 0 1px 3px -1px rgba(15,23,42,0.18); }

        @media (max-width: 560px) {
          .sds-opt-top { align-items: flex-start; padding-right: 30px; }
          .sds-opt { padding-right: 16px; }
          .sds-opt-facts { flex-direction: column; gap: 6px; }
          .sds-rec-top { display: none; }
          .sds-rec-below { display: inline-flex; margin-top: 10px; }
          .sds-mail-row { flex-wrap: wrap; }
          .sds-mail-id { flex: 1 1 calc(100% - 50px); }
          .sds-pill { margin-left: auto; margin-top: 8px; }
        }
      `}</style>
    </div>
  );
}
