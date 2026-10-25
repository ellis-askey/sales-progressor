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

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
import { DEFAULT_PICKS } from "@/lib/glass/default-picks";
import { DEFAULT_RECIPE, newStyleId, type GlassRecipe, type GlassStyle } from "@/lib/glass/custom";
import type { GlassMode } from "@/lib/glass/variants";

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
  const { picks, styles, mode, setPick, saveStyle, setPreview, resetAll } = useGlassPicks();
  // Drawer's own light/dark toggle. Flips the whole app theme (and this
  // panel), so the cards behind the drawer re-render in the chosen mode and
  // setPick writes that mode's slot. That's how light + dark get mixed.
  const { isDark, setDark } = useDarkMode();
  const [cards, setCards] = useState<DiscoveredCard[]>([]);
  const [copiedExport, setCopiedExport] = useState(false);
  // When set, the drawer body swaps to the live glass editor for this card.
  const [editing, setEditing] = useState<{ glassId: string; label: string } | null>(null);
  const pathname = usePathname();

  // Drag-to-move: the lab docks top-right, which covers whatever sits there
  // (e.g. the Focus right-rail cards). The header is a drag handle so you can
  // slide it aside and watch a card update live behind it. Offset from the
  // dock; reset whenever the lab re-opens so it always returns home.
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  useEffect(() => {
    if (open) setDragPos({ x: 0, y: 0 });
  }, [open]);
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    // Let the close button work normally — don't start a drag from it.
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, bx: dragPos.x, by: dragPos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setDragPos({ x: d.bx + (e.clientX - d.sx), y: d.by + (e.clientY - d.sy) });
  };
  const onHeaderPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* capture may already be gone */ }
  };

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
    // Both halves, so a page can be baked: picks (what's assigned) + styles
    // (the custom recipes those picks reference).
    const json = JSON.stringify({ picks, styles }, null, 2);
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
  }, [picks, styles]);

  const totalPicks = Object.keys(picks).length;

  const options = useMemo(() => GLASS_FAMILIES, []);
  // Hidden/unused variants are pulled out of their families and tucked into a
  // single "Legacy" optgroup at the bottom, so the main list stays clean.
  const visibleFamilies = useMemo(
    () => options.map((f) => ({ ...f, variants: f.variants.filter((v) => !v.hidden) })).filter((f) => f.variants.length > 0),
    [options],
  );
  const hiddenVariants = useMemo(() => options.flatMap((f) => f.variants.filter((v) => v.hidden)), [options]);

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
      {/* No dimming backdrop: this is a design tool, not a modal. The page
          behind must stay fully visible (undistorted, so the real glass look
          is judged true) and interactive (scroll, click a card to retarget)
          while the lab is open. Close via Esc or the X. */}
      <style>{`
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
          // Entrance slide runs once (no fill), then this inline transform (the
          // drag offset) takes over — translate(0,0) keeps it docked until moved.
          transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
          animation: "design-lab-drawer-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header — doubles as the drag handle (see onHeaderPointerDown). */}
        <header
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
          style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `0.5px solid ${c.border}`,
          background: c.headerGrad,
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
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

        {/* Card list — or the live glass editor when customising a card. */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          {editing ? (() => {
            const current = picks[editing.glassId]?.[mode];
            const base = current ? styles.find((s) => s.id === current) : undefined;
            return (
              <GlassStyleEditor
                key={`${editing.glassId}-${mode}`}
                glassId={editing.glassId}
                label={editing.label}
                mode={mode}
                start={base?.recipe ?? DEFAULT_RECIPE}
                baseName={base?.name}
                c={c}
                saveStyle={saveStyle}
                setPick={setPick}
                setPreview={setPreview}
                onClose={() => { setPreview(null); setEditing(null); }}
              />
            );
          })() : (<>
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
                      // Show the EFFECTIVE variant — the user's pick, else the
                      // app-wide default (DEFAULT_PICKS), else v00 — so the
                      // dropdown reflects what's actually on screen, not a
                      // misleading "v00" for a card that really renders v05/v06.
                      // Mirrors usePickForCard's resolution. When it's showing an
                      // inherited default (no explicit pick), tag the label so the
                      // user can tell "default" from "your pick".
                      const effective = entry?.[m] ?? DEFAULT_PICKS[card.glassId]?.[m] ?? "v00";
                      const fromDefault = !set && effective !== "v00";
                      return (
                        <div key={m}>
                          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: set ? "#5b8cff" : c.sub, marginBottom: 4 }}>
                            {m === "light" ? "☀ Light" : "🌙 Dark"}{fromDefault ? " · default" : ""}
                          </label>
                          <select
                            value={effective}
                            onChange={(e) => setPick(card.glassId, e.target.value, m)}
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
                            {styles.length > 0 && (
                              <optgroup label="Your styles">
                                {styles.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </optgroup>
                            )}
                            {visibleFamilies.map((family) => (
                              <optgroup key={family.id} label={family.label}>
                                {family.variants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.id}. {v.label}{v.recommended ? " ★" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                            {hiddenVariants.length > 0 && (
                              <optgroup label="Legacy (unused)">
                                {hiddenVariants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.id}. {v.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing({ glassId: card.glassId, label: card.label })}
                    style={{ marginTop: 9, width: "100%", padding: "7px 8px", fontSize: 11, fontWeight: 600, borderRadius: 8, border: `0.5px solid ${c.border}`, background: c.chip, color: c.sub, cursor: "pointer" }}
                  >
                    ✎ Customise ({mode})
                  </button>
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
          </>)}
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

// ── Live glass editor ────────────────────────────────────────────────────────
// Design a surface's glass recipe (blur / tint / vibrancy / border / shadow)
// with the real card updating live (via setPreview). Save always FORKS a new
// named style (never mutates an existing one) and assigns it to this card+mode.

function hexToTriple(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
function tripleToHex(t: string): string {
  const p = t.split(",").map((s) => Math.max(0, Math.min(255, parseInt(s.trim(), 10) || 0)));
  const r = p[0] ?? 255, g = p[1] ?? 255, b = p[2] ?? 255;
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function GlassStyleEditor({
  glassId, label, mode, start, baseName, c, saveStyle, setPick, setPreview, onClose,
}: {
  glassId: string;
  label: string;
  mode: GlassMode;
  start: GlassRecipe;
  baseName?: string;
  c: Record<string, string>;
  saveStyle: (s: GlassStyle) => void;
  setPick: (glassId: string, value: string, mode?: GlassMode) => void;
  setPreview: (p: { glassId: string; mode: GlassMode; recipe: GlassRecipe } | null) => void;
  onClose: () => void;
}) {
  const [recipe, setRecipe] = useState<GlassRecipe>(start);
  const [name, setName] = useState(baseName ? `${baseName} copy` : "");

  // Push the draft to the real card live; clear the preview when we leave.
  useEffect(() => { setPreview({ glassId, mode, recipe }); }, [recipe, glassId, mode, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  const patch = (p: Partial<GlassRecipe>) => setRecipe((r) => ({ ...r, ...p }));

  function doSave() {
    const id = newStyleId();
    saveStyle({ id, name: name.trim() || "Custom style", recipe });
    setPick(glassId, id, mode);
    setPreview(null);
    onClose();
  }

  const Slider = ({ label: l, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) => (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: c.sub, marginBottom: 5 }}>
        <span>{l}</span><span style={{ color: c.text, fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#5b8cff", cursor: "pointer" }} />
    </div>
  );
  const Swatch = ({ triple, onChange }: { triple: string; onChange: (t: string) => void }) => (
    <label style={{ position: "relative", width: 30, height: 30, borderRadius: 7, flexShrink: 0, cursor: "pointer", overflow: "hidden", border: `1px solid ${c.border}`, background: `rgb(${triple})` }}>
      <input type="color" value={tripleToHex(triple)} onChange={(e) => onChange(hexToTriple(e.target.value))} style={{ position: "absolute", inset: -4, width: "150%", height: "150%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
    </label>
  );

  return (
    <div>
      <button type="button" onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: c.sub, background: "none", border: "none", cursor: "pointer", padding: "2px 0 10px" }}>
        ← Back to list
      </button>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: c.text }}>{label}</p>
      <p style={{ margin: "2px 0 14px", fontSize: 11, color: c.sub }}>Editing the <b style={{ color: c.text }}>{mode}</b> surface · live</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name this style (e.g. Frosted bar)"
        style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 9, border: `1px solid ${c.border}`, background: c.input, color: c.text, outline: "none", marginBottom: 16, boxSizing: "border-box" }}
      />

      <Slider label="Blur" value={recipe.blur} min={0} max={80} step={1} onChange={(v) => patch({ blur: v })} fmt={(v) => `${Math.round(v)}px`} />

      <div style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: c.sub, marginBottom: 5 }}>
          <span>Tint</span><span style={{ color: c.text }}>{Math.round(recipe.bgA * 100)}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Swatch triple={recipe.bg} onChange={(t) => patch({ bg: t })} />
          <input type="range" min={0} max={1} step={0.01} value={recipe.bgA} onChange={(e) => patch({ bgA: parseFloat(e.target.value) })} style={{ flex: 1, accentColor: "#5b8cff", cursor: "pointer" }} />
        </div>
      </div>

      <Slider label="Vibrancy" value={recipe.sat} min={0.5} max={2} step={0.05} onChange={(v) => patch({ sat: v })} fmt={(v) => `${v.toFixed(2)}×`} />

      <div style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: c.sub, marginBottom: 5 }}>
          <span>Border</span><span style={{ color: c.text }}>{recipe.borderW === 0 ? "off" : `${recipe.borderW}px · ${Math.round(recipe.borderA * 100)}%`}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Swatch triple={recipe.borderC} onChange={(t) => patch({ borderC: t })} />
          <input type="range" min={0} max={6} step={0.5} value={recipe.borderW} onChange={(e) => patch({ borderW: parseFloat(e.target.value) })} title="Width" style={{ flex: 1, accentColor: "#5b8cff", cursor: "pointer" }} />
          <input type="range" min={0} max={1} step={0.01} value={recipe.borderA} onChange={(e) => patch({ borderA: parseFloat(e.target.value) })} title="Opacity" style={{ flex: 1, accentColor: "#5b8cff", cursor: "pointer" }} />
        </div>
      </div>

      <Slider label="Shadow" value={recipe.shadow} min={0} max={100} step={1} onChange={(v) => patch({ shadow: v })} fmt={(v) => `${Math.round(v)}`} />

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px 12px", fontSize: 12, fontWeight: 600, borderRadius: 9, border: `0.5px solid ${c.border}`, background: c.chip, color: c.text, cursor: "pointer" }}>
          Cancel
        </button>
        <button type="button" onClick={doSave} style={{ flex: 2, padding: "9px 12px", fontSize: 12, fontWeight: 700, borderRadius: 9, border: "1px solid #5b8cff", background: "#5b8cff", color: "#fff", cursor: "pointer" }}>
          Save as style
        </button>
      </div>
    </div>
  );
}
