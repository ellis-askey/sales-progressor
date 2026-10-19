// WhatsApp watchdog (Phase 4b §C3, extended after the Sept-Oct 2026 outage).
// "WhatsApp must not silently stop working": twice a day this checks
// (1) THE BRIDGE — unreachable, unlinked (needs a QR scan), or linked but
//     capturing nothing for days. Runs whenever the bridge is configured —
//     the Railway trial expiring on 22 Sept 2026 killed capture for four weeks
//     and nothing said a word; this check is the never-again.
// (2) every configured Cloud business number for a quiet webhook, an expiring
//     token, or a cluster of failed sends (skipped while Cloud is parked).
// Problems are stamped on the number row (red on the Command Centre card) and
// emailed to WHATSAPP_ALERT_EMAIL. Healthy runs clear watchdog-raised flags.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCloudConfigured } from "@/lib/integrations/whatsapp-cloud/config";
import { bridgeGlobalStatus } from "@/lib/integrations/whatsapp/bridge-client";

const QUIET_MS = 48 * 60 * 60 * 1000;
// Bridge-capture silence threshold. 72h, not 48h, so a genuinely quiet weekend
// doesn't page on Monday's 07:00 run.
const BRIDGE_QUIET_MS = 72 * 60 * 60 * 1000;
const TOKEN_WARN_MS = 7 * 24 * 60 * 60 * 1000;
const WATCHDOG_PREFIX = "[watchdog] ";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const now = Date.now();
  const alerts: string[] = [];

  // ---- (1) Bridge health — independent of the parked Cloud API ----
  const bridge = await bridgeGlobalStatus();
  if (bridge.configured) {
    if (!bridge.reachable) {
      alerts.push(
        "The WhatsApp bridge is not responding, so nothing is being captured. Check the Railway service is running (and that the plan hasn't lapsed).",
      );
    } else if (bridge.connection !== "open") {
      alerts.push(
        `The WhatsApp bridge is running but the WhatsApp link is down (state: ${bridge.connection ?? "unknown"}), so nothing is being captured. Open Command Centre → WhatsApp and scan the QR to re-link.`,
      );
    } else {
      // Linked and claiming healthy — verify messages are actually landing.
      const newest = await prisma.outboundMessage.findFirst({
        where: { method: "whatsapp" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (newest && now - newest.createdAt.getTime() > BRIDGE_QUIET_MS) {
        alerts.push(
          `The WhatsApp bridge reports connected but no message has been captured since ${newest.createdAt.toLocaleString("en-GB")}. The link may be silently broken — check Command Centre → WhatsApp.`,
        );
      }
    }
  }

  // ---- (2) Cloud business numbers (parked — skipped until configured) ----
  const numbers = isCloudConfigured() ? await prisma.whatsAppBusinessNumber.findMany() : [];

  for (const n of numbers) {
    const issues: string[] = [];

    if (n.lastEventAt && now - n.lastEventAt.getTime() > QUIET_MS) {
      issues.push(`No WhatsApp events received since ${n.lastEventAt.toLocaleString("en-GB")} — the connection may have stopped.`);
    }
    if (n.tokenExpiresAt && n.tokenExpiresAt.getTime() - now < TOKEN_WARN_MS) {
      issues.push(`The access token expires ${n.tokenExpiresAt.toLocaleDateString("en-GB")} — generate a fresh one before then.`);
    }
    const failed24h = await prisma.outboundMessage.count({
      where: { channel: "whatsapp", status: "failed", failedAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
    });
    if (failed24h >= 3) {
      issues.push(`${failed24h} WhatsApp sends failed in the last 24 hours.`);
    }

    if (issues.length) {
      const summary = WATCHDOG_PREFIX + issues.join(" ");
      await prisma.whatsAppBusinessNumber.update({
        where: { id: n.id },
        data: { status: "error", lastError: summary },
      });
      alerts.push(`${n.displayPhone ?? n.phoneNumberId}: ${issues.join(" ")}`);
    } else if (n.lastError?.startsWith(WATCHDOG_PREFIX)) {
      // Only clear flags the watchdog itself raised — never someone else's note.
      await prisma.whatsAppBusinessNumber.update({
        where: { id: n.id },
        data: { status: "active", lastError: null },
      });
    }
  }

  // Optional email alert (set WHATSAPP_ALERT_EMAIL to receive these).
  const alertTo = process.env.WHATSAPP_ALERT_EMAIL?.trim();
  if (alerts.length && alertTo) {
    try {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: alertTo,
        subject: "WhatsApp needs attention",
        text: `The WhatsApp connection flagged a problem:\n\n${alerts.join("\n")}\n\nDetails on Command Centre → WhatsApp.`,
      });
    } catch (e) {
      console.error("[whatsapp-cloud] watchdog alert email failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    bridge: bridge.configured
      ? { reachable: bridge.reachable, connection: bridge.connection ?? null }
      : "not configured",
    checked: numbers.length,
    alerts: alerts.length,
  });
}
