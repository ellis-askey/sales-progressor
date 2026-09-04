"use client";

// InspectHost — mounts one registry entry in its selected state and overlays a
// floating inspector bar (component name, live state selector, verified toggle,
// close). Two presentation modes:
//   overlay   — the real drawer/modal portals itself over the live /sheets
//               page, so translucency + backdrop blur are judged against the
//               actual app background.
//   inline    — the notice is dropped into a faux page column (FixturePage) so
//               banners / callouts / empty-states are seen in realistic context.
//
// Switching state remounts the entry (keyed on stateId) so components that seed
// useState from props pick up the new fixture.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, CaretLeft } from "@phosphor-icons/react";
import type { SheetEntry, DesignSelection } from "../_registry/types";
import type { DesignByMode } from "../_registry/design";
import { SURFACE_OPTIONS, SURFACE_GROUP_ORDER, FOOTER_OPTIONS, DEFAULT_SELECTION, selectionFromPreset, DARK_HEADERS } from "../_registry/design";
import { PRESETS } from "../_registry/presets";
import { FixturePage } from "./FixtureUI";

const TYPE_LABEL: Record<SheetEntry["type"], string> = {
  drawer: "Drawer",
  modal: "Modal",
  notification: "Notification",
};

export function InspectHost({
  entry,
  stateId,
  onStateChange,
  onClose,
  verified,
  onToggleVerified,
  designByMode,
  onDesignChange,
}: {
  entry: SheetEntry;
  stateId: string;
  onStateChange: (id: string) => void;
  onClose: () => void;
  verified: boolean;
  onToggleVerified: () => void;
  designByMode: DesignByMode;
  onDesignChange: (next: DesignByMode) => void;
}) {
  // Escape closes the whole inspection (belt-and-braces alongside each
  // component's own Escape handler).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Track the live theme so the design bench edits + previews the right mode's
  // selection (the surface variant look adapts to <html> data-theme).
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.dataset.theme === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const mode: "light" | "dark" = isDark ? "dark" : "light";
  const activeDesign = designByMode[mode];
  const design: DesignSelection | undefined = entry.designable ? activeDesign : undefined;

  function setModeSelection(next: DesignSelection) {
    onDesignChange({ ...designByMode, [mode]: next });
  }

  const rendered = (
    // Keyed on the design selection too, so a surface/footer switch remounts
    // the primitive and re-applies the class cleanly.
    <div
      key={`${entry.id}:${stateId}:${design?.presetId ?? "-"}:${design?.surfaceVariant ?? "-"}:${design?.footerVariant ?? "-"}`}
      style={{ display: "contents" }}
    >
      {entry.render({ open: true, stateId, onClose, design })}
    </div>
  );

  const designPanel =
    entry.designable && typeof document !== "undefined"
      ? createPortal(
          <DesignPanel mode={mode} selection={activeDesign} onChange={setModeSelection} />,
          document.body,
        )
      : null;

  const bar =
    typeof document !== "undefined"
      ? createPortal(
          <InspectorBar
            entry={entry}
            stateId={stateId}
            onStateChange={onStateChange}
            onClose={onClose}
            verified={verified}
            onToggleVerified={onToggleVerified}
          />,
          document.body,
        )
      : null;

  if (entry.preview === "inline") {
    return typeof document !== "undefined"
      ? createPortal(
          <div
            className="agent-shell-root"
            data-theme="custom"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1200,
              overflowY: "auto",
              // Transparent so the fixed AppBackground shows through — the
              // whole point is judging notices against the real backdrop.
              background: "transparent",
              padding: "96px 24px 160px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <FixturePage>{rendered}</FixturePage>
            {bar}
            {designPanel}
          </div>,
          document.body,
        )
      : null;
  }

  // Overlay mode: most entries portal themselves (drawer/modal) over the live
  // page, so `rendered` produces nothing in-flow. But some entries render a
  // TRIGGER (a status pill, diary row, banner or floating button you click to
  // open the real overlay). We place `rendered` in a centred stage near the top
  // so those triggers are visible and clickable; self-portalling overlays leave
  // the stage empty and appear over everything as normal.
  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="agent-shell-root"
            data-theme="custom"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              paddingTop: 132,
              zIndex: 1150,
              pointerEvents: "none",
            }}
          >
            <div style={{ pointerEvents: "auto", maxWidth: "min(94vw, 720px)" }}>{rendered}</div>
          </div>,
          document.body,
        )}
      {bar}
      {designPanel}
    </>
  );
}

// Left-edge panel for the design benches: pick the surface variant + footer
// treatment for the ACTIVE theme. Sits clear of a right-anchored drawer and a
// centred modal so you can judge the change live.
function DesignPanel({
  mode,
  selection,
  onChange,
}: {
  mode: "light" | "dark";
  selection: DesignSelection;
  onChange: (next: DesignSelection) => void;
}) {
  // Flip <html> data-theme so the bench can be designed in both modes without
  // closing (the catalogue's own Dark toggle is behind the open overlay).
  function toggleTheme() {
    const next = mode === "dark" ? "light" : "dark";
    (window as unknown as { __salesProgressorThemeMode__?: string }).__salesProgressorThemeMode__ = next;
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.add("elevra-bg");
  }
  return (
    <div
      className="agent-shell-root"
      data-theme="custom"
      style={{
        position: "fixed",
        left: 16,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 2_147_401,
        width: 288,
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
        minHeight: 0,
      }}
    >
      <div
        className="agent-reveal-in"
        style={{
          borderRadius: 14,
          background: "var(--agent-banner-bg)",
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          border: "1px solid var(--agent-border-default)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>Design</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="agent-segment-pill agent-segment-pill-sm on"
            title="Switch light / dark (edits that mode's look)"
            style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10 }}
          >
            Editing {mode} · switch
          </button>
        </div>
        <p style={{ margin: "-6px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
          Each mode is designed independently — switch above to do the other. Choices persist.
        </p>

        {/* Direction (preset) — the main choice */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
            Direction
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {PRESETS.map((p) => {
              const on = selection.presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange(selectionFromPreset(p.id))}
                  style={{
                    textAlign: "left",
                    padding: "9px 11px",
                    borderRadius: 11,
                    cursor: "pointer",
                    border: on ? "1px solid var(--agent-coral)" : "1px solid var(--agent-border-subtle)",
                    background: on ? "var(--agent-coral-bg-tint)" : "transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    transition: "background 150ms, border-color 150ms",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? "var(--agent-coral-deep)" : "var(--agent-text-primary)" }}>
                    {p.label}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", lineHeight: 1.35 }}>{p.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dark header — only in dark mode; the bright coral band reads wrong on dark. */}
        {mode === "dark" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
              Dark header
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {DARK_HEADERS.map((h) => {
                const on = (selection.headerStyleId ?? "slate") === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onChange({ ...selection, headerStyleId: h.id })}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                      padding: "8px 10px", borderRadius: 11, cursor: "pointer",
                      border: on ? "1px solid var(--agent-coral)" : "1px solid var(--agent-border-subtle)",
                      background: on ? "var(--agent-coral-bg-tint)" : "transparent",
                      transition: "background 150ms, border-color 150ms",
                    }}
                  >
                    <span aria-hidden style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: h.bg, border: "1px solid rgba(255,255,255,0.14)" }} />
                    <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? "var(--agent-coral-deep)" : "var(--agent-text-primary)" }}>{h.label}</span>
                      <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", lineHeight: 1.3 }}>{h.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ height: 1, background: "var(--agent-border-subtle)" }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)", marginBottom: -4 }}>
          Fine-tune
        </span>

        {/* Surface */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
            Surface
          </span>
          {SURFACE_GROUP_ORDER.map((group) => {
            const opts = SURFACE_OPTIONS.filter((o) => o.group === group);
            if (opts.length === 0) return null;
            return (
              <div key={group} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", opacity: 0.75 }}>
                  {group === "New" ? "New (restyled)" : group}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {opts.map((o) => {
                    const on = (selection.surfaceVariant ?? null) === o.id;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => onChange({ ...selection, surfaceVariant: o.id })}
                        className={`agent-segment-pill agent-segment-pill-sm${on ? " on" : ""}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        {o.isNew && (
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--agent-coral)", flexShrink: 0 }} />
                        )}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
            Sticky footer
          </span>
          <div style={{ display: "flex", gap: 5 }}>
            {FOOTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ ...selection, footerVariant: f.id })}
                className={`agent-segment-pill agent-segment-pill-sm${selection.footerVariant === f.id ? " on" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_SELECTION })}
          className="agent-btn agent-btn-sm agent-btn-ghost"
          style={{ alignSelf: "flex-start" }}
        >
          Reset {mode}
        </button>
      </div>
    </div>
  );
}

function InspectorBar({
  entry,
  stateId,
  onStateChange,
  onClose,
  verified,
  onToggleVerified,
}: {
  entry: SheetEntry;
  stateId: string;
  onStateChange: (id: string) => void;
  onClose: () => void;
  verified: boolean;
  onToggleVerified: () => void;
}) {
  const multiState = entry.states.length > 1;
  const active = entry.states.find((s) => s.id === stateId);
  return (
    <div
      className="agent-shell-root"
      data-theme="custom"
      style={{
        position: "fixed",
        // Sits above every overlay tier (modal deep = 2000).
        zIndex: 2_147_400,
        left: "50%",
        bottom: 20,
        transform: "translateX(-50%)",
        maxWidth: "min(94vw, 920px)",
        width: "max-content",
        // .agent-shell-root imposes min-height:100vh (globals.css) — cancel it
        // here or this bottom-anchored bar stretches to full height and its
        // content rides up to the top of the viewport.
        minHeight: 0,
      }}
    >
      <div
        className="agent-reveal-in"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 10px 8px 14px",
          borderRadius: 14,
          background: "var(--agent-banner-bg)",
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          border: "1px solid var(--agent-border-default)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="agent-icon-btn"
          aria-label="Close inspector"
          style={{ flexShrink: 0 }}
          title="Close (Esc)"
        >
          <CaretLeft size={16} weight="bold" />
        </button>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1, paddingRight: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
              {entry.name}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-coral-deep)", background: "var(--agent-coral-bg-tint)", padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}>
              {TYPE_LABEL[entry.type]}
            </span>
          </div>
          {active?.hint && (
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320 }}>
              {active.hint}
            </span>
          )}
        </div>

        {multiState && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 480, borderLeft: "1px solid var(--agent-border-subtle)", paddingLeft: 12 }}>
            {entry.states.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onStateChange(s.id)}
                className={`agent-segment-pill agent-segment-pill-sm${s.id === stateId ? " on" : ""}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleVerified}
          className={`agent-btn agent-btn-sm ${verified ? "agent-btn-primary" : "agent-btn-secondary"}`}
          style={{ flexShrink: 0, marginLeft: 4 }}
          title={verified ? "Marked verified — click to unmark" : "Mark this component verified"}
        >
          {verified ? "✓ Verified" : "Mark verified"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="agent-icon-btn"
          aria-label="Close"
          style={{ flexShrink: 0 }}
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
