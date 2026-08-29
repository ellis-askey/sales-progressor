import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// The write side of the unified feature-usage stream (Command Centre → Feature
// usage). Call this for features that otherwise leave NO durable first-party
// row — downloads, view-only surfaces, anything that today only reports to the
// dormant PostHog. Features that already write their own row (a message, a
// document, a confirm) do NOT call this; the registry reads those tables
// directly, so calling here as well would double-count.
//
// Best-effort: failures are logged, never thrown. A usage record must never
// block or break the user action that triggered it.

export type FeatureUseInput = {
  feature: string; // registry feature id, e.g. "calendar_export"
  surface: "portal" | "agent" | "solicitor" | "internal";
  actorType: "client" | "agent" | "firm" | "file";
  actorId?: string | null;
  transactionId?: string | null;
  agencyId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordFeatureUse(input: FeatureUseInput): Promise<void> {
  try {
    await prisma.featureEvent.create({
      data: {
        feature: input.feature,
        surface: input.surface,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        transactionId: input.transactionId ?? null,
        agencyId: input.agencyId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    console.warn("[command/feature-usage] feature_use_write_failed", {
      feature: input.feature,
      transactionId: input.transactionId,
      err,
    });
  }
}
