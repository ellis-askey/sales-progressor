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

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, CaretLeft } from "@phosphor-icons/react";
import type { SheetEntry } from "../_registry/types";
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
}: {
  entry: SheetEntry;
  stateId: string;
  onStateChange: (id: string) => void;
  onClose: () => void;
  verified: boolean;
  onToggleVerified: () => void;
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

  const rendered = (
    // Keyed on stateId so a state switch fully remounts the component.
    <div key={`${entry.id}:${stateId}`} style={{ display: "contents" }}>
      {entry.render({ open: true, stateId, onClose })}
    </div>
  );

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
    </>
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
