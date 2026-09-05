// Weekly brief ("Your week in sales") — the agent's Friday summary: how many
// files are active, how much moved this week, and where each file stands.
// Redesigned into the lifecycle email family. The title is baked into the hero
// art, so the date + greeting sit just below it; each file shows its photo (or a
// status-tinted placeholder), current step, status pill and progress.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type FileState = "attention" | "slow" | "exchange" | "ontrack";
type WeeklyFile = {
  address: string;
  url: string;
  photoUrl?: string;
  state: FileState;
  stageLabel: string;
  completed: number;
  total: number;
  reason?: string;
};

const STATE: Record<FileState, { label: string; pillBg: string; pillBorder: string; pillColor: string; icon: string; bar: string; track: string; tile: string }> = {
  attention: { label: "Needs attention", pillBg: "#FDECEC", pillBorder: "#F7D2D2", pillColor: "#D93A3F", icon: "icon-pill-warn.png", bar: "#E5484D", track: "#F5D9D9", tile: "icon-house-red-line.png" },
  slow: { label: "Moving slowly", pillBg: "#FEF3E0", pillBorder: "#F6E3BE", pillColor: "#C0820B", icon: "icon-pill-clock.png", bar: "#F0A020", track: "#F3E6CC", tile: "icon-house-amber-line.png" },
  exchange: { label: "Exchange approaching", pillBg: "#E9F5EC", pillBorder: "#CDE9D4", pillColor: "#2E9E5B", icon: "icon-pill-flag.png", bar: "#2E9E5B", track: "#D6EBDC", tile: "icon-house-green-line.png" },
  ontrack: { label: "On track", pillBg: "#E9F5EC", pillBorder: "#CDE9D4", pillColor: "#2E9E5B", icon: "icon-pill-flag.png", bar: "#2E9E5B", track: "#D6EBDC", tile: "icon-house-green-line.png" },
};

// Two-word label: on desktop the words stack (word over word) so all three cards
// are the same height; on mobile (stacked, full width) the number + label sit on
// one line.
function statCard(icon: string, bg: string, num: number, w1: string, w2: string, pad: string): string {
  return `<td class="stat3" width="33.33%" valign="top" style="${pad}">
    <div style="background:${bg};border-radius:14px;padding:15px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" width="50"><img src="${EMAIL_ASSET}/${icon}" width="46" height="46" alt="" style="display:block;border:0;"></td>
        <td valign="middle" style="padding-left:11px;">
          <span class="statnum" style="display:block;font-family:${FONT_STACK};font-size:24px;font-weight:800;color:#0F1B2D;line-height:1;">${num}</span>
          <span class="statlbl-d" style="display:block;font-family:${FONT_STACK};font-size:13px;color:#54617d;line-height:1.25;margin-top:3px;">${w1}<br>${w2}</span>
          <span class="statlbl-m" style="display:none;font-family:${FONT_STACK};font-size:14px;color:#54617d;"> ${w1} ${w2}</span>
        </td>
      </tr></table>
    </div>
  </td>`;
}

function fileCard(f: WeeklyFile): string {
  const m = STATE[f.state];
  const pct = f.total > 0 ? Math.max(4, Math.round((f.completed / f.total) * 100)) : 0;
  // Photo (if the file has one) in a circle; otherwise the bare status house icon.
  const tile = f.photoUrl
    ? `<img src="${f.photoUrl.replace(/"/g, "&quot;")}" width="52" height="52" alt="" style="display:block;border:0;width:52px;height:52px;border-radius:50%;object-fit:cover;">`
    : `<img src="${EMAIL_ASSET}/${m.tile}" width="52" height="52" alt="" style="display:block;border:0;">`;
  const pill = `<span style="display:inline-block;padding:5px 11px 5px 9px;border-radius:999px;background:${m.pillBg};border:1px solid ${m.pillBorder};white-space:nowrap;"><img src="${EMAIL_ASSET}/${m.icon}" width="13" height="13" alt="" style="vertical-align:-2px;border:0;margin-right:5px;"><span style="font-family:${FONT_STACK};font-size:12px;font-weight:700;color:${m.pillColor};">${m.label}</span></span>`;
  const bar = `<div style="background:${m.track};border-radius:99px;height:9px;width:100%;line-height:9px;font-size:0;"><div style="background:${m.bar};border-radius:99px;height:9px;width:${pct}%;line-height:9px;font-size:0;">&nbsp;</div></div>`;
  const note = f.reason
    ? `<div style="margin-top:12px;background:#F5F6F8;border-radius:10px;padding:10px 12px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="top" width="26"><img src="${EMAIL_ASSET}/icon-info-grey.png" width="16" height="16" alt="" style="display:block;border:0;margin-top:1px;"></td><td valign="top" style="font-family:${FONT_STACK};font-size:13px;color:#7a8493;line-height:1.45;">${escapeHtml(f.reason)}</td></tr></table></div>`
    : "";
  return `<a href="${f.url}" style="text-decoration:none;display:block;"><div style="border:1px solid #EEF0F3;border-radius:16px;padding:16px 18px;box-shadow:0 1px 3px rgba(16,24,40,0.04);background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" width="66">${tile}</td>
      <td valign="top" style="padding-left:14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" style="font-family:${FONT_STACK};font-size:15.5px;font-weight:800;color:#0F1B2D;line-height:1.3;">${escapeHtml(f.address)}</td>
          <td valign="top" align="right" style="padding-left:10px;white-space:nowrap;">${pill}</td>
        </tr></table>
        <div style="font-family:${FONT_STACK};font-size:13.5px;color:#8a93a3;margin-top:6px;">${escapeHtml(f.stageLabel)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
          <td valign="middle" style="padding-right:14px;">${bar}</td>
          <td valign="middle" align="right" style="font-family:${FONT_STACK};font-size:13px;color:#8a93a3;white-space:nowrap;">${f.total > 0 ? `${f.completed} of ${f.total} steps` : ""}</td>
        </tr></table>
        ${note}
      </td>
      <td valign="middle" align="right" width="18" style="padding-left:8px;"><img src="${EMAIL_ASSET}/icon-chevron.png" width="9" height="15" alt="" style="display:block;border:0;"></td>
    </tr></table>
  </div></a>`;
}

export function buildWeeklyBrief(vars: {
  firstName: string;
  weekOf: string; // preformatted, e.g. "Friday 4 September"
  activeSales: number;
  milestonesThisWeek: number;
  needsAttention: number;
  files: WeeklyFile[];
  moreCount?: number; // files beyond the ones listed — renders a "+N more" link
  pipelineUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(vars.firstName.trim());
  const weekOf = escapeHtml(vars.weekOf.trim());
  const subject = vars.needsAttention > 0 ? `Your week in sales · ${vars.needsAttention} to look at` : "Your week in sales";

  // One full-width stacked stat card for the phone (wk-mob). A real div — the
  // Gmail app keeps a fixed table's columns even when a cell is set to block, so
  // the desktop table can't stack; the div stack reaches full width reliably.
  const statCardMobile = (icon: string, bg: string, num: number, label: string, gap: boolean) =>
    `<div style="background:${bg};border-radius:14px;padding:14px 16px;${gap ? "margin-bottom:8px;" : ""}">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" width="50"><img src="${EMAIL_ASSET}/${icon}" width="46" height="46" alt="" style="display:block;border:0;"></td>
        <td valign="middle" style="padding-left:12px;font-family:${FONT_STACK};">
          <span style="font-size:23px;font-weight:800;color:#0F1B2D;">${num}</span>
          <span style="font-size:15px;color:#54617d;">&nbsp;${label}</span>
        </td>
      </tr></table>
    </div>`;

  const stats = `<div class="wk-desk"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;width:100%;"><tr>
    ${statCard("icon-stat-home-line.png", "#EEF4FC", vars.activeSales, "active", "sales", "padding-right:5px;")}
    ${statCard("icon-stat-check-line.png", "#EDF6EE", vars.milestonesThisWeek, "steps", "completed", "padding:0 3px;")}
    ${statCard("icon-stat-warn-line.png", "#FDECEC", vars.needsAttention, "needs", "attention", "padding-left:5px;")}
  </tr></table></div>
  <div class="wk-mob" style="display:none;">
    ${statCardMobile("icon-stat-home-line.png", "#EEF4FC", vars.activeSales, "active sales", true)}
    ${statCardMobile("icon-stat-check-line.png", "#EDF6EE", vars.milestonesThisWeek, "steps completed", true)}
    ${statCardMobile("icon-stat-warn-line.png", "#FDECEC", vars.needsAttention, "needs attention", false)}
  </div>`;

  const cards = vars.files.map((f) => `<tr><td style="padding:14px 0 0;">${fileCard(f)}</td></tr>`).join("");
  const moreRow = vars.moreCount && vars.moreCount > 0
    ? `<tr><td style="padding:14px 0 2px;"><a href="${vars.pipelineUrl}" style="display:block;text-align:center;text-decoration:none;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#FF6B4A;padding:12px;">and ${vars.moreCount} more in your pipeline  &rarr;</a></td></tr>`
    : "";

  const body =
    `<tr><td class="px" style="padding:18px 34px 0;">
      <p style="margin:0 0 4px;font-family:${FONT_STACK};font-size:12.5px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:#9aa2b1;">Week of ${weekOf}</p>
      <p style="margin:0;font-family:${FONT_STACK};font-size:19px;font-weight:700;color:#0F1B2D;">Good morning, ${firstName}.</p>
    </td></tr>
    <tr><td class="px" style="padding:16px 34px 0;">${stats}</td></tr>
    <tr><td class="px" style="padding:2px 34px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}${moreRow}</table>
    </td></tr>
    <tr><td class="px" style="padding:26px 34px 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.pipelineUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Open your pipeline  &rarr;</a>
      </div>
    </td></tr>` +
    `<tr><td class="px" style="padding:0 34px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pageFooter(vars.unsubscribeUrl)}</table></td></tr>`;

  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 14px 22px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #EAE6E1;box-shadow:0 6px 26px rgba(17,24,39,0.07);">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.")}</table>
        </td></tr>
        <tr><td style="padding:0;"><img src="${EMAIL_ASSET}/hero-weekly.png" alt="Your week in sales." style="display:block;width:100%;max-width:100%;border:0;"></td></tr>
        ${body}
      </table>
    </td></tr></table>
  </body></html>`;

  const textLines: string[] = [
    `Good morning, ${vars.firstName.trim()}.`,
    `Week of ${vars.weekOf.trim()}.`,
    ``,
    `${vars.activeSales} active sales · ${vars.milestonesThisWeek} milestones completed this week · ${vars.needsAttention} needs attention.`,
    ``,
    `Your files:`,
  ];
  for (const f of vars.files) {
    textLines.push(`  ${f.address} [${STATE[f.state].label}] · ${f.stageLabel}${f.total > 0 ? ` (${f.completed} of ${f.total} steps)` : ""}`);
    if (f.reason) textLines.push(`      ${f.reason}`);
  }
  if (vars.moreCount && vars.moreCount > 0) textLines.push(`  …and ${vars.moreCount} more in your pipeline.`);
  textLines.push(``, `Open your pipeline: ${vars.pipelineUrl}`, ``, `TSP · Sales Progressor`, `A simpler, better way to progress property sales.`);
  if (vars.unsubscribeUrl) textLines.push(``, `Don’t want these emails? ${vars.unsubscribeUrl}`);

  return { subject, html, text: textLines.join("\n") };
}
