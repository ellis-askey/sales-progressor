import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isHybridSuperadminEmail } from "@/lib/security/hybrid-emails";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Soft per-sandbox AI cost cap for the agent demo. In-memory per edge instance
// (a hard/global cap would use Upstash, currently flagged off), which is fine for
// cost protection — it bounds runaway usage per visitor. Keyed on the sandbox.
const DEMO_AI_CAP = 5;
const DEMO_AI_WINDOW_MS = 60 * 60 * 1000;
const demoAiHits = new Map<string, number[]>();
function demoAiOverQuota(key: string): boolean {
  const now = Date.now();
  const hits = (demoAiHits.get(key) ?? []).filter((t) => now - t < DEMO_AI_WINDOW_MS);
  if (hits.length >= DEMO_AI_CAP) {
    demoAiHits.set(key, hits);
    return true;
  }
  hits.push(now);
  demoAiHits.set(key, hits);
  return false;
}

// Command centre timing constants (ms) â€” kept inline to avoid Node.js module
// imports that are unavailable in the Edge Runtime.
const STEP_UP_MAX_AGE_MS  = 30 * 60 * 1000;
const IDLE_MAX_AGE_MS     =  8 * 60 * 60 * 1000;
const SESSION_HARD_MAX_MS = 24 * 60 * 60 * 1000;
const COMMAND_COOKIE      = "command_session";

/** Verifies HMAC-SHA256 signature using the Web Crypto API (Edge-compatible). */
async function verifyCommandHmac(encoded: string, sig: string, keyHex: string): Promise<boolean> {
  try {
    const keyBytes = Uint8Array.from(keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(sig.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const data = new TextEncoder().encode(encoded);
    return crypto.subtle.verify("HMAC", key, sigBytes, data);
  } catch {
    return false;
  }
}

export default withAuth(
  async function middleware(req) {
    const { pathname, searchParams } = req.nextUrl;
    const role = req.nextauth.token?.role;
    const email = req.nextauth.token?.email;
    const isHybridSuperadmin = isHybridSuperadminEmail(email);

    // â”€â”€ Command centre gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (pathname.startsWith("/command")) {
      // 1. Superadmin role required — or a hybrid-superadmin email (one-off
      //    exception for the platform owner). The 2FA step-up flow below is
      //    skipped for hybrid users per product decision.
      if (role !== "superadmin" && !isHybridSuperadmin) {
        return NextResponse.redirect(new URL("/agent/hub", req.url));
      }

      // 2. IP allowlist (skipped when env var is empty)
      const allowlistRaw = process.env.ADMIN_IP_ALLOWLIST ?? "";
      if (allowlistRaw.trim()) {
        const allowed = allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean);
        const ip =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          req.headers.get("x-real-ip") ??
          "";
        if (!allowed.includes(ip)) {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }

      // Step-up / enrollment pages are exempt from the step-up cookie check.
      // Server action POSTs (Next-Action header) are also exempt â€” they carry
      // their own assertSuperadmin() guard and the middleware's 307 redirect
      // would be forwarded as a POST by the browser, breaking the action.
      const isStepUpPath =
        pathname.startsWith("/command/auth/step-up") ||
        pathname.startsWith("/command/setup-2fa") ||
        pathname.startsWith("/api/command/auth/step-up") ||
        pathname.startsWith("/api/command/setup-2fa");
      const isServerAction = req.headers.has("next-action");

      // Hybrid superadmin (ellis) skips the entire 2FA step-up flow per product
      // decision. Real superadmins still go through it.
      if (!isStepUpPath && !isServerAction && !isHybridSuperadmin) {
        // 3. Cookie presence
        const cookie = req.cookies.get(COMMAND_COOKIE)?.value ?? "";
        const dot = cookie.lastIndexOf(".");
        if (!cookie || dot === -1) {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }

        const encoded = cookie.slice(0, dot);
        const sig = cookie.slice(dot + 1);

        // 4. HMAC signature
        const keyHex = process.env.ADMIN_AUDIT_HMAC_KEY ?? "";
        const valid = await verifyCommandHmac(encoded, sig, keyHex);
        if (!valid) {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }

        // 5. Timestamp checks
        let payload: { issuedAt: number; lastSeenAt: number; stepUpAt: number };
        try {
          payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        } catch {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }

        const now = Date.now();
        if (now - payload.issuedAt > SESSION_HARD_MAX_MS) {
          return NextResponse.redirect(new URL("/login", req.url));
        }
        if (now - payload.lastSeenAt > IDLE_MAX_AGE_MS) {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }
        if (now - payload.stepUpAt > STEP_UP_MAX_AGE_MS) {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }
      }
    }
    // â”€â”€ End command centre gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // ── Founder page-gallery preview (per-request, look-only) ───────────────
    // The Command-Centre page gallery frames logged-in agent pages as a chosen
    // sample user. A ?__previewAs=<userId> on the framed request is honoured ONLY
    // for a real superadmin, and ONLY for this one request: it is forwarded as an
    // x-sp-preview-as request header that applyViewAs() reads (and re-gates on
    // superadmin). Nothing persists, so the parent /command session is untouched.
    // Read-only, like cookie view-as: a mutation carrying the param is blocked.
    const previewAs = searchParams.get("__previewAs");
    if (previewAs) {
      const isSuper = role === "superadmin" || isHybridSuperadmin;
      if (!isSuper) {
        // Not a superadmin: the param does nothing. Strip any spoofed header and
        // continue as the real (non-impersonated) user.
        const clean = new Headers(req.headers);
        clean.delete("x-sp-preview-as");
        return NextResponse.next({ request: { headers: clean } });
      }
      if (MUTATION_METHODS.has(req.method)) {
        return new NextResponse(
          JSON.stringify({ error: "Preview is read-only." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      const fwd = new Headers(req.headers);
      fwd.set("x-sp-preview-as", previewAs);
      return NextResponse.next({ request: { headers: fwd } });
    }

    // Pass-through response (may carry UTM attribution cookie). Strip any
    // client-supplied preview header so only the branch above can set it.
    const passHeaders = new Headers(req.headers);
    passHeaders.delete("x-sp-preview-as");
    const res = NextResponse.next({ request: { headers: passHeaders } });

    // Capture UTM params in a 30-day cookie for signup attribution.
    // Read at agency creation time to populate Agency.signup* fields.
    const utmSource   = searchParams.get("utm_source");
    const utmMedium   = searchParams.get("utm_medium");
    const utmCampaign = searchParams.get("utm_campaign");
    if (utmSource || utmMedium || utmCampaign) {
      res.cookies.set("utm_attr", JSON.stringify({
        source:      utmSource   ?? undefined,
        medium:      utmMedium   ?? undefined,
        campaign:    utmCampaign ?? undefined,
        referrer:    req.headers.get("referer") ?? undefined,
        landingPage: pathname,
        capturedAt:  new Date().toISOString(),
      }), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    // Founder "view as" is hard read-only. While the view-as cookie is present
    // (a superadmin looking through an agent's eyes), block EVERY mutation —
    // /api routes and server-action POSTs to /agent pages alike — at the edge, so
    // it can never become "act as them". The exit is a GET route (not blocked).
    // Cookie name inlined (edge runtime can't import lib/security/view-as.ts).
    const VIEW_AS_COOKIE = "sp_view_as";
    if (req.cookies.get(VIEW_AS_COOKIE)?.value && MUTATION_METHODS.has(req.method)) {
      return new NextResponse(
        JSON.stringify({ error: "View-as is read-only. Exit view-as to make changes." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Agent-demo guest confinement (v1 is file-only) ──────────────────────
    // A demo session (carries sandbox ids on its token) may only reach its own
    // sandbox file, that file's APIs, and the demo launcher/restart. Anything
    // else bounces to the star file. Data access is ALSO hard-scoped per-query by
    // the "demo" access-scope — this just keeps the visitor on the experience.
    const demoIds = req.nextauth.token?.demoSandboxTransactionIds;
    const demoStar = req.nextauth.token?.demoStarTransactionId;
    if (Array.isArray(demoIds) && demoIds.length > 0 && demoStar) {
      // Cap the demo's AI spend (chase drafting, memo parsing, etc.).
      if (
        (pathname.startsWith("/api/ai/") || pathname.startsWith("/api/agent/memo-parse")) &&
        MUTATION_METHODS.has(req.method) &&
        demoAiOverQuota(demoStar)
      ) {
        return new NextResponse(
          JSON.stringify({ error: "You've reached the demo's AI limit. Use Start over to keep exploring." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
      // Block the few non-file endpoints that could reach a real person (inviting
      // a teammate, referrals). File interactions all run through access-scoped,
      // isDemo-suppressed paths; these do not. (Non-file PAGE server actions are
      // already blocked by the navigation confinement below.)
      if (
        MUTATION_METHODS.has(req.method) &&
        (pathname.startsWith("/api/agent/team") || pathname.includes("/invite") || pathname.includes("/refer"))
      ) {
        return new NextResponse(
          JSON.stringify({ error: "That action is disabled in the demo." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      const starFile = new URL(`/agent/transactions/${demoStar}`, req.url);
      if (pathname.startsWith("/api") || pathname.startsWith("/agent-demo")) {
        // allowed — APIs are access-scoped; launcher/restart are demo routes
      } else if (pathname.startsWith("/agent/transactions/")) {
        const id = pathname.split("/")[3];
        if (!id || !demoIds.includes(id)) return NextResponse.redirect(starFile);
      } else {
        return NextResponse.redirect(starFile);
      }
    }

    // Viewers are read-only â€” block all mutation API calls
    if (
      role === "viewer" &&
      pathname.startsWith("/api/") &&
      MUTATION_METHODS.has(req.method)
    ) {
      return new NextResponse(
        JSON.stringify({ error: "Viewers cannot make changes" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const isAgentUser = role === "negotiator" || role === "director";

    // Redirect agent users from internal SP transaction pages into the agent shell
    if (isAgentUser && pathname.match(/^\/transactions\/[^/]+/)) {
      const id = pathname.split("/")[2];
      return NextResponse.redirect(new URL(`/agent/transactions/${id}`, req.url));
    }

    // Agent users can only access the agent area, APIs, and portal â€” nowhere else.
    // The client-facing email-link pages (chases-paused / unsubscribed / feedback)
    // are public + token-gated in-page; included here so a signed-in agent opening
    // one (e.g. to preview it) isn't bounced to the hub.
    const agentAllowed = ["/agent", "/api", "/portal", "/s/", "/a/", "/quote", "/claim", "/invite", "/invite-negotiator", "/outsource", "/help", "/helpdrawertest", "/drawertest", "/bgtest", "/chases-paused", "/unsubscribed", "/feedback"];
    if (isAgentUser && !agentAllowed.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/agent/hub", req.url));
    }

    // All authenticated roles can access /agent/* — data scoping enforced per-query via access-scope.ts

    return res;
  },
  {
    callbacks: {
      // Machine-to-machine routes authenticate via Bearer token inside the handler â€”
      // they must bypass the NextAuth session gate so Vercel Crons can reach them.
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;
        if (pathname.startsWith("/portal")) return true;
        // Public agent-demo launcher/restart — provisions + mints its own scoped
        // session, so it must reach the gate logged-out (like /portal).
        if (pathname.startsWith("/agent-demo")) return true;
        // Solicitor confirm links — token-authenticated inside the page/actions,
        // like /portal. No session required.
        if (pathname.startsWith("/s/")) return true;
        // Mortgage-advisor portal links — token-authenticated inside the page/actions,
        // like /s/. No session required.
        if (pathname.startsWith("/a/")) return true;
        // Public no-auth quote-request page (Contact.portalToken gated in-page).
        if (pathname.startsWith("/quote")) return true;
        if (pathname.startsWith("/claim")) return true;
        // Public no-auth "hand us a file" landing page for the outsourced service.
        if (pathname.startsWith("/outsource")) return true;
        if (pathname.startsWith("/invite")) return true;
        if (pathname.startsWith("/invite-negotiator")) return true;
        // Client-facing email-link pages — reached logged-out from an email, each
        // token/param-gated in-page (same model as /quote). Without these, a client
        // clicking "pause reminders" / "unsubscribe" / a survey link hits the login wall.
        if (pathname.startsWith("/chases-paused")) return true;
        if (pathname.startsWith("/unsubscribed")) return true;
        if (pathname.startsWith("/feedback")) return true;
        // Cron routes authenticate by CRON_SECRET bearer inside each handler.
        // Validate it fail-CLOSED here too (audit AUTO-003): the per-route checks
        // compare `authorization !== "Bearer " + CRON_SECRET`, which would ACCEPT
        // the literal "Bearer undefined" if CRON_SECRET were ever unset. Deny at
        // the edge when the secret is missing or the header doesn't match, so a
        // missing env var can't throw the scheduled-jobs door open. Vercel Cron
        // sends Authorization: Bearer <CRON_SECRET>, so legitimate runs still pass;
        // the per-route checks remain as defence-in-depth.
        if (pathname.startsWith("/api/cron/")) {
          const secret = process.env.CRON_SECRET;
          return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
        }
        if (pathname.startsWith("/api/reminders/")) return true;
        if (pathname.startsWith("/api/webhooks/")) return true;
        // Cookie-consent audit write — can be set before sign-in, on public pages.
        if (pathname === "/api/consent") return true;
        // WhatsApp bridge ingest — bearer-secret auth inside the handler.
        if (pathname.startsWith("/api/integrations/whatsapp/")) return true;
        if (pathname.startsWith("/api/claim")) return true;
        if (pathname === "/api/healthz") return true;
        return !!token;
      },
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    // sw.js MUST be excluded from middleware — service workers refuse to
    // register if their script comes through any redirect, and the agent-
    // route gate below would 307 /sw.js for agent users (no matching prefix
    // in agentAllowed). Exclude as a literal path so the file is served
    // as a pure static asset.
    //
    // Pre-launch dev-route gate (2026-05-25): bg-test, login-preview,
    // helpdrawertest, audit-gallery, and test were previously in this
    // exclusion list, making them publicly reachable in production. Removed
    // so they now hit the middleware auth gate. Unauthenticated visitors
    // get redirected to /login; logged-in users still reach them via the
    // existing agentAllowed prefix list inside the middleware function.
    // Boardwalk Forms (white-label form builder) — boardwalk/* has its own
    // session system (lib/forms/auth.ts, forms_session cookie), f/* is the
    // public respondent-facing form runner (no auth by design, like /quote),
    // and api/forms/* handlers each enforce the Boardwalk session themselves
    // (public submission endpoints are rate-limited + validated server-side).
    // All three must bypass the NextAuth gate or visitors get bounced to the
    // TSP /login. Added 2026-10-12 with the Boardwalk Forms platform.
    // Public legal pages — must bypass the auth-routing redirect so logged-in
    // users can read policies without being thrown back to /agent/hub. terms
    // and privacy were already excluded; cookie-policy, legal (covers both
    // /legal and /legal/dpa), and billing-terms added 2026-05-25 when the new
    // policy pack shipped. outsourced-terms added when the Outsourced Sales
    // Progression Terms page shipped. provider-terms added at the same time to
    // fix a redirect bug: it had been live in the nav but was missing from this
    // list, so agent users hit it were bounced to /agent/hub and logged-out
    // buyers/sellers to /login.
    // /dev/* is excluded so the canonical-primitive gallery at /dev/gallery/*
    // can be reached without auth. Prod-blocked at the page level via
    // process.env.NODE_ENV === "production" → notFound() per Phase 2 of
    // docs/BUILD_PLAN.md. Added 2026-06-26 with the Card primitive.
    // api/dev follows the same convention: data endpoints for /dev prototypes
    // (e.g. /dev/sold-for), each prod-blocked inside the handler with the same
    // NODE_ENV check, so excluding them here exposes nothing in production.
    // proposal + api/proposal: the private Boardwalk prospectus. Self-gated by
    // its own HMAC `proposal_session` cookie (lib/proposal/auth.ts), like the
    // Boardwalk Forms suite above — it must bypass the NextAuth gate so an
    // unauthenticated recipient reaches its own password screen, not TSP /login.
    "/((?!login|register|forgot-password|reset-password|terms|privacy|cookie-policy|legal|billing-terms|outsourced-terms|provider-terms|portal|quote|dev|api/dev|api/auth|api/portal|api/register|boardwalk|f/|api/forms|api/todo|proposal|api/proposal|sw\\.js|_next/static|_next/image|favicon\\.ico|.*\\.(?:jpg|jpeg|png|svg|webp|gif|ico)).*)",
  ],
};
