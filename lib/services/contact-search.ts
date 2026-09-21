import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { phoneSearchVariants } from "@/lib/utils";

/**
 * Contact IDs whose phone matches the query in ANY format.
 *
 * Stored phones are inconsistently formatted — some "+44 7534 632791" (with
 * spaces), some "+447377534656" (without) — and Prisma `contains` matches the
 * raw column, so a query whose digits span a stored space silently fails (e.g.
 * "075346" misses "+44 7534 632791" because the run crosses the space between
 * "7534" and "632791"). We strip every non-digit from the column in SQL
 * (regexp_replace) and substring-match the digit-only query variants, so the
 * stored formatting no longer matters — the same normalisation the client-side
 * highlighter already uses.
 *
 * Returns IDs only. Callers AND this with their own tenant scope (e.g.
 * `where: { transaction: txWhere, OR: [{ id: { in: ids } }, …] }`), so this
 * deliberately-unscoped lookup stays safe (Law 7).
 */
export async function phoneMatchContactIds(q: string): Promise<string[]> {
  const variants = [
    ...new Set(phoneSearchVariants(q).map((v) => v.replace(/\D/g, "")).filter((v) => v.length >= 4)),
  ];
  if (variants.length === 0) return [];

  const conds = variants.map(
    (v) => Prisma.sql`regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + v + "%"}`,
  );
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "Contact" WHERE ${Prisma.join(conds, " OR ")} LIMIT 50`,
  );
  return rows.map((r) => r.id);
}
