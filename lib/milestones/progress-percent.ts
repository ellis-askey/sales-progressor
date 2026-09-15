// The single definition of "how far along is this sale" — the pooled, weighted
// completion percentage across every applicable milestone on both sides,
// excluding not-required steps. Used by the server (calculateProgress) AND the
// live file-page hero, so the two can never disagree: the browser recomputes
// the SAME number the instant a step is ticked, rather than a second copy of
// the maths. The sale-type logic (which steps apply, what each is worth) is
// resolved upstream and baked into the items passed in — it is NOT duplicated
// here.

export type ProgressLite = { weight: number; isComplete: boolean; isNotRequired: boolean };

// Unrounded ratio (0–100). 100 when nothing is applicable (mirrors the prior
// inline behaviour in calculateProgress).
export function pooledCompletionRaw(items: ProgressLite[]): number {
  const applicable = items.filter((m) => !m.isNotRequired);
  const total = applicable.reduce((s, m) => s + m.weight, 0);
  const completed = applicable.filter((m) => m.isComplete).reduce((s, m) => s + m.weight, 0);
  return total > 0 ? (completed / total) * 100 : 100;
}

export function pooledCompletionPercent(items: ProgressLite[]): number {
  return Math.round(pooledCompletionRaw(items));
}
