"use client";

// Cross-Suspense reveal coordinator.
//
// The file-detail page streams the sidebar and the active tab body in
// independently — but they finish at different times (sidebar ~1.5s,
// Overview ~2s on slow files), which creates a "one at a time" pop-in
// instead of a coordinated reveal. This component holds both halves in
// their skeleton state until BOTH have streamed in, then fades them in
// together.
//
// Shape:
//   - RevealCoordinator wraps a region of the page that contains
//     multiple Suspense'd panels. You tell it which slots to wait for
//     (e.g. ["sidebar", "overview"]).
//   - Each panel renders a <RevealSlot id="..."> whose children include
//     a skeleton (always rendered) and a Suspense block whose content
//     pings the coordinator when it mounts.
//   - Until every slot has pinged, the slot's content is display:none
//     and its skeleton stays visible.
//   - Once all slots have pinged, the skeletons fade out and the real
//     content fades in.
//
// Why not just nest both in a single Suspense? The sidebar is a prop on
// PropertyFileTabs and the tab body is a child — they sit in different
// DOM positions, so a shared boundary would require restructuring the
// tabs component. The coordinator is the lighter-touch fix.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  register: (slotId: string) => void;
};
const RevealCtx = createContext<Ctx | null>(null);

// Inline styles so this component is self-contained (no globals.css edit
// needed). Reveal+hide is gated by data attributes on the wrapper.
const STYLE = `
  [data-reveal-coord] [data-reveal-content] {
    display: none;
  }
  [data-reveal-coord][data-ready="true"] [data-reveal-content] {
    display: block;
    animation: reveal-fade-in 380ms cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  [data-reveal-coord][data-ready="true"] [data-reveal-skeleton] {
    display: none;
  }
  @keyframes reveal-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-reveal-coord][data-ready="true"] [data-reveal-content] {
      animation: none;
    }
  }
`;

export function RevealCoordinator({
  slots,
  children,
}: {
  slots: string[];
  children: ReactNode;
}) {
  const [readySet, setReadySet] = useState<Set<string>>(new Set());
  const register = useCallback((slotId: string) => {
    setReadySet((prev) => {
      if (prev.has(slotId)) return prev;
      const next = new Set(prev);
      next.add(slotId);
      return next;
    });
  }, []);

  const allReady = slots.every((s) => readySet.has(s));

  return (
    <RevealCtx.Provider value={{ register }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div data-reveal-coord data-ready={allReady ? "true" : "false"} style={{ display: "contents" }}>
        {children}
      </div>
    </RevealCtx.Provider>
  );
}

// Tells the coordinator this slot's content has finished mounting.
// Mount this at the end of each Suspense'd panel's render tree.
export function RevealPing({ slotId }: { slotId: string }) {
  const ctx = useContext(RevealCtx);
  useEffect(() => {
    ctx?.register(slotId);
  }, [ctx, slotId]);
  return null;
}

// Renders a skeleton (kept until all slots are ready) and the real
// content (kept hidden until all slots are ready). The skeleton fades
// out and the content fades in together.
export function RevealSlot({
  skeleton,
  children,
}: {
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div data-reveal-skeleton>{skeleton}</div>
      <div data-reveal-content>{children}</div>
    </>
  );
}
