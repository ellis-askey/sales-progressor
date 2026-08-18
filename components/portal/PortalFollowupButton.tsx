"use client";

// Smart "email your conveyancer" button (follow-up sender). Shows a status pill
// (whose court the ball is in) and opens a compose sheet with a pre-written,
// situation-appropriate draft. "Open in email" hands off to the client's own
// mail app (mailto), agency CC'd — they hit send themselves. We log the tap for
// the Command Centre usage view; the CC'd copy is the proof of an actual send.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { P, PORTAL_BTN, PortalPill, type PortalPillTone } from "@/components/portal/portal-ui";

export type FollowupNudgeProps = {
  token: string;
  state: "calm" | "check_in" | "behind" | "other_side";
  stepCode: string;
  subject: string;
  body: string;
  solicitorEmail: string;
  solicitorName: string | null;
  ccEmail: string | null;
};

// Tones use the standard PortalPill (white, coloured hairline + dot). The
// "nudge" state is coral (our brand warm), NOT alarm-red: the chase timings are
// the average for a smooth sale, not a set deadline, so this reads as "a nudge
// could help", never "your solicitor is failing". Subtext explains it gently.
const STATE_META: Record<FollowupNudgeProps["state"], { label: string; tone: PortalPillTone; subtext: string }> = {
  calm: { label: "With your solicitor", tone: "grey", subtext: "Your solicitor is dealing with this." },
  check_in: { label: "Worth a check-in", tone: "amber", subtext: "A good time to check in and keep things moving." },
  behind: { label: "A nudge would help", tone: "coral", subtext: "It's been a little while, so a friendly nudge can help keep things moving." },
  other_side: { label: "Waiting on the other side", tone: "grey", subtext: "Your solicitor is waiting on the other side to come back." },
};

// Shown on the solicitor row when we have a conveyancer but no email on file:
// prompts the client to add it, deep-linking to the solicitor section of the
// menu drawer (the same "portal:open-menu" event the manage rows use).
export function PortalAddConveyancerEmail() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("portal:open-menu", { detail: { section: "solicitor", edit: true } }))}
      className="pbtn pbtn-press"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        marginTop: 10,
        fontSize: 12.5,
        fontWeight: 700,
        padding: "9px 14px",
        borderRadius: 11,
        background: "transparent",
        border: `1px solid ${P.border}`,
        color: P.accent,
      }}
    >
      Add their email to message them here
    </button>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2m0 4l-8 5-8-5V6l8 5 8-5z" />
    </svg>
  );
}

function buildMailto(to: string, cc: string | null, subject: string, body: string): string {
  const params = [
    cc ? `cc=${encodeURIComponent(cc)}` : null,
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body)}`,
  ]
    .filter(Boolean)
    .join("&");
  return `mailto:${encodeURIComponent(to)}?${params}`;
}

export function PortalFollowupButton({
  token,
  state,
  stepCode,
  subject,
  body,
  solicitorEmail,
  solicitorName,
  ccEmail,
  trailing,
}: FollowupNudgeProps & { trailing?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState(body);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setDraft(body);
  }, [open, body]);

  const meta = STATE_META[state];
  const isNudge = state === "check_in" || state === "behind";
  const btnLabel = state === "other_side" ? "Request an update" : isNudge ? "Follow up" : "Email your conveyancer";

  function openMail() {
    fetch(`/api/portal/${token}/followup-tap`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stepCode, state }),
    }).catch(() => {});
    window.location.href = buildMailto(solicitorEmail, ccEmail, subject, draft);
    setOpen(false);
  }

  const sheet = open ? (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: "rgba(15,23,42,0.42)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: P.pageBg,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.28)",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 999, background: P.border, margin: "0 auto 14px" }} />
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: P.textPrimary }}>Email your conveyancer</p>
        <p style={{ margin: "3px 0 14px", fontSize: 12.5, color: P.textSecondary }}>
          To {solicitorName ?? solicitorEmail}. We&rsquo;ll be copied in. Opens in your email app, ready to send.
        </p>

        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: P.textMuted }}>
          Subject
        </p>
        <div style={{ fontSize: 13.5, color: P.textPrimary, background: P.cardBg, borderRadius: 12, padding: "10px 12px", marginBottom: 12, boxShadow: P.shadowSm }}>
          {subject}
        </div>

        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: P.textMuted }}>
          Message
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={9}
          placeholder="Write your message..."
          style={{
            width: "100%",
            fontSize: 13.5,
            lineHeight: 1.5,
            color: P.textPrimary,
            background: P.cardBg,
            border: `1px solid ${P.border}`,
            borderRadius: 12,
            padding: "10px 12px",
            outline: "none",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="pbtn pbtn-press"
            style={{ flex: "0 0 auto", fontSize: 13.5, fontWeight: 700, padding: "12px 16px", borderRadius: 12, background: "transparent", border: `1px solid ${P.border}`, color: P.textSecondary }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={openMail}
            disabled={!draft.trim()}
            className="pbtn pbtn-press"
            style={{ flex: 1, fontSize: 13.5, fontWeight: 700, padding: "12px 16px", borderRadius: 12, background: PORTAL_BTN.emailBg, boxShadow: PORTAL_BTN.emailShadow, color: "#fff", opacity: draft.trim() ? 1 : 0.5 }}
          >
            Open in email
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
      <div style={{ alignSelf: "flex-start" }}>
        <PortalPill tone={meta.tone}>{meta.label}</PortalPill>
      </div>
      <span style={{ fontSize: 12, color: P.textSecondary, lineHeight: 1.45 }}>{meta.subtext}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pbtn pbtn-press"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12.5,
            fontWeight: 700,
            padding: "9px 14px",
            borderRadius: 11,
            background: isNudge ? PORTAL_BTN.emailBg : "transparent",
            border: isNudge ? "none" : `1px solid ${P.border}`,
            boxShadow: isNudge ? PORTAL_BTN.emailShadow : undefined,
            color: isNudge ? "#fff" : P.textSecondary,
          }}
        >
          <MailIcon /> {btnLabel}
        </button>
        {trailing}
      </div>
      {mounted && sheet ? createPortal(sheet, document.body) : null}
    </div>
  );
}
