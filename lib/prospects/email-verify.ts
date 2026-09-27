// Recipient email deliverability pre-check for outreach (Phase 1 blocker).
// Cheap and account-free: RFC-ish syntax + a DNS MX/A lookup for the domain.
// This catches the single worst bounce driver on a fresh sending domain —
// guessed addresses at domains that don't exist or accept no mail at all.
//
// What it does NOT do: verify the mailbox itself (a real domain but a wrong
// local part, e.g. jane@ vs john@). That needs a paid verifier and is a later
// upgrade — see the provider seam at the bottom. So "valid" here means "the
// domain can receive mail", not "this exact inbox exists".

import { resolveMx, resolve as resolveDns } from "dns/promises";

export type EmailVerifyStatus = "valid" | "invalid" | "unknown";
export type EmailVerifyResult = { status: EmailVerifyStatus; reason?: string };

// Permissive on purpose (not a full RFC 5322 parser), but rejects the obvious
// breakage: spaces, missing @, missing TLD, consecutive dots.
const SYNTAX = /^[^\s@"]+@[^\s@.]+(\.[^\s@.]+)+$/;

// Cache per-domain results for the process lifetime (cron runs are short), so a
// batch of sends to the same agency domain does one DNS lookup, not one each.
const domainCache = new Map<string, { status: EmailVerifyStatus; at: number }>();
const CACHE_MS = 10 * 60 * 1000;

export async function verifyEmailDeliverable(email: string): Promise<EmailVerifyResult> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e || e.includes("..") || !SYNTAX.test(e)) return { status: "invalid", reason: "malformed address" };
  const domain = e.slice(e.lastIndexOf("@") + 1);

  const cached = domainCache.get(domain);
  const status = cached && Date.now() - cached.at < CACHE_MS ? cached.status : await lookupDomain(domain);
  if (!cached || Date.now() - cached.at >= CACHE_MS) domainCache.set(domain, { status, at: Date.now() });

  return { status, reason: status === "invalid" ? "domain has no mail server" : undefined };
}

async function lookupDomain(domain: string): Promise<EmailVerifyStatus> {
  try {
    const mx = await resolveMx(domain);
    if (mx && mx.length > 0) return "valid";
    // Empty MX set -> fall through to an A-record check (mail can route to A).
  } catch (err) {
    const code = (err as { code?: string }).code;
    // Anything other than "no such record" is a transient DNS problem: don't
    // condemn the address on a lookup blip.
    if (code !== "ENODATA" && code !== "ENOTFOUND") return "unknown";
    // ENODATA / ENOTFOUND -> no MX; check for an A record before calling it dead.
  }
  try {
    const a = await resolveDns(domain);
    return a && a.length > 0 ? "valid" : "invalid";
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return "invalid"; // domain doesn't resolve at all
    return "unknown";
  }
}

// --- Provider seam (later upgrade) -------------------------------------------
// A mailbox-level verifier (ZeroBounce / NeverBounce / Verifalia) slots in here,
// gated by an env key, called from the same verifyEmailDeliverable entrypoint so
// no caller changes. Until then, domain-level checking is the safety net.
// lands: Phase 3 (needs a paid account — see docs/active/ELLIS_MANUAL_TODO.md)
