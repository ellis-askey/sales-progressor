// CSV export for the Automated-emails feed.
//
// Scope is re-derived from the session here (never trusted from the query),
// and the same search + filters the page applies are re-applied, so an export
// can only ever contain rows the caller may already see (Law 7). Returns a
// download (Content-Disposition: attachment) so the browser saves the file.

import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { agencyUserHasSelfManagedFiles } from "@/lib/agent/self-managed-nav";
import {
  listAutomatedEmails,
  type EmailListTab,
  type EmailDeliveryStatus,
} from "@/lib/services/automated-emails-list";
import { getAutomationFiles } from "@/lib/services/automated-emails-coverage";
import { deliveryStatusMeta } from "@/components/automated-emails/deliveryStatus";

const EMAIL_TABS = ["pending", "sent", "errored", "upcoming"] as const;
const DELIVERY_STATUSES = ["pending", "sent", "delivered", "deferred", "bounced", "blocked", "errored", "failed"];
const EXPORT_LIMIT = 5000;

const dtFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });
const fmt = (d: Date | null | undefined) => (d ? dtFmt.format(new Date(d)) : "");

// RFC-4180-ish escaping: wrap in quotes and double any embedded quotes; always
// quote so commas / newlines in addresses or subjects can't break columns.
function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  // Prepend a BOM so Excel opens UTF-8 addresses (accents) correctly.
  return "﻿" + lines.join("\r\n");
}

function categoryLabel(category: "chase" | "notification"): string {
  return category === "chase" ? "Chase" : "Notification";
}
function roleLabel(role: string): string {
  if (role === "vendor") return "Seller";
  if (role === "purchaser") return "Buyer";
  if (role === "solicitor") return "Solicitor";
  return role || "";
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!(await agencyUserHasSelfManagedFiles(session.user.role, session.user.id, session.user.agencyId))) {
    return new Response("Not found", { status: 404 });
  }

  const sp = new URL(request.url).searchParams;
  const rawTab = sp.get("tab") ?? "sent";
  const tab = rawTab === "files" ? "files" : (EMAIL_TABS as readonly string[]).includes(rawTab) ? (rawTab as EmailListTab) : "sent";

  const mineOnly = sp.get("mine") === "1";
  const fileId = sp.get("fileId") || undefined;
  const search = sp.get("q")?.trim() || undefined;
  const categoryRaw = sp.get("category");
  const category = categoryRaw === "chase" || categoryRaw === "notification" ? categoryRaw : undefined;
  const recipientRole = sp.get("role") || undefined;
  const statusRaw = sp.get("status");
  const deliveryStatus = statusRaw && DELIVERY_STATUSES.includes(statusRaw) ? (statusRaw as EmailDeliveryStatus) : undefined;
  const fromRaw = sp.get("from");
  const fromDate = fromRaw && !Number.isNaN(Date.parse(fromRaw)) ? new Date(fromRaw) : undefined;

  const role = session.user.role as "director" | "negotiator" | "sales_progressor" | "admin" | "superadmin" | "viewer";
  const scopeBase = {
    role,
    userId: session.user.id,
    agencyId: session.user.agencyId || null,
    hasAdminPowers: hasAdminPowers(session),
    mineOnly: role === "director" ? mineOnly : false,
    fileId,
  };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  let csv: string;
  let filename: string;

  if (tab === "files") {
    const rows = await getAutomationFiles(scopeBase, search);
    csv = toCsv(
      ["File", "Coverage", "Queued", "Next send", "Issues"],
      rows.map((r) => [
        r.address,
        r.status === "needInfo" ? "Needs info" : r.status === "paused" ? "Paused" : "Covered",
        r.pendingCount,
        fmt(r.nextSendAt),
        r.issuesCount,
      ]),
    );
    filename = `automated-emails-files-${today}.csv`;
  } else {
    const { rows } = await listAutomatedEmails({
      ...scopeBase, tab, search, category, recipientRole, deliveryStatus, fromDate, limit: EXPORT_LIMIT,
    });
    csv = toCsv(
      ["Time", "Type", "File", "Subject", "Recipient", "Role", "Status"],
      rows.map((r) => {
        const when = r.status === "sent" ? r.sentAt : r.status === "errored" ? r.errorAt : r.scheduledFor;
        return [
          fmt(when),
          categoryLabel(r.category),
          r.transactionAddress,
          r.subject,
          r.recipientName,
          roleLabel(r.recipientRole),
          deliveryStatusMeta(r.deliveryStatus).label,
        ];
      }),
    );
    filename = `automated-emails-${tab}-${today}.csv`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
