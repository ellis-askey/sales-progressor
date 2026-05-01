import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/services/retention";

const STYLES = `
  body { font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 64px 24px; color: #1a1d29; background: #fff; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 16px; }
  p { font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 12px; }
  a { color: #3b82f6; }
`;

function successPage(): NextResponse {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title><style>${STYLES}</style></head><body>
<h1>You've been unsubscribed</h1>
<p>You won't receive any more retention emails from Sales Progressor. You'll still get updates on your active sales.</p>
<p><a href="/">Return to Sales Progressor</a></p>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function errorPage(): NextResponse {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid link</title><style>${STYLES}</style></head><body>
<h1>This link isn't valid</h1>
<p>This unsubscribe link isn't valid. Log in to manage your notification preferences.</p>
<p><a href="/login">Log in</a></p>
</body></html>`;
  return new NextResponse(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return errorPage();
  }

  const userId = verifyToken(token);
  if (!userId) {
    return errorPage();
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { retentionEmailOptOut: true },
    });
  } catch {
    // If user not found or update fails, still show error
    return errorPage();
  }

  return successPage();
}
