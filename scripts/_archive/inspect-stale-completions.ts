// Read-only prevalence query: how many active txs in prod actually
// have VM20 + PM27 both confirmed (i.e. the file is done but the
// status is still "active")? Surfaced by 14-16 Wellcroft, Ivinghoe
// 2026-06-19 — VM20 + PM27 confirmed 16 Jun, status still "active"
// on 19 Jun.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const rows = await p.$queryRaw<Array<{
    id: string; address: string; status: string;
    exchangedAt: Date | null; completionDate: Date | null;
    vm20_at: Date | null; pm27_at: Date | null;
  }>>`
    SELECT
      pt.id, pt."propertyAddress" AS address, pt.status::text AS status,
      pt."exchangedAt", pt."completionDate",
      vm20.completed_at AS vm20_at,
      pm27.completed_at AS pm27_at
    FROM "PropertyTransaction" pt
    LEFT JOIN LATERAL (
      SELECT mc."completedAt" AS completed_at
      FROM "MilestoneCompletion" mc
      JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
      WHERE mc."transactionId" = pt.id
        AND md.code = 'VM20'
        AND mc.state = 'complete'
      LIMIT 1
    ) vm20 ON true
    LEFT JOIN LATERAL (
      SELECT mc."completedAt" AS completed_at
      FROM "MilestoneCompletion" mc
      JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
      WHERE mc."transactionId" = pt.id
        AND md.code = 'PM27'
        AND mc.state = 'complete'
        AND (mc."buyerRoundId" IS NULL OR mc."buyerRoundId" = pt."activeBuyerRoundId")
      LIMIT 1
    ) pm27 ON true
    WHERE vm20.completed_at IS NOT NULL
      AND pm27.completed_at IS NOT NULL
      AND pt.status::text != 'completed'
    ORDER BY GREATEST(vm20.completed_at, pm27.completed_at) DESC
  `;
  console.log(`Files with VM20 + PM27 both complete but status != "completed": ${rows.length}`);
  for (const r of rows) {
    console.log(`  ${r.status.padEnd(10)} VM20=${r.vm20_at?.toISOString().slice(0,10)} PM27=${r.pm27_at?.toISOString().slice(0,10)} compDate=${r.completionDate?.toISOString().slice(0,10) ?? "—"} ${r.id}  ${r.address}`);
  }
})().catch(console.error).finally(()=>p.$disconnect());
