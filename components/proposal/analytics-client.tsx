"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { ProposalEventKind } from "@/lib/proposal/config";

// Client-side engagement beacon. Sends only WHICH section/calculator was engaged
// with — never a reader's financial inputs. Idempotent kinds (a section first
// coming into view, a calculator first opened, reaching the close) fire once per
// browsing session. Everything is fire-and-forget; a failed beacon is silent.

interface BeaconApi {
  track: (kind: ProposalEventKind, opts?: { sectionId?: string; detail?: string }) => void;
  trackSectionView: (sectionId: string) => void;
}

const BeaconContext = createContext<BeaconApi | null>(null);

function post(body: Record<string, unknown>) {
  try {
    const payload = JSON.stringify(body);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/proposal/event", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/proposal/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    /* best-effort */
  }
}

export function ProposalAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const sent = useRef<Set<string>>(new Set());

  // Resolve the browsing occasion once per mount (may rotate the session cookie
  // server-side after an idle gap, recording a return visit).
  useEffect(() => {
    post({ visit: true });
  }, []);

  const track = useCallback<BeaconApi["track"]>((kind, opts = {}) => {
    const idempotent =
      kind === "section_view" || kind === "calculator_open" || kind === "reached_close" || kind === "pdf_download";
    const key = `${kind}:${opts.sectionId ?? ""}:${opts.detail ?? ""}`;
    if (idempotent) {
      if (sent.current.has(key)) return;
      sent.current.add(key);
    }
    post({ kind, sectionId: opts.sectionId, detail: opts.detail });
  }, []);

  const trackSectionView = useCallback(
    (sectionId: string) => track("section_view", { sectionId }),
    [track],
  );

  return <BeaconContext.Provider value={{ track, trackSectionView }}>{children}</BeaconContext.Provider>;
}

export function useBeacon(): BeaconApi {
  const ctx = useContext(BeaconContext);
  // A no-op fallback keeps components usable outside the provider (e.g. in tests).
  return ctx ?? { track: () => {}, trackSectionView: () => {} };
}
