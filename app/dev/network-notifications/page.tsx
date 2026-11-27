"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE — Progressor Network: closing the silent loop.
//
// Two gaps from the audit, previewed for approval before anything is wired:
//   #1  Nobody is told anything. Three emails that would fire on the real
//       handshake: request → progressor, accepted → agency, declined → agency.
//   #4  A decline looks like a glitch. The agency's Introductions tab, before
//       (request silently vanishes) and after (a clear "not taken up" state).
//
// Email frames mirror the real TSP email shell (lib/emails/retention: 600px
// white card, #EAE6E1 border, Hanken Grotesk, coral CTA). Copy is the proposal —
// nothing here sends. Strings voice-passed (no em-dashes, no exclamations).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

const FONT = "'Hanken Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
const CORAL_GRAD = "linear-gradient(180deg,#FF7E57 0%,#F0511A 100%)";

// ── A faithful mini email shell (matches lib/emails/retention/emailShell) ──────
function EmailFrame({
  from,
  to,
  subject,
  children,
}: {
  from: string;
  to: string;
  subject: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: FONT, fontSize: 12.5, color: "#6b7280", lineHeight: 1.6 }}>
        <div><strong style={{ color: "#374151" }}>From</strong> &nbsp;{from}</div>
        <div><strong style={{ color: "#374151" }}>To</strong> &nbsp;&nbsp;&nbsp;{to}</div>
        <div><strong style={{ color: "#374151" }}>Subject</strong> &nbsp;{subject}</div>
      </div>
      <div style={{ background: "#F3F0EC", borderRadius: 18, padding: "24px 14px" }}>
        <div
          style={{
            width: 600,
            maxWidth: "100%",
            margin: "0 auto",
            background: "#fff",
            borderRadius: 22,
            border: "1px solid #EAE6E1",
            boxShadow: "0 6px 26px rgba(17,24,39,0.07)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "26px 34px 0" }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: "#F0511A", letterSpacing: "-0.01em" }}>
              The Sales Progressor
            </div>
          </div>
          <div style={{ padding: "18px 34px 30px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 15px", fontFamily: FONT, fontSize: 15.5, lineHeight: 1.6, color: "#374151" }}>{children}</p>;
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 16px", fontFamily: FONT, fontSize: 21, fontWeight: 750, letterSpacing: "-0.02em", color: "#1a1d29" }}>{children}</p>;
}

function Cta({ label }: { label: string }) {
  return (
    <div style={{ padding: "6px 0 2px" }}>
      <span style={{ display: "inline-block", background: CORAL_GRAD, borderRadius: 14, boxShadow: "0 6px 16px rgba(240,81,26,0.30)" }}>
        <span style={{ display: "block", padding: "14px 26px", fontFamily: FONT, fontSize: 15.5, fontWeight: 700, color: "#fff" }}>{label}</span>
      </span>
    </div>
  );
}

function NoteBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: "2px 0 18px", padding: "14px 17px", background: "#F7F5F2", border: "1px solid #ECE7E1", borderRadius: 12 }}>
      <p style={{ margin: 0, fontFamily: FONT, fontSize: 14.5, lineHeight: 1.55, color: "#4b5563", fontStyle: "italic" }}>&ldquo;{children}&rdquo;</p>
    </div>
  );
}

// ── #4 — the agency's Introductions tab, before vs after a decline ────────────
function Monogram() {
  return (
    <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 11, background: "#1F6F5C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>
      MW
    </div>
  );
}

function DeclinedAfter() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) {
    return (
      <div style={{ fontFamily: FONT, fontSize: 13.5, color: "#8A8178", padding: "18px 4px" }}>
        Dismissed. Moves By Wright is back in Discover whenever you want to try again.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 13, alignItems: "center", background: "#FFFDFB", border: "1px solid rgba(45,24,16,0.10)", borderRadius: 16, padding: "16px 18px" }}>
      <Monogram />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: "#2A2320" }}>Moves By Wright</div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: "#8A8178", marginTop: 2 }}>
          Not taken up. They aren&apos;t accepting new connections right now.
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: "#5C544C", background: "#fff", border: "1px solid rgba(45,24,16,0.14)", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}
      >
        Dismiss
      </button>
    </div>
  );
}

export default function NetworkNotificationsPreview() {
  return (
    <div style={{ minHeight: "100vh", background: "#ECE7E0", padding: "40px 20px 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
        {/* Intro */}
        <div>
          <p style={{ margin: 0, fontFamily: FONT, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#F0511A" }}>Preview · not wired</p>
          <h1 style={{ margin: "8px 0 0", fontFamily: FONT, fontSize: 28, fontWeight: 780, letterSpacing: "-0.02em", color: "#1a1d29" }}>Closing the silent loop</h1>
          <p style={{ margin: "10px 0 0", fontFamily: FONT, fontSize: 15.5, lineHeight: 1.6, color: "#4b5563", maxWidth: 560 }}>
            Right now the whole handshake happens in silence. These are the emails that would fire on the real events, and the state the agency would see when a request isn&apos;t taken up. Nothing here sends yet.
          </p>
        </div>

        {/* #1 — Emails */}
        <section style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <SectionTitle n="1" title="The three emails" sub="One on each real event in the handshake." />

          <EmailFrame
            from="The Sales Progressor"
            to="Moves By Wright (progressor)"
            subject="Boardwalk would like to connect with you"
          >
            <Heading>A new connection request</Heading>
            <Para>Boardwalk has found you on the Progressor Network and would like to connect. Once you accept, they&apos;ll be able to hand sales to you to progress.</Para>
            <NoteBlock>We&apos;ve worked with your team before and would love to send some of our sales your way.</NoteBlock>
            <Para>You can accept or decline from your Clients page. We&apos;ll let Boardwalk know either way.</Para>
            <Cta label="Review the request" />
          </EmailFrame>

          <EmailFrame
            from="The Sales Progressor"
            to="Boardwalk (agency)"
            subject="You're connected with Moves By Wright"
          >
            <Heading>Connection accepted</Heading>
            <Para>Moves By Wright has accepted your request. They&apos;re now in your progressors list, and you can hand a sale over to them whenever you&apos;re ready.</Para>
            <Para>Connecting on its own shares nothing. A sale only moves across when you choose to hand one over.</Para>
            <Cta label="Assign a sale" />
          </EmailFrame>

          <EmailFrame
            from="The Sales Progressor"
            to="Boardwalk (agency)"
            subject="Update on your connection request"
          >
            <Heading>Your request wasn&apos;t taken up</Heading>
            <Para>Moves By Wright isn&apos;t able to take on new connections right now, so your request wasn&apos;t taken up. Nothing has been shared, and you&apos;re free to connect with other progressors on the network.</Para>
            <Cta label="Browse the network" />
          </EmailFrame>
        </section>

        {/* #4 — Declined state */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionTitle n="4" title="When a request is declined" sub="What the agency sees on their Introductions tab." />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Label>Today</Label>
            <div style={{ fontFamily: FONT, fontSize: 14, color: "#6b7280", lineHeight: 1.6, background: "#fff", border: "1px dashed rgba(45,24,16,0.18)", borderRadius: 16, padding: "20px 22px" }}>
              The request simply disappears. The card quietly flips back to &ldquo;Request to connect&rdquo; with no word that they said no, and nothing stops you asking again straight away. It reads like a glitch.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Label>Proposed</Label>
            <DeclinedAfter />
            <p style={{ margin: "4px 0 0", fontFamily: FONT, fontSize: 13, color: "#8A8178", lineHeight: 1.55 }}>
              A clear, gentle &ldquo;not taken up&rdquo; row stays until you dismiss it, paired with the email above. No blame, no dead end, and the business returns to Discover so you can try again later.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: "#fff", background: CORAL_GRAD, borderRadius: 8, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
      <div>
        <h2 style={{ margin: 0, fontFamily: FONT, fontSize: 19, fontWeight: 750, letterSpacing: "-0.01em", color: "#1a1d29" }}>{title}</h2>
        <p style={{ margin: "3px 0 0", fontFamily: FONT, fontSize: 13.5, color: "#6b7280" }}>{sub}</p>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9A9189" }}>{children}</span>;
}
