// Cost estimation for AI calls, in pence, from token usage.
//
// Rates are APPROXIMATE list prices (pence per 1,000,000 tokens) and are meant to
// be kept roughly current, not billed-accurate — they exist so the Command Centre
// can show a sensible running spend, not to reconcile an invoice. Update here when
// provider pricing changes. An unknown model logs cost 0 (we never fabricate a
// number we can't back), and getMissingRates() surfaces which models need rates.

import type { AIUsage } from "./provider";

type Rate = { inPencePerM: number; outPencePerM: number };

// Approx GBP list prices as of 2026-Q3 (~0.79 GBP/USD). Verify against provider
// pricing pages; these drive a sensible running total, not a billed figure.
const RATES: Record<string, Rate> = {
  // Anthropic Claude Opus 4.x — approx $15 / $75 per MTok.
  "claude-opus-4-8": { inPencePerM: 1185, outPencePerM: 5925 },
  // Anthropic Claude Haiku 4.5 — approx $1 / $5 per MTok.
  "claude-haiku-4-5-20251001": { inPencePerM: 79, outPencePerM: 395 },
  // OpenAI GPT-5.x — reviewer runs on gpt-5.5.
  "gpt-5.5": { inPencePerM: 395, outPencePerM: 2370 }, // ~$5 / $30
  "gpt-5.5-pro": { inPencePerM: 2370, outPencePerM: 14220 }, // ~$30 / $180
  "gpt-5.4": { inPencePerM: 198, outPencePerM: 1185 }, // ~$2.50 / $15
  "gpt-5.6-sol": { inPencePerM: 395, outPencePerM: 2370 }, // ~$5 / $30
  // Legacy fallbacks.
  "gpt-4.1": { inPencePerM: 158, outPencePerM: 632 },
  "gpt-4o": { inPencePerM: 198, outPencePerM: 790 },
};

export function estimateCostPence(model: string, usage: AIUsage): number {
  const rate = RATES[model];
  if (!rate) return 0; // unknown model: log 0 rather than invent a figure
  const inCost = (usage.inputTokens / 1_000_000) * rate.inPencePerM;
  const outCost = (usage.outputTokens / 1_000_000) * rate.outPencePerM;
  return Math.round(inCost + outCost);
}

export function hasRate(model: string): boolean {
  return !!RATES[model];
}
