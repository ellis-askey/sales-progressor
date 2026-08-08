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
import { X, RotateCcw, Download, Sparkle } from "lucide-react";
import { useGlassPicks } from "@/lib/glass/context";
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
  const { picks, setPick, resetAll } = useGlassPicks();
  const [cards, setCards] = useState<DiscoveredCard[]>([]);
  const [copiedExport, setCopiedExport] = useState(false);

  // Re-scan on open + whenever picks change (picks can re-render tagged
  // cards, so a fresh scan catches any newly-mounted nested ones).
  useEffect(() => {
    if (!open) return;
    setCards(discoverCards());
  }, [open, picks]);

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
          background: "#ffffff",
          borderLeft: "1px solid rgba(15, 23, 42, 0.10)",
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
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "0.5px solid rgba(15, 23, 42, 0.08)",
          background: "linear-gradient(180deg, rgba(91,140,255,0.04), transparent)",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#5b8cff", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Design Lab
            </p>
            <h2 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
              Glass picker
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
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
              border: "1px solid rgba(15, 23, 42, 0.10)",
              background: "#fff",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </header>

        {/* Card list */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          {cards.length === 0 ? (
            <p style={{ padding: "24px 12px", fontSize: 13, color: "#64748b", textAlign: "center" }}>
              No <code>data-glass-id</code> cards found on this page yet.
              Tag a card with <code>&lt;GlassCard&gt;</code> and reopen the lab.
            </p>
          ) : (
            cards.map((card) => {
              const activePick = picks[card.glassId];
              const showing = activePick ?? "v00";
              const isCustom = !!activePick;
              return (
                <div
                  key={card.glassId}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: isCustom ? "1px solid rgba(91,140,255,0.30)" : "0.5px solid rgba(15, 23, 42, 0.08)",
                    marginBottom: 10,
                    background: isCustom ? "rgba(91,140,255,0.04)" : "#fbfbfc",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {card.label}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        {card.glassId} · {showing}
                      </p>
                    </div>
                    {isCustom && (
                      <button
                        onClick={() => setPick(card.glassId, "v00")}
                        title="Reset this card"
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "0.5px solid rgba(15,23,42,0.15)",
                          background: "#fff",
                          color: "#64748b",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <select
                    value={showing}
                    onChange={(e) => setPick(card.glassId, e.target.value as GlassVariantId)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      borderRadius: 8,
                      border: "0.5px solid rgba(15, 23, 42, 0.15)",
                      background: "#fff",
                      color: "#0f172a",
                      cursor: "pointer",
                    }}
                  >
                    {options.map((family) => (
                      <optgroup key={family.id} label={family.label}>
                        {family.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.id}. {v.label}{v.recommended ? " ★" : ""} — {v.technique}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              );
            })
          )}

          {/* Family reference panel — recommended picks at a glance. */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: 11, fontWeight: 600, color: "#64748b", cursor: "pointer", padding: "8px 4px" }}>
              Family reference · recommended picks
            </summary>
            <div style={{ padding: "8px 12px 12px", fontSize: 11, color: "#475569" }}>
              {GLASS_FAMILIES.map((family) => {
                const rec = family.variants.find((v) => v.recommended);
                if (!rec) return null;
                return (
                  <div key={family.id} style={{ marginBottom: 10 }}>
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkle size={11} style={{ color: "#a8ff60" }} />
                      <strong style={{ color: "#0f172a", fontWeight: 600 }}>{family.label}</strong>
                      <span style={{ color: "#94a3b8" }}>· {rec.label}</span>
                    </p>
                    {rec.recommendedFor && (
                      <p style={{ margin: "2px 0 0 17px", color: "#64748b", fontStyle: "italic", fontSize: 10 }}>
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
          borderTop: "0.5px solid rgba(15, 23, 42, 0.08)",
          display: "flex",
          gap: 8,
          background: "#fbfbfc",
        }}>
          <button
            onClick={resetAll}
            disabled={totalPicks === 0}
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
              border: "0.5px solid rgba(15, 23, 42, 0.15)",
              background: "#fff",
              color: totalPicks === 0 ? "#cbd5e1" : "#475569",
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
