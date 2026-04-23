import { NextRequest, NextResponse } from "next/server";
import { getPortalData } from "@/lib/services/portal";

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
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const data = await getPortalData(token);

  if (!data || !data.transaction.completionDate) {
    return new NextResponse("No completion date set", { status: 404 });
  }

  const { transaction, contact } = data;
  const side = contact.roleType === "vendor" ? "sale" : "purchase";
  const completionDate = new Date(transaction.completionDate!);

  // Reminder 3 days before
  const reminder3 = new Date(completionDate);
  reminder3.setDate(reminder3.getDate() - 3);

  const address = transaction.propertyAddress;
  const uid     = `completion-${token}@thesalesprogressor.co.uk`;
  const now     = fmtICS(new Date());
  const dateStr = fmtICSDate(completionDate);
  const rem3Str = fmtICSDate(reminder3);

  const summary     = side === "sale" ? `Sale completion — ${address}` : `Purchase completion — ${address}`;
  const description = side === "sale"
    ? `Completion day for the sale of ${address}.\\nLeave all keys, fobs, and appliance manuals at the property.\\nRead meters before you leave.\\nYour solicitor will handle the fund transfer.`
    : `Completion day for the purchase of ${address}.\\nBe available by phone from 9am — your solicitor will call when funds transfer.\\nKeys are usually available from midday.\\nRead meters when you arrive.`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Sales Progressor//Completion Calendar//EN",
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
    `DESCRIPTION:Completion in 3 days — ${address}`,
    `TRIGGER;VALUE=DATE-TIME:${rem3Str}T080000`,
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:Completion day — ${address}`,
    `TRIGGER;VALUE=DATE-TIME:${dateStr}T080000`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="completion-date.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
