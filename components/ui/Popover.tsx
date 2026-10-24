"use client";

// The canonical floating primitive for the agent/TSP surfaces: dropdown menus,
// tooltips and rich popovers. ONE surface (Ellis's locked recipe, 2026-10-24:
// glass 30% + blur30 + saturate200 + 1px border + soft shadow + radius 10, Lift
// hover), ONE behaviour (portalled to <body>, above everything, flips/shifts to
// stay on screen with an edge gutter, closes on outside-click/escape/scroll).
//
// Presets share the shell: `menu` (list rows + Lift hover), `popover` (rich
// content), `tooltip` (hover-triggered). Replaces the scattered ad-hoc menus
// (agent-dropdown-in, RowActionsMenu, fcl-tip, lum-menu, …).
// See project_menus_consolidation.

import { useState, useRef, useEffect, type ReactNode, type CSSProperties, type Ref } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useAnchoredPosition, type Placement } from "@/lib/agent/use-anchored-position";

type Preset = "menu" | "popover" | "tooltip";

// The locked surface recipe. Glass alpha is computed from the active dark mode
// (portals can't inherit the shell's tokens), everything else rides --agent-*.
function surfaceStyle(isNight: boolean): CSSProperties {
  return {
    background: `rgba(${isNight ? "20,26,36" : "255,255,255"}, 0.30)`,
    backdropFilter: "blur(30px) saturate(200%)",
    WebkitBackdropFilter: "blur(30px) saturate(200%)",
    border: "1px solid var(--agent-border-default)",
    boxShadow: "0 12px 30px rgba(20,12,6,0.16)",
    borderRadius: 10,
  };
}

function FloatLayer({ isNight, theme, preset, bare, floatRef, pos, width, role, children }: {
  isNight: boolean; theme: string; preset: Preset; bare?: boolean; floatRef: Ref<HTMLDivElement>;
  pos: { top: number; left: number } | null; width?: number; role?: string; children: ReactNode;
}) {
  return createPortal(
    <div
      ref={floatRef}
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      role={role}
      className={`ui-pop ui-pop-${preset} agent-dropdown-in${isNight ? " nv2-night" : ""}`}
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width,
        visibility: pos ? "visible" : "hidden",
        zIndex: 1400,
        ...surfaceStyle(isNight),
        // Full-bleed panels (changelog, notifications, pickers) manage their own
        // internal padding and need the surface to clip their edge-to-edge rows.
        ...(bare ? { padding: 0, overflow: "hidden" } : null),
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function Popover({ trigger, children, placement = "bottom-start", preset = "menu", bare, width }: {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  placement?: Placement;
  preset?: "menu" | "popover";
  bare?: boolean;
  width?: number;
}) {
  const { theme, isNight } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(anchorRef, floatRef, open, { placement });
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || floatRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <span ref={anchorRef} className="ui-pop-anchor" onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && typeof document !== "undefined" && (
        <FloatLayer isNight={isNight} theme={theme} preset={preset} bare={bare} floatRef={floatRef} pos={pos} width={width} role={preset === "menu" ? "menu" : undefined}>
          {typeof children === "function" ? children(close) : children}
        </FloatLayer>
      )}
    </>
  );
}

export function PopoverMenuItem({ icon, children, onClick, tone = "default" }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; tone?: "default" | "danger" }) {
  return (
    <button type="button" role="menuitem" className={`ui-pop-item${tone === "danger" ? " danger" : ""}`} onClick={onClick}>
      {icon && <span className="ui-pop-item-ic">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export function PopoverDivider() { return <div className="ui-pop-div" aria-hidden />; }

// Hover/focus tooltip — same surface, shown on hover, no interactive content.
export function Tooltip({ children, content, placement = "top-start" }: { children: ReactNode; content: ReactNode; placement?: Placement }) {
  const { theme, isNight } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(anchorRef, floatRef, open, { placement });

  return (
    <>
      <span
        ref={anchorRef}
        className="ui-pop-anchor"
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open && typeof document !== "undefined" && (
        <FloatLayer isNight={isNight} theme={theme} preset="tooltip" floatRef={floatRef} pos={pos} role="tooltip">
          {content}
        </FloatLayer>
      )}
    </>
  );
}
