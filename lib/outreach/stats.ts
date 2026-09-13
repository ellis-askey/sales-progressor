// Statistics for outreach experiments (Build Order D).
//
// Binary conversion outcomes (a prospect either reaches the primary-metric stage
// or not) with small samples and frequent zero-event cells. The correct test for
// a 2x2 table under these conditions is the TWO-SIDED FISHER'S EXACT TEST: it is
// exact (no normal approximation), valid for tiny counts and zero cells, and is
// the standard 2x2 test. A z-test / chi-square would be unreliable at our counts.
//
// A winner is NEVER declared on sample size alone. It requires, in addition to a
// significant p-value: a metric fixed before launch, adequate exposure on BOTH
// variants, enough actual outcome events, and no obvious allocation skew. If any
// guard fails we report the observed numbers honestly and return winner = null.
// Sample-size bands below are DISPLAY labels only, not statistical conclusions.

export type MaturityLabel = "insufficient" | "early data" | "directional data" | "substantial sample";

// Display-only maturity from per-variant exposure. Never used to declare a winner.
export function maturityLabel(total: number): MaturityLabel {
  if (total < 100) return "insufficient";
  if (total < 300) return "early data";
  if (total < 800) return "directional data";
  return "substantial sample";
}

// ── Fisher's exact test (two-sided) ─────────────────────────────────────────

// Lanczos approximation of ln(Gamma(x)); accurate for our use.
function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function logFactorial(n: number): number {
  return logGamma(n + 1);
}

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

// P(X = a) for a 2x2 table with the observed margins fixed (hypergeometric).
function logHypergeom(a: number, r1: number, r2: number, c1: number, n: number): number {
  return logChoose(r1, a) + logChoose(r2, c1 - a) - logChoose(n, c1);
}

// Two-sided Fisher's exact p-value for the 2x2 table [[a,b],[c,d]].
export function fisherExactTwoSided(a: number, b: number, c: number, d: number): number {
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = a + b + c + d;
  if (n === 0 || r1 === 0 || r2 === 0 || c1 === 0 || c1 === n) return 1;

  const pObs = logHypergeom(a, r1, r2, c1, n);
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  const EPS = 1e-7;
  let p = 0;
  for (let x = lo; x <= hi; x++) {
    const lp = logHypergeom(x, r1, r2, c1, n);
    if (lp <= pObs + EPS) p += Math.exp(lp);
  }
  return Math.min(1, Math.max(0, p));
}

// ── Variant comparison ──────────────────────────────────────────────────────

export type VariantStat = { key: string; successes: number; total: number };

export type CompareOptions = {
  alpha?: number; // significance threshold (default 0.05)
  minExposure?: number; // min recipients per variant before a call (default 100)
  minEvents?: number; // min combined outcome events before a call (default 10)
  minAllocationRatio?: number; // smaller/larger exposure must exceed this (default 0.2)
};

export type VariantResult = {
  key: string;
  successes: number;
  total: number;
  rate: number; // successes / total (0 if total 0)
  maturity: MaturityLabel;
};

export type Comparison = {
  test: "fisher_exact_two_sided";
  alpha: number;
  pValue: number | null; // null when not computed (a guard failed first)
  winner: "control" | "challenger" | null;
  reason: string;
  control: VariantResult;
  challenger: VariantResult;
  guards: {
    exposureOk: boolean;
    eventsOk: boolean;
    allocationOk: boolean;
  };
};

function toResult(v: VariantStat): VariantResult {
  return {
    key: v.key,
    successes: v.successes,
    total: v.total,
    rate: v.total > 0 ? v.successes / v.total : 0,
    maturity: maturityLabel(v.total),
  };
}

// Compare a control vs a challenger on a binary outcome. Returns winner: null
// (with honest numbers) unless every guard passes AND Fisher's exact clears alpha.
export function compareVariants(
  control: VariantStat,
  challenger: VariantStat,
  opts: CompareOptions = {},
): Comparison {
  const alpha = opts.alpha ?? 0.05;
  const minExposure = opts.minExposure ?? 100;
  const minEvents = opts.minEvents ?? 10;
  const minAllocationRatio = opts.minAllocationRatio ?? 0.2;

  const c = toResult(control);
  const h = toResult(challenger);

  const exposureOk = c.total >= minExposure && h.total >= minExposure;
  const eventsOk = c.successes + h.successes >= minEvents;
  const larger = Math.max(c.total, h.total);
  const smaller = Math.min(c.total, h.total);
  const allocationOk = larger > 0 && smaller / larger >= minAllocationRatio;

  const base = {
    test: "fisher_exact_two_sided" as const,
    alpha,
    control: c,
    challenger: h,
    guards: { exposureOk, eventsOk, allocationOk },
  };

  if (c.total === 0 || h.total === 0) {
    return { ...base, pValue: null, winner: null, reason: "No exposure on one or both variants." };
  }
  if (!exposureOk) {
    return { ...base, pValue: null, winner: null, reason: `Not enough exposure yet (need >= ${minExposure} per variant).` };
  }
  if (!allocationOk) {
    return { ...base, pValue: null, winner: null, reason: "Allocation looks skewed between variants; not calling a result." };
  }
  if (!eventsOk) {
    return { ...base, pValue: null, winner: null, reason: `Not enough outcome events yet (need >= ${minEvents} combined).` };
  }

  const p = fisherExactTwoSided(
    c.successes,
    c.total - c.successes,
    h.successes,
    h.total - h.successes,
  );

  if (p < alpha) {
    const winner = h.rate > c.rate ? "challenger" : "control";
    return { ...base, pValue: p, winner, reason: `Fisher's exact two-sided p = ${p.toFixed(4)} < ${alpha}.` };
  }
  return { ...base, pValue: p, winner: null, reason: `No significant difference (Fisher's exact p = ${p.toFixed(4)} >= ${alpha}).` };
}
