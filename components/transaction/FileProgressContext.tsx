"use client";

// Shared live source for the file page's overall progress. Seeded with the
// server's milestone truth; each mounted MilestoneRow reports its own optimistic
// completion state up here (via report()), and the hero reads the recomputed
// pooled percentage. This is what makes the hero % move the instant a step is
// ticked instead of waiting for the server round-trip — using the SAME pooled
// maths the server uses (pooledCompletionPercent), so the number can never
// disagree, only appear sooner.
//
// Why report()-from-rows rather than a second optimistic engine: MilestoneRow
// already owns per-row optimism via useOptimistic (which auto-reverts on error
// and reconciles on fresh server data). By simply mirroring that value up, the
// hero inherits the exact same correctness — no duplicate rollback logic. When
// fresh server data lands (revalidate), the seed changes and overrides clear,
// so we always settle back to server truth.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { pooledCompletionPercent, type ProgressLite } from "@/lib/milestones/progress-percent";

export type ProgressSeed = ProgressLite & { id: string };
type RowState = { isComplete: boolean; isNotRequired: boolean };

type Ctx = {
  percent: number;
  report: (id: string, state: RowState) => void;
};

const FileProgressCtx = createContext<Ctx | null>(null);

// Null when there is no provider (e.g. the hero rendered outside the file page),
// so consumers fall back to their static prop.
export function useFileProgress(): Ctx | null {
  return useContext(FileProgressCtx);
}

export function FileProgressProvider({
  seed,
  fallbackPercent,
  children,
}: {
  seed: ProgressSeed[];
  fallbackPercent: number;
  children: React.ReactNode;
}) {
  // A stable key of the server truth. When it changes (a revalidate landed),
  // drop all optimistic overrides so we reconcile to the server.
  const seedKey = useMemo(
    () => seed.map((s) => `${s.id}:${s.weight}:${s.isComplete ? 1 : 0}:${s.isNotRequired ? 1 : 0}`).join("|"),
    [seed],
  );

  const [overrides, setOverrides] = useState<Map<string, RowState>>(new Map());
  useEffect(() => { setOverrides(new Map()); }, [seedKey]);

  // Keep the latest seed in a ref so report() can compare against it without
  // becoming an unstable dependency (which would re-fire every row's effect).
  const seedRef = useRef(seed);
  seedRef.current = seed;

  const report = useCallback((id: string, state: RowState) => {
    setOverrides((prev) => {
      const base = seedRef.current.find((s) => s.id === id);
      const matchesBase = base && base.isComplete === state.isComplete && base.isNotRequired === state.isNotRequired;
      if (matchesBase) {
        // Row matches server truth — no override needed (drop any stale one).
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      }
      const cur = prev.get(id);
      if (cur && cur.isComplete === state.isComplete && cur.isNotRequired === state.isNotRequired) return prev;
      const next = new Map(prev);
      next.set(id, state);
      return next;
    });
  }, []);

  const percent = useMemo(() => {
    if (seed.length === 0) return fallbackPercent;
    const items = seed.map((s) => {
      const ov = overrides.get(s.id);
      return {
        weight: s.weight,
        isComplete: ov?.isComplete ?? s.isComplete,
        isNotRequired: ov?.isNotRequired ?? s.isNotRequired,
      };
    });
    return pooledCompletionPercent(items);
  }, [seed, overrides, fallbackPercent]);

  const value = useMemo(() => ({ percent, report }), [percent, report]);
  return <FileProgressCtx.Provider value={value}>{children}</FileProgressCtx.Provider>;
}
