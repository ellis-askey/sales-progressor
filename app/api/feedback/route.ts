import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";

const FEEDBACK_TO   = "inbox@thesalesprogressor.co.uk";
const FEEDBACK_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

const VALID_CATEGORIES = ["bug", "suggestion", "question"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

const MIME_MAP: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp",
};

export async function POST(req: NextRequest) {
  try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

  const body = await req.json();
  const {
    category, field1, field2,
    screenshotBase64, screenshotFilename,
    url, browser, viewportSize, userAgent,
    portalToken,
  } = body;

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!field1?.trim()) {
    return NextResponse.json({ error: "field1 is required" }, { status: 400 });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  let userId: string | null = null;
  let userRole: string | null = null;
  let userEmail: string | null = null;
  let userName: string | null = null;
  let agencyId: string | null = null;
  let agencyName: string | null = null;

  const session = await getServerSession(authOptions);
  if (session) {
    userId    = session.user.id;
    userRole  = session.user.role;
    userEmail = session.user.email ?? null;
    userName  = session.user.name ?? null;
    agencyId  = session.user.agencyId ?? null;
    if (agencyId) {
      const ag = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
      agencyName = ag?.name ?? null;
    }
  } else if (portalToken) {
    const contact = await prisma.contact.findFirst({
      where: { portalToken },
      select: { name: true, email: true, roleType: true, propertyTransactionId: true },
    });
    if (!contact) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    userRole  = contact.roleType;
    userEmail = contact.email ?? null;
    userName  = contact.name;
    if (contact.propertyTransactionId) {
      const tx = await prisma.propertyTransaction.findUnique({
        where: { id: contact.propertyTransactionId },
        select: { agencyId: true, agency: { select: { name: true } } },
      });
      agencyId   = tx?.agencyId ?? null;
      agencyName = tx?.agency?.name ?? null;
    }
  } else {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Screenshot upload ─────────────────────────────────────────────────────
  let screenshotUrl: string | null = null;
  let uploadedPath: string | null = null;

  if (screenshotBase64 && screenshotFilename) {
    const ext = screenshotFilename.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = MIME_MAP[ext];
    if (!mimeType) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
    // ~5 MB limit: base64 inflates ~33%, so 5MB → ≤6.8M chars
    if (screenshotBase64.length > 6_800_000) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const buffer = Buffer.from(screenshotBase64, "base64");
    const path   = `${Date.now()}-${Math.random().toString(36).slice(2)}-${screenshotFilename}`;
    const { error: upErr } = await supabase.storage
      .from("feedback-screenshots")
      .upload(path, buffer, { contentType: mimeType });
    if (!upErr) {
      uploadedPath = path;
      const { data: signed } = await supabase.storage
        .from("feedback-screenshots")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      screenshotUrl = signed?.signedUrl ?? null;
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const submission = await prisma.feedbackSubmission.create({
    data: {
      category,
      userId,
      userRole,
      userEmail,
      agencyId,
      field1: field1.trim(),
      field2: field2?.trim() || null,
      url:          url ?? null,
      browser:      browser ?? null,
      viewportSize: viewportSize ?? null,
      userAgent:    userAgent ?? null,
      screenshotUrl,
      screenshotFilename: screenshotFilename ?? null,
    },
  });

  // ── Email (fire-and-forget — never block the response) ────────────────────
  sendFeedbackEmail({
    id:         submission.id,
    category:   category as Category,
    field1:     submission.field1 ?? "",
    field2:     submission.field2,
    url:        submission.url,
    browser:    submission.browser,
    viewportSize: submission.viewportSize,
    userName,
    userRole,
    userEmail,
    agencyName,
    screenshotBase64: uploadedPath ? screenshotBase64 : null,
    screenshotFilename: uploadedPath ? screenshotFilename : null,
  }).catch(console.error);

  return NextResponse.json({ success: true, id: submission.id });
  } catch (err) {
    console.error("[feedback] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Email sender ──────────────────────────────────────────────────────────────

interface EmailPayload {
  id: string;
  category: Category;
  field1: string;
  field2?: string | null;
  url?: string | null;
  browser?: string | null;
  viewportSize?: string | null;
  userName: string | null;
  userRole: string | null;
  userEmail: string | null;
  agencyName: string | null;
  screenshotBase64?: string | null;
  screenshotFilename?: string | null;
}

async function sendFeedbackEmail(p: EmailPayload) {
  const LABELS: Record<Category, string> = {
    bug:        "Bug Report",
    suggestion: "Suggestion",
    question:   "Question",
  };
  const BADGE_COLORS: Record<Category, string> = {
    bug:        "#fee2e2",
    suggestion: "#fef3c7",
    question:   "#e0f2fe",
  };
  const BADGE_TEXT: Record<Category, string> = {
    bug:        "#991b1b",
    suggestion: "#92400e",
    question:   "#075985",
  };

  const label = LABELS[p.category];
  const truncated = p.field1.length > 50 ? p.field1.slice(0, 50) + "…" : p.field1;
  const subject = `[${label}] ${truncated}`;

  function esc(s: string | null | undefined) {
    return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  let fieldsHtml = "";
  if (p.category === "bug") {
    fieldsHtml = `
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">What they were trying to do</p>
      <p style="font-size:14px;color:#111827;white-space:pre-wrap;margin:0 0 20px">${esc(p.field1)}</p>
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">What happened instead</p>
      <p style="font-size:14px;color:#111827;white-space:pre-wrap;margin:0">${esc(p.field2 ?? "Not specified")}</p>`;
  } else if (p.category === "suggestion") {
    fieldsHtml = `
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">The suggestion</p>
      <p style="font-size:14px;color:#111827;white-space:pre-wrap;margin:0 0 20px">${esc(p.field1)}</p>
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">Why it would help</p>
      <p style="font-size:14px;color:#111827;white-space:pre-wrap;margin:0">${esc(p.field2 ?? "Not specified")}</p>`;
  } else {
    fieldsHtml = `
      <p style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">The question</p>
      <p style="font-size:14px;color:#111827;white-space:pre-wrap;margin:0">${esc(p.field1)}</p>`;
  }

  const roleLabel: Record<string, string> = {
    director: "Director", negotiator: "Negotiator", sales_progressor: "Sales Progressor",
    admin: "Admin", vendor: "Vendor (portal)", purchaser: "Purchaser (portal)",
  };

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:32px auto;padding:0 16px">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="padding:24px 28px;border-bottom:1px solid #f3f4f6">
      <span style="display:inline-block;padding:4px 10px;border-radius:99px;background:${BADGE_COLORS[p.category]};color:${BADGE_TEXT[p.category]};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${label}</span>
      <p style="margin:12px 0 4px;font-size:13px;color:#374151">
        <strong>${esc(p.userName ?? "Unknown user")}</strong>
        ${p.userRole ? ` · ${esc(roleLabel[p.userRole] ?? p.userRole)}` : ""}
        ${p.agencyName ? ` · ${esc(p.agencyName)}` : ""}
      </p>
      ${p.userEmail ? `<p style="margin:0;font-size:12px;color:#6b7280">${esc(p.userEmail)}</p>` : ""}
    </div>
    <div style="padding:24px 28px;border-bottom:1px solid #f3f4f6">
      ${fieldsHtml}
    </div>
    <div style="padding:20px 28px;background:#f9fafb">
      <p style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Context</p>
      ${p.url ? `<p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>URL:</strong> ${esc(p.url)}</p>` : ""}
      ${p.browser ? `<p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>Browser:</strong> ${esc(p.browser)}</p>` : ""}
      ${p.viewportSize ? `<p style="font-size:12px;color:#6b7280;margin:0 0 4px"><strong>Viewport:</strong> ${esc(p.viewportSize)}</p>` : ""}
      ${p.screenshotFilename ? `<p style="font-size:12px;color:#6b7280;margin:4px 0 0"><strong>Screenshot:</strong> attached (${esc(p.screenshotFilename)})</p>` : ""}
      <p style="font-size:11px;color:#d1d5db;margin:12px 0 0">ID: ${p.id} · Reply to this email to respond directly to the user</p>
    </div>
  </div>
</div>
</body></html>`;

  const text = [
    `[${label}]`,
    `From: ${p.userName ?? "Unknown"} (${roleLabel[p.userRole ?? ""] ?? p.userRole ?? "unknown"})${p.agencyName ? ` at ${p.agencyName}` : ""}`,
    p.userEmail ? `Email: ${p.userEmail}` : "",
    "",
    p.category === "bug"
      ? `What they were trying to do:\n${p.field1}\n\nWhat happened instead:\n${p.field2 ?? "Not specified"}`
      : p.category === "suggestion"
      ? `Suggestion:\n${p.field1}\n\nWhy it would help:\n${p.field2 ?? "Not specified"}`
      : `Question:\n${p.field1}`,
    "",
    p.url ? `URL: ${p.url}` : "",
    p.browser ? `Browser: ${p.browser}` : "",
    p.viewportSize ? `Viewport: ${p.viewportSize}` : "",
    `ID: ${p.id}`,
  ].filter(Boolean).join("\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg: any = {
    to:      FEEDBACK_TO,
    from:    FEEDBACK_FROM,
    subject,
    text,
    html,
    ...(p.userEmail ? { replyTo: p.userEmail } : {}),
  };

  if (p.screenshotBase64 && p.screenshotFilename) {
    const ext  = p.screenshotFilename.split(".").pop()?.toLowerCase() ?? "png";
    const mime = MIME_MAP[ext] ?? "image/png";
    msg.attachments = [{ content: p.screenshotBase64, filename: p.screenshotFilename, type: mime, disposition: "attachment" }];
  }

  await sgMail.send(msg);

  await prisma.feedbackSubmission.update({
    where: { id: p.id },
    data: { emailSent: true, emailSentAt: new Date() },
  });
}
