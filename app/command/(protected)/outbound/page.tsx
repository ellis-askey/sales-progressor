import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies } from "@/lib/command/scope";
import { OutboundRow, type OutboundRowData } from "@/components/command/OutboundRow";
import { OutboundFilters } from "@/components/command/OutboundFilters";
import type { Prisma } from "@prisma/client";
import Link from "next/link";

const PAGE_SIZE = 50;

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string; agency?: string;
    ch?: string; st?: string; ai?: string;
    from?: string; to?: string; rec?: string; q?: string;
    cursor?: string; pending?: string;
  }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);

  const channels = sp.ch?.split(",").filter(Boolean) ?? [];
  const statuses = sp.st?.split(",").filter(Boolean) ?? [];
  const aiFilter = sp.ai ?? "all";
  const dateFrom = sp.from ? new Date(sp.from) : null;
  const dateTo = sp.to ? new Date(`${sp.to}T23:59:59.999Z`) : null;
  const recipient = sp.rec?.trim() ?? "";
  const bodySearch = sp.q?.trim() ?? "";
  const pending = sp.pending === "1";
  const cursor = sp.cursor ?? null;

  const where: Prisma.OutboundMessageWhereInput = {};
  if (agencyIds.length > 0) where.agencyId = { in: agencyIds };
  if (channels.length > 0) where.channel = { in: channels as Prisma.EnumOutboundChannelFilter["in"] };
  if (aiFilter === "yes") where.wasAiGenerated = true;
  else if (aiFilter === "no") where.wasAiGenerated = false;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }
  if (recipient) {
    where.OR = [
      { recipientEmail: { contains: recipient, mode: "insensitive" } },
      { recipientName: { contains: recipient, mode: "insensitive" } },
      { recipientHandle: { contains: recipient, mode: "insensitive" } },
    ];
  }
  if (pending) {
    where.requiresApproval = true;
    where.approvedAt = null;
    if (statuses.length === 0) where.status = { not: "cancelled" };
  } else if (statuses.length > 0) {
    where.status = { in: statuses as Prisma.EnumOutboundStatusFilter["in"] };
  }

  if (bodySearch) {
    const bodyIds = await commandDb.$queryRaw<{ id: string }[]>`
      SELECT id FROM "OutboundMessage"
      WHERE "bodySearch" @@ plainto_tsquery('english', ${bodySearch})
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 500
    `;
    where.id = bodyIds.length > 0 ? { in: bodyIds.map((r) => r.id) } : { in: [] as string[] };
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const h24ago = new Date(Date.now() - 86_400_000);
  const todayStr = todayStart.toISOString().slice(0, 10);

  const [totalToday, sentToday, aiToday, awaitingApproval, failed24h] = await Promise.all([
    commandDb.outboundMessage.count({ where: { createdAt: { gte: todayStart } } }),
    commandDb.outboundMessage.count({ where: { sentAt: { gte: todayStart } } }),
    commandDb.outboundMessage.count({ where: { wasAiGenerated: true, createdAt: { gte: todayStart } } }),
    commandDb.outboundMessage.count({
      where: { requiresApproval: true, approvedAt: null, status: { not: "cancelled" } },
    }),
    commandDb.outboundMessage.count({ where: { status: "failed", failedAt: { gte: h24ago } } }),
  ]);

  const rows = await commandDb.outboundMessage.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, channel: true, status: true, purpose: true,
      recipientName: true, recipientEmail: true, recipientHandle: true,
      subject: true, wasAiGenerated: true, requiresApproval: true,
      approvedAt: true, isAutomated: true, aiModel: true,
      aiTokensInput: true, aiTokensOutput: true, aiCostCents: true,
      sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true,
      failedAt: true, failureReason: true, scheduledFor: true,
      createdAt: true, transactionId: true, agencyId: true,
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const messages = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? messages[messages.length - 1].id : null;

  function buildUrl(extra: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const forward = { mode: sp.mode, agency: sp.agency, ch: sp.ch, st: sp.st, ai: sp.ai, from: sp.from, to: sp.to, rec: sp.rec, q: sp.q, pending: sp.pending };
    for (const [k, v] of Object.entries({ ...forward, ...extra })) {
      if (v) p.set(k, v);
    }
    return `/command/outbound?${p.toString()}`;
  }

  const SUMMARY = [
    { label: "Today",             value: totalToday,        href: `/command/outbound?from=${todayStr}&to=${todayStr}`,                                                          warn: false },
    { label: "Sent today",        value: sentToday,         href: `/command/outbound?st=sent%2Cdelivered%2Copened%2Cclicked&from=${todayStr}&to=${todayStr}`,                   warn: false },
    { label: "AI today",          value: aiToday,           href: `/command/outbound?ai=yes&from=${todayStr}&to=${todayStr}`,                                                   warn: false },
    { label: "Awaiting approval", value: awaitingApproval,  href: "/command/outbound?pending=1",                                                                               warn: awaitingApproval > 0 },
    { label: "Failed 24h",        value: failed24h,         href: "/command/outbound?st=failed",                                                                               warn: failed24h > 0 },
  ] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-100">Outbound</h1>

      {/* Summary counts */}
      <div className="flex items-center gap-2 flex-wrap">
        {SUMMARY.map(({ label, value, href, warn }) => (
          <Link
            key={label}
            href={href}
            className="flex items-baseline gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors"
          >
            <span
              className={`text-xl font-semibold tabular-nums leading-none ${
                warn ? "text-amber-400" : "text-white"
              }`}
            >
              {value.toLocaleString()}
            </span>
            <span className="text-[11px] text-neutral-500">{label}</span>
          </Link>
        ))}
      </div>

      {/* Filter bar */}
      <OutboundFilters />

      {/* Message list */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {messages.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-neutral-600">No messages match these filters.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between">
              <p className="text-[10px] text-neutral-600">
                {messages.length}{hasMore ? "+" : ""} message{messages.length !== 1 ? "s" : ""}
              </p>
              {cursor && (
                <Link
                  href={buildUrl({ cursor: undefined })}
                  className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  ← First page
                </Link>
              )}
            </div>

            {messages.map((row) => (
              <OutboundRow key={row.id} row={row as unknown as OutboundRowData} />
            ))}

            {hasMore && nextCursor && (
              <div className="px-4 py-3 border-t border-neutral-800">
                <Link
                  href={buildUrl({ cursor: nextCursor })}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Load next {PAGE_SIZE} →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
