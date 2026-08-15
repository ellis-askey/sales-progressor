"use client";

// Portal Design Lab (founder-only). Mirrors the agent Design Lab, adapted for
// the portal: single mode (the portal is light-only) and a GLOBAL store, so
// picks go live to every client immediately — the founder styles a real file,
// then Export JSON hands the winners over for hard implementation and we remove
// the lab. Renders nothing unless the viewer is the founder (canEdit from the
// portal glass context, set server-side from the agent session).

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FlaskConical, X, RotateCcw, Download } from "lucide-react";
import { usePortalGlass } from "@/lib/glass/portal-context";
import { GLASS_FAMILIES, isGlassVariantId, type GlassVariantId } from "@/lib/glass/variants";

type DiscoveredCard = { glassId: string; label: string; currentVariant: GlassVariantId };

function discoverCards(): DiscoveredCard[] {
  if (typeof document === "undefined") return [];
  const found: DiscoveredCard[] = [];
  const seen = new Set<string>();
  document.querySelectorAll<HTMLElement>("[data-glass-id]").forEach((el) => {
    const glassId = el.dataset.glassId;
    if (!glassId || seen.has(glassId)) return;
    seen.add(glassId);
    const raw = el.dataset.glassVariant;
    found.push({
      glassId,
      label: el.dataset.glassLabel ?? glassId,
      currentVariant: isGlassVariantId(raw) ? raw : "v00",
    });
  });
  return found;
}

export function PortalDesignLab() {
  const { canEdit } = usePortalGlass();
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Design Lab (founder only)"
        aria-label="Open Design Lab"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: 10,
          border: "0.5px solid rgba(15,23,42,0.10)", background: "#fff",
          color: "#5b8cff", cursor: "pointer",
        }}
      >
        <FlaskConical size={16} />
      </button>
      {open && <LabDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function LabDrawer({ onClose }: { onClose: () => void }) {
  const { picks, setPick, resetAll } = usePortalGlass();
  const [cards, setCards] = useState<DiscoveredCard[]>([]);
  const [copied, setCopied] = useState(false);

  // Re-discover tagged surfaces on open, then on any DOM change (a pick
  // re-renders tagged cards; content can stream in after first paint).
  useEffect(() => {
    const scan = () => setCards(discoverCards());
    scan();
    const t1 = window.setTimeout(scan, 300);
    const t2 = window.setTimeout(scan, 1000);
    let raf = 0;
    const obs = new MutationObserver(() => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => { raf = 0; scan(); });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); if (raf) window.cancelAnimationFrame(raf); obs.disconnect(); };
  }, [picks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleExport = useCallback(async () => {
    const json = JSON.stringify(picks, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the JSON is also shown in the box below */
    }
  }, [picks]);

  const totalPicks = Object.keys(picks).length;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.20)", zIndex: 9998 }} />
      <aside
        role="dialog"
        aria-label="Portal Design Lab"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 380, maxWidth: "100vw",
          background: "#fff", borderLeft: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", zIndex: 9999,
          display: "flex", flexDirection: "column",
        }}
      >
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid rgba(15,23,42,0.08)" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#5b8cff", textTransform: "uppercase", letterSpacing: "0.08em" }}>Portal Design Lab</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Glass picker</h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
              {cards.length} surface{cards.length === 1 ? "" : "s"} on this page
              {totalPicks > 0 ? ` · ${totalPicks} live pick${totalPicks === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", color: "#64748b", cursor: "pointer", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: "8px 20px", fontSize: 11, color: "#b45309", background: "rgba(245,158,11,0.08)", borderBottom: "0.5px solid rgba(15,23,42,0.08)" }}>
          Picks apply live to every client. Export the JSON when you&apos;re happy.
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          {cards.length === 0 ? (
            <p style={{ padding: "24px 12px", fontSize: 13, color: "#64748b", textAlign: "center" }}>
              No tagged surfaces found on this page yet.
            </p>
          ) : (
            cards.map((card) => {
              const current = picks[card.glassId] ?? "v00";
              const isCustom = current !== "v00";
              return (
                <div key={card.glassId} style={{ padding: "12px 14px", borderRadius: 10, border: isCustom ? "1px solid rgba(91,140,255,0.5)" : "0.5px solid rgba(15,23,42,0.08)", marginBottom: 10, background: isCustom ? "rgba(91,140,255,0.04)" : "#fbfbfc" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.label}</p>
                  <p style={{ margin: "2px 0 9px", fontSize: 10, color: "#94a3b8", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{card.glassId}</p>
                  <select
                    value={current}
                    onChange={(e) => setPick(card.glassId, e.target.value as GlassVariantId)}
                    style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 8, border: `0.5px solid ${isCustom ? "rgba(91,140,255,0.5)" : "rgba(15,23,42,0.08)"}`, background: "#fff", color: "#0f172a", cursor: "pointer" }}
                  >
                    {GLASS_FAMILIES.map((family) => (
                      <optgroup key={family.id} label={family.label}>
                        {family.variants.map((v) => (
                          <option key={v.id} value={v.id}>{v.id}. {v.label}{v.recommended ? " ★" : ""}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              );
            })
          )}

          {totalPicks > 0 && (
            <pre style={{ marginTop: 12, background: "#0f1420", color: "#d7e0f5", borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 1.5, overflowX: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{JSON.stringify(picks, null, 2)}</pre>
          )}
        </div>

        <footer style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(15,23,42,0.08)", display: "flex", gap: 8, background: "#fbfbfc" }}>
          <button onClick={resetAll} disabled={totalPicks === 0} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "0.5px solid rgba(15,23,42,0.08)", background: "#fff", color: totalPicks === 0 ? "#94a3b8" : "#0f172a", cursor: totalPicks === 0 ? "not-allowed" : "pointer" }}>
            <RotateCcw size={13} /> Reset all
          </button>
          <button onClick={handleExport} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid #5b8cff", background: "#5b8cff", color: "#fff", cursor: "pointer" }}>
            <Download size={13} /> {copied ? "Copied JSON" : "Export JSON"}
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}
