/**
 * @jest-environment node
 */

// Tests for the three pure decision helpers in
// lib/services/exchange-completion-rules.ts:
//   - EXCHANGE_COMPLETION_CODES / AUTO_COUNTERPART_OF (constants)
//   - isExchangeCompletionStale (staleness rule)
//   - decideCompletionPackTiming (completion-pack scheduling)

import {
  EXCHANGE_COMPLETION_CODES,
  AUTO_COUNTERPART_OF,
  isExchangeCompletionStale,
  decideCompletionPackTiming,
} from "@/lib/services/exchange-completion-rules";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ── Constants ─────────────────────────────────────────────────────────────

describe("EXCHANGE_COMPLETION_CODES", () => {
  test("contains exactly VM19, PM26, VM20, PM27", () => {
    expect(EXCHANGE_COMPLETION_CODES.has("VM19")).toBe(true);
    expect(EXCHANGE_COMPLETION_CODES.has("PM26")).toBe(true);
    expect(EXCHANGE_COMPLETION_CODES.has("VM20")).toBe(true);
    expect(EXCHANGE_COMPLETION_CODES.has("PM27")).toBe(true);
    expect(EXCHANGE_COMPLETION_CODES.size).toBe(4);
  });

  test("does NOT contain non-exchange/completion codes", () => {
    for (const code of ["VM7", "PM7", "VM18", "PM25", "PM14", "VM10", "VM1", "PM1"]) {
      expect(EXCHANGE_COMPLETION_CODES.has(code)).toBe(false);
    }
  });
});

describe("AUTO_COUNTERPART_OF", () => {
  test("maps VM19↔PM26 and VM20↔PM27 bidirectionally", () => {
    expect(AUTO_COUNTERPART_OF.VM19).toBe("PM26");
    expect(AUTO_COUNTERPART_OF.PM26).toBe("VM19");
    expect(AUTO_COUNTERPART_OF.VM20).toBe("PM27");
    expect(AUTO_COUNTERPART_OF.PM27).toBe("VM20");
  });

  test("returns undefined for non-auto-counterpart codes (helper is a no-op)", () => {
    expect(AUTO_COUNTERPART_OF.VM7).toBeUndefined();
    expect(AUTO_COUNTERPART_OF.VM18).toBeUndefined();
    expect(AUTO_COUNTERPART_OF.PM14).toBeUndefined();
  });
});

// ── Staleness rule ────────────────────────────────────────────────────────

describe("isExchangeCompletionStale", () => {
  const NOW = new Date("2026-05-29T10:00:00Z").getTime();

  describe("non-exchange/completion codes are never stale", () => {
    test("VM1, PM7, VM18 return false regardless of dates", () => {
      const dates = { expectedExchangeDate: new Date("2020-01-01"), completionDate: new Date("2020-01-01") };
      expect(isExchangeCompletionStale("VM1", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM7", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("VM18", dates, NOW)).toBe(false);
    });
  });

  describe("VM19/PM26 exchange — 72h window", () => {
    test("not stale when no recorded exchange date (rule: tick is source of truth)", () => {
      const dates = { expectedExchangeDate: null, completionDate: null };
      expect(isExchangeCompletionStale("VM19", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM26", dates, NOW)).toBe(false);
    });

    test("not stale when ticked exactly at the exchange date", () => {
      const dates = { expectedExchangeDate: new Date(NOW), completionDate: null };
      expect(isExchangeCompletionStale("VM19", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM26", dates, NOW)).toBe(false);
    });

    test("not stale at 71h after exchange date", () => {
      const dates = { expectedExchangeDate: new Date(NOW - 71 * HOUR_MS), completionDate: null };
      expect(isExchangeCompletionStale("VM19", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM26", dates, NOW)).toBe(false);
    });

    test("not stale at exactly 72h after exchange date", () => {
      const dates = { expectedExchangeDate: new Date(NOW - 72 * HOUR_MS), completionDate: null };
      // > 72h, not >= 72h
      expect(isExchangeCompletionStale("VM19", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM26", dates, NOW)).toBe(false);
    });

    test("stale at 72h + 1ms after exchange date", () => {
      const dates = { expectedExchangeDate: new Date(NOW - 72 * HOUR_MS - 1), completionDate: null };
      expect(isExchangeCompletionStale("VM19", dates, NOW)).toBe(true);
      expect(isExchangeCompletionStale("PM26", dates, NOW)).toBe(true);
    });

    test("stale at 7 days after exchange date", () => {
      const dates = { expectedExchangeDate: new Date(NOW - 7 * DAY_MS), completionDate: null };
      expect(isExchangeCompletionStale("VM19", dates, NOW)).toBe(true);
      expect(isExchangeCompletionStale("PM26", dates, NOW)).toBe(true);
    });

    test("exchange staleness uses expectedExchangeDate, NOT completionDate", () => {
      const dates = {
        expectedExchangeDate: new Date(NOW - 1 * HOUR_MS), // fresh
        completionDate: new Date(NOW - 100 * DAY_MS),       // ancient
      };
      expect(isExchangeCompletionStale("VM19", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM26", dates, NOW)).toBe(false);
    });
  });

  describe("VM20/PM27 completion — 24h window", () => {
    test("not stale when no recorded completion date", () => {
      const dates = { expectedExchangeDate: null, completionDate: null };
      expect(isExchangeCompletionStale("VM20", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM27", dates, NOW)).toBe(false);
    });

    test("not stale at 23h after completion date", () => {
      const dates = { expectedExchangeDate: null, completionDate: new Date(NOW - 23 * HOUR_MS) };
      expect(isExchangeCompletionStale("VM20", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM27", dates, NOW)).toBe(false);
    });

    test("not stale at exactly 24h after completion date", () => {
      const dates = { expectedExchangeDate: null, completionDate: new Date(NOW - 24 * HOUR_MS) };
      // > 24h, not >= 24h
      expect(isExchangeCompletionStale("VM20", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM27", dates, NOW)).toBe(false);
    });

    test("stale at 24h + 1ms after completion date", () => {
      const dates = { expectedExchangeDate: null, completionDate: new Date(NOW - 24 * HOUR_MS - 1) };
      expect(isExchangeCompletionStale("VM20", dates, NOW)).toBe(true);
      expect(isExchangeCompletionStale("PM27", dates, NOW)).toBe(true);
    });

    test("stale at 3 days after completion date", () => {
      const dates = { expectedExchangeDate: null, completionDate: new Date(NOW - 3 * DAY_MS) };
      expect(isExchangeCompletionStale("VM20", dates, NOW)).toBe(true);
      expect(isExchangeCompletionStale("PM27", dates, NOW)).toBe(true);
    });

    test("completion staleness uses completionDate, NOT expectedExchangeDate", () => {
      const dates = {
        expectedExchangeDate: new Date(NOW - 100 * DAY_MS), // ancient
        completionDate: new Date(NOW - 1 * HOUR_MS),         // fresh
      };
      expect(isExchangeCompletionStale("VM20", dates, NOW)).toBe(false);
      expect(isExchangeCompletionStale("PM27", dates, NOW)).toBe(false);
    });
  });
});

// ── Completion-pack timing ───────────────────────────────────────────────

describe("decideCompletionPackTiming", () => {
  const NOW = new Date("2026-05-29T10:00:00Z").getTime();

  test("E3: no completion date → send-now (tick is source of truth)", () => {
    expect(decideCompletionPackTiming(null, NOW)).toEqual({ action: "send-now" });
  });

  test("PAST: completion date in the past → skip entirely", () => {
    const past = new Date(NOW - 3 * DAY_MS);
    expect(decideCompletionPackTiming(past, NOW)).toEqual({ action: "skip" });
  });

  test("PAST: completion date 1 second in the past → skip", () => {
    expect(decideCompletionPackTiming(new Date(NOW - 1), NOW)).toEqual({ action: "skip" });
  });

  test("E2: completion date exactly now → send-now (treat as ≤3 days)", () => {
    // completionMs >= now, completionMs - now = 0 ≤ 3 days → send-now
    expect(decideCompletionPackTiming(new Date(NOW), NOW)).toEqual({ action: "send-now" });
  });

  test("E2: completion 1 day from now → send-now", () => {
    const oneDay = new Date(NOW + 1 * DAY_MS);
    expect(decideCompletionPackTiming(oneDay, NOW)).toEqual({ action: "send-now" });
  });

  test("E2: completion exactly 3 days from now → send-now", () => {
    const threeDays = new Date(NOW + 3 * DAY_MS);
    expect(decideCompletionPackTiming(threeDays, NOW)).toEqual({ action: "send-now" });
  });

  test("E1: completion 3 days + 1ms from now → schedule for completionDate - 3 days", () => {
    const justOver = new Date(NOW + 3 * DAY_MS + 1);
    const result = decideCompletionPackTiming(justOver, NOW);
    expect(result.action).toBe("schedule");
    if (result.action !== "schedule") return;
    // Expected scheduledFor = (NOW + 3d + 1ms) - 3d = NOW + 1ms
    expect(result.scheduledFor.getTime()).toBe(NOW + 1);
  });

  test("E1: completion 7 days from now → schedule for now + 4 days", () => {
    const sevenDays = new Date(NOW + 7 * DAY_MS);
    const result = decideCompletionPackTiming(sevenDays, NOW);
    expect(result.action).toBe("schedule");
    if (result.action !== "schedule") return;
    expect(result.scheduledFor.getTime()).toBe(NOW + 4 * DAY_MS);
  });

  test("E1: completion 6 weeks from now → schedule for (6 weeks - 3 days) from now", () => {
    const sixWeeks = new Date(NOW + 42 * DAY_MS);
    const result = decideCompletionPackTiming(sixWeeks, NOW);
    expect(result.action).toBe("schedule");
    if (result.action !== "schedule") return;
    expect(result.scheduledFor.getTime()).toBe(NOW + 39 * DAY_MS);
  });
});
