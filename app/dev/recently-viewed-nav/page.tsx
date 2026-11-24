"use client";

// /dev/recently-viewed-nav — proposed move of "Recently viewed" out of the left
// nav and into a top-bar control that opens a hover dropdown in the SAME glass
// style as the user-menu chip (.uacc-card: blur 30 / saturate 200, light+dark).
// The list cascades down with a thumbnail + address + "when". Fully mocked —
// the real data (useRecentlyViewed) only stores id + address + visitedAt, so a
// production build would resolve each file's photo by id. Flip light/dark top-right.

import { useEffect, useRef, useState } from "react";
import { ClockCounterClockwise, CaretDown, House, MagnifyingGlass, Bell } from "@phosphor-icons/react";

type Recent = { id: string; line1: string; town: string; when: string; hue: number };
const RECENTS: Recent[] = [
  { id: "1", line1: "38 Riviera Crescent", town: "Bristol, BS16 4SE", when: "2 min ago", hue: 18 },
  { id: "2", line1: "16 Deans Furlong", town: "Tring, HP23 4AR", when: "1 hr ago", hue: 150 },
  { id: "3", line1: "2 Demask Close", town: "Tring, HP23 5UA", when: "3 hrs ago", hue: 265 },
  { id: "4", line1: "14 Bushey Avenue", town: "Broxbourne, EN10 6QE", when: "Yesterday", hue: 40 },
  { id: "5", line1: "7 Mill Lane", town: "Tring, HP23 5QQ", when: "2 days ago", hue: 200 },
];

function Thumb({ hue }: { hue: number }) {
  // Stand-in for the real property photo (PropertyThumb in production).
  return (
    <span style={{ position: "relative", width: 40, height: 40, borderRadius: 9, flexShrink: 0, overflow: "hidden", display: "grid", placeItems: "center", background: `linear-gradient(140deg, hsl(${hue} 55% 60%), hsl(${hue + 30} 50% 42%))` }}>
      <House size={16} weight="fill" style={{ color: "rgba(255,255,255,0.9)" }} />
    </span>
  );
}

export default function Page() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const closeT = useRef<number | undefined>(undefined);

  useEffect(() => { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);

  const enter = () => { if (closeT.current) window.clearTimeout(closeT.current); setOpen(true); };
  const leave = () => { closeT.current = window.setTimeout(() => setOpen(false), 130); };

  return (
    <div style={{ minHeight: "100vh" }}>
      <style>{`
        .rv-card { opacity: 0; transform: translateY(-8px) scale(0.98); transform-origin: top right; pointer-events: none;
          transition: opacity .2s cubic-bezier(.2,.8,.2,1), transform .24s cubic-bezier(.2,.8,.2,1); }
        .rv-wrap[data-open="1"] .rv-card { opacity: 1; transform: none; pointer-events: auto; }
        .rv-row { opacity: 0; transform: translateY(-7px);
          transition: opacity .26s cubic-bezier(.2,.8,.2,1), transform .26s cubic-bezier(.2,.8,.2,1), background .12s; }
        .rv-wrap[data-open="1"] .rv-row { opacity: 1; transform: none; }
        .rv-row:hover { background: rgba(var(--rv-ink), 0.07); }
        .rv-card { --rv-ink: 45,24,16; background: rgba(255,255,255,0.42); -webkit-backdrop-filter: blur(30px) saturate(200%); backdrop-filter: blur(30px) saturate(200%); }
        :root[data-theme="dark"] .rv-card { --rv-ink: 235,235,240; background: rgba(20,26,36,0.42); }
      `}</style>

      {/* ── Mock top bar ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", gap: 18, padding: "0 20px", height: 56,
        borderBottom: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface-glass)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-coral-deep)" }}>TSP</span>
        <nav style={{ display: "flex", gap: 4 }}>
          {["Hub", "Files", "Reminders", "Analytics"].map((n, i) => (
            <span key={n} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, color: i === 1 ? "var(--agent-text-primary)" : "var(--agent-text-muted)", background: i === 1 ? "var(--agent-hover-tint)" : "transparent", cursor: "pointer" }}>{n}</span>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <MagnifyingGlass size={18} style={{ color: "var(--agent-text-muted)", cursor: "pointer" }} />
        <Bell size={18} style={{ color: "var(--agent-text-muted)", cursor: "pointer" }} />

        {/* ── The new Recently-viewed control ── */}
        <div className="rv-wrap" data-open={open ? "1" : "0"} onMouseEnter={enter} onMouseLeave={leave} style={{ position: "relative" }}>
          <button
            onFocus={enter} onBlur={leave}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 10, border: "none", cursor: "pointer",
              background: open ? "var(--agent-hover-tint)" : "transparent", color: "var(--agent-text-secondary)", fontSize: 13, fontWeight: 600 }}
            aria-haspopup="true" aria-expanded={open}
          >
            <ClockCounterClockwise size={16} weight="regular" />
            Recently viewed
            <CaretDown size={11} weight="bold" style={{ transition: "transform .18s", transform: open ? "rotate(180deg)" : "none" }} />
          </button>

          {/* Dropdown — matches the user-menu .uacc-card glass */}
          <div className="rv-card" role="menu" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 312, borderRadius: 16,
            border: "0.5px solid var(--agent-glass-border)", boxShadow: "0 16px 44px rgba(20,12,6,0.22)", overflow: "hidden", padding: 6 }}>
            <p style={{ margin: "6px 10px 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Recently viewed</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {RECENTS.map((r, i) => (
                <a key={r.id} href="#" role="menuitem" className="rv-row"
                  style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 11, textDecoration: "none",
                    transitionDelay: open ? `${60 + i * 36}ms` : "0ms" }}>
                  <Thumb hue={r.hue} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.line1}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.town}</span>
                  </span>
                  <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>{r.when}</span>
                </a>
              ))}
            </div>
            <div style={{ height: "0.5px", background: "var(--agent-border-subtle)", margin: "5px 8px" }} />
            <a href="#" style={{ display: "block", padding: "7px 10px", fontSize: 12.5, fontWeight: 600, color: "var(--agent-coral-deep)", textDecoration: "none" }}>See all files →</a>
          </div>
        </div>

        {/* User chip (for context) */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 4px", borderRadius: 10, cursor: "pointer" }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep))", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>EA</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Ellis Askey</span>
          <CaretDown size={11} weight="bold" style={{ color: "var(--agent-text-muted)" }} />
        </span>

        <button onClick={() => setDark((v) => !v)} style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 8, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", color: "var(--agent-text-secondary)", cursor: "pointer" }}>{dark ? "Dark" : "Light"}</button>
      </header>

      {/* Page body — so the dropdown has something to overlay */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <p style={{ fontSize: 12, color: "var(--agent-text-muted)", marginBottom: 14 }}>Hover <b style={{ color: "var(--agent-text-secondary)" }}>Recently viewed</b> in the bar above. The left-nav list moves up here; the dropdown cascades the files with their photo, address and when you last opened them.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="agent-glass" style={{ height: 150, borderRadius: 16 }} />
          ))}
        </div>
      </main>
    </div>
  );
}
