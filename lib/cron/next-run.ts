// Compute the next time a 5-field cron expression will fire (UTC), for the
// System status page. Covers the field shapes we actually use in vercel.json:
// "*", single values, ranges (a-b), lists (a,b), and steps (*/n). Cron runs in
// UTC on Vercel. Returns null if no match within the search horizon.

// Parse one cron field into the set of allowed integer values within [min,max].
function parseField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    if (part === "*") {
      for (let v = min; v <= max; v++) out.add(v);
      continue;
    }
    // step: */n  or  a-b/n
    const stepMatch = part.match(/^(\*|\d+-\d+)\/(\d+)$/);
    if (stepMatch) {
      const [, range, stepStr] = stepMatch;
      const step = Number(stepStr);
      let lo = min, hi = max;
      if (range !== "*") {
        const [a, b] = range.split("-").map(Number);
        lo = a; hi = b;
      }
      for (let v = lo; v <= hi; v += step) out.add(v);
      continue;
    }
    // range: a-b
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      for (let v = a; v <= b; v++) if (v >= min && v <= max) out.add(v);
      continue;
    }
    // single value
    const n = Number(part);
    if (!Number.isNaN(n) && n >= min && n <= max) out.add(n);
  }
  return out;
}

export function nextRun(expr: string, from: Date): Date | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minF, hourF, domF, monF, dowF] = parts;
  const mins = parseField(minF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const mons = parseField(monF, 1, 12);
  const dows = parseField(dowF, 0, 6); // 0 = Sunday

  // Whether day-of-month and day-of-week are both restricted. Cron treats them
  // as OR when both are set; here our expressions only ever restrict one, so a
  // simple AND with wildcard-passes is correct.
  const domRestricted = domF !== "*";
  const dowRestricted = dowF !== "*";

  // Step minute-by-minute from the next minute. Horizon of 62 days covers the
  // monthly (1st-of-month) job in every case.
  const start = new Date(from);
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);
  const horizon = new Date(start.getTime() + 62 * 24 * 60 * 60 * 1000);

  for (let t = new Date(start); t <= horizon; t.setUTCMinutes(t.getUTCMinutes() + 1)) {
    if (!mins.has(t.getUTCMinutes())) continue;
    if (!hours.has(t.getUTCHours())) continue;
    if (!mons.has(t.getUTCMonth() + 1)) continue;
    const domOk = doms.has(t.getUTCDate());
    const dowOk = dows.has(t.getUTCDay());
    // OR semantics when both restricted; otherwise the wildcard side passes.
    if (domRestricted && dowRestricted) {
      if (!domOk && !dowOk) continue;
    } else {
      if (!domOk || !dowOk) continue;
    }
    return new Date(t);
  }
  return null;
}
