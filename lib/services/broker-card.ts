// Mortgage broker card — resolution + shared helpers (2026-08-21).
//
// The buyer portal shows one mortgage broker to mortgage buyers. Which broker
// depends on the file:
//   1. The agent set a broker on the file  -> that broker ("agent" source).
//   2. Otherwise, an outsourced file        -> the TSP-default broker provider
//      ("tsp" source).
//   3. Otherwise (self-managed, no broker)  -> nothing.
//
// Only ever relevant to mortgage buyers (purchaseType = mortgage); cash buyers
// have no mortgage milestones and never see it. Milestone/side/hidden gating
// lives on the portal page; this module owns the broker resolution + prefill.

import { prisma } from "@/lib/prisma";
import { getProviderLogoUrl } from "@/lib/supabase-storage";
import type { QuoteContactMethod, ProviderServiceType } from "@prisma/client";

export type BrokerSource = "agent" | "tsp";

export type ResolvedBroker = {
  source: BrokerSource;
  // Provider firm id + email are only present for the TSP source (the broker
  // is a ProviderFirm we email directly). For the agent source the broker is
  // the file's BrokerFirm/BrokerContact and we email the agent, not the broker.
  firmName: string;
  providerId: string | null;
  brokerEmail: string | null;
  // Provider logo (TSP source only — agents' BrokerFirm has no logo). Null
  // falls back to the firm's initials.
  logoUrl: string | null;
};

// Shared resolver used by both the display card and the request action.
export async function resolveBroker(tx: {
  serviceType: string | null;
  brokerFirmId: string | null;
  brokerFirm: { name: string } | null;
}): Promise<ResolvedBroker | null> {
  if (tx.brokerFirmId && tx.brokerFirm) {
    return { source: "agent", firmName: tx.brokerFirm.name, providerId: null, brokerEmail: null, logoUrl: null };
  }
  if (tx.serviceType !== "self_managed") {
    const tsp = await prisma.providerFirm.findFirst({
      where: { kind: "mortgage_broker", tspDefault: true, active: true },
      select: { id: true, name: true, email: true, logoPath: true },
    });
    if (tsp) return { source: "tsp", firmName: tsp.name, providerId: tsp.id, brokerEmail: tsp.email, logoUrl: getProviderLogoUrl(tsp.logoPath) };
  }
  return null;
}

export type BrokerCardData = {
  source: BrokerSource;
  firmName: string;
  logoUrl: string | null;
  // The agency the buyer sees us as — we present as the agent on every file,
  // in-house or outsourced. Drives the "Recommended by {agency}" line.
  agencyName: string;
  // True when ANY purchaser on the file has already requested a call-back, so
  // a joint co-buyer sees the acknowledgment rather than re-requesting.
  requested: boolean;
  prefill: {
    name: string;
    email: string | null;
    phone: string | null;
    contactMethod: QuoteContactMethod;
  };
} | null;

/**
 * Resolve the broker card for a purchaser's portal view. Returns null when no
 * broker applies (not a mortgage buyer, or self-managed with no agent broker).
 * The caller (portal page) still applies the milestone/side/dismiss gating.
 */
export async function getPortalBrokerCard(
  transactionId: string,
  contactId: string,
): Promise<BrokerCardData> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      serviceType: true,
      purchaseType: true,
      brokerFirmId: true,
      brokerFirm: { select: { name: true } },
      agency: { select: { name: true } },
      contacts: {
        where: { roleType: "purchaser" },
        select: { brokerCallbackRequestedAt: true },
      },
    },
  });
  if (!tx || tx.purchaseType !== "mortgage") return null;

  const broker = await resolveBroker(tx);
  if (!broker) return null;

  const requested = tx.contacts.some((c) => c.brokerCallbackRequestedAt != null);

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { name: true, email: true, phone: true, portalSettings: true },
  });
  const settings = (contact?.portalSettings ?? null) as { whatsappOptIn?: boolean } | null;

  return {
    source: broker.source,
    firmName: broker.firmName,
    logoUrl: broker.logoUrl,
    agencyName: tx.agency?.name ?? "your agent",
    requested,
    prefill: {
      name: contact?.name ?? "",
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      contactMethod: settings?.whatsappOptIn ? "whatsapp" : "either",
    },
  };
}

// Find-or-create the single "Mortgage advice" service type a broker
// QuoteRequest is filed under. Brokers don't have per-service pricing like
// surveyors, so one shared row is enough.
export async function resolveBrokerServiceType(): Promise<ProviderServiceType> {
  const existing = await prisma.providerServiceType.findFirst({
    where: { kind: "mortgage_broker" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.providerServiceType.create({
    data: { kind: "mortgage_broker", label: "Mortgage advice", sortOrder: 0, active: true },
  });
}
