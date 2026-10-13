// WhatsApp Cloud watchdog (Phase 4b, REBUILD_PLAN §C3 health monitoring).
// "WhatsApp must not silently stop working": twice a day this checks every
// configured business number for (a) a webhook gone quiet, (b) an access token
// nearing expiry, (c) a cluster of failed sends — and stamps the problem onto
// the number row (surfaced in red on the Command Centre card) plus an optional
// alert email. Healthy runs clear any watchdog-raised flag.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCloudConfigured } from "@/lib/integrations/whatsapp-cloud/config";

const QUIET_MS = 48 * 60 * 60 * 1000;
const TOKEN_WARN_MS = 7 * 24 * 60 * 60 * 1000;
const WATCHDOG_PREFIX = "[watchdog] ";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!isCloudConfigured()) return NextResponse.json({ ok: true, skipped: "not configured" });

  const numbers = await prisma.whatsAppBusinessNumber.findMany();
  const now = Date.now();
  const alerts: string[] = [];

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

  return NextResponse.json({ ok: true, checked: numbers.length, alerts: alerts.length });
}
