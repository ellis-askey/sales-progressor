// lib/email/medians-ready.ts
//
// One-shot email to superadmins notifying that enough completion data has
// accumulated to consider swapping the hardcoded MILESTONE_DURATION_MEDIANS
// in lib/services/fees.ts for learned values. Fires when the threshold in
// /api/cron/medians-ready-check is crossed. Never re-fires (single-row
// SystemNotification flag).
//
// Per-row confidence labelling:
//   - ≥30 non-reconciled completions  → "ready" (suggest swap)
//   - 10–29                            → "low sample" (warning, consider waiting)
//   - <10                              → "insufficient" (count shown, no swap suggestion)
//
// The body deliberately hedges on premature action: even at 50 transactions
// across the system, only a subset of milestones will have ≥30 samples. The
// recommendation is to either action only the "ready" rows OR wait until 100
// transactions have flowed through so more end-stage milestones cross the
// confidence bar. The decision is Ellis's, made at email-read time.

export type PerMilestoneRow = {
  code: string;                  // "PM8"
  name: string;                  // verbose name from MilestoneDefinition
  currentHardcoded: number;      // current value in MILESTONE_DURATION_MEDIANS (days)
  computedMedian: number | null; // null when sample size is 0
  sampleSize: number;            // non-reconciled "complete" rows for this code
};

type Confidence = "ready" | "low_sample" | "insufficient";

function classify(sampleSize: number): Confidence {
  if (sampleSize >= 30) return "ready";
  if (sampleSize >= 10) return "low_sample";
  return "insufficient";
}

function confidenceLabel(c: Confidence): string {
  if (c === "ready")      return "Ready — suggest swap";
  if (c === "low_sample") return "Low sample — consider waiting";
  return "Insufficient — wait";
}

function suggestedSwap(c: Confidence, current: number, computed: number | null): string {
  if (c === "insufficient" || computed == null) return "—";
  return `${current} → ${computed}`;
}

export type MediansReadyPayload = {
  triggerTransactionCount: number; // distinct transactions with ≥1 completed milestone
  rows: PerMilestoneRow[];         // ordered by code (VM first, then PM, numeric within)
};

export function renderMediansReadySubject(): string {
  return "Sales Progressor: enough data to consider swapping the hardcoded medians";
}

export function renderMediansReadyText(payload: MediansReadyPayload): string {
  const { triggerTransactionCount, rows } = payload;

  const lines: string[] = [];
  lines.push(`Hi Ellis,`);
  lines.push("");
  lines.push(
    `${triggerTransactionCount} distinct transactions on the platform now have at least one completed milestone (non-reconciled). That's enough volume for the broad readiness signal to fire — some milestone codes have accumulated enough samples to support a confident swap from the hardcoded MILESTONE_DURATION_MEDIANS in lib/services/fees.ts to learned values.`,
  );
  lines.push("");
  lines.push(
    `Heads-up before you action this: 50 transactions is the threshold for the email itself, not for every individual milestone to be confident. End-stage codes (VM19/VM20, PM26/PM27) will have far fewer samples than early-stage ones — see the per-row breakdown below.`,
  );
  lines.push("");
  lines.push(
    `Two reasonable paths:`,
  );
  lines.push(
    `  1. Try a few examples first — swap only the rows tagged "Ready — suggest swap" (≥30 samples), leave the others on hardcoded values. Iterate as more data arrives.`,
  );
  lines.push(
    `  2. Wait until 100 transactions have flowed through. By then more end-stage milestones will cross the ≥30 bar and the platform-wide swap is more honest. This email won't re-fire — you'd need to remember to check.`,
  );
  lines.push("");
  lines.push(`Per-milestone breakdown:`);
  lines.push("");
  lines.push(`Code  | Current | Computed | Samples | Status`);
  lines.push(`------+---------+----------+---------+--------------------------------`);
  for (const row of rows) {
    const c = classify(row.sampleSize);
    const code = row.code.padEnd(5);
    const current = String(row.currentHardcoded).padStart(7);
    const computed = (row.computedMedian == null ? "—" : String(row.computedMedian)).padStart(8);
    const samples = String(row.sampleSize).padStart(7);
    const status = confidenceLabel(c);
    lines.push(`${code} | ${current} | ${computed} | ${samples} | ${status}`);
  }
  lines.push("");
  lines.push(`When you're ready to action a swap:`);
  lines.push(`  1. Edit MILESTONE_DURATION_MEDIANS in lib/services/fees.ts for the codes you're confident about.`);
  lines.push(`  2. Flip MEDIANS_READY in lib/services/milestone-staleness.ts from false to true.`);
  lines.push(`  3. The slowness badge (Change 3 of the visibility pass) and the predicted-exchange band (Change 2) re-activate platform-wide on the next deploy.`);
  lines.push("");
  lines.push(`See docs/active/ELLIS_MANUAL_TODO.md for the full sequence.`);
  lines.push("");
  lines.push(`This email won't fire again — the SystemNotification row keyed "medians_ready" is now set.`);
  lines.push("");
  lines.push(`— Sales Progressor`);

  return lines.join("\n");
}

export function renderMediansReadyHtml(payload: MediansReadyPayload): string {
  const { triggerTransactionCount, rows } = payload;

  const rowsHtml = rows
    .map((row) => {
      const c = classify(row.sampleSize);
      const colour =
        c === "ready"      ? "#16a34a"
        : c === "low_sample" ? "#d97706"
        :                      "#94a3b8";
      const bg =
        c === "ready"      ? "#f0fdf4"
        : c === "low_sample" ? "#fffbeb"
        :                      "#f8fafc";
      const status = confidenceLabel(c);
      const swap = suggestedSwap(c, row.currentHardcoded, row.computedMedian);
      const computed = row.computedMedian == null ? "—" : String(row.computedMedian);
      return `
        <tr style="background:${bg};">
          <td style="padding:6px 10px;font-family:monospace;font-size:12px;color:#1e2d4a;">${row.code}</td>
          <td style="padding:6px 10px;font-size:12px;color:#1e2d4a;">${escapeHtml(row.name)}</td>
          <td style="padding:6px 10px;text-align:right;font-family:monospace;font-size:12px;color:#1e2d4a;">${row.currentHardcoded}</td>
          <td style="padding:6px 10px;text-align:right;font-family:monospace;font-size:12px;color:#1e2d4a;">${computed}</td>
          <td style="padding:6px 10px;text-align:right;font-family:monospace;font-size:12px;color:#1e2d4a;">${row.sampleSize}</td>
          <td style="padding:6px 10px;font-size:11px;font-weight:600;color:${colour};">${status}</td>
          <td style="padding:6px 10px;font-family:monospace;font-size:11px;color:${colour};">${swap}</td>
        </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e2d4a;line-height:1.5;max-width:780px;margin:0 auto;padding:24px;">
  <h2 style="font-size:18px;font-weight:700;margin:0 0 12px;">Enough data to consider swapping the hardcoded medians</h2>

  <p style="font-size:14px;margin:0 0 12px;">Hi Ellis,</p>

  <p style="font-size:14px;margin:0 0 12px;">
    <strong>${triggerTransactionCount} distinct transactions</strong> on the platform now have at least one completed milestone (non-reconciled). That's enough volume for the broad readiness signal to fire — some milestone codes have accumulated enough samples to support a confident swap from the hardcoded <code>MILESTONE_DURATION_MEDIANS</code> in <code>lib/services/fees.ts</code> to learned values.
  </p>

  <div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:10px 14px;margin:0 0 16px;border-radius:4px;">
    <p style="font-size:13px;margin:0;color:#78350f;">
      <strong>Heads-up before you action this.</strong> 50 transactions is the threshold for this email firing, not the threshold for every individual milestone being confident. End-stage codes (VM19/VM20, PM26/PM27) will have far fewer samples than early-stage ones — see the per-row breakdown below.
    </p>
  </div>

  <p style="font-size:14px;margin:0 0 8px;"><strong>Two reasonable paths:</strong></p>
  <ol style="font-size:14px;margin:0 0 16px 20px;padding:0;">
    <li style="margin-bottom:6px;"><strong>Try a few examples first.</strong> Swap only the rows tagged "Ready — suggest swap" (≥30 samples), leave the others on hardcoded values. Iterate as more data arrives.</li>
    <li><strong>Wait until 100 transactions have flowed through.</strong> By then more end-stage milestones will cross the ≥30 bar and the platform-wide swap is more honest. <em>This email won't re-fire — you'd need to remember to check.</em></li>
  </ol>

  <h3 style="font-size:14px;font-weight:700;margin:20px 0 8px;">Per-milestone breakdown</h3>

  <table style="width:100%;border-collapse:collapse;border:0.5px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:12px;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;">Code</th>
        <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;">Milestone</th>
        <th style="padding:8px 10px;text-align:right;font-weight:700;color:#334155;">Current</th>
        <th style="padding:8px 10px;text-align:right;font-weight:700;color:#334155;">Computed</th>
        <th style="padding:8px 10px;text-align:right;font-weight:700;color:#334155;">Samples</th>
        <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;">Status</th>
        <th style="padding:8px 10px;text-align:left;font-weight:700;color:#334155;">Suggested swap</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <p style="font-size:11px;color:#64748b;margin:6px 0 0;">Days. Current = MILESTONE_DURATION_MEDIANS hardcoded value. Computed = median of non-reconciled completion durations across the platform.</p>

  <h3 style="font-size:14px;font-weight:700;margin:24px 0 8px;">When you're ready to action a swap</h3>
  <ol style="font-size:13px;margin:0 0 12px 20px;padding:0;">
    <li>Edit <code>MILESTONE_DURATION_MEDIANS</code> in <code>lib/services/fees.ts</code> for the codes you're confident about.</li>
    <li>Flip <code>MEDIANS_READY</code> in <code>lib/services/milestone-staleness.ts</code> from <code>false</code> to <code>true</code>.</li>
    <li>The slowness badge (Change 3 of the visibility pass) and the predicted-exchange band (Change 2) re-activate platform-wide on the next deploy.</li>
  </ol>

  <p style="font-size:13px;color:#64748b;margin:0 0 4px;">See <code>docs/active/ELLIS_MANUAL_TODO.md</code> for the full sequence.</p>

  <hr style="border:none;border-top:0.5px solid #e2e8f0;margin:24px 0 12px;" />
  <p style="font-size:11px;color:#94a3b8;margin:0;">
    This email won't fire again — the <code>SystemNotification</code> row keyed <code>medians_ready</code> is now set. To re-test, delete that row.
  </p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
