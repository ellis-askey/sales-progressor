// One-shot review tool: dumps the live ReminderRule timing data into an
// .xlsx for Ellis to review and mark up his intended values before the
// chase pipeline goes live.
//
// READ-ONLY against the system. Builds a spreadsheet with:
//   Sheet 1 — "Chase Timings": one row per chaseable milestone (41 rows)
//             with current values + computed timeline + empty MY-intended
//             columns with live formulas.
//   Sheet 2 — "Excluded (Bilateral)": the 6 hard-blocked codes with one-
//             line reasons.
//   Sheet 3 — "Legend": plain-English glossary so the sheet is readable
//             standalone.
//
// Run: npx tsx scripts/build-chase-timings-spreadsheet.ts
// Output: docs/active/chase-timings-review.xlsx

// CRITICAL: load .env.local BEFORE importing prisma so DATABASE_URL points
// at staging (same pattern as scripts/test-send-chase-email.ts).
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { prisma } from "../lib/prisma";
import { getMilestoneCopy } from "../lib/portal-copy";
import { isClientChaseable, CLIENT_CHASE_EXCLUDE } from "../lib/chase/chaseable-milestones";
import ExcelJS from "exceljs";
import path from "path";

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";

// Pre-pre-B7 floor on grace (client cron only — see lib/services/client-chase-cron.ts).
const GRACE_FLOOR = 1;

// Parses portal-copy.typicalDuration strings like "results in 2–4 weeks",
// "typically 1–3 weeks", "1–5 days", "can take 4–8 weeks". Returns the
// inferred MIN days (or null if can't parse). Used for the risk flag.
function parseMinDays(str: string | undefined): number | null {
  if (!str) return null;
  // Match "<num>–<num> <unit>" or "<num> <unit>"
  const rangeMatch = str.match(/(\d+)\s*[–-]\s*\d+\s*(day|week|month)/i);
  const singleMatch = !rangeMatch && str.match(/(\d+)\s*(day|week|month)/i);
  const m = rangeMatch || singleMatch;
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("day")) return n;
  if (unit.startsWith("week")) return n * 7;
  if (unit.startsWith("month")) return n * 30;
  return null;
}

async function main() {
  // ─── Pre-flight: staging only ────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL || "";
  const m = dbUrl.match(/postgres\.([^:]+):/);
  const projectId = m ? m[1] : "unknown";
  console.log(`[spreadsheet] DB project: ${projectId}`);
  if (projectId === PROD_PROJECT_ID) {
    console.error("[spreadsheet] ABORT: connected to production");
    process.exit(1);
  }
  if (projectId !== STAGING_PROJECT_ID) {
    console.error(`[spreadsheet] ABORT: not staging (got ${projectId})`);
    process.exit(1);
  }

  // ─── Load active ReminderRules + relevant milestone defs ─────────────
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true },
    select: {
      targetMilestoneCode: true,
      anchorMilestone: { select: { code: true, name: true } },
      graceDays: true,
      repeatEveryDays: true,
      useEventDate: true,
      requiresExchangeReady: true,
    },
  });
  const allCodes = Array.from(new Set(rules.map((r) => r.targetMilestoneCode).filter((c): c is string => !!c)));
  const allDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: allCodes } },
    select: { code: true, name: true, side: true, orderIndex: true },
  });
  const defByCode = new Map(allDefs.map((d) => [d.code, d]));

  console.log(`[spreadsheet] loaded ${rules.length} active reminder rules`);

  // Build the chaseable list (excluding the 6 bilateral codes).
  type Row = {
    rule: typeof rules[number];
    def: typeof allDefs[number];
    copy: ReturnType<typeof getMilestoneCopy>;
  };
  const chaseable: Row[] = [];
  for (const rule of rules) {
    const code = rule.targetMilestoneCode;
    if (!code || !isClientChaseable(code)) continue;
    const def = defByCode.get(code);
    if (!def) {
      console.warn(`[spreadsheet] WARN: no MilestoneDefinition for code ${code}`);
      continue;
    }
    const copy = getMilestoneCopy(code);
    chaseable.push({ rule, def, copy });
  }

  // Sort: vendor side first (by orderIndex), then purchaser side (by orderIndex)
  chaseable.sort((a, b) => {
    if (a.def.side !== b.def.side) {
      return a.def.side === "vendor" ? -1 : 1;
    }
    return a.def.orderIndex - b.def.orderIndex;
  });
  console.log(`[spreadsheet] chaseable: ${chaseable.length} rows (expecting 41)`);

  // ─── Build workbook ──────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sales Progressor build-chase-timings-spreadsheet.ts";
  wb.created = new Date();

  // ────────── Sheet 1: Chase Timings ──────────
  const s1 = wb.addWorksheet("Chase Timings", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });

  s1.columns = [
    { header: "Code", key: "code", width: 7 },
    { header: "Milestone (plain English)", key: "label", width: 38 },
    { header: "Side", key: "side", width: 10 },
    { header: "Whose job", key: "who", width: 11 },
    { header: "Tone", key: "tone", width: 8 },
    { header: "Anchor (what it waits for)", key: "anchor", width: 38 },
    { header: "Cross-side?", key: "crossSide", width: 12 },
    { header: "Current grace (days)", key: "grace", width: 13 },
    { header: "Current repeat (days)", key: "repeat", width: 14 },
    { header: "Typical real-world duration", key: "typical", width: 26 },
    { header: "Risk flag", key: "risk", width: 38 },
    { header: "Now: chase 1 fires day", key: "chase1", width: 14 },
    { header: "Now: chase 2 fires day", key: "chase2", width: 14 },
    { header: "Now: escalates day", key: "escalateDay", width: 14 },
    { header: "MY grace (days)", key: "myGrace", width: 13 },
    { header: "MY repeat (days)", key: "myRepeat", width: 13 },
    { header: "MY chase 1 fires day", key: "myChase1", width: 14 },
    { header: "MY chase 2 fires day", key: "myChase2", width: 14 },
    { header: "MY escalates day", key: "myEscalate", width: 14 },
    { header: "Notes / why", key: "notes", width: 50 },
  ];

  // Header style
  s1.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  s1.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" },
  };
  s1.getRow(1).alignment = { vertical: "middle", wrapText: true };
  s1.getRow(1).height = 32;

  // Section header rows function — coloured row label between vendor and purchaser
  const writeSectionHeader = (label: string, colorArgb: string) => {
    const row = s1.addRow([label]);
    row.font = { bold: true, italic: true, color: { argb: "FF1F2937" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorArgb } };
    s1.mergeCells(`A${row.number}:T${row.number}`);
  };

  // Write data rows, with section headers between sides
  let lastSide: "vendor" | "purchaser" | null = null;
  for (const r of chaseable) {
    if (r.def.side !== lastSide) {
      writeSectionHeader(
        r.def.side === "vendor" ? "VENDOR SIDE — buyer's seller-facing milestones" : "PURCHASER SIDE — buyer's milestones",
        r.def.side === "vendor" ? "FFE0F2FE" : "FFFEF3C7",
      );
      lastSide = r.def.side;
    }

    const tone: "DIY" | "NUDGE" = r.copy.who === "you" ? "DIY" : "NUDGE";
    const anchorPlain = r.rule.anchorMilestone
      ? `${r.rule.anchorMilestone.code}: ${getMilestoneCopy(r.rule.anchorMilestone.code).label}`
      : "(at transaction start — no anchor milestone)";

    // Cross-side flag: anchor is on the OTHER side
    const anchorCode = r.rule.anchorMilestone?.code ?? null;
    const isCrossSide = !!anchorCode && (
      (r.def.side === "vendor" && anchorCode.startsWith("PM")) ||
      (r.def.side === "purchaser" && anchorCode.startsWith("VM"))
    );

    const typical = r.copy.typicalDuration || "";
    const minTypicalDays = parseMinDays(typical);

    const graceFloored = Math.max(r.rule.graceDays, GRACE_FLOOR);
    const chase1Day = graceFloored;
    const chase2Day = graceFloored + r.rule.repeatEveryDays;
    const escalateDay = graceFloored + 2 * r.rule.repeatEveryDays;

    // Risk flag heuristics — chase fires well before typical min duration
    let riskFlag = "";
    if (minTypicalDays !== null && chase1Day < minTypicalDays) {
      const ratio = minTypicalDays / chase1Day;
      const severity = ratio >= 3 ? "🔴 well before" : "🟠 before";
      riskFlag = `${severity}: chase 1 fires day ${chase1Day}, typical min ~${minTypicalDays}d`;
    }
    if (r.rule.graceDays === 0) {
      riskFlag = riskFlag ? `${riskFlag} · day-1 floor applied (real grace=0)` : "ℹ️ Floor applied (real grace=0)";
    }

    const row = s1.addRow({
      code: r.def.code,
      label: r.copy.label,
      side: r.def.side,
      who: r.copy.who,
      tone,
      anchor: anchorPlain,
      crossSide: isCrossSide ? "★ cross-side" : "",
      grace: r.rule.graceDays,
      repeat: r.rule.repeatEveryDays,
      typical,
      risk: riskFlag,
      chase1: chase1Day,
      chase2: chase2Day,
      escalateDay,
      myGrace: "",
      myRepeat: "",
      // Formulas reference O = MY grace, P = MY repeat (column letters by header order)
      myChase1: { formula: `IF(O${0}="","",MAX(O${0},1))`, result: undefined as unknown as undefined },
      myChase2: { formula: `IF(OR(O${0}="",P${0}=""),"",MAX(O${0},1)+P${0})`, result: undefined as unknown as undefined },
      myEscalate: { formula: `IF(OR(O${0}="",P${0}=""),"",MAX(O${0},1)+2*P${0})`, result: undefined as unknown as undefined },
      notes: "",
    });

    // Fix formulas: rewrite with the actual row number
    const rowNum = row.number;
    row.getCell("myChase1").value = { formula: `IF(O${rowNum}="","",MAX(O${rowNum},1))`, result: "" };
    row.getCell("myChase2").value = { formula: `IF(OR(O${rowNum}="",P${rowNum}=""),"",MAX(O${rowNum},1)+P${rowNum})`, result: "" };
    row.getCell("myEscalate").value = { formula: `IF(OR(O${rowNum}="",P${rowNum}=""),"",MAX(O${rowNum},1)+2*P${rowNum})`, result: "" };

    // Highlight crossed-side rows lightly
    if (isCrossSide) {
      row.getCell("crossSide").font = { bold: true, color: { argb: "FFB45309" } };
      row.getCell("anchor").fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" },
      };
    }
    // Highlight risk-flagged rows
    if (riskFlag.startsWith("🔴")) {
      row.getCell("risk").font = { bold: true, color: { argb: "FFB91C1C" } };
      row.getCell("risk").fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" },
      };
    } else if (riskFlag.startsWith("🟠")) {
      row.getCell("risk").font = { color: { argb: "FFC2410C" } };
      row.getCell("risk").fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEDD5" },
      };
    }

    // Editable columns get a light highlight so they're obvious
    for (const colKey of ["myGrace", "myRepeat", "notes"]) {
      row.getCell(colKey).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFFEFCE8" },
      };
    }
    // Formula columns get a slightly different highlight (read-only after fill)
    for (const colKey of ["myChase1", "myChase2", "myEscalate"]) {
      row.getCell(colKey).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAF9" },
      };
      row.getCell(colKey).font = { italic: true, color: { argb: "FF6B7280" } };
    }
  }

  // ────────── Sheet 2: Excluded (Bilateral) ──────────
  const s2 = wb.addWorksheet("Excluded (Bilateral)", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  s2.columns = [
    { header: "Code", key: "code", width: 8 },
    { header: "Milestone", key: "label", width: 40 },
    { header: "Side", key: "side", width: 10 },
    { header: "Why excluded", key: "reason", width: 70 },
  ];
  s2.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  s2.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" },
  };

  const excludedReasons: Record<string, string> = {
    VM18: "Ready-to-exchange is a one-sided gate confirmed by the solicitor, not the client. Agent-orchestrated.",
    PM25: "Ready-to-exchange is a one-sided gate confirmed by the solicitor, not the client. Agent-orchestrated.",
    VM19: "Exchange is the bilateral moment where both solicitors confirm contracts together. Agent marks it.",
    PM26: "Exchange is the bilateral moment where both solicitors confirm contracts together. Agent marks it.",
    VM20: "Completion is the bilateral moment when money moves and ownership transfers. Agent marks it.",
    PM27: "Completion is the bilateral moment when money moves and ownership transfers. Agent marks it.",
  };
  for (const code of Array.from(CLIENT_CHASE_EXCLUDE).sort()) {
    const def = defByCode.get(code);
    const copy = getMilestoneCopy(code);
    s2.addRow({
      code,
      label: copy.label,
      side: def?.side ?? "",
      reason: excludedReasons[code] ?? "Bilateral / agent-orchestrated.",
    });
  }

  // ────────── Sheet 3: Legend ──────────
  const s3 = wb.addWorksheet("Legend");
  s3.columns = [
    { header: "Term", key: "term", width: 28 },
    { header: "Plain-English explanation", key: "explanation", width: 100 },
  ];
  s3.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  s3.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" },
  };

  const legend: Array<[string, string]> = [
    ["Code", "Internal milestone code. VM* = vendor (seller) side. PM* = purchaser (buyer) side."],
    ["Side", "Which client receives the chase: vendor (the seller) or purchaser (the buyer)."],
    ["Whose job (you / solicitor / lender)", "Who is responsible for completing the real-world action. DIY tone if 'you'; NUDGE tone if 'solicitor' or 'lender'."],
    ["Tone", "DIY = email says 'only you can move this forward'. NUDGE = email says 'sitting with your solicitor/lender — no action needed unless you want to chase'."],
    ["Anchor", "The upstream milestone that must complete before this one's chase clock starts. If '(at transaction start)', the clock starts when the file is created."],
    ["Cross-side", "Marked ★ when this milestone's anchor is on the OPPOSITE side (e.g. PM7 waits on VM7 — buyer waits on seller's solicitor)."],
    ["Current grace (days)", "Days after the anchor completes before chase 1 fires. Floored at 1 for client-chase emails — see day-1 floor in scripts/lib/services/client-chase-cron.ts."],
    ["Current repeat (days)", "Days between chase 1 and chase 2 (and between chase 2 and the escalation window closing)."],
    ["Typical real-world duration", "From portal-copy.typicalDuration — the time the underlying task usually takes in the real world."],
    ["Risk flag", "Auto-computed: 🔴 if chase 1 fires before 1/3 of typical min duration · 🟠 if before typical min · ℹ️ if grace=0 (day-1 floor applied)."],
    ["Now: chase 1 / chase 2 / escalate day", "Day-counter showing what happens TODAY under current values, assuming anchor completes on Day 0."],
    ["MY grace / repeat", "Empty columns for you to fill in your intended values."],
    ["MY chase 1 / 2 / escalate day", "Live formulas — recompute automatically once you fill MY grace and MY repeat."],
    ["Interpretation B", "Escalation fires AFTER the second chase's repeat-window closes (not on the second send). Hardcoded — see plan."],
    ["2-chase cap", "Client cron sends a maximum of 2 chase emails per (milestone, contact). Hardcoded — not editable per-rule."],
    ["14-day silence ceiling", "If the client doesn't engage for 14 days since first chase OR last engagement, the chase escalates to the agent regardless of chase-count. Hardcoded."],
  ];
  for (const [term, explanation] of legend) {
    const row = s3.addRow({ term, explanation });
    row.alignment = { wrapText: true, vertical: "top" };
    row.height = 32;
  }

  // ────────── Save ──────────
  const outPath = path.resolve("docs/active/chase-timings-review.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log(`[spreadsheet] ✓ wrote ${outPath}`);
  console.log(`[spreadsheet] sheets: Chase Timings (${chaseable.length} rows) · Excluded (Bilateral) (${CLIENT_CHASE_EXCLUDE.size} rows) · Legend`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
