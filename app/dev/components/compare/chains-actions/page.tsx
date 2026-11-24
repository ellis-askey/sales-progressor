"use client";

// Item 8 preview — the NoChainSetupCard action buttons (Set up chain primary +
// no-chain confirm/undo secondary with a real spinner). Live component, inert
// handlers. Toggle theme / width / "saving" to check every state + breakpoint.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { NoChainSetupCard } from "@/components/chain/NoChainSetupCard";
import type { NoChainSale } from "@/lib/services/chains";

type Theme = "light" | "dark";
type Width = "desktop" | "tablet" | "mobile";
const WIDTHS: Record<Width, number> = { desktop: 1120, tablet: 720, mobile: 380 };
const CORAL = "#FF6B4A";

const base: NoChainSale = {
  transactionId: "n1", address: "4 Mill Lane, Tring, HP23 5QR", status: "active",
  createdAt: "2026-09-02T10:00:00.000Z", photoUrl: null, agencyName: "Akeman Residential",
  buyerPosition: "First-time buyer", noChainRequired: false, noChainConfirmedAt: null,
  resurfaced: false, awaitingClientOnward: true, chainSetupPending: false, search: "",
};
const needsSetup = base;
const looksChainFree: NoChainSale = { ...base, transactionId: "n2", address: "9 Oak Rise, Berkhamsted, HP4 2PN", noChainRequired: true, buyerPosition: "Cash buyer", awaitingClientOnward: false };
const confirmed: NoChainSale = { ...base, transactionId: "n3", address: "3 Beech Close, Aylesbury, HP20 1AB", noChainRequired: true, awaitingClientOnward: false, noChainConfirmedAt: "2026-10-05T10:00:00.000Z" };
const noop = () => {};

const CARDS: { sale: NoChainSale; caption: string }[] = [
  { sale: needsSetup, caption: "Needs setup — No chain (secondary) + Set up chain (primary)" },
  { sale: looksChainFree, caption: "Looks chain-free — Confirm no chain (secondary) + Set up chain (primary)" },
  { sale: confirmed, caption: "No-chain tab — Set up chain instead (single secondary)" },
];

export default function ChainsActionsPreview() {
  const [theme, setTheme] = useState<Theme>("light");
  const [width, setWidth] = useState<Width>("desktop");
  const [saving, setSaving] = useState(false);
  const restore = useRef<string | null>(null);
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", theme === "light" ? "sunset" : "dark"); }, [theme]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const bg = theme === "dark" ? "#17140f" : "#F4F2EF";
  const ink = theme === "dark" ? "#f1ece6" : "#20242E";
  const muted = theme === "dark" ? "rgba(241,236,230,0.6)" : "#9a938a";
  const line = theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db";
  const tog = (a: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${line}`, background: a ? CORAL : "transparent", color: a ? "#fff" : ink });

  const cardCss = `
    .chains-card-grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr)); }
    .chains-card-grid .chain-prop-card { box-shadow: 0 2px 8px rgba(15,26,46,0.10), 0 1px 2px rgba(15,26,46,0.05); }
    :root[data-theme="dark"] .chains-card-grid .chain-prop-card { box-shadow: 0 2px 8px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.28); }
  `;

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme === "light" ? "sunset" : "dark"} style={{ minHeight: "100vh", background: bg, color: ink, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <style>{cardCss}</style>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: bg, borderBottom: `1px solid ${line}`, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={tog(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={tog(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["desktop", "tablet", "mobile"] as Width[]).map((w) => (
            <button key={w} type="button" style={tog(width === w)} onClick={() => setWidth(w)}>{w}</button>
          ))}
        </div>
        <button type="button" style={tog(saving)} onClick={() => setSaving((s) => !s)}>{saving ? "Saving… (spinner on)" : "Simulate saving"}</button>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: muted }}>Item 8 · Setup-card action buttons</span>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 80px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: ink }}>Setup-card actions — now proper buttons</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: muted, lineHeight: 1.6, maxWidth: 820 }}>
          Live NoChainSetupCard (inert handlers). &quot;Set up chain&quot; is the flat-coral primary and keeps its drawer + hover-prefetch; the no-chain confirm/undo is a neutral secondary with a real spinner while saving. Desktop/tablet: right-aligned footer row. Mobile: full-width stacked, primary on top. Toggle width + &quot;Simulate saving&quot; to check.
        </p>
        <div style={{ width: WIDTHS[width], maxWidth: "100%", margin: "0 auto", transition: "width 180ms ease" }}>
          <div className="chains-card-grid">
            {CARDS.map(({ sale, caption }) => (
              <div key={sale.transactionId}>
                <NoChainSetupCard sale={sale} currentUserId="me" currentUserRole="director" showAgency={false} onConfirmNoChain={noop} onUndoNoChain={noop} pending={saving} />
                <p style={{ margin: "8px 2px 0", fontSize: 11.5, color: muted, lineHeight: 1.4 }}>{caption}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
