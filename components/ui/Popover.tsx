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

import { useState, useRef, useEffect, useLayoutEffect, type ReactNode, type CSSProperties, type Ref, type RefObject } from "react";
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

export function PopoverMenuItem({ icon, children, onClick, tone = "default", disabled }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; tone?: "default" | "danger"; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} className={`ui-pop-item${tone === "danger" ? " danger" : ""}`} onClick={onClick}>
      {icon && <span className="ui-pop-item-ic">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export function PopoverDivider() { return <div className="ui-pop-div" aria-hidden />; }

// Controlled sibling of Popover for typeaheads / comboboxes: the consumer owns
// an input (with its own ref) and drives `open` from what's typed + focus, while
// this shares the exact same portal, positioning (flip/shift/gutter) and locked
// glass surface. `matchWidth` sizes the panel to the anchor (the search field).
// Results should use onMouseDown (not onClick) so they fire before the input's
// blur. Outside-click / Escape call onClose.
export function AnchoredPanel({
  anchorRef,
  open,
  onClose,
  placement = "bottom-start",
  matchWidth,
  width,
  bare,
  preset = "popover",
  role,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  placement?: Placement;
  matchWidth?: boolean;
  width?: number;
  bare?: boolean;
  preset?: "menu" | "popover";
  role?: string;
  children: ReactNode;
}) {
  const { theme, isNight } = usePortalTheme();
  const floatRef = useRef<HTMLDivElement>(null);
  const [anchorWidth, setAnchorWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open || !matchWidth) return;
    const measure = () => {
      const w = anchorRef.current?.getBoundingClientRect().width;
      if (w) setAnchorWidth(w);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, matchWidth, anchorRef]);

  const pos = useAnchoredPosition(anchorRef, floatRef, open, { placement });

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || floatRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, anchorRef, onClose]);

  if (!open || typeof document === "undefined") return null;
  return (
    <FloatLayer
      isNight={isNight}
      theme={theme}
      preset={preset}
      bare={bare}
      floatRef={floatRef}
      pos={pos}
      width={matchWidth ? anchorWidth : width}
      role={role}
    >
      {children}
    </FloatLayer>
  );
}

// Tooltip — same surface. Opens on hover/focus (desktop) AND on tap (touch):
// there's no hover on touch, so a hover-only tip is unreachable on mobile. A tap
// "pins" it open until an outside-tap / Escape (so it behaves like the bespoke
// fcl-tip #298 / InfoTip it replaces). While pinned, hover-out doesn't close it.
export function Tooltip({ children, content, placement = "top-start", block }: { children: ReactNode; content: ReactNode; placement?: Placement; block?: boolean }) {
  const { theme, isNight } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(anchorRef, floatRef, open, { placement });

  useEffect(() => {
    if (!pinned) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || floatRef.current?.contains(t)) return;
      setPinned(false);
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { setPinned(false); setOpen(false); } }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [pinned]);

  return (
    <>
      <span
        ref={anchorRef}
        className="ui-pop-anchor"
        tabIndex={0}
        style={block ? { display: "block", width: "100%" } : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { if (!pinned) setOpen(false); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (!pinned) setOpen(false); }}
        onClick={() => { const next = !pinned; setPinned(next); setOpen(next); }}
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
