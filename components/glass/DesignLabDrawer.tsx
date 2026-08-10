"use client";
// Design Lab drawer — right-side slide-in that lists every glass card
// currently on the page and lets Ellis swap its variant live. Picks
// persist to User.agentPreferences.glassPicks via GlassPicksContext.
//
// Auto-discovery: on open (and when picks change) we scan the DOM for
// all `[data-glass-id]` elements, extract their label + current variant,
// and render a picker row per unique card. This means the drawer stays
// accurate as tabs are switched or new cards mount.
// 2026-08-08.

import { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X, RotateCcw, Download, Sparkle, Sun, Moon } from "lucide-react";
import { useGlassPicks } from "@/lib/glass/context";
import { useDarkMode } from "@/lib/agent/use-theme";
import {
  GLASS_FAMILIES,
  isGlassVariantId,
  type GlassVariantId,
} from "@/lib/glass/variants";

type DiscoveredCard = {
  glassId: string;
  label: string;
  currentVariant: GlassVariantId;
};

function discoverCards(): DiscoveredCard[] {
  if (typeof document === "undefined") return [];
  const found: DiscoveredCard[] = [];
  const seen = new Set<string>();
  document.querySelectorAll<HTMLElement>("[data-glass-id]").forEach((el) => {
    const glassId = el.dataset.glassId;
    if (!glassId || seen.has(glassId)) return;
    seen.add(glassId);
    const rawVariant = el.dataset.glassVariant;
    const currentVariant: GlassVariantId = isGlassVariantId(rawVariant) ? rawVariant : "v00";
    found.push({
      glassId,
      label: el.dataset.glassLabel ?? glassId,
      currentVariant,
    });
  });
  // Stable-ish order: top-of-page cards first via document order.
  return found;
}

export function DesignLabDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { picks, mode, setPick, resetAll } = useGlassPicks();
  // Drawer's own light/dark toggle. Flips the whole app theme (and this
  // panel), so the cards behind the drawer re-render in the chosen mode and
  // setPick writes that mode's slot. That's how light + dark get mixed.
  const { isDark, setDark } = useDarkMode();
  const [cards, setCards] = useState<DiscoveredCard[]>([]);
  const [copiedExport, setCopiedExport] = useState(false);
  const pathname = usePathname();

  // Re-discover the page's tagged cards whenever they could have changed:
  //   - open toggles / picks change (a pick re-renders tagged cards)
  //   - pathname changes — the lab lives in the persistent topbar, so
  //     navigating the sidebar with it open used to leave a stale scan
  //     from the previous page (Ellis: "0 cards" on My Files / Analytics /
  //     Auto emails, 2026-08-09)
  //   - content streams in via Suspense after first paint (list pages),
  //     or a tab switch swaps the card set — caught by delayed re-scans
  //     plus a MutationObserver on the body while the lab is open.
  useEffect(() => {
    if (!open) return;
    const scan = () => setCards(discoverCards());
    scan();
    // Catch Suspense-streamed content that mounts shortly after navigation.
    const t1 = window.setTimeout(scan, 350);
    const t2 = window.setTimeout(scan, 1200);
    // Debounced re-scan on any DOM change (route swaps, tab switches).
    let raf = 0;
    const obs = new MutationObserver(() => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => { raf = 0; scan(); });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (raf) window.cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [open, picks, pathname]);

  // Esc key closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleExport = useCallback(async () => {
    const json = JSON.stringify(picks, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopiedExport(true);
      window.setTimeout(() => setCopiedExport(false), 2000);
    } catch {
      // Fallback: dump to a downloaded file
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "glass-picks.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [picks]);

  const totalPicks = Object.keys(picks).length;

  const options = useMemo(() => GLASS_FAMILIES, []);

  // Panel palette follows the mode being edited so the drawer itself is
  // legible in dark (and you preview cards in the matching theme).
  const c = isDark
    ? { panel: "#111621", rowBg: "#171c27", rowBgOn: "rgba(91,140,255,0.14)", text: "#e8edf5", sub: "#9aa7b8", faint: "#6b7280", border: "rgba(255,255,255,0.10)", borderOn: "rgba(91,140,255,0.50)", chip: "#1b2130", input: "#0e131c", headerGrad: "linear-gradient(180deg, rgba(91,140,255,0.10), transparent)" }
    : { panel: "#ffffff", rowBg: "#fbfbfc", rowBgOn: "rgba(91,140,255,0.04)", text: "#0f172a", sub: "#64748b", faint: "#94a3b8", border: "rgba(15,23,42,0.08)", borderOn: "rgba(91,140,255,0.30)", chip: "#ffffff", input: "#ffffff", headerGrad: "linear-gradient(180deg, rgba(91,140,255,0.04), transparent)" };

  if (!open) return null;

  // Portalled to <body>: the drawer mounts inside the topbar, whose
  // backdrop-filter makes it a containing block for position:fixed
  // descendants — without the portal the drawer pins to the BAR, not
  // the viewport, and renders clipped (Ellis screenshot, 2026-08-08,
  // after the app-wide blur restoration made topbar blur real).
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.20)",
          zIndex: 9998,
          animation: "design-lab-backdrop-in 180ms ease",
        }}
      />
      <style>{`
        @keyframes design-lab-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes design-lab-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Design Lab"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          maxWidth: "100vw",
          background: c.panel,
          borderLeft: `1px solid ${c.border}`,
          boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.12)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          animation: "design-lab-drawer-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <header style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `0.5px solid ${c.border}`,
          background: c.headerGrad,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#5b8cff", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Design Lab
            </p>
            <h2 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600, color: c.text }}>
              Glass picker
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.sub }}>
              {cards.length} card{cards.length === 1 ? "" : "s"} on this page
              {totalPicks > 0 ? ` · ${totalPicks} custom pick${totalPicks === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Design Lab"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.chip,
              color: c.sub,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </header>

        {/* Preview toggle — flips the whole app (and this panel) so you can SEE
            each mode's look. Both modes are always editable via the two
            dropdowns below, regardless of what's previewed here. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderBottom: `0.5px solid ${c.border}` }}>
          <span style={{ fontSize: 11, color: c.sub, fontWeight: 500 }}>Preview</span>
          <div style={{ display: "inline-flex", padding: 2, borderRadius: 999, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)", border: `0.5px solid ${c.border}` }}>
            {([["light", Sun, "Light"], ["dark", Moon, "Dark"]] as const).map(([m, Icon, label]) => {
              const on = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setDark(m === "dark")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    background: on ? "#5b8cff" : "transparent",
                    color: on ? "#fff" : c.sub,
                    transition: "background 140ms, color 140ms",
                  }}
                  aria-pressed={on}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card list */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          {cards.length === 0 ? (
            <p style={{ padding: "24px 12px", fontSize: 13, color: c.sub, textAlign: "center" }}>
              No <code>data-glass-id</code> cards found on this page yet.
              Tag a card with <code>&lt;GlassCard&gt;</code> and reopen the lab.
            </p>
          ) : (
            cards.map((card) => {
              const entry = picks[card.glassId];
              const isCustom = !!(entry?.light || entry?.dark);
              return (
                <div
                  key={card.glassId}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: isCustom ? `1px solid ${c.borderOn}` : `0.5px solid ${c.border}`,
                    marginBottom: 10,
                    background: isCustom ? c.rowBgOn : c.rowBg,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {card.label}
                  </p>
                  <p style={{ margin: "2px 0 9px", fontSize: 10, color: c.faint, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {card.glassId}
                  </p>
                  {/* Two dropdowns — set the light and dark variant independently.
                      Pick v00 in either to clear that mode's slot. */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {(["light", "dark"] as const).map((m) => {
                      const set = !!entry?.[m];
                      return (
                        <div key={m}>
                          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: set ? "#5b8cff" : c.sub, marginBottom: 4 }}>
                            {m === "light" ? "☀ Light" : "🌙 Dark"}
                          </label>
                          <select
                            value={entry?.[m] ?? "v00"}
                            onChange={(e) => setPick(card.glassId, e.target.value as GlassVariantId, m)}
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              fontSize: 12,
                              borderRadius: 8,
                              border: `0.5px solid ${set ? c.borderOn : c.border}`,
                              background: c.input,
                              color: c.text,
                              cursor: "pointer",
                            }}
                          >
                            {options.map((family) => (
                              <optgroup key={family.id} label={family.label}>
                                {family.variants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.id}. {v.label}{v.recommended ? " ★" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Family reference panel — recommended picks at a glance. */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: 11, fontWeight: 600, color: c.sub, cursor: "pointer", padding: "8px 4px" }}>
              Family reference · recommended picks
            </summary>
            <div style={{ padding: "8px 12px 12px", fontSize: 11, color: c.sub }}>
              {GLASS_FAMILIES.map((family) => {
                const rec = family.variants.find((v) => v.recommended);
                if (!rec) return null;
                return (
                  <div key={family.id} style={{ marginBottom: 10 }}>
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkle size={11} style={{ color: "#a8ff60" }} />
                      <strong style={{ color: c.text, fontWeight: 600 }}>{family.label}</strong>
                      <span style={{ color: c.faint }}>· {rec.label}</span>
                    </p>
                    {rec.recommendedFor && (
                      <p style={{ margin: "2px 0 0 17px", color: c.sub, fontStyle: "italic", fontSize: 10 }}>
                        {rec.recommendedFor}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        </div>

        {/* Footer */}
        <footer style={{
          padding: "12px 16px",
          borderTop: `0.5px solid ${c.border}`,
          display: "flex",
          gap: 8,
          background: c.rowBg,
        }}>
          <button
            onClick={resetAll}
            disabled={totalPicks === 0}
            title="Clear every pick, both modes"
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 8,
              border: `0.5px solid ${c.border}`,
              background: c.chip,
              color: totalPicks === 0 ? c.faint : c.text,
              cursor: totalPicks === 0 ? "not-allowed" : "pointer",
            }}
          >
            <RotateCcw size={13} />
            Reset all
          </button>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: "1px solid #5b8cff",
              background: "#5b8cff",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <Download size={13} />
            {copiedExport ? "Copied JSON!" : "Export JSON"}
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}
