// Append-only exchange-prediction history (Data Optionality capture-now, PR4).
//
// The live prediction fields (expectedExchangeDate, overridePredictedDate) stay
// the operational source of truth. This module records, change-only, the
// trajectory those fields take over a file's life so we can later evaluate how
// forecasts moved and whether they were accurate. Capture-only: no product
// surface reads ExchangePredictionHistory yet.
//
// A row is written ONLY when the value actually moves to a different calendar
// day, so the high-frequency system recompute (which fires on every confirm)
// does not spam identical rows.

import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

export type PredictionField = "expectedExchangeDate" | "overridePredictedDate";
export type PredictionSource =
  | "creation"
  | "system_recompute"
  | "manual_override"
  | "override_cleared"
  | "exchange_freeze"
  | "relist_reset"
  | "api_patch";

/**
 * True when the predicted date has moved to a different calendar day (UTC —
 * both stored values are date-only at UTC midnight, matching isSameCalendarDay
 * in app/actions/transactions.ts). A null↔date transition counts as a change; a
 * time-of-day-only difference does not (so per-render recomputes don't log).
 */
export function predictionChanged(previous: Date | null, next: Date | null): boolean {
  if (!previous && !next) return false;
  if (!previous || !next) return true;
  return (
    previous.getUTCFullYear() !== next.getUTCFullYear() ||
    previous.getUTCMonth() !== next.getUTCMonth() ||
    previous.getUTCDate() !== next.getUTCDate()
  );
}

export type PredictionHistoryInput = {
  transactionId: string;
  buyerRoundId?: string | null;
  field: PredictionField;
  previousDate: Date | null;
  predictedDate: Date | null;
  source: PredictionSource;
  isOverride?: boolean;
  changedByUserId?: string | null;
  inputsSnapshot?: Prisma.InputJsonValue;
};

/**
 * Append a prediction-change row ONLY when the date actually moved (calendar
 * day). Returns true if a row was written. Uses the passed `db` handle so it can
 * share a caller's transaction. Not wrapped in try/catch — irrecoverable data.
 */
export async function recordPredictionChangeIfMoved(
  db: Db,
  input: PredictionHistoryInput,
): Promise<boolean> {
  if (!predictionChanged(input.previousDate, input.predictedDate)) return false;
  await db.exchangePredictionHistory.create({
    data: {
      transactionId: input.transactionId,
      buyerRoundId: input.buyerRoundId ?? null,
      field: input.field,
      previousDate: input.previousDate,
      predictedDate: input.predictedDate,
      source: input.source,
      isOverride: input.isOverride ?? false,
      changedByUserId: input.changedByUserId ?? null,
      ...(input.inputsSnapshot !== undefined ? { inputsSnapshot: input.inputsSnapshot } : {}),
    },
  });
  return true;
}
