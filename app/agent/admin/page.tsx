// /agent/admin — single-user admin page for the platform owner.
//
// Visible only to ellis@thesalesprogressor.co.uk (nav item gated in AgentShell;
// page-level guard duplicates the check so direct URL navigation 404s for
// anyone else).
//
// Three cards:
//   1. Agency fee management — set a per-agency legacy override that replaces
//      the £250/£300/£350 outsourced sliding scale with a fixed amount. Self-
//      managed (£59) is never affected.
//   2. Milestone definitions — read-only display of the live engine (ported
//      from /admin, restyled for the agent surface).
//   3. Reminder rules — read-only display of the live rules (ported from
//      /admin).
//
// Cards 2 and 3 carry NO logic changes — same Prisma queries, same data, just
// the agent-surface visual system applied.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { AgencyFeeCard } from "./AgencyFeeCard";

const ADMIN_PAGE_EMAILS = new Set(["ellis@thesalesprogressor.co.uk"]);

export default async function AgentAdminPage() {
  const session = await requireSession();
  if (!ADMIN_PAGE_EMAILS.has(session.user.email ?? "")) notFound();
  const showCommandCentreLink = hasSuperAdminPowers(session);

  const [agencies, milestoneDefs, reminderRules] = await Promise.all([
    prisma.agency.findMany({
      where: { isInternal: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        feeTier: true,
        legacyOutsourcedFeePence: true,
        _count: { select: { transactions: true } },
      },
    }),
    prisma.milestoneDefinition.findMany({
      orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
    }),
    prisma.reminderRule.findMany({
      where: { isActive: true },
      include: { anchorMilestone: { select: { name: true, code: true, side: true, orderIndex: true } } },
    }),
  ]);

  const vendorDefs = milestoneDefs.filter((d) => d.side === "vendor");
  const purchaserDefs = milestoneDefs.filter((d) => d.side === "purchaser");

  // Sort reminder rules to mirror milestone progression order — same logic as
  // the old /admin page so the display matches exactly.
  const sortedRules = [...reminderRules].sort((a, b) => {
    const aNull = !a.anchorMilestone;
    const bNull = !b.anchorMilestone;
    if (aNull && bNull) return a.name.localeCompare(b.name);
    if (aNull) return -1;
    if (bNull) return 1;
    const sideOrder = { vendor: 0, purchaser: 1 } as Record<string, number>;
    const aSide = sideOrder[a.anchorMilestone!.side] ?? 0;
    const bSide = sideOrder[b.anchorMilestone!.side] ?? 0;
    if (aSide !== bSide) return aSide - bSide;
    return a.anchorMilestone!.orderIndex - b.anchorMilestone!.orderIndex;
  });

  const fileCreationRules = sortedRules.filter((r) => !r.anchorMilestone);
  const vendorRules       = sortedRules.filter((r) => r.anchorMilestone?.side === "vendor");
  const purchaserRules    = sortedRules.filter((r) => r.anchorMilestone?.side === "purchaser");

  const legacyCount = agencies.filter((a) => a.feeTier === "legacy").length;

  return (
    <div className="max-w-5xl mx-auto pb-6">
      <PageHeader
        title="Admin"
        subtitle="Per-agency fee overrides plus a live view of milestones and reminder rules."
      >
        {showCommandCentreLink && (
          <Link
            href="/command/overview"
            className="text-xs font-semibold px-3 py-1.5 rounded-md text-white hover:opacity-90 transition-opacity"
            style={{ background: "#FF6B4A" }}
          >
            Open Command Centre →
          </Link>
        )}
      </PageHeader>

      {/* PageHeader has its own internal padding (24/32/16); cards sit in a
       * dedicated wrapper that picks up from where the header ends, with a
       * tighter top gap so subtitle → first card reads as one block. */}
      <div className="px-6 pt-1 space-y-5">

      {/* ── Card 1 — Agency fees (the only editable surface on this page) */}
      <AgencyFeeCard
        agencies={agencies.map((a) => ({
          id: a.id,
          name: a.name,
          feeTier: a.feeTier,
          legacyOutsourcedFeePence: a.legacyOutsourcedFeePence,
          transactionCount: a._count.transactions,
        }))}
        legacyCount={legacyCount}
        totalCount={agencies.length}
      />

      {/* ── Card 2 — Milestone definitions (read-only) */}
      <div className="glass-card rounded-[12px] p-5">
        <div className="mb-4">
          <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Milestone definitions</p>
          <p className="agent-card-subtitle">
            {milestoneDefs.length} definitions across vendor and purchaser sides. Read-only — the engine
            is the source of truth.
          </p>
        </div>

        <div className="space-y-5">
          {[{ label: "Vendor side", defs: vendorDefs }, { label: "Purchaser side", defs: purchaserDefs }].map(({ label, defs }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-900/45 mb-2">{label}</p>
              <div className="glass-card overflow-hidden" style={{ borderRadius: 10 }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20 bg-white/10">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40 w-12">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Name</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Blocks exch.</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-900/40">Code</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-900/40">Predecessor</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Can N/R</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/15">
                    {defs.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2.5 text-xs text-slate-900/40">{d.orderIndex}</td>
                        <td className="px-4 py-2.5 text-slate-900/80">{d.name}</td>
                        <td className="px-3 py-2.5 text-center">{d.blocksExchange ? <Flag color="blue" /> : <Dash />}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-900/60 font-mono">{d.code}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-900/40 font-mono">{d.predecessorCode ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-900/60">{d.canBeMarkedNr === "never" ? <Dash /> : d.canBeMarkedNr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card 3 — Reminder rules (read-only) */}
      <div className="glass-card rounded-[12px] p-5">
        <div className="mb-4">
          <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Reminder rules</p>
          <p className="agent-card-subtitle">
            {reminderRules.length} active rules, ordered by milestone progression. Anchor = what must
            complete to start the reminder. Target = what stops it.
          </p>
        </div>

        <div className="space-y-5">
          {[
            { label: "Active from file creation", sublabel: "No anchor — triggers immediately on new files", rules: fileCreationRules },
            { label: "Vendor-side triggers",      sublabel: "Unlocked after the anchor vendor milestone completes", rules: vendorRules },
            { label: "Purchaser-side triggers",   sublabel: "Unlocked after the anchor purchaser milestone completes", rules: purchaserRules },
          ].filter((g) => g.rules.length > 0).map(({ label, sublabel, rules }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-900/45 mb-0.5">{label}</p>
              <p className="text-xs text-slate-900/40 mb-2">{sublabel}</p>
              <div className="glass-card overflow-hidden" style={{ borderRadius: 10 }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20 bg-white/10">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Rule name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Anchor</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Target</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Grace</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Repeat</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Escalate</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Exch. gated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/15">
                    {rules.map((r) => (
                      <tr key={r.id} className={r.requiresExchangeReady ? "bg-emerald-50/20" : ""}>
                        <td className="px-4 py-2.5 text-slate-900/80">{r.name}</td>
                        <td className="px-4 py-2.5">
                          {r.anchorMilestone ? (
                            <div>
                              <span className="text-xs font-mono font-semibold text-slate-900/60">{r.anchorMilestone.code}</span>
                              <p className="text-xs text-slate-900/40 mt-0.5 leading-tight">{r.anchorMilestone.name}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-900/30 italic">File creation</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {r.targetMilestoneCode
                            ? <span className="font-mono font-semibold text-slate-900/60">{r.targetMilestoneCode}</span>
                            : <span className="text-slate-900/30">—</span>
                          }
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-900/60">{r.graceDays}d</td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-900/60">{r.repeatEveryDays}d</td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-900/60">{r.escalateAfterChases} chases</td>
                        <td className="px-3 py-2.5 text-center">{r.requiresExchangeReady ? <Flag color="green" /> : <Dash />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      </div>
    </div>
  );
}

function Flag({ color }: { color: "blue" | "green" }) {
  const cls = color === "blue" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-700";
  return <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>✓</span>;
}

function Dash() {
  return <span className="text-slate-900/20 text-xs">—</span>;
}
