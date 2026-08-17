import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { commandDb } from "@/lib/command/prisma";
import { parseAgencies } from "@/lib/command/scope";
import {
  TABS,
  kindsForTab,
  kindLabel,
  REDACTED_KINDS,
  type AgentEmailTabId,
} from "@/lib/command/agent-emails";
import { AgentEmailRow, type AgentEmailRowData } from "@/components/command/agent-emails/AgentEmailRow";
import { AgentEmailFilters } from "@/components/command/agent-emails/AgentEmailFilters";

// Command Centre → Agent emails. Every email we send TO an agency user (or an
// external agent) that doesn't already leave a trail on a file. Client-facing
// sends are logged on the file, not here. Log starts at ship date; no backfill.

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AgentEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    agency?: string;
    tab?: string;
    rec?: string;
    cursor?: string;
  }>;
}) {
  const sp = await searchParams;
  const agencyIds = parseAgencies(sp.agency);
  const tabId = (TABS.some((t) => t.id === sp.tab) ? sp.tab : "all") as AgentEmailTabId;
  const kinds = kindsForTab(tabId);
  const recipient = sp.rec?.trim() ?? "";
  const cursor = sp.cursor ?? null;

  const where: Prisma.AgentEmailLogWhereInput = {};
  if (kinds) where.kind = { in: kinds };
  if (agencyIds.length > 0) where.agencyId = { in: agencyIds };
  if (recipient) {
    where.OR = [
      { toEmail: { contains: recipient, mode: "insensitive" } },
      { user: { name: { contains: recipient, mode: "insensitive" } } },
    ];
  }

  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000);
  const d30 = new Date(now - 30 * 86_400_000);

  const [sent7d, sent30d, byKind, rowsRaw] = await Promise.all([
    commandDb.agentEmailLog.count({ where: { sentAt: { gte: d7 } } }),
    commandDb.agentEmailLog.count({ where: { sentAt: { gte: d30 } } }),
    commandDb.agentEmailLog.groupBy({
      by: ["kind"],
      where: { sentAt: { gte: d30 } },
      _count: { _all: true },
    }),
    commandDb.agentEmailLog.findMany({
      where,
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        sentAt: true,
        toEmail: true,
        kind: true,
        subject: true,
        text: true,
        html: true,
        user: { select: { name: true, role: true } },
        agency: { select: { name: true } },
        transaction: { select: { propertyAddress: true } },
      },
    }),
  ]);

  const hasMore = rowsRaw.length > PAGE_SIZE;
  const page = hasMore ? rowsRaw.slice(0, PAGE_SIZE) : rowsRaw;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const rows: AgentEmailRowData[] = page.map((r) => {
    const redacted = REDACTED_KINDS.has(r.kind);
    return {
      id: r.id,
      sentAt: r.sentAt.toISOString(),
      toEmail: r.toEmail,
      kind: r.kind,
      subject: r.subject,
      userName: r.user?.name ?? null,
      userRole: r.user?.role ?? null,
      agencyName: r.agency?.name ?? null,
      txAddress: r.transaction?.propertyAddress ?? null,
      text: redacted ? null : r.text,
      html: redacted ? null : r.html,
      redacted,
    };
  });

  const kindCounts = new Map<string, number>();
  for (const g of byKind) kindCounts.set(g.kind, g._count._all);
  const topKinds = [...kindCounts.entries()].sort((a, b) => b[1] - a[1]);

  function buildUrl(extra: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const forward = { mode: sp.mode, agency: sp.agency, tab: sp.tab, rec: sp.rec };
    for (const [k, v] of Object.entries({ ...forward, ...extra })) {
      if (v) p.set(k, v);
    }
    return `/command/agent-emails?${p.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Agent emails</h1>
        <p className="mt-1 text-sm text-neutral-400">
          What we send agency users and external agents. Client-facing emails are logged on the file,
          not here.
        </p>
      </div>

      {/* KPI strip */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-baseline gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800">
          <span className="text-xl font-semibold tabular-nums leading-none text-white">
            {sent7d.toLocaleString()}
          </span>
          <span className="text-[11px] text-neutral-500">sent 7 days</span>
        </div>
        <div className="flex items-baseline gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800">
          <span className="text-xl font-semibold tabular-nums leading-none text-white">
            {sent30d.toLocaleString()}
          </span>
          <span className="text-[11px] text-neutral-500">sent 30 days</span>
        </div>
        {topKinds.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-1">
            {topKinds.map(([kind, count]) => (
              <Link
                key={kind}
                href={buildUrl({ tab: undefined, cursor: undefined })}
                className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
                title={`${kindLabel(kind)}: ${count} in 30 days`}
              >
                {kindLabel(kind)} <span className="tabular-nums text-neutral-400">{count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-neutral-800 pb-2">
        {TABS.map((t) => {
          const active = t.id === tabId;
          return (
            <Link
              key={t.id}
              href={buildUrl({ tab: t.id === "all" ? undefined : t.id, cursor: undefined })}
              className={`text-[12px] px-2.5 py-1 rounded-md transition-colors ${
                active
                  ? "bg-[#1d2d50] text-[#93c5fd]"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Recipient search */}
      <AgentEmailFilters />

      {/* List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-neutral-600">No agent emails match these filters.</p>
            <p className="mt-1 text-[11px] text-neutral-700">
              The log starts from when this was shipped — earlier sends were not recorded.
            </p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between">
              <p className="text-[10px] text-neutral-600">
                {rows.length}
                {hasMore ? "+" : ""} email{rows.length !== 1 ? "s" : ""}
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
            {rows.map((row) => (
              <AgentEmailRow key={row.id} row={row} />
            ))}
            {nextCursor && (
              <div className="px-4 py-3 border-t border-neutral-800 text-center">
                <Link
                  href={buildUrl({ cursor: nextCursor })}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Load older →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
