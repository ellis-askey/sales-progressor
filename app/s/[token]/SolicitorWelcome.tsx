"use client";

import { useEffect, useState } from "react";
import { FileText, UsersThree, ShieldCheck, Lock, Check, Key, Package } from "@phosphor-icons/react/dist/ssr";
import { S } from "./ui";

// First-visit primer — the solicitor version of the client welcome sheet
// (PortalWelcomeSheet): a lead line, a small progress stepper with a gently
// pulsing "in progress" node, three points, then the CTA with a reassurance
// footer beneath it. Slides up once per device, sits above the cookie banner,
// and releases it on close.

const PROGRESS_BLUE = "#2f5fd0"; // the pulsing in-progress node (solicitor accent)
const PURPLE = "#7c5cf0";
const BTN_GRADIENT = "linear-gradient(135deg, #3a6fd8 0%, #2f5fd0 100%)";

export function SolicitorWelcome({ firstName, side }: { firstName: string; side: "vendor" | "purchaser" }) {
  const [show, setShow] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("sol_welcome_seen") === "1") return;
    setShow(true);
    const t = setTimeout(() => setEntered(true), 60); // let it mount, then slide up
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setEntered(false);
    localStorage.setItem("sol_welcome_seen", "1");
    // Release the cookie banner (which held back while this was open) so it can
    // fade in now, and never share the screen with us.
    document.documentElement.removeAttribute("data-welcome-open");
    window.dispatchEvent(new Event("welcome:closed"));
    setTimeout(() => setShow(false), 260);
  }

  if (!show) return null;

  const dealWord = side === "vendor" ? "sale" : "purchase";

  return (
    <>
      {/* Above the cookie banner (z 10000) + its manage modal (10001). */}
      <div onClick={dismiss} style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(9,20,40,0.36)", backdropFilter: "blur(3px)", opacity: entered ? 1 : 0, transition: "opacity 240ms ease" }} />
      <div
        role="dialog"
        aria-label="Welcome"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10003,
          maxWidth: 620,
          margin: "0 auto",
          background: S.card,
          borderRadius: "22px 22px 0 0",
          boxShadow: "0 -12px 36px rgba(9,20,40,0.2)",
          padding: "10px 24px calc(22px + env(safe-area-inset-bottom))",
          maxHeight: "92svh",
          overflowY: "auto",
          transform: entered ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(15,39,64,0.14)", margin: "4px auto 14px" }} />

        <h2 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 700, color: S.ink, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h2>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: S.ink }}>A simple way to keep everyone in the loop.</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: S.inkSoft }}>
          When something moves, update it here in a couple of clicks. We&rsquo;ll keep the agent and clients informed, helping cut down the progress-chasing calls and emails coming your way.
        </p>

        <Stepper side={side} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <Point iconBg={S.successBg} iconColor={S.success} icon={<FileText size={18} weight="regular" />} title="Keep everyone updated">
            Confirm key stages as they happen and we&rsquo;ll share the latest position.
          </Point>
          <div style={{ height: 1, background: S.line, margin: "14px 0" }} />
          <Point iconBg={S.accentBg} iconColor={S.accent} icon={<UsersThree size={18} weight="regular" />} title="Fewer progress chasers">
            Clients and agents can check progress themselves, without needing to contact you for routine updates.
          </Point>
          <div style={{ height: 1, background: S.line, margin: "14px 0" }} />
          <Point iconBg="rgba(124,92,240,0.12)" iconColor={PURPLE} icon={<ShieldCheck size={18} weight="regular" />} title="Works alongside you">
            Nothing here replaces your own systems or processes. It&rsquo;s simply there to make sharing progress easier.
          </Point>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="pbtn pbtn-press"
          style={{ marginTop: 22, width: "100%", padding: "14px", borderRadius: 14, border: "none", background: BTN_GRADIENT, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(47,95,208,0.35)" }}
        >
          View the {dealWord}
        </button>

        <p style={{ margin: "14px 0 0", fontSize: 12, color: S.faint, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Lock size={13} weight="regular" /> Secure link</span>
          <span aria-hidden>·</span>
          <span>No login required</span>
          <span aria-hidden>·</span>
          <span>You&rsquo;re in control</span>
        </p>
      </div>
    </>
  );
}

function Stepper({ side }: { side: "vendor" | "purchaser" }) {
  const startNode = side === "vendor" ? "Offer accepted" : "Sale agreed";
  const MovingIcon = side === "vendor" ? Key : Package;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", margin: "24px 4px 28px" }}>
      {/* Done */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: S.successRing }}>
          <Check size={15} weight="bold" color="#fff" />
        </div>
        <span style={{ fontSize: 12, marginTop: 8, whiteSpace: "nowrap", color: S.inkSoft }}>{startNode}</span>
      </div>
      {/* Solid connector */}
      <div style={{ flex: 1, height: 2, borderRadius: 2, margin: "13px 6px 0", background: S.successRing }} />
      {/* In progress (pulsing) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ position: "relative", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="portal-inprogress-pulse" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: PROGRESS_BLUE }} />
          <span style={{ position: "relative", width: 28, height: 28, borderRadius: "50%", background: PROGRESS_BLUE }} />
        </div>
        <span style={{ fontSize: 12, marginTop: 8, fontWeight: 700, whiteSpace: "nowrap", color: S.ink }}>In progress</span>
      </div>
      {/* Dashed connector */}
      <div style={{ flex: 1, margin: "13px 6px 0", borderTop: `2px dashed ${S.nestedBorder}` }} />
      {/* Moving day (upcoming) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${S.nestedBorder}` }}>
          <MovingIcon size={14} weight="regular" color={S.muted} />
        </div>
        <span style={{ fontSize: 12, marginTop: 8, whiteSpace: "nowrap", color: S.inkSoft }}>Moving day</span>
      </div>
    </div>
  );
}

function Point({ iconBg, iconColor, icon, title, children }: { iconBg: string; iconColor: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.ink }}>{title}</p>
        <p style={{ margin: "3px 0 0", fontSize: 13, lineHeight: 1.5, color: S.inkSoft }}>{children}</p>
      </div>
    </div>
  );
}
