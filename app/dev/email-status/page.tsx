"use client";

// /dev preview — delivery-status dot on email activity cards.
// Faithful mock of the file activity feed (components/activity/ActivityTimeline)
// so the dot placement + colours can be judged before wiring the real data.
// Data already exists: SendGrid events stamp OutboundMessage.status / deliveredAt
// / bouncedAt / openedAt (lib/email/sendgrid-webhook.ts).

import { useState } from "react";

type Delivery = "sent" | "delivered" | "bounced" | "none";

const C = {
  coral: "#FF6B4A",
  coralDeep: "#E0552F",
  ink: "#1e2d4a",
  muted: "#8b93a7",
  border: "rgba(30,45,74,0.09)",
  sent: "#9aa3b2",
  delivered: "#15b371",
  bounced: "#e5484d",
};

function StatusIndicator({ state, reason }: { state: Delivery; reason?: string }) {
  if (state === "none") return null;
  const cfg = {
    sent: { dot: C.sent, label: "Sent", text: C.muted },
    delivered: { dot: C.delivered, label: "Delivered", text: C.muted },
    bounced: { dot: C.bounced, label: "Bounced", text: C.bounced },
  }[state];
  return (
    <span
      title={state === "bounced" && reason ? `Bounced: ${reason}` : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        fontSize: 10.5, fontWeight: 600, letterSpacing: "0.01em", color: cfg.text,
        cursor: state === "bounced" ? "help" : "default",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: cfg.dot, boxShadow: `0 0 0 3px ${cfg.dot}1f` }} />
      {cfg.label}
    </span>
  );
}

function TspAvatar() {
  return (
    <span style={{
      width: 26, height: 26, borderRadius: 999, flexShrink: 0,
      background: `linear-gradient(140deg, #ff8a63, ${C.coral})`,
      display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 13,
      boxShadow: "0 1px 2px rgba(224,85,47,0.35)",
    }}>e</span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, color: "#4a5570",
      padding: "3px 10px", borderRadius: 999, background: "rgba(30,45,74,0.045)",
      border: `0.5px solid ${C.border}`,
    }}>{children}</span>
  );
}

function EmailCard({
  state, reason, actor, body, cta, recipient, time, inbound,
}: {
  state: Delivery; reason?: string; actor: string; body: React.ReactNode;
  cta?: string; recipient?: string; time: string; inbound?: boolean;
}) {
  return (
    <div style={{ position: "relative", padding: "16px 18px", borderRadius: 16, border: `0.5px solid ${C.border}`,
      background: "linear-gradient(135deg, #ffffff 0%, #fbfaff 55%, #f6f4fb 100%)",
      boxShadow: "0 1px 2px rgba(30,45,74,0.04), 0 10px 26px rgba(30,45,74,0.05)" }}>

      {/* delivery dot — top-right */}
      <div style={{ position: "absolute", top: 13, right: 15 }}>
        <StatusIndicator state={state} reason={reason} />
      </div>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        {inbound
          ? <span style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, background: "rgba(21,179,113,0.14)", display: "grid", placeItems: "center", color: C.delivered, fontWeight: 700, fontSize: 12 }}>{actor.slice(0, 1)}</span>
          : <TspAvatar />}
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{actor}</span>
      </div>

      {/* body */}
      <div style={{ fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{body}</div>

      {cta && (
        <button style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, background: "none",
          border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 600,
          color: C.coralDeep, cursor: "pointer" }}>
          <span style={{ fontWeight: 700 }}>›</span> {cta}
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 14 }}>
        {recipient ? <Pill>{recipient}</Pill> : <span />}
        <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{time}</span>
      </div>
    </div>
  );
}

export default function EmailStatusPreview() {
  const [showOpened, setShowOpened] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f4f3f8, #eceaf3)", padding: "40px 20px 80px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ marginBottom: 6, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: C.coralDeep }}>Preview · activity cards</div>
        <h1 style={{ margin: "2px 0 8px", fontSize: 26, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Email delivery status</h1>
        <p style={{ margin: "0 0 10px", fontSize: 14.5, color: "#55607a", lineHeight: 1.55, maxWidth: "54ch" }}>
          A small dot + label, top-right of each <b>email</b> card. Three states only — <b>sent</b>, <b>delivered</b>, <b>bounced</b>. The red bounce is the one that earns its place: it flags a client who never got the email.
        </p>

        {/* legend */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "14px 0 24px", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.6)", border: `0.5px solid ${C.border}` }}>
          <Legend dot={C.sent} label="Sent" note="left our system" />
          <Legend dot={C.delivered} label="Delivered" note="reached their inbox server" />
          <Legend dot={C.bounced} label="Bounced" note="never arrived — hover for why" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <EmailCard
            state="delivered" actor="TSP" time="Today, 10:00" recipient="Danielle Casali" cta="Open response page"
            body={<>
              <p style={{ margin: "0 0 12px" }}>Hi Danielle,</p>
              <p style={{ margin: "0 0 12px" }}>A quick update on your purchase at 18 Old Mill Gardens.</p>
              <p style={{ margin: 0 }}>One thing is sitting with your solicitor right now that we haven&apos;t seen confirmed yet: <b>Searches being ordered</b>.</p>
            </>}
          />

          <EmailCard
            state="sent" actor="TSP" time="Today, 10:00" recipient="Mark Webb"
            body={<>
              <p style={{ margin: "0 0 12px" }}>Hi Mark,</p>
              <p style={{ margin: 0 }}>Memorandum of sale issued for 4 Thornbury Rise — the legal process has officially started.</p>
            </>}
          />

          <EmailCard
            state="bounced" actor="TSP" time="Today, 10:00" recipient="j.okafor@gmai.com" reason="550 mailbox does not exist"
            body={<>
              <p style={{ margin: "0 0 12px" }}>Hi Joseph,</p>
              <p style={{ margin: 0 }}>Your mortgage offer has arrived for 22 Larch Close. Congratulations — your mortgage is confirmed.</p>
            </>}
          />

          <EmailCard
            state="none" inbound actor="Maria (Curwens)" time="Today, 09:12"
            body={<p style={{ margin: 0 }}>Thanks — searches are ordered, we&apos;ll chase the local authority and revert.</p>}
          />

          <EmailCard
            state="sent" actor="Jack at Akeman (via Outlook)" time="Today, 08:40" recipient="Faizan (Muve)"
            body={<p style={{ margin: 0 }}>Please find the draft contract pack attached for 2 Magnolia Way.</p>}
          />
        </div>

        <p style={{ margin: "22px 2px 0", fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
          Notes: the <b>inbound</b> reply (green avatar) carries no dot — delivery status only applies to what we send.
          The last card was sent through a connected <b>Outlook</b> mailbox, so it shows only <b>Sent</b> — those don&apos;t
          report delivery back to us (SendGrid sends do).
        </p>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 18, fontSize: 13, color: "#55607a", cursor: "pointer" }}>
          <input type="checkbox" checked={showOpened} onChange={(e) => setShowOpened(e.target.checked)} />
          Also show an &ldquo;Opened&rdquo; state (not recommended)
        </label>
        {showOpened && (
          <p style={{ margin: "8px 2px 0", fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
            We can detect opens, but only on some emails, and it&apos;s an unreliable signal (image-blocking, privacy proxies).
            A green &ldquo;Delivered&rdquo; is honest; an &ldquo;Opened&rdquo; that silently fails to register reads as &ldquo;they ignored me&rdquo; when they didn&apos;t. Recommend leaving it out.
          </p>
        )}
      </div>
    </div>
  );
}

function Legend({ dot, label, note }: { dot: string; label: string; note: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#4a5570" }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: dot, boxShadow: `0 0 0 3px ${dot}1f` }} />
      <b style={{ color: C.ink }}>{label}</b>
      <span style={{ color: C.muted }}>· {note}</span>
    </span>
  );
}
