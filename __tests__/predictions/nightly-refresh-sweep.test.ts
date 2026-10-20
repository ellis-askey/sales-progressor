/**
 * @jest-environment node
 *
 * Nightly expectedExchangeDate refresh sweep (audit full-audit-2026-10,
 * finding DATA-003).
 *
 * The stored prediction was only recomputed on milestone confirms, so quiet
 * files froze on every surface except the live file-page sidebar. The sweep
 * refreshes every live file nightly. These tests lock the candidate filter and
 * the per-file failure isolation (one bad file must not stall the sweep).
 */

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({
  prisma: {
    propertyTransaction: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    milestoneCompletion: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/services/exchange-prediction-history", () => ({
  recordPredictionChangeIfMoved: jest.fn().mockResolvedValue(undefined),
}));

import { refreshAllExpectedExchangeDates } from "@/lib/services/exchange-prediction";
import { prisma } from "@/lib/prisma";

const p = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("refreshAllExpectedExchangeDates", () => {
  it("sweeps live files only: active, not demo, not exchanged", async () => {
    p.propertyTransaction.findMany.mockResolvedValue([]);
    await refreshAllExpectedExchangeDates();
    expect(p.propertyTransaction.findMany).toHaveBeenCalledWith({
      where: { status: "active", isDemo: false, exchangedAt: null },
      select: { id: true },
    });
  });

  it("one failing file does not stall the sweep", async () => {
    p.propertyTransaction.findMany.mockResolvedValue([{ id: "bad" }, { id: "gone" }]);
    // First file: the per-file lookup blows up. Second file: no longer found
    // (deleted between sweep query and refresh) — a clean no-op, not a failure.
    p.propertyTransaction.findUnique
      .mockRejectedValueOnce(new Error("db hiccup"))
      .mockResolvedValueOnce(null);
    const res = await refreshAllExpectedExchangeDates();
    expect(res).toEqual({ considered: 2, updated: 0, failed: 1 });
    // Both files were attempted — the failure did not break the loop.
    expect(p.propertyTransaction.findUnique).toHaveBeenCalledTimes(2);
  });
});
