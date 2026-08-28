"use client";

import { useEffect, useState } from "react";
import { HandWaving } from "@phosphor-icons/react/dist/ssr";
import { S } from "./ui";

// First-visit primer — an animated bottom drawer, same spirit as the client
// portal's welcome sheet. Shows once per device, reassures a solicitor the link
// is legitimate and low-commitment, then gets out of the way.
export function SolicitorWelcome({ firstName }: { firstName: string }) {
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
          padding: "26px 24px calc(22px + env(safe-area-inset-bottom))",
          transform: entered ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <span style={{ width: 52, height: 52, borderRadius: 26, background: S.accentBg, color: S.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <HandWaving size={26} weight="regular" />
        </span>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: S.ink, letterSpacing: "-0.01em" }}>
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: S.inkSoft }}>
          This is a quick, secure link for this sale. You can see where it&rsquo;s up to, confirm the steps you handle, and leave an update, all without a login. Nothing here is binding; it simply keeps everyone in sync.
        </p>
        <button
          type="button"
          onClick={dismiss}
          style={{ marginTop: 20, width: "100%", padding: "14px", borderRadius: 12, border: "none", background: S.primary, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          Got it
        </button>
      </div>
    </>
  );
}
