// Canonical Accordion primitive. Wraps the existing agent-acc-* CSS
// classes (defined in app/agent/styles/agent-system.css line ~1391) behind
// a typed React API with controlled + uncontrolled modes, ARIA wiring,
// and keyboard support.
//
// Phase 2 Week 8 of the discipline migration (see docs/BUILD_PLAN.md).
//
// The CSS animation pattern is `grid-template-rows: 0fr → 1fr` so the body
// height interpolates without JavaScript. Open is 200ms, close is 150ms —
// the asymmetry is intentional and matches the existing pattern.
//
// 15 files currently use the raw agent-acc-* classes (see the catalog
// migration footprint). Each migration is hand-rolled per consumer (Law 16).
//
// Out of scope for Phase 2 Week 8 (deferred to consumer-driven Phase 3):
//   - Multi-section accordion group (only one section open at a time).
//     None of the 15 existing consumers need this; emerge from a real
//     consumer per Law 14.
//   - Animated chevron rotation as a separate prop. Built-in by default;
//     pass showChevron={false} to suppress.
//
// See docs/reference/COMPONENT_LIBRARY_CATALOG.md §2.6 for the catalog
// entry. Gallery story at app/dev/gallery/accordion/page.tsx.
"use client";

import type { ReactNode, HTMLAttributes } from "react";
import { useState, useId, useCallback, createContext, useContext } from "react";
import { CaretDown } from "@phosphor-icons/react";

type AccordionContext = {
  open: boolean;
  toggle: () => void;
  bodyId: string;
  headerId: string;
};

const Ctx = createContext<AccordionContext | null>(null);

function useAccordion() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Accordion.Header and Accordion.Body must be used inside <Accordion>");
  return ctx;
}

export type AccordionProps = {
  // Controlled: pass `open` AND `onOpenChange`.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Uncontrolled: pass `defaultOpen` only. Component manages state.
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

export function Accordion({
  open: openProp,
  onOpenChange,
  defaultOpen = false,
  className = "",
  children,
}: AccordionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const toggle = useCallback(() => {
    const next = !open;
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
      onOpenChange?.(next);
    }
  }, [open, isControlled, onOpenChange]);

  const id = useId();
  const headerId = `acc-hdr-${id}`;
  const bodyId = `acc-body-${id}`;

  return (
    <Ctx.Provider value={{ open, toggle, bodyId, headerId }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

// ─── Accordion.Header ────────────────────────────────────────────────────

export type AccordionHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick"> & {
  // When false, suppresses the built-in CaretDown chevron at the end of
  // the header. Default true.
  showChevron?: boolean;
  children: ReactNode;
};

export function AccordionHeader({
  showChevron = true,
  className = "",
  children,
  style,
  ...rest
}: AccordionHeaderProps) {
  const { open, toggle, bodyId, headerId } = useAccordion();
  return (
    <div
      id={headerId}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-controls={bodyId}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      className={`agent-acc-hdr ${className}`.trim()}
      style={{ borderBottom: open ? undefined : "none", ...style }}
      {...rest}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
        {children}
      </div>
      {showChevron && (
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          style={{
            flexShrink: 0,
            color: "var(--agent-text-muted)",
            transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      )}
    </div>
  );
}

// ─── Accordion.Body ──────────────────────────────────────────────────────

export type AccordionBodyProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function AccordionBody({
  className = "",
  children,
  style,
  ...rest
}: AccordionBodyProps) {
  const { open, bodyId, headerId } = useAccordion();
  return (
    <div
      id={bodyId}
      role="region"
      aria-labelledby={headerId}
      // Hidden from accessibility tree when closed so screen readers don't
      // announce content that's visually collapsed.
      aria-hidden={!open}
      className={`agent-acc ${open ? "open" : ""}`}
    >
      <div className={`agent-acc-in ${className}`.trim()} style={style} {...rest}>
        {children}
      </div>
    </div>
  );
}

// Attach compound parts to the Accordion namespace.
Accordion.Header = AccordionHeader;
Accordion.Body = AccordionBody;
