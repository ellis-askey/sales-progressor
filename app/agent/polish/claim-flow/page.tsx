"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import "../../../claim/styles/claim-flow.css";

// ─── Polish-page frame layout ─────────────────────────────────────────────────

const CSS = `
  .cf-outer { padding: 32px 32px 96px; }
  .cf-section { margin-bottom: 72px; }
  .cf-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: rgba(30,45,74,.45); margin: 60px 0 4px; padding: 9px 16px;
    background: rgba(30,45,74,.05); border-left: 3px solid rgba(30,45,74,.2);
    border-radius: 0 6px 6px 0; font-family: monospace;
  }
  .cf-label:first-child { margin-top: 0; }
  .cf-sub {
    font-size: 11px; color: rgba(30,45,74,.4); font-family: monospace;
    margin: 0 0 16px;
  }
  .cf-frames { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  .cf-frame-wrap { display: flex; flex-direction: column; gap: 6px; }
  .cf-frame-tag {
    font-size: 10px; color: rgba(30,45,74,.4); font-family: monospace;
    text-transform: uppercase; letter-spacing: .05em;
  }
  .cf-frame {
    border-radius: 10px; border: 1px solid #d8dfe8; overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,.06);
  }
  .cf-frame--desktop { width: 560px; }
  .cf-frame--mobile  { width: 375px; }
  /* Suppress min-height and sticky inside frames */
  .cf-frame .claim-page       { min-height: 0; }
  .cf-frame .claim-header     { position: relative; top: auto; }
  .cf-frame .claim-context-strip { position: relative; top: auto; }
  .cf-frame .claim-panel      { position: relative; top: auto; }
`;

// ─── Reusable shell pieces ────────────────────────────────────────────────────

function ClaimHdr() {
  return (
    <header className="claim-header">
      <span className="claim-wordmark">The Sales Progressor</span>
    </header>
  );
}

function ConnectorEl() {
  return (
    <div className="claim-chain-connector">
      <div className="claim-chain-connector-dot" />
      <div className="claim-chain-connector-line" />
      <div className="claim-chain-connector-dot" />
    </div>
  );
}

type RowType = "claimed" | "yours" | "pending" | "ghost";
function ChainRow({ pos, type, address, agency }: { pos: number; type: RowType; address?: string; agency?: string }) {
  const cardCls = `claim-chain-card claim-chain-card--${type}`;
  if (type === "ghost") return (
    <div className="claim-chain-row">
      <div className="claim-chain-gutter">
        <span className="claim-chain-num" style={{ fontSize: 14, opacity: 0.5 }}>··</span>
      </div>
      <div className={cardCls}>
        <span className="claim-chain-address" style={{ color: "rgba(255,255,255,.4)", fontSize: 12, fontWeight: 400 }}>
          — and {address} more —
        </span>
      </div>
    </div>
  );
  return (
    <div className="claim-chain-row">
      <div className="claim-chain-gutter">
        <span className="claim-chain-num">{String(pos).padStart(2, "0")}</span>
      </div>
      <div className={cardCls}>
        {type === "yours" ? (
          <>
            <div className="claim-chain-head">
              <span className="claim-chain-address">{address}</span>
              <span className="claim-chain-status">YOU</span>
            </div>
            <div className="claim-chain-inner">
              <span className="claim-chain-inner-text">Your sale · Claim to join</span>
              <span className="claim-chain-inner-arrow">→</span>
            </div>
          </>
        ) : type === "claimed" ? (
          <>
            <div className="claim-chain-head">
              <span className="claim-chain-address">{address}</span>
              <span className="claim-chain-status">✓ Tracking</span>
            </div>
            {agency && <div className="claim-chain-agency">{agency}</div>}
          </>
        ) : (
          <div className="claim-chain-head">
            <span className="claim-chain-address" style={{ color: "rgba(255,255,255,.5)", fontStyle: "italic", fontWeight: 400 }}>
              Pending sale
            </span>
            <span className="claim-chain-status">Invited</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ContextStrip({ address }: { address: string }) {
  return (
    <div className="claim-context-strip">
      <a href="#" className="claim-context-back">← Back</a>
      <div className="claim-context-info">
        <div className="claim-context-label">You&apos;re claiming</div>
        <div className="claim-context-address">{address}</div>
      </div>
    </div>
  );
}

// ─── Route 1 — /claim (landing) ───────────────────────────────────────────────

function ClaimLanding({ mobile }: { mobile?: boolean }) {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className={mobile ? "claim-container--narrow" : "claim-container"}>
        <div className="claim-hero">
          <p className="claim-hero-eyebrow">SARAH HARTWELL · HARTWELL PARTNERS</p>
          <h1 className="claim-hero-h1">Your sale is part of a live chain.</h1>
          <p className="claim-hero-sub">
            Sarah has linked 12 Acme Street, Birmingham to their file.
            Join to see where the chain stands.
          </p>
          <div className="claim-hero-rule" />

          {/* Chain visual — 3 links, yours at #2 */}
          <div className="claim-chain">
            <ChainRow pos={1} type="claimed" address="42 Garden Road, Harrow" agency="Hartwell Partners" />
            <ConnectorEl />
            <ChainRow pos={2} type="yours" address="12 Acme Street, Birmingham" />
            <ConnectorEl />
            <ChainRow pos={3} type="pending" />
          </div>

          {/* Meta strip */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.15)", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.60)" }}>
              Invited by: <strong style={{ color: "rgba(255,255,255,.85)" }}>Sarah Hartwell</strong> — Hartwell Partners
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.50)" }}>Invited on: 12 May 2026</span>
          </div>
        </div>

        {/* CTA */}
        <div className="claim-cta" style={{ marginTop: 20 }}>
          <a href="#" className="claim-btn">Claim this sale</a>
          <p className="claim-microcopy">Free to use · Takes 30 seconds</p>
          <p className="claim-link-row">
            Already have an account? <a href="#">Log in</a>
          </p>
          <a href="#" className="claim-decline-link">This isn&apos;t mine — decline invite</a>
        </div>
      </div>
    </div>
  );
}

// 5-link chain with ghost row (truncation demo)
function ClaimLanding5Links() {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className="claim-container">
        <div className="claim-hero">
          <p className="claim-hero-eyebrow">JAMES FULLER · FULLER &amp; CO.</p>
          <h1 className="claim-hero-h1">Your sale is part of a live chain.</h1>
          <p className="claim-hero-sub">
            James has linked 7 Birchwood Ave to their file.
            Join to see where the chain stands.
          </p>
          <div className="claim-hero-rule" />
          <div className="claim-chain">
            <ChainRow pos={1} type="claimed" address="3 Elmwood Close, Bristol" agency="Fuller & Co." />
            <ConnectorEl />
            <ChainRow pos={2} type="claimed" address="19 Maple Drive, Bath" agency="Fuller & Co." />
            <ConnectorEl />
            <ChainRow pos={3} type="yours" address="7 Birchwood Ave, Bristol" />
            <ConnectorEl />
            <ChainRow pos={0} type="ghost" address="2" />
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.15)" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.60)" }}>
              Invited by: <strong style={{ color: "rgba(255,255,255,.85)" }}>James Fuller</strong> — Fuller &amp; Co.
            </span>
          </div>
        </div>
        <div className="claim-cta" style={{ marginTop: 20 }}>
          <a href="#" className="claim-btn">Claim this sale</a>
          <a href="#" className="claim-decline-link">This isn&apos;t mine — decline invite</a>
        </div>
      </div>
    </div>
  );
}

// Error states
function ClaimErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className="claim-error-wrap">
        <div className="claim-error-inner">
          <p className="claim-error-eyebrow">The Sales Progressor</p>
          <h1 className="claim-error-h1">{title}</h1>
          <p className="claim-error-p">{body}</p>
          <p className="claim-error-support">
            Need help?{" "}
            <a href="mailto:support@thesalesprogressor.co.uk">
              support@thesalesprogressor.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Route 2 — /claim/signup ──────────────────────────────────────────────────

function SignupPanel() {
  return (
    <div className="claim-panel">
      <p className="claim-panel-eyebrow">You&apos;re joining</p>
      <p className="claim-panel-address">12 Acme Street, Birmingham</p>
      <div className="claim-panel-rule" />
      <div className="claim-chain" style={{ gap: 4 }}>
        <ChainRow pos={1} type="claimed" address="42 Garden Road, Harrow" agency="Hartwell Partners" />
        <ConnectorEl />
        <ChainRow pos={2} type="yours" address="12 Acme Street" />
        <ConnectorEl />
        <ChainRow pos={3} type="pending" />
      </div>
      <p className="claim-panel-invite">
        Invited by Sarah Hartwell · 12 May 2026
      </p>
    </div>
  );
}

function SignupForm({ warn }: { warn?: boolean }) {
  return (
    <div>
      <h1 className="claim-sub-h1">Create your account</h1>
      <p className="claim-sub-p">Join free — no card required.</p>

      {warn && (
        <div className="claim-warn-card">
          <p className="claim-warn-p">
            <strong>You&apos;re logged in as a different account.</strong> This invite was sent to{" "}
            <strong>s.harris@estates.co.uk</strong>. Log out and sign up with that address to claim this sale.
          </p>
          <p className="claim-warn-p">
            <a href="#" style={{ color: "#92400e", fontWeight: 600, textDecoration: "underline" }}>Log out and use the correct account</a>
          </p>
        </div>
      )}

      <div className="claim-form-card">
        <div className="claim-field">
          <label className="claim-field-label">Full name</label>
          <input className="claim-field-input" defaultValue="" placeholder="Jane Smith" readOnly />
        </div>
        <div className="claim-field">
          <label className="claim-field-label">Email address</label>
          <input className="claim-field-input" defaultValue="s.harris@estates.co.uk" readOnly style={{ background: "#F4F4F4", color: "#8b91a3" }} />
        </div>
        <div className="claim-field">
          <label className="claim-field-label">Firm name</label>
          <input className="claim-field-input" defaultValue="" placeholder="Harris Estates" readOnly />
        </div>
        <div className="claim-field claim-field-gap">
          <label className="claim-field-label">Password</label>
          <div className="claim-field-row">
            <input className="claim-field-input" type="password" defaultValue="" placeholder="Min. 8 characters" readOnly />
            <button className="claim-field-toggle" type="button">Show</button>
          </div>
        </div>
        <a href="#" className="claim-btn">Create account &amp; claim</a>
        <p className="claim-form-terms">
          By creating an account you agree to our{" "}
          <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
        </p>
      </div>

      <p className="claim-link-row" style={{ marginTop: 16 }}>
        Already have an account?{" "}
        <a href="#">Log in instead</a>
      </p>
    </div>
  );
}

function ClaimSignupDesktop({ warn }: { warn?: boolean }) {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className="claim-signup-grid">
        <SignupForm warn={warn} />
        <SignupPanel />
      </div>
    </div>
  );
}

function ClaimSignupMobile() {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className="claim-container--narrow">
        <SignupForm />
      </div>
    </div>
  );
}

// ─── Route 3 — /claim/login ───────────────────────────────────────────────────

function ClaimLogin({ mobile }: { mobile?: boolean }) {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className={mobile ? "claim-container--narrow" : "claim-container--narrow"} style={{ maxWidth: mobile ? 375 : 440 }}>
        <ContextStrip address="12 Acme Street, Birmingham" />
        <h1 className="claim-sub-h1">Log in to claim</h1>
        <p className="claim-sub-p">
          We found an account for <strong>s.harris@estates.co.uk</strong>.
          Log in to link your sale.
        </p>
        <div className="claim-form-card">
          <div className="claim-field">
            <label className="claim-field-label">Email address</label>
            <input className="claim-field-input" defaultValue="s.harris@estates.co.uk" readOnly style={{ background: "#F4F4F4", color: "#8b91a3" }} />
          </div>
          <div className="claim-field claim-field-gap">
            <label className="claim-field-label">Password</label>
            <div className="claim-field-row">
              <input className="claim-field-input" type="password" defaultValue="" placeholder="" readOnly />
              <button className="claim-field-toggle" type="button">Show</button>
            </div>
          </div>
          <a href="#" className="claim-btn">Log in &amp; claim</a>
          <p className="claim-form-forgot">
            Forgot your password?{" "}
            <a href="#" style={{ color: "#8b91a3", fontWeight: 600 }}>Reset it</a>
          </p>
        </div>
        <p className="claim-link-row" style={{ marginTop: 16 }}>
          New agent?{" "}
          <a href="#">Create an account instead</a>
        </p>
      </div>
    </div>
  );
}

// ─── Route 4 — /claim/confirm ─────────────────────────────────────────────────

function ClaimConfirmCreate({ mobile }: { mobile?: boolean }) {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div style={{ maxWidth: mobile ? 375 : 480, margin: "0 auto", padding: "0 20px 64px" }}>
        <ContextStrip address="12 Acme Street, Birmingham" />
        <h1 className="claim-confirm-h1">Ready to join this chain</h1>
        <p className="claim-confirm-p">
          Confirm the details below and we&apos;ll link your sale.
        </p>
        <div className="claim-summary">
          <div className="claim-summary-row">
            <span className="claim-summary-label">Property</span>
            <span className="claim-summary-value">12 Acme Street, Birmingham</span>
          </div>
          <div className="claim-summary-row">
            <span className="claim-summary-label">Invited by</span>
            <span className="claim-summary-value">Sarah Hartwell · Hartwell Partners</span>
          </div>
          <div className="claim-summary-row">
            <span className="claim-summary-label">Your account</span>
            <span className="claim-summary-value">s.harris@estates.co.uk</span>
          </div>
          <div className="claim-summary-row">
            <span className="claim-summary-label">Chain position</span>
            <span className="claim-summary-value">#2 of 3</span>
          </div>
        </div>
        <a href="#" className="claim-btn">Claim this sale</a>
        <p className="claim-wrong-note">
          Something wrong? <a href="#">Back to invite</a>
        </p>
      </div>
    </div>
  );
}

function ClaimConfirmLink() {
  const [choice, setChoice] = useState<"create" | "link">("create");
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 64px" }}>
        <ContextStrip address="12 Acme Street, Birmingham" />
        <h1 className="claim-confirm-h1">Is this already in your system?</h1>
        <p className="claim-confirm-p">
          We spotted a sale at the same address. Link the existing one or create a new file.
        </p>

        {/* Duplicate picker */}
        <div style={{ marginBottom: 20 }}>
          <div
            className={`claim-dup-option${choice === "create" ? " selected" : ""}`}
            onClick={() => setChoice("create")}
          >
            <div className="claim-dup-radio" />
            <div>
              <p className="claim-dup-label">Create a new sale for this address</p>
              <p className="claim-dup-sub">Start a fresh file for 12 Acme Street, Birmingham</p>
            </div>
          </div>
          <div
            className={`claim-dup-option${choice === "link" ? " selected" : ""}`}
            onClick={() => setChoice("link")}
          >
            <div className="claim-dup-radio" />
            <div>
              <p className="claim-dup-label">Link my existing sale</p>
              <p className="claim-dup-sub">12 Acme Street — added 3 days ago</p>
            </div>
          </div>
        </div>

        <div className="claim-summary" style={{ marginBottom: 20 }}>
          <div className="claim-summary-row">
            <span className="claim-summary-label">Property</span>
            <span className="claim-summary-value">12 Acme Street, Birmingham</span>
          </div>
          <div className="claim-summary-row">
            <span className="claim-summary-label">Chain position</span>
            <span className="claim-summary-value">#2 of 3</span>
          </div>
        </div>

        <a href="#" className="claim-btn">
          {choice === "link" ? "Link this sale" : "Claim this sale"}
        </a>
        <p className="claim-wrong-note">
          Something wrong? <a href="#">Back to invite</a>
        </p>
      </div>
    </div>
  );
}

// ─── Route 5 — /claim/decline ─────────────────────────────────────────────────

function ClaimDeclineMain({ mobile }: { mobile?: boolean }) {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className="claim-decline-wrap" style={{ minHeight: mobile ? 400 : 440 }}>
        <div className="claim-decline-bloom" />
        <div className="claim-decline-body">
          <h1 className="claim-decline-h1">All noted.</h1>
          <p className="claim-decline-sub">
            We&apos;ve let them know this isn&apos;t your sale. Estate agencies are busy —
            thanks for letting us know.
          </p>
          <div className="claim-nudge-card">
            <p className="claim-nudge-text">
              Changed your mind? This link is valid until 19 June 2026.
            </p>
            <a href="#" className="claim-btn claim-btn--ghost">Claim after all</a>
          </div>
          <p className="claim-about">
            What is The Sales Progressor? Estate agents use it to track every sale in a chain
            together — so everyone knows where the hold-up is before they pick up the phone.
          </p>
          <p className="claim-support">
            Questions?{" "}
            <a href="mailto:support@thesalesprogressor.co.uk">
              support@thesalesprogressor.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function ClaimDeclineAlreadyNoted() {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className="claim-decline-wrap" style={{ minHeight: 440 }}>
        <div className="claim-decline-bloom" />
        <div className="claim-decline-body">
          <h1 className="claim-decline-h1">Already noted.</h1>
          <p className="claim-decline-sub">
            We already let them know. Nothing more needed from you.
          </p>
          <div className="claim-nudge-card">
            <p className="claim-nudge-text">
              Changed your mind? This link is valid until 19 June 2026.
            </p>
            <a href="#" className="claim-btn claim-btn--ghost">Claim after all</a>
          </div>
          <p className="claim-about">
            What is The Sales Progressor? Estate agents use it to track every sale in a chain
            together — so everyone knows where the hold-up is before they pick up the phone.
          </p>
          <p className="claim-support">
            Questions?{" "}
            <a href="mailto:support@thesalesprogressor.co.uk">
              support@thesalesprogressor.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function ClaimDeclineExpired() {
  return (
    <div className="claim-page">
      <ClaimHdr />
      <div className="claim-decline-wrap" style={{ minHeight: 440 }}>
        <div className="claim-decline-bloom" />
        <div className="claim-decline-body">
          <h1 className="claim-decline-h1">This invite has expired.</h1>
          <p className="claim-decline-sub">
            The link was valid for 7 days. No action needed — we haven&apos;t notified anyone.
          </p>
          <p className="claim-about">
            What is The Sales Progressor? Estate agents use it to track every sale in a chain
            together — so everyone knows where the hold-up is before they pick up the phone.
          </p>
          <p className="claim-support">
            Questions?{" "}
            <a href="mailto:support@thesalesprogressor.co.uk">
              support@thesalesprogressor.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Frame wrapper helpers ────────────────────────────────────────────────────

function Frame({ children, mobile }: { children: React.ReactNode; mobile?: boolean }) {
  return (
    <div className="cf-frame-wrap">
      <span className="cf-frame-tag">{mobile ? "Mobile — 375px" : "Desktop — 560px"}</span>
      <div className={`cf-frame ${mobile ? "cf-frame--mobile" : "cf-frame--desktop"}`}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClaimFlowPolishPage() {
  return (
    <div>
      <style>{CSS}</style>
      <PageHeader title="Claim Flow — Polish Pass" subtitle="All 5 routes · All state variants · Desktop + 375px mobile" />

      <div className="cf-outer">

        {/* ── ROUTE 1: /claim — main landing ── */}
        <div className="cf-label">ROUTE 1 — /claim — Main landing (3-link chain, you are #2)</div>
        <p className="cf-sub">Hero card contains chain visual. CTA block below on cream background.</p>
        <div className="cf-frames">
          <Frame><ClaimLanding /></Frame>
          <Frame mobile><ClaimLanding mobile /></Frame>
        </div>

        {/* ── ROUTE 1: /claim — 5-link chain (ghost row) ── */}
        <div className="cf-label">ROUTE 1 — /claim — 5-link chain (truncated, you are #3)</div>
        <p className="cf-sub">Chains over 4 links: show first 3 real cards + ghost &quot;and N more&quot; row.</p>
        <div className="cf-frames">
          <Frame><ClaimLanding5Links /></Frame>
        </div>

        {/* ── ROUTE 1: /claim — error states ── */}
        <div className="cf-label">ROUTE 1 — /claim — Expired invite</div>
        <p className="cf-sub">inviteTokenExpiresAt in the past. No chain preview shown.</p>
        <div className="cf-frames">
          <Frame>
            <ClaimErrorState
              title="This invite has expired."
              body="The link was valid for 7 days after it was sent. Ask the inviting agent to resend it."
            />
          </Frame>
        </div>

        <div className="cf-label">ROUTE 1 — /claim — Already claimed</div>
        <p className="cf-sub">transactionId !== null or inviteStatus === CLAIMED.</p>
        <div className="cf-frames">
          <Frame>
            <ClaimErrorState
              title="Already claimed"
              body="This chain link has already been claimed. If you believe this is a mistake, contact support."
            />
          </Frame>
        </div>

        {/* ── ROUTE 2: /claim/signup ── */}
        <div className="cf-label">ROUTE 2 — /claim/signup — Standard (email pre-filled, read-only)</div>
        <p className="cf-sub">Desktop: two-column 55/42fr. Mobile: single column, chain panel hidden.</p>
        <div className="cf-frames">
          <Frame><ClaimSignupDesktop /></Frame>
          <Frame mobile><ClaimSignupMobile /></Frame>
        </div>

        <div className="cf-label">ROUTE 2 — /claim/signup — Wrong account warning</div>
        <p className="cf-sub">Logged in as different user. Yellow warning card above form.</p>
        <div className="cf-frames">
          <Frame><ClaimSignupDesktop warn /></Frame>
        </div>

        {/* ── ROUTE 3: /claim/login ── */}
        <div className="cf-label">ROUTE 3 — /claim/login — Standard</div>
        <p className="cf-sub">Context strip + email pre-filled from stub (read-only). Password field.</p>
        <div className="cf-frames">
          <Frame><ClaimLogin /></Frame>
          <Frame mobile><ClaimLogin mobile /></Frame>
        </div>

        {/* ── ROUTE 4: /claim/confirm ── */}
        <div className="cf-label">ROUTE 4 — /claim/confirm — Create new sale (default)</div>
        <p className="cf-sub">No existing transactions. Summary card + single CTA.</p>
        <div className="cf-frames">
          <Frame><ClaimConfirmCreate /></Frame>
          <Frame mobile><ClaimConfirmCreate mobile /></Frame>
        </div>

        <div className="cf-label">ROUTE 4 — /claim/confirm — Link existing sale (duplicate picker)</div>
        <p className="cf-sub">
          Agent already has a transaction at this address. Picker is interactive in this frame — click to toggle.
        </p>
        <div className="cf-frames">
          <Frame><ClaimConfirmLink /></Frame>
        </div>

        {/* ── ROUTE 5: /claim/decline ── */}
        <div className="cf-label">ROUTE 5 — /claim/decline — All noted (first decline)</div>
        <p className="cf-sub">Coral radial bloom atmosphere. Nudge card with expiry date + ghost CTA.</p>
        <div className="cf-frames">
          <Frame><ClaimDeclineMain /></Frame>
          <Frame mobile><ClaimDeclineMain mobile /></Frame>
        </div>

        <div className="cf-label">ROUTE 5 — /claim/decline — Already noted (idempotent reload)</div>
        <p className="cf-sub">inviteStatus already DECLINED. Same layout, copy changes.</p>
        <div className="cf-frames">
          <Frame><ClaimDeclineAlreadyNoted /></Frame>
        </div>

        <div className="cf-label">ROUTE 5 — /claim/decline — Expired (no nudge card)</div>
        <p className="cf-sub">Expired link — cannot reclaim. Nudge card omitted. No notification sent.</p>
        <div className="cf-frames">
          <Frame><ClaimDeclineExpired /></Frame>
        </div>

      </div>
    </div>
  );
}
