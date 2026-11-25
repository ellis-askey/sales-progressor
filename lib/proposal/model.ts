// Pure financial model for the Boardwalk proposal microsite.
//
// Every function here is deterministic, dependency-free and runs client-side —
// no reader input ever leaves the browser (see the engagement-analytics note in
// the brief). These reproduce the exact figures in the prospectus; the jest
// suite in __tests__/proposal/model.test.ts pins each one against the PDF.
//
// All money is in whole pounds unless a function says otherwise. Rounding is
// deferred to the formatter so intermediate maths stays exact.

// ─── Boardwalk tiered exchange pricing ───────────────────────────────────────
// £50 for the first 60 monthly exchanges, £35 for each beyond that.

export const BOARDWALK_TIER1_LIMIT = 60;
export const BOARDWALK_TIER1_PRICE = 50;
export const BOARDWALK_TIER2_PRICE = 35;

export function boardwalkMonthlyCost(
  exchanges: number,
  tier1Limit = BOARDWALK_TIER1_LIMIT,
  tier1Price = BOARDWALK_TIER1_PRICE,
  tier2Price = BOARDWALK_TIER2_PRICE,
): number {
  const e = Math.max(0, exchanges);
  const tier1 = Math.min(e, tier1Limit);
  const tier2 = Math.max(0, e - tier1Limit);
  return tier1 * tier1Price + tier2 * tier2Price;
}

// ─── Standard agency revenue (flat £50 / exchange) ───────────────────────────

export const AGENCY_PRICE_PER_EXCHANGE = 50;

export interface AgencyRevenueInput {
  agencies: number;
  exchangesPerAgency: number;
  pricePerExchange?: number;
}
export interface AgencyRevenueResult {
  totalMonthlyExchanges: number;
  totalAnnualExchanges: number;
  monthlyRevenue: number;
  annualRevenue: number;
}

export function agencyRevenue({
  agencies,
  exchangesPerAgency,
  pricePerExchange = AGENCY_PRICE_PER_EXCHANGE,
}: AgencyRevenueInput): AgencyRevenueResult {
  const totalMonthlyExchanges = agencies * exchangesPerAgency;
  const monthlyRevenue = totalMonthlyExchanges * pricePerExchange;
  return {
    totalMonthlyExchanges,
    totalAnnualExchanges: totalMonthlyExchanges * 12,
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12,
  };
}

// ─── Software consolidation (Forms + Tasks) ──────────────────────────────────

export const FORMS_BUNDLE_MONTHLY = 49;
export const FORMS_MODULE_MONTHLY = 29;
export const FORMS_BUNDLE_ANNUAL = FORMS_BUNDLE_MONTHLY * 12; // £588

export interface FormsConsolidationInput {
  /** Each existing subscription's ANNUAL cost. Defaults to the two the PDF cites. */
  subscriptionsAnnual?: number[];
  bundleAnnual?: number;
}
export interface FormsConsolidationResult {
  existingAnnual: number;
  proposedAnnual: number;
  annualSaving: number;
  pctSaving: number; // 0..1
}

export function formsConsolidation({
  subscriptionsAnnual = [550, 550],
  bundleAnnual = FORMS_BUNDLE_ANNUAL,
}: FormsConsolidationInput = {}): FormsConsolidationResult {
  const existingAnnual = subscriptionsAnnual.reduce((a, b) => a + b, 0);
  const annualSaving = existingAnnual - bundleAnnual;
  return {
    existingAnnual,
    proposedAnnual: bundleAnnual,
    annualSaving,
    pctSaving: existingAnnual > 0 ? annualSaving / existingAnnual : 0,
  };
}

// ─── Mixed customer portfolio ────────────────────────────────────────────────
// Groups of agencies on the flat £50 charge, PLUS an optional single Boardwalk
// account on its tiered pricing. Boardwalk is priced once and never folded into
// a flat-rate group, so it can never be double-counted.

export interface PortfolioGroup {
  id: string;
  label: string;
  count: number;
  avgExchanges: number;
  pricePerExchange?: number;
}
export interface PortfolioResult {
  monthlyRevenue: number;
  annualRevenue: number;
  totalMonthlyExchanges: number;
  perGroup: { id: string; label: string; monthlyRevenue: number; monthlyExchanges: number }[];
}

export function mixedPortfolio(
  groups: PortfolioGroup[],
  boardwalk?: { exchanges: number },
): PortfolioResult {
  const perGroup = groups.map((g) => {
    const monthlyExchanges = g.count * g.avgExchanges;
    const monthlyRevenue = monthlyExchanges * (g.pricePerExchange ?? AGENCY_PRICE_PER_EXCHANGE);
    return { id: g.id, label: g.label, monthlyRevenue, monthlyExchanges };
  });

  if (boardwalk && boardwalk.exchanges > 0) {
    perGroup.push({
      id: "boardwalk",
      label: "Boardwalk",
      monthlyRevenue: boardwalkMonthlyCost(boardwalk.exchanges),
      monthlyExchanges: boardwalk.exchanges,
    });
  }

  const monthlyRevenue = perGroup.reduce((a, g) => a + g.monthlyRevenue, 0);
  const totalMonthlyExchanges = perGroup.reduce((a, g) => a + g.monthlyExchanges, 0);
  return {
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12,
    totalMonthlyExchanges,
    perGroup,
  };
}

// ─── Boardwalk's own economics ───────────────────────────────────────────────

export const BOARDWALK_AVG_FEE = 4300;
export const BOARDWALK_REVENUE_TARGET = 7_000_000;

export interface BoardwalkEconomicsInput {
  exchanges: number;
  avgFee?: number;
  annualRevenueTarget?: number;
}
export interface BoardwalkEconomicsResult {
  monthlyCost: number;
  annualCost: number;
  monthlyCommission: number;
  annualCommission: number;
  pctOfCommission: number; // 0..1
  pctOfTarget: number; // 0..1
}

export function boardwalkEconomics({
  exchanges,
  avgFee = BOARDWALK_AVG_FEE,
  annualRevenueTarget = BOARDWALK_REVENUE_TARGET,
}: BoardwalkEconomicsInput): BoardwalkEconomicsResult {
  const monthlyCost = boardwalkMonthlyCost(exchanges);
  const annualCost = monthlyCost * 12;
  const monthlyCommission = exchanges * avgFee;
  const annualCommission = monthlyCommission * 12;
  return {
    monthlyCost,
    annualCost,
    monthlyCommission,
    annualCommission,
    pctOfCommission: annualCommission > 0 ? annualCost / annualCommission : 0,
    pctOfTarget: annualRevenueTarget > 0 ? annualCost / annualRevenueTarget : 0,
  };
}

// ─── Fall-through sensitivity ────────────────────────────────────────────────
// Same starting number of agreed sales in both scenarios (the brief's
// mathematical-consistency requirement). Software cost of the extra exchanges is
// reported separately, and the result is gross commission, never "profit".

export interface FallThroughInput {
  agreedSales: number;
  baselineFalloutPct: number; // 0..1
  improvedFalloutPct: number; // 0..1
  avgFee?: number;
  pricePerExchange?: number;
}
export interface FallThroughResult {
  baselineExchanges: number;
  improvedExchanges: number;
  additionalExchanges: number;
  additionalGrossCommission: number;
  additionalSoftwareCost: number;
}

export function fallThrough({
  agreedSales,
  baselineFalloutPct,
  improvedFalloutPct,
  avgFee = BOARDWALK_AVG_FEE,
  pricePerExchange = AGENCY_PRICE_PER_EXCHANGE,
}: FallThroughInput): FallThroughResult {
  const baselineExchanges = agreedSales * (1 - baselineFalloutPct);
  const improvedExchanges = agreedSales * (1 - improvedFalloutPct);
  const additionalExchanges = improvedExchanges - baselineExchanges;
  return {
    baselineExchanges,
    improvedExchanges,
    additionalExchanges,
    additionalGrossCommission: additionalExchanges * avgFee,
    additionalSoftwareCost: additionalExchanges * pricePerExchange,
  };
}

// ─── Independent progressor network ──────────────────────────────────────────
// £5 base fee applies to EVERY added sale (own + introduced). The +£10 applies
// only to TSP-introduced sales that go on to exchange — never a second £5.

export const PROGRESSOR_DIRECTOR_FEE = 59;
export const PROGRESSOR_MEMBER_FEE = 39;
export const PROGRESSOR_PER_SALE_FEE = 5;
export const PROGRESSOR_INTRO_EXCHANGE_FEE = 10;

export interface ProgressorNetworkInput {
  businesses: number;
  directorsPerBusiness: number;
  additionalMembersPerBusiness: number;
  salesPerBusinessPerMonth: number;
  pctViaIntroduction: number; // 0..1
  networkExchangeRate: number; // 0..1 — share of introduced sales that exchange
  directorFee?: number;
  memberFee?: number;
  perSaleFee?: number;
  introExchangeFee?: number;
}
export interface ProgressorNetworkResult {
  monthlySubscription: number;
  monthlyTransaction: number;
  monthlyNetworkExchange: number;
  monthlyTotal: number;
  annualTotal: number;
}

export function progressorNetwork({
  businesses,
  directorsPerBusiness,
  additionalMembersPerBusiness,
  salesPerBusinessPerMonth,
  pctViaIntroduction,
  networkExchangeRate,
  directorFee = PROGRESSOR_DIRECTOR_FEE,
  memberFee = PROGRESSOR_MEMBER_FEE,
  perSaleFee = PROGRESSOR_PER_SALE_FEE,
  introExchangeFee = PROGRESSOR_INTRO_EXCHANGE_FEE,
}: ProgressorNetworkInput): ProgressorNetworkResult {
  const monthlySubscription =
    businesses * (directorsPerBusiness * directorFee + additionalMembersPerBusiness * memberFee);

  const totalSales = businesses * salesPerBusinessPerMonth;
  const monthlyTransaction = totalSales * perSaleFee; // £5 on every added sale

  const introducedSales = totalSales * pctViaIntroduction;
  const networkExchanges = introducedSales * networkExchangeRate;
  const monthlyNetworkExchange = networkExchanges * introExchangeFee; // +£10 on exchange only

  const monthlyTotal = monthlySubscription + monthlyTransaction + monthlyNetworkExchange;
  return {
    monthlySubscription,
    monthlyTransaction,
    monthlyNetworkExchange,
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
  };
}

// ─── Additional operational software (Forms + Tasks bundle adoption) ─────────

export interface AdditionalSoftwareInput {
  customers: number;
  adoptionPct: number; // 0..1
  bundleMonthly?: number;
}
export interface AdditionalSoftwareResult {
  adoptingCustomers: number;
  monthlyRevenue: number;
  annualRevenue: number;
}

export function additionalSoftware({
  customers,
  adoptionPct,
  bundleMonthly = FORMS_BUNDLE_MONTHLY,
}: AdditionalSoftwareInput): AdditionalSoftwareResult {
  const adoptingCustomers = customers * adoptionPct;
  const monthlyRevenue = adoptingCustomers * bundleMonthly;
  return {
    adoptingCustomers,
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12,
  };
}

// ─── Investment budget allocation ────────────────────────────────────────────

export interface BudgetAllocation {
  id: string;
  label: string;
  amount: number;
}
export interface BudgetResult {
  total: number;
  allocated: number;
  remaining: number;
  monthlyEquivalent: number;
  items: { id: string; label: string; amount: number; pct: number }[];
  /** Runway in months at an assumed monthly spend (if provided and > 0). */
  durationMonths: number | null;
}

export function investmentBudget(
  total: number,
  allocations: BudgetAllocation[],
  assumedMonthlySpend?: number,
): BudgetResult {
  const allocated = allocations.reduce((a, b) => a + b.amount, 0);
  return {
    total,
    allocated,
    remaining: total - allocated,
    monthlyEquivalent: total / 12,
    items: allocations.map((a) => ({
      id: a.id,
      label: a.label,
      amount: a.amount,
      pct: total > 0 ? a.amount / total : 0,
    })),
    durationMonths: assumedMonthlySpend && assumedMonthlySpend > 0 ? total / assumedMonthlySpend : null,
  };
}

export const DEFAULT_BUDGET_TOTAL = 75_000;
export const DEFAULT_BUDGET_ALLOCATIONS: BudgetAllocation[] = [
  { id: "advertising", label: "Advertising & lead generation", amount: 24_000 },
  { id: "sales", label: "Sales & business development", amount: 18_000 },
  { id: "events", label: "Industry events & exhibitions", amount: 10_000 },
  { id: "contingency", label: "Contingency & opportunities", amount: 10_000 },
  { id: "content", label: "Content, video & marketing materials", amount: 8_000 },
  { id: "tools", label: "Marketing tools & experimentation", amount: 5_000 },
];

// ─── Customer acquisition (explicitly illustrative) ──────────────────────────

export interface AcquisitionInput {
  budget: number;
  costPerAcquisition: number;
  avgExchangesPerCustomer: number;
  pricePerExchange?: number;
}
export interface AcquisitionResult {
  customersAcquired: number;
  monthlyExchanges: number;
  annualRevenueFullAdoption: number;
}

export function acquisition({
  budget,
  costPerAcquisition,
  avgExchangesPerCustomer,
  pricePerExchange = AGENCY_PRICE_PER_EXCHANGE,
}: AcquisitionInput): AcquisitionResult {
  const customersAcquired = costPerAcquisition > 0 ? budget / costPerAcquisition : 0;
  const monthlyExchanges = customersAcquired * avgExchangesPerCustomer;
  return {
    customersAcquired,
    monthlyExchanges,
    annualRevenueFullAdoption: monthlyExchanges * pricePerExchange * 12,
  };
}

// ─── Combined business model ─────────────────────────────────────────────────
// Sums the independent revenue streams and returns their composition. Each
// stream is computed by its own function above so there is one definition of
// each number. No stream double-counts another.

export interface CombinedModelInput {
  agency: AgencyRevenueInput;
  includeBoardwalk: boolean;
  boardwalkExchanges: number;
  progressor: ProgressorNetworkInput;
  software: AdditionalSoftwareInput;
}
export interface CombinedStream {
  id: string;
  label: string;
  monthly: number;
  annual: number;
}
export interface CombinedModelResult {
  streams: CombinedStream[];
  monthlyTotal: number;
  annualTotal: number;
}

export function combinedModel(input: CombinedModelInput): CombinedModelResult {
  const agency = agencyRevenue(input.agency);
  const boardwalk = input.includeBoardwalk ? boardwalkMonthlyCost(input.boardwalkExchanges) : 0;
  const progressor = progressorNetwork(input.progressor);
  const software = additionalSoftware(input.software);

  const streams: CombinedStream[] = [
    { id: "agency", label: "Agency exchanges", monthly: agency.monthlyRevenue, annual: agency.annualRevenue },
    { id: "boardwalk", label: "Boardwalk", monthly: boardwalk, annual: boardwalk * 12 },
    { id: "progressor", label: "Progressor network", monthly: progressor.monthlyTotal, annual: progressor.annualTotal },
    { id: "software", label: "Operational tools", monthly: software.monthlyRevenue, annual: software.annualRevenue },
  ];

  const monthlyTotal = streams.reduce((a, s) => a + s.monthly, 0);
  return { streams, monthlyTotal, annualTotal: monthlyTotal * 12 };
}

// ─── Formatting helpers (presentation only — never used inside the maths) ────

export function gbp(n: number, opts: { decimals?: number } = {}): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0,
  }).format(n);
}

export function gbpCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`;
  if (Math.abs(n) >= 1_000) return `£${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return gbp(n);
}

export function pct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function num(n: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n);
}
