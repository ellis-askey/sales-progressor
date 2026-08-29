import { NextRequest, NextResponse } from "next/server";
import { getPortalData } from "@/lib/services/portal";
import { recordFeatureUse } from "@/lib/command/feature-usage-write";

function fmtICS(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtICSDate(d: Date) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await getPortalData(token);

  if (!result || result.kind === "deadRound") {
    return new NextResponse("Not found", { status: 404 });
  }
  const data = result.data;
  const { transaction, contact } = data;
  const side = contact.roleType === "vendor" ? "sale" : "purchase";
  const address = transaction.propertyAddress;
  const now = fmtICS(new Date());

  // Which key date is being saved: the exchange target (pre-exchange) or the
  // completion day (default). Completion still owns the plain no-arg URL so the
  // existing banner link is unchanged.
  const event = req.nextUrl.searchParams.get("event") === "exchange" ? "exchange" : "completion";

  const targetDate =
    event === "exchange" ? transaction.expectedExchangeDate : transaction.completionDate;
  if (!targetDate) {
    return new NextResponse("No date set", { status: 404 });
  }
  const date = new Date(targetDate);

  // Reminder 3 days before
  const reminder3 = new Date(date);
  reminder3.setDate(reminder3.getDate() - 3);

  const dateStr = fmtICSDate(date);
  const rem3Str = fmtICSDate(reminder3);

  let uid: string;
  let summary: string;
  let description: string;
  let reminderText: string;
  let dayText: string;
  let filename: string;

  if (event === "exchange") {
    uid = `exchange-${token}@thesalesprogressor.co.uk`;
    summary = `Exchange target: ${address}`;
    description = side === "sale"
      ? `Target exchange date for the sale of ${address}.\\nThis is an estimate and can move.\\nYour team will confirm the date once it is set.`
      : `Target exchange date for the purchase of ${address}.\\nThis is an estimate and can move.\\nYour team will confirm the date once it is set.`;
    reminderText = `Exchange target in 3 days: ${address}`;
    dayText = `Exchange target: ${address}`;
    filename = "exchange-target.ics";
  } else {
    uid = `completion-${token}@thesalesprogressor.co.uk`;
    summary = side === "sale" ? `Sale completion: ${address}` : `Purchase completion: ${address}`;
    description = side === "sale"
      ? `Completion day for the sale of ${address}.\\nLeave all keys, fobs, and appliance manuals at the property.\\nRead meters before you leave.\\nYour solicitor will handle the fund transfer.`
      : `Completion day for the purchase of ${address}.\\nBe available by phone from 9am. Your solicitor will call when funds transfer.\\nKeys are usually available from midday.\\nRead meters when you arrive.`;
    reminderText = `Completion in 3 days: ${address}`;
    dayText = `Completion day: ${address}`;
    filename = "completion-date.ics";
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Sales Progressor//Key Dates Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${reminderText}`,
    `TRIGGER;VALUE=DATE-TIME:${rem3Str}T080000`,
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${dayText}`,
    `TRIGGER;VALUE=DATE-TIME:${dateStr}T080000`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  // Feature-usage: a client added a key date to their calendar. This download is
  // otherwise invisible (no DB row), so record it on the unified stream.
  await recordFeatureUse({
    feature: "calendar_export",
    surface: "portal",
    actorType: "client",
    actorId: contact.id,
    transactionId: transaction.id,
    metadata: { event },
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
