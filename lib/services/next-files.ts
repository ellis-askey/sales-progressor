// Founder cockpit data — "what to work on next" (critiques #12 + #29).
//
// Active OUTSOURCED files across all agencies, aged by how long since a HUMAN
// last contacted each client side (seller / buyer). "Human" = a logged call,
// a personal email, WhatsApp, or a portal update WE sent — never the automated
// step-chaser or system emails. Ordered most-neglected first; a file is "quiet"
// once neither side has been touched for 5 working days. Also returns a coverage
// stat: how many active files were touched in the last 10 calendar days.
//
// Founder-only surface. The page gates on the founder email; this service just
// scopes cross-agency via getAccessScope (kind:"all" for the founder).

import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { businessDaysSince } from "@/lib/services/fees";

// Outbound rows that actually reached (or are on their way to) the recipient.
const REACHED_STATUSES = ["sent", "delivered", "opened", "clicked"] as const;
// Coverage window is calendar days (the founder's "touched in the last 10 days").
const COVERAGE_WINDOW_DAYS = 10;
// Never-touched files sort above any real quiet count.
const NEVER_TOUCHED_SENTINEL = 9999;

export type CockpitSide = {
  contactId: string;
  name: string;
  image: string | null;
  phone: string | null;
  email: string | null;
  roleType: "vendor" | "purchaser";
  lastTouchAt: string | null; // ISO, most recent human touch to this side
  lastMethod: string | null; // "phone" | "email" | "whatsapp" | "sms" | "portal" | ...
  quietWorkingDays: number | null; // null when never touched
};

export type CockpitFile = {
  id: string;
  address: string;
  agencyName: string | null;
  photoUrl: string | null;
  // Working days since the last human touch to EITHER side. Never-touched files
  // carry the sentinel so they float to the top.
  quietWorkingDays: number;
  lastTouchAt: string | null;
  seller: CockpitSide | null;
  buyer: CockpitSide | null;
};

export type CockpitData = {
  files: CockpitFile[];
  coverage: { total: number; touched: number };
};

type Touch = { at: Date; method: string };

// Fold a (contactId, timestamp, method) touch into the running latest-per-contact map.
function record(map: Map<string, Touch>, contactId: string, at: Date, method: string) {
  const prev = map.get(contactId);
  if (!prev || at > prev.at) map.set(contactId, { at, method });
}

export async function getNextFiles(session: Parameters<typeof getAccessScope>[0]): Promise<CockpitData> {
  const scope = getAccessScope(session);

  const files = await prisma.propertyTransaction.findMany({
    where: { ...scopeTransactionWhere(scope), status: "active", serviceType: "outsourced" },
    select: {
      id: true,
      propertyAddress: true,
      photoStoragePath: true,
      activeBuyerRoundId: true,
      agency: { select: { name: true } },
      contacts: {
        select: { id: true, name: true, roleType: true, image: true, phone: true, email: true, isPrincipal: true, buyerRoundId: true },
      },
    },
  });

  if (files.length === 0) return { files: [], coverage: { total: 0, touched: 0 } };

  const txIds = files.map((f) => f.id);

  // Every HUMAN outbound comm on these files (isAutomated:false, actually sent),
  // plus every agent→client portal message. WhatsApp is included (method matches).
  const [comms, portalMsgs] = await Promise.all([
    prisma.outboundMessage.findMany({
      where: {
        transactionId: { in: txIds },
        type: "outbound",
        isAutomated: false,
        status: { in: [...REACHED_STATUSES] },
      },
      select: { transactionId: true, contactIds: true, method: true, createdAt: true, sentAt: true },
    }),
    prisma.portalMessage.findMany({
      where: { transactionId: { in: txIds }, fromClient: false },
      select: { transactionId: true, contactId: true, createdAt: true },
    }),
  ]);

  // Latest human touch per contact, keyed by transaction.
  const touchesByTx = new Map<string, Map<string, Touch>>();
  const ensure = (txId: string) => {
    let m = touchesByTx.get(txId);
    if (!m) { m = new Map(); touchesByTx.set(txId, m); }
    return m;
  };
  for (const c of comms) {
    if (!c.transactionId) continue;
    const at = c.sentAt ?? c.createdAt;
    const method = c.method ?? "message";
    const m = ensure(c.transactionId);
    for (const cid of c.contactIds) record(m, cid, at, method);
  }
  for (const p of portalMsgs) {
    if (!p.contactId) continue;
    record(ensure(p.transactionId), p.contactId, p.createdAt, "portal");
  }

  const now = new Date();
  const coverageCutoff = new Date(now.getTime() - COVERAGE_WINDOW_DAYS * 86400000);

  const photoMap = await getSignedUrlMap(files.map((f) => f.photoStoragePath));

  const built: CockpitFile[] = files.map((f) => {
    const touches = touchesByTx.get(f.id) ?? new Map<string, Touch>();

    // Client contacts per side. Purchaser contacts are round-scoped (relisted
    // files get a fresh buyer); vendor contacts are file-level (null round).
    const isActiveRound = (roundId: string | null) => roundId === null || roundId === f.activeBuyerRoundId;
    const vendorContacts = f.contacts.filter((c) => c.roleType === "vendor");
    const purchaserContacts = f.contacts.filter((c) => c.roleType === "purchaser" && isActiveRound(c.buyerRoundId));

    const buildSide = (contacts: typeof f.contacts, roleType: "vendor" | "purchaser"): CockpitSide | null => {
      if (contacts.length === 0) return null;
      const principal = contacts.find((c) => c.isPrincipal) ?? contacts[0];
      // Side's last touch = most recent across ALL of that side's contacts.
      let best: Touch | null = null;
      for (const c of contacts) {
        const t = touches.get(c.id);
        if (t && (!best || t.at > best.at)) best = t;
      }
      return {
        contactId: principal.id,
        name: principal.name,
        image: principal.image ?? null,
        phone: principal.phone ?? null,
        email: principal.email ?? null,
        roleType,
        lastTouchAt: best ? best.at.toISOString() : null,
        lastMethod: best ? best.method : null,
        quietWorkingDays: best ? businessDaysSince(best.at, now) : null,
      };
    };

    const seller = buildSide(vendorContacts, "vendor");
    const buyer = buildSide(purchaserContacts, "purchaser");

    // File-level last touch = the more recent of the two sides.
    const dates = [seller?.lastTouchAt, buyer?.lastTouchAt].filter((d): d is string => !!d).map((d) => new Date(d));
    const lastTouch = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

    return {
      id: f.id,
      address: f.propertyAddress,
      agencyName: f.agency?.name ?? null,
      photoUrl: f.photoStoragePath ? photoMap.get(f.photoStoragePath) ?? null : null,
      quietWorkingDays: lastTouch ? businessDaysSince(lastTouch, now) : NEVER_TOUCHED_SENTINEL,
      lastTouchAt: lastTouch ? lastTouch.toISOString() : null,
      seller,
      buyer,
    };
  });

  // Most neglected first; oldest-touch breaks ties.
  built.sort((a, b) => {
    if (b.quietWorkingDays !== a.quietWorkingDays) return b.quietWorkingDays - a.quietWorkingDays;
    const aT = a.lastTouchAt ? new Date(a.lastTouchAt).getTime() : 0;
    const bT = b.lastTouchAt ? new Date(b.lastTouchAt).getTime() : 0;
    return aT - bT;
  });

  const touched = built.filter((f) => f.lastTouchAt && new Date(f.lastTouchAt) >= coverageCutoff).length;

  return { files: built, coverage: { total: built.length, touched } };
}
