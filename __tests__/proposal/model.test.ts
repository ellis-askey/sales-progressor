// Pins the proposal microsite's financial model against the exact figures in
// the "Beyond Sales Progression" prospectus. If a calculator ever drifts from
// the PDF, one of these fails. Numbers taken from the prospectus pages cited.

import {
  boardwalkMonthlyCost,
  agencyRevenue,
  formsConsolidation,
  mixedPortfolio,
  boardwalkEconomics,
  fallThrough,
  progressorNetwork,
  additionalSoftware,
  investmentBudget,
  acquisition,
  combinedModel,
  DEFAULT_BUDGET_TOTAL,
  DEFAULT_BUDGET_ALLOCATIONS,
} from "@/lib/proposal/model";

describe("Boardwalk tiered pricing (prospectus p11)", () => {
  it.each([
    [60, 3_000],
    [70, 3_350],
    [75, 3_525],
    [80, 3_700],
  ])("%i exchanges → £%i / month", (exchanges, expected) => {
    expect(boardwalkMonthlyCost(exchanges)).toBe(expected);
  });

  it("annualises the 80-exchange example to £44,400", () => {
    expect(boardwalkMonthlyCost(80) * 12).toBe(44_400);
  });

  it("is flat £50 below the tier-1 limit", () => {
    expect(boardwalkMonthlyCost(30)).toBe(1_500);
    expect(boardwalkMonthlyCost(0)).toBe(0);
  });
});

describe("Standard agency revenue (prospectus p12)", () => {
  it.each([
    [5, 250, 3_000],
    [10, 500, 6_000],
    [15, 750, 9_000],
    [30, 1_500, 18_000],
    [60, 3_000, 36_000],
  ])("one agency at %i exchanges → £%i/mo, £%i/yr", (exch, monthly, annual) => {
    const r = agencyRevenue({ agencies: 1, exchangesPerAgency: exch });
    expect(r.monthlyRevenue).toBe(monthly);
    expect(r.annualRevenue).toBe(annual);
  });

  it.each([
    [20, 5, 100, 5_000, 60_000],
    [20, 10, 200, 10_000, 120_000],
    [20, 15, 300, 15_000, 180_000],
    [50, 10, 500, 25_000, 300_000],
    [100, 10, 1_000, 50_000, 600_000],
    [250, 10, 2_500, 125_000, 1_500_000],
    [500, 10, 5_000, 250_000, 3_000_000],
    [1_000, 10, 10_000, 500_000, 6_000_000],
  ])(
    "%i agencies × %i/mo → %i exchanges, £%i/mo, £%i/yr",
    (agencies, avg, totalExch, monthly, annual) => {
      const r = agencyRevenue({ agencies, exchangesPerAgency: avg });
      expect(r.totalMonthlyExchanges).toBe(totalExch);
      expect(r.monthlyRevenue).toBe(monthly);
      expect(r.annualRevenue).toBe(annual);
    },
  );
});

describe("Forms + Tasks consolidation (prospectus p6)", () => {
  it("defaults to the PDF baseline: £1,100 → £588, save £512 (46.5%)", () => {
    const r = formsConsolidation();
    expect(r.existingAnnual).toBe(1_100);
    expect(r.proposedAnnual).toBe(588);
    expect(r.annualSaving).toBe(512);
    expect(r.pctSaving).toBeCloseTo(0.4654, 3);
  });

  it("recomputes for arbitrary existing subscriptions", () => {
    const r = formsConsolidation({ subscriptionsAnnual: [600, 400, 300] });
    expect(r.existingAnnual).toBe(1_300);
    expect(r.annualSaving).toBe(712);
  });
});

describe("Boardwalk economics (prospectus p11)", () => {
  it("reproduces the 80-exchange headline", () => {
    const r = boardwalkEconomics({ exchanges: 80, avgFee: 4_300, annualRevenueTarget: 7_000_000 });
    expect(r.monthlyCost).toBe(3_700);
    expect(r.annualCost).toBe(44_400);
    expect(r.annualCommission).toBe(4_128_000);
    expect(r.pctOfCommission).toBeCloseTo(0.0108, 4); // ~1.08%
    expect(r.pctOfTarget).toBeCloseTo(0.0063, 4); // ~0.63%
  });

  it.each([
    [60, 36_000, 3_096_000],
    [70, 40_200, 3_612_000],
    [75, 42_300, 3_870_000],
    [80, 44_400, 4_128_000],
  ])("%i exchanges → £%i annual cost, £%i annual commission", (exch, annualCost, annualComm) => {
    const r = boardwalkEconomics({ exchanges: exch });
    expect(r.annualCost).toBe(annualCost);
    expect(r.annualCommission).toBe(annualComm);
  });
});

describe("Mixed portfolio never double-counts Boardwalk", () => {
  it("prices Boardwalk once on its tier, groups on flat £50", () => {
    const r = mixedPortfolio(
      [
        { id: "small", label: "Smaller", count: 10, avgExchanges: 5 },
        { id: "busy", label: "Busy", count: 5, avgExchanges: 15 },
      ],
      { exchanges: 80 },
    );
    // groups: (10*5 + 5*15) * 50 = (50+75)*50 = 6,250 ; boardwalk: 3,700
    expect(r.monthlyRevenue).toBe(6_250 + 3_700);
    expect(r.totalMonthlyExchanges).toBe(50 + 75 + 80);
    expect(r.perGroup.find((g) => g.id === "boardwalk")?.monthlyRevenue).toBe(3_700);
    // Boardwalk appears exactly once.
    expect(r.perGroup.filter((g) => g.id === "boardwalk")).toHaveLength(1);
  });

  it("omits Boardwalk cleanly when not included", () => {
    const r = mixedPortfolio([{ id: "a", label: "A", count: 20, avgExchanges: 10 }]);
    expect(r.monthlyRevenue).toBe(10_000);
    expect(r.perGroup.some((g) => g.id === "boardwalk")).toBe(false);
  });
});

describe("Fall-through sensitivity is mathematically consistent", () => {
  it("uses the same agreed-sales base in both scenarios", () => {
    const r = fallThrough({
      agreedSales: 100,
      baselineFalloutPct: 0.3,
      improvedFalloutPct: 0.2,
      avgFee: 4_300,
    });
    expect(r.baselineExchanges).toBeCloseTo(70, 10);
    expect(r.improvedExchanges).toBeCloseTo(80, 10);
    expect(r.additionalExchanges).toBeCloseTo(10, 10);
    expect(r.additionalGrossCommission).toBeCloseTo(43_000, 6);
    // Software cost of the extra exchanges is reported separately.
    expect(r.additionalSoftwareCost).toBeCloseTo(500, 6);
  });

  it("is zero improvement when the fall-through rate is unchanged", () => {
    const r = fallThrough({ agreedSales: 50, baselineFalloutPct: 0.25, improvedFalloutPct: 0.25 });
    expect(r.additionalExchanges).toBe(0);
    expect(r.additionalGrossCommission).toBe(0);
  });
});

describe("Progressor network (prospectus p9) — £5 base, +£10 on introduced exchange", () => {
  it("a single introduced sale that exchanges totals £15, never a second £5", () => {
    const r = progressorNetwork({
      businesses: 1,
      directorsPerBusiness: 0,
      additionalMembersPerBusiness: 0,
      salesPerBusinessPerMonth: 1,
      pctViaIntroduction: 1,
      networkExchangeRate: 1,
    });
    expect(r.monthlyTransaction).toBe(5); // base £5 on the one sale
    expect(r.monthlyNetworkExchange).toBe(10); // +£10 on the exchange
    expect(r.monthlyTotal).toBe(15);
  });

  it("charges £5 on every added sale regardless of origin", () => {
    const r = progressorNetwork({
      businesses: 2,
      directorsPerBusiness: 1,
      additionalMembersPerBusiness: 1,
      salesPerBusinessPerMonth: 10,
      pctViaIntroduction: 0, // none introduced
      networkExchangeRate: 1,
    });
    // subscription: 2 * (1*59 + 1*39) = 196 ; transaction: 20 * 5 = 100 ; network: 0
    expect(r.monthlySubscription).toBe(196);
    expect(r.monthlyTransaction).toBe(100);
    expect(r.monthlyNetworkExchange).toBe(0);
    expect(r.monthlyTotal).toBe(296);
  });
});

describe("Additional operational software", () => {
  it("only counts adopting customers", () => {
    const r = additionalSoftware({ customers: 100, adoptionPct: 0.3 });
    expect(r.adoptingCustomers).toBe(30);
    expect(r.monthlyRevenue).toBe(30 * 49);
    expect(r.annualRevenue).toBe(30 * 49 * 12);
  });
});

describe("Investment budget (prospectus p13)", () => {
  it("the default allocation reconciles exactly to £75,000", () => {
    const r = investmentBudget(DEFAULT_BUDGET_TOTAL, DEFAULT_BUDGET_ALLOCATIONS);
    expect(r.allocated).toBe(75_000);
    expect(r.remaining).toBe(0);
    expect(r.monthlyEquivalent).toBeCloseTo(6_250, 6);
  });

  it("£100,000 is £8,333/mo", () => {
    const r = investmentBudget(100_000, DEFAULT_BUDGET_ALLOCATIONS);
    expect(r.monthlyEquivalent).toBeCloseTo(8_333.33, 1);
    expect(r.remaining).toBe(25_000); // default allocations total £75k
  });

  it("reports runway at an assumed monthly spend", () => {
    const r = investmentBudget(75_000, DEFAULT_BUDGET_ALLOCATIONS, 6_250);
    expect(r.durationMonths).toBe(12);
  });
});

describe("Customer acquisition (illustrative)", () => {
  it("derives customers and full-adoption annual revenue", () => {
    const r = acquisition({ budget: 24_000, costPerAcquisition: 1_200, avgExchangesPerCustomer: 10 });
    expect(r.customersAcquired).toBe(20);
    expect(r.monthlyExchanges).toBe(200);
    expect(r.annualRevenueFullAdoption).toBe(200 * 50 * 12); // £120,000
  });
});

describe("Combined model sums independent streams without double-counting", () => {
  it("adds agency + boardwalk + progressor + software", () => {
    const r = combinedModel({
      agency: { agencies: 100, exchangesPerAgency: 10 },
      includeBoardwalk: true,
      boardwalkExchanges: 80,
      progressor: {
        businesses: 10,
        directorsPerBusiness: 1,
        additionalMembersPerBusiness: 1,
        salesPerBusinessPerMonth: 10,
        pctViaIntroduction: 0.2,
        networkExchangeRate: 0.5,
      },
      software: { customers: 100, adoptionPct: 0.3 },
    });
    const agency = 100 * 10 * 50; // 50,000
    const boardwalk = 3_700;
    const progressor = 10 * (59 + 39) + 100 * 5 + 100 * 0.2 * 0.5 * 10; // 980 + 500 + 100
    const software = 30 * 49; // 1,470
    expect(r.monthlyTotal).toBeCloseTo(agency + boardwalk + progressor + software, 6);
    expect(r.streams).toHaveLength(4);
  });
});
