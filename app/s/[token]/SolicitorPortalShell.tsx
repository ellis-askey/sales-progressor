"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, House, ClockCounterClockwise, ChatCircle, X, FileArrowDown, BellSlash } from "@phosphor-icons/react/dist/ssr";
import { PortalDesignLab } from "@/components/portal/PortalDesignLab";
import { solicitorSetEmailsPausedAction, solicitorPauseUntilAction } from "./actions";
import { S } from "./ui";
import { GreetingText } from "./GreetingText";

// The solicitor-portal chrome — top bar + bottom Overview/Progress/Updates nav +
// a menu sheet. Cloned in spirit from the client portal's PortalShell (greeting
// with the typewriter, frosted glass nav, per-tab routing), in the professional
// blue palette. No notification bell (decision D).
export function SolicitorPortalShell({
  token,
  firstName,
  mosUrl,
  mosFilename,
  emailsPaused,
  pausedUntil,
  children,
}: {
  token: string;
  firstName: string;
  mosUrl: string | null;
  mosFilename: string | null;
  emailsPaused: boolean;
  pausedUntil: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/s/${token}`;
  const [menuOpen, setMenuOpen] = useState(false);

  // Time-of-day greeting is set after mount (avoids a hydration mismatch and a
  // bare-name flash), same as the client portal.
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  const greetingLabel = greeting ? (firstName ? `${greeting}, ${firstName}` : greeting) : "";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isHome = pathname === base || pathname === `${base}/`;
  const onProgress = pathname.startsWith(`${base}/progress`);
  const onUpdates = pathname.startsWith(`${base}/updates`);

  return (
    <div
      className="portal-scope"
      style={{
        // Blue accent for any accent-tinted glass variant + the nav glow.
        "--portal-primary": "#2f5fd0",
        minHeight: "100svh",
        backgroundColor: "#eef2f8",
        backgroundImage:
          "radial-gradient(42% 28% at 50% -4%, rgba(56,120,255,0.10), transparent 70%)," +
          "radial-gradient(78% 55% at 6% 3%, rgba(120,160,255,0.13), transparent 72%)," +
          "radial-gradient(72% 52% at 96% 8%, rgba(150,180,255,0.13), transparent 72%)," +
          "radial-gradient(90% 62% at 50% 102%, rgba(176,200,255,0.16), transparent 76%)",
        backgroundAttachment: "fixed",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
      } as React.CSSProperties}
    >
      {/* Top bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: S.navBg,
          backdropFilter: S.navBlur,
          WebkitBackdropFilter: S.navBlur,
          borderBottom: `1px solid ${S.navBorder}`,
        }}
      >
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", color: S.ink, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <List size={20} weight="regular" />
          </button>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: S.ink, textAlign: "center", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <GreetingText key={greetingLabel} text={greetingLabel} />
          </p>
          <span style={{ width: 36, height: 36, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <PortalDesignLab />
          </span>
        </div>
      </header>

      {/* Page content */}
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "16px 14px 104px" }}>{children}</main>

      {/* Bottom nav */}
      <nav
        aria-label="Primary"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: S.navBg,
          backdropFilter: S.navBlur,
          WebkitBackdropFilter: S.navBlur,
          borderTop: `1px solid ${S.navBorder}`,
        }}
      >
        <div style={{ maxWidth: 620, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", padding: "6px 8px" }}>
          <TabItem href={base} label="Overview" active={isHome} icon={<House size={22} weight={isHome ? "fill" : "regular"} />} />
          <TabItem href={`${base}/progress`} label="Progress" active={onProgress} icon={<ClockCounterClockwise size={22} weight={onProgress ? "fill" : "regular"} />} />
          <TabItem href={`${base}/updates`} label="Updates" active={onUpdates} icon={<ChatCircle size={22} weight={onUpdates ? "fill" : "regular"} />} />
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </nav>

      {menuOpen && (
        <MenuSheet token={token} mosUrl={mosUrl} mosFilename={mosFilename} emailsPaused={emailsPaused} pausedUntil={pausedUntil} onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
}

function TabItem({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 4px", borderRadius: 12, textDecoration: "none" }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: active ? S.accent : S.muted,
          boxShadow: active ? `0 0 22px ${S.accentBg}` : "none",
          transform: active ? "scale(1.08)" : "scale(1)",
          transition: "transform 220ms cubic-bezier(0.16,1,0.3,1), color 150ms ease",
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: active ? S.accent : S.muted }}>{label}</span>
    </Link>
  );
}

function MenuSheet({ token, mosUrl, mosFilename, emailsPaused, pausedUntil, onClose }: { token: string; mosUrl: string | null; mosFilename: string | null; emailsPaused: boolean; pausedUntil: string | null; onClose: () => void }) {
  const [paused, setPaused] = useState(emailsPaused);
  const [until, setUntil] = useState<string | null>(pausedUntil);
  const [pending, start] = useTransition();
  const isPaused = paused || !!until;

  function toggle() {
    if (isPaused) {
      setPaused(false);
      setUntil(null);
      start(async () => { try { await solicitorSetEmailsPausedAction(token, false); } catch { setPaused(emailsPaused); setUntil(pausedUntil); } });
    } else {
      setPaused(true);
      start(async () => { try { await solicitorSetEmailsPausedAction(token, true); } catch { setPaused(false); } });
    }
  }

  function pauseFor(weeks: 1 | 2) {
    const d = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    setUntil(d);
    setPaused(false);
    start(async () => { try { await solicitorPauseUntilAction(token, weeks); } catch { setUntil(pausedUntil); } });
  }

  const untilLabel = until ? new Date(until).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : null;
  const pauseBtn: React.CSSProperties = { flex: 1, padding: "9px 10px", fontSize: 12.5, fontWeight: 600, color: S.inkSoft, background: "#fff", border: "1px solid #d5deea", borderRadius: 9, cursor: pending ? "default" : "pointer" };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(9,20,40,0.34)", backdropFilter: "blur(3px)" }} />
      <aside
        role="dialog"
        aria-label="Menu"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 41,
          maxWidth: 620,
          margin: "0 auto",
          background: S.card,
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -10px 34px rgba(9,20,40,0.18)",
          padding: "10px 18px calc(20px + env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(15,39,64,0.14)", margin: "4px auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>This matter</p>
          <button type="button" onClick={onClose} aria-label="Close menu" style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: S.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} weight="bold" />
          </button>
        </div>

        {mosUrl && (
          <a
            href={mosUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: S.nested, border: `1px solid ${S.nestedBorder}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}
          >
            <span style={{ width: 36, height: 36, borderRadius: 9, background: S.accentBg, display: "inline-flex", alignItems: "center", justifyContent: "center", color: S.accent, flexShrink: 0 }}>
              <FileArrowDown size={18} weight="regular" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: S.ink }}>Memorandum of sale</span>
              <span style={{ display: "block", fontSize: 12, color: S.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mosFilename ?? "Download"}</span>
            </span>
          </a>
        )}

        <p style={{ margin: "12px 2px 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>Notifications</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: S.nested, border: `1px solid ${S.nestedBorder}`, borderRadius: 12, padding: "12px 14px" }}>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(15,39,64,0.06)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: S.muted, flexShrink: 0 }}>
            <BellSlash size={18} weight="regular" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: S.ink }}>Reminder emails</span>
            <span style={{ display: "block", fontSize: 12, color: S.muted }}>{until ? `Paused until ${untilLabel}` : paused ? "Paused for this matter" : "On for this matter"}</span>
          </span>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            role="switch"
            aria-checked={!isPaused}
            aria-label="Reminder emails for this matter"
            style={{ width: 44, height: 26, borderRadius: 13, border: "none", padding: 0, position: "relative", cursor: pending ? "default" : "pointer", background: !isPaused ? S.accent : "rgba(15,39,64,0.18)", transition: "background 180ms ease", flexShrink: 0 }}
          >
            <span style={{ position: "absolute", top: 3, left: 3, width: 20, height: 20, borderRadius: 10, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transform: !isPaused ? "translateX(18px)" : "translateX(0)", transition: "transform 180ms cubic-bezier(0.16,1,0.3,1)" }} />
          </button>
        </div>
        {!isPaused && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => pauseFor(1)} disabled={pending} style={pauseBtn}>Pause 1 week</button>
            <button type="button" onClick={() => pauseFor(2)} disabled={pending} style={pauseBtn}>Pause 2 weeks</button>
          </div>
        )}
        <p style={{ margin: "8px 2px 0", fontSize: 11.5, color: S.faint, lineHeight: 1.5 }}>Turn off to stop chasing emails on this matter, or pause them for a while. You can turn them back on any time.</p>
      </aside>
    </>
  );
}
