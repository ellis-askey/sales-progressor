"use client";

import { type ReactNode, type CSSProperties } from "react";
import { useRevealStagger } from "@/lib/agent/use-reveal-stagger";

// The canonical collapsible body: the two-wrapper `agent-acc` grid-slide PLUS a
// staggered bloom reveal of its direct children on expand (useRevealStagger).
// A drop-in for the hand-rolled
//   <div className={`agent-acc${open ? " open" : ""}`}>
//     <div className="agent-acc-in">{children}</div>
//   </div>
// pattern repeated across the app. Because it's a component (not a hook), it's
// safe to use inside a .map() of sections.
//
// Attach-point note: the reveal staggers the DIRECT CHILDREN of the inner
// `agent-acc-in`, so pass the rows/cards directly as children (not wrapped in a
// single container) for a per-row cascade.
export function AccordionBody({
  open,
  children,
  innerClassName,
  innerStyle,
}: {
  open: boolean;
  children: ReactNode;
  innerClassName?: string;
  innerStyle?: CSSProperties;
}) {
  const ref = useRevealStagger<HTMLDivElement>(open);
  return (
    <div className={`agent-acc${open ? " open" : ""}`}>
      <div ref={ref} className={`agent-acc-in${innerClassName ? ` ${innerClassName}` : ""}`} style={innerStyle}>
        {children}
      </div>
    </div>
  );
}
