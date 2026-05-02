// Vercel deployment webhook — writes a Deployment row on each successful deploy.
// Configure in Vercel Dashboard → Project → Settings → Git → Deploy Hooks
// or Integrations → Webhooks with event type "deployment.succeeded".
//
// Auth: Vercel signs webhook payloads with HMAC-SHA1.
// Set VERCEL_WEBHOOK_SECRET env var to the secret from the Vercel dashboard.
// If the secret is not set, the endpoint accepts all requests (dev/staging only).

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha1", secret)
    .update(body)
    .digest("hex");
  // Vercel sends "sha1=<hex>"
  const provided = signature.startsWith("sha1=") ? signature.slice(5) : signature;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(provided, "hex")
  );
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("x-vercel-signature") ?? "";
    if (!sig || !verifySignature(rawBody, sig, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const p = payload as Record<string, unknown>;

  // Only record successful deployments
  const type = p.type as string | undefined;
  if (type && type !== "deployment.succeeded" && type !== "deployment.ready") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const deployment = (p.deployment ?? p.data) as Record<string, unknown> | undefined;
  const meta = (p.meta ?? {}) as Record<string, unknown>;

  const version = String(
    deployment?.["id"] ??
    deployment?.["url"] ??
    meta["commitSha"] ??
    "unknown"
  ).slice(0, 64);

  const environment = String(
    deployment?.["target"] ??
    p["target"] ??
    meta["deploymentEnvironment"] ??
    "unknown"
  );

  const releaseNotes = (() => {
    const sha = String(meta["commitSha"] ?? "").slice(0, 8);
    const message = String(meta["commitMessage"] ?? "");
    const ref = String(meta["gitBranch"] ?? meta["branch"] ?? "");
    if (!sha && !message) return undefined;
    return [sha && `sha: ${sha}`, ref && `branch: ${ref}`, message].filter(Boolean).join("\n");
  })();

  const triggeredBy = String(
    meta["deploymentCreatedBy"] ??
    p["createdBy"] ??
    "vercel"
  ).slice(0, 128);

  await prisma.deployment.create({
    data: {
      version,
      environment,
      releaseNotes,
      triggerType: "webhook",
      triggeredBy,
    },
  });

  return NextResponse.json({ ok: true });
}
