/**
 * Multi-tenant safety regression (Law 7 + Law 18).
 *
 * Asserts that every API route under app/api/ which queries a multi-
 * tenant model (PropertyTransaction, ReminderLog, ChaseTask,
 * ClientChaseState, OutboundMessage, etc.) either:
 *   (a) calls one of the access-scope helpers from
 *       lib/security/access-scope.ts, OR
 *   (b) is explicitly allowlisted as a route that uses superadmin
 *       context (commandDb / /api/command/* / webhooks / cron).
 *
 * Catches the silent class of bugs where a refactor accidentally
 * drops the `where: { ..., agencyId }` clause and turns a tenant-
 * scoped query into a cross-tenant leak.
 *
 * Surfaced + locked as part of Phase 1 of the discipline migration.
 * Runs in CI on every PR.
 */

import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const API_DIR = join(ROOT, "app/api");
const ACTIONS_DIR = join(ROOT, "app/actions");

// Multi-tenant Prisma models. A findMany / findFirst / findUnique on any
// of these from a non-allowlisted route without an access-scope helper
// is a tenant isolation hole.
const MULTI_TENANT_MODELS = [
  "propertyTransaction",
  "reminderLog",
  "chaseTask",
  "clientChaseState",
  "outboundMessage",
  "milestoneCompletion",
  "outboundEmailQueue",
  "contact",
  "buyerRound",
  "transactionDocument",
  "portalMessage",
];

// Routes that legitimately bypass the scope helper:
const ALLOWLIST_PREFIXES = [
  "app/api/command/",          // superadmin Command Centre via commandDb
  "app/api/gdpr/",             // superadmin GDPR tooling (export / erase) — superadmin role + Command-Centre step-up auth, not session agency scope
  "app/api/webhooks/",         // external webhooks (e.g. SendGrid bounce, Vercel deploy)
  "app/api/cron/",             // scheduled jobs run under cron secret
  "app/api/portal/",           // portal token auth — not session-based
  "app/api/auth/",             // NextAuth
  "app/api/health/",           // health checks
  "app/api/debug/",            // local-dev debug
  "app/api/test-fixtures/",    // dev-only test fixtures (blocked in production at runtime)
];

// Individual files within the API tree that are legitimately allowed
// (e.g. internal-staff resolver routes that use access-scope but pattern-
// match differently). Add entries here ONLY with a documented reason.
const FILE_ALLOWLIST: Record<string, string> = {
  // Portal token-bearer auth (token is the scoping mechanism — no session).
  "app/api/survey/route.ts": "Portal-token auth: contact found by portalToken == the requester. No session-level scoping required. CC 2026-06-26.",
  // Platform-wide count of portal-confirmed events for the SP bell.
  // POLISH_TBD entry filed to review whether this should be scoped.
  "app/api/notifications/portal/route.ts": "Platform-wide count for the SP bell. Filed in POLISH_TBD 2026-06-26 for scope review.",
  // Portal/broker token-bearer server actions: the request is authenticated by
  // an unguessable portalToken that resolves to a single Contact/transaction
  // (same model as the app/api/portal/ prefix). No NextAuth session to scope.
  "app/actions/portal-menu.ts": "Portal-token auth: every action calls requirePortalContact(token) → Contact by portalToken. No session scoping. 2026-10-27.",
  "app/actions/portal-onward.ts": "Portal-token auth: resolveVendor(token) → Contact by portalToken, vendor-gated. No session scoping. 2026-10-27.",
  "app/actions/portal-related-sale.ts": "Portal-token auth: resolvePurchaser(token) → Contact by portalToken, purchaser-gated. No session scoping. 2026-10-27.",
  "app/actions/broker-callback.ts": "Portal-token auth: requestBrokerCallbackAction(token) → Contact by portalToken. No session scoping. 2026-10-27.",
};

function walk(dir: string, out: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === "route.ts" || entry === "route.tsx") out.push(full);
  }
  return out;
}

// Server actions aren't named route.ts — collect every .ts under app/actions/
// (excluding tests and type decls) so the same scope check covers them too.
function walkActions(dir: string, out: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkActions(full, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function isAllowlisted(relPath: string): boolean {
  if (ALLOWLIST_PREFIXES.some((p) => relPath.startsWith(p))) return true;
  if (FILE_ALLOWLIST[relPath]) return true;
  return false;
}

function usesMultiTenantModel(content: string): string[] {
  const hits = new Set<string>();
  for (const model of MULTI_TENANT_MODELS) {
    const re = new RegExp(`prisma\\.${model}\\.(findMany|findFirst|findUnique|count)`);
    if (re.test(content)) hits.add(model);
  }
  return [...hits];
}

function usesAccessScopeHelper(content: string): boolean {
  // Pattern A: the internal-staff access-scope helper (admin / sales_progressor
  // / superadmin). Lives at lib/security/access-scope.ts.
  const usesAccessScope =
    /scopeTransactionWhere/.test(content) ||
    /scopeOwnershipWhere/.test(content) ||
    /scopeChaseTaskWhere/.test(content) ||
    /scopeReminderLogWhere/.test(content) ||
    /getAccessScope/.test(content) ||
    /from\s+["']@\/lib\/security\/access-scope["']/.test(content);

  // Pattern B: the agent-side visibility resolver. Lives at lib/services/agent.ts.
  // Returns an AgentVisibility object that's threaded into queries.
  const usesAgentVisibility =
    /resolveAgentVisibility/.test(content) ||
    /resolveInternalVisibility/.test(content) ||
    /AgentVisibility/.test(content);

  // Pattern C: the legacy agencyId-from-session pattern that pre-dates the
  // access-scope helper. Per Law 7 it should migrate, but per Law 19
  // (grandfather generously) routes using this pattern are acceptable AS
  // LONG AS they actually thread agencyId through to the where clause in
  // some form.
  //
  // Detection: the file references session.user.agencyId AND references
  // agencyId in a where clause (direct, destructured, or threaded). The
  // possible legitimate shapes:
  //   - { where: { agencyId } } — destructured var
  //   - { where: { ..., agencyId } } — same, with other filters
  //   - { where: { agencyId: session.user.agencyId } } — inline
  //   - building a `where = { agencyId, ... }` const before the query
  //   - calling a helper that takes agencyId as a parameter
  //
  // This is regression-class detection: it catches FUTURE refactors that
  // drop the agencyId code entirely. It does NOT certify that each query
  // is correctly scoped — that's Phase 3 surface-remediation work.
  const usesLegacyAgencyIdFilter =
    /session\.user\.agencyId/.test(content) &&
    /\bagencyId\b/.test(content);

  // Pattern D: agencyId appears in a where clause regardless of source.
  // Catches routes that look up agencyId via a different mechanism
  // (e.g. agent user table lookup) and thread it into the query.
  // Catches the "where: { id, agencyId: agentUser?.agencyId }" shape.
  const usesAgencyIdInWhereClause =
    /where:\s*\{[^}]*agencyId[^}]*\}/.test(content);

  // Pattern E: self-scoped work — the row is keyed to the acting user rather
  // than an agency (e.g. a user editing their own account, sessions, tasks, or
  // an internal progressor scoped by assignedUserId). Common in app/actions/*.
  // Correctly isolated by the user id, not agencyId.
  const usesSelfScope =
    /session\.user\.id/.test(content) &&
    /\b(userId|createdById|authorId|assignedUserId|adminUserId|recipientUserId)\b/.test(content);

  return usesAccessScope || usesAgentVisibility || usesLegacyAgencyIdFilter || usesAgencyIdInWhereClause || usesSelfScope;
}

describe("Multi-tenant safety — access-scope coverage", () => {
  const routes = walk(API_DIR);
  const actionFiles = walkActions(ACTIONS_DIR);

  it("finds API routes to audit", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it("finds server actions to audit", () => {
    expect(actionFiles.length).toBeGreaterThan(10);
  });

  for (const abs of [...routes, ...actionFiles]) {
    const rel = relative(ROOT, abs).replace(/\\/g, "/");
    const content = readFileSync(abs, "utf8");
    const models = usesMultiTenantModel(content);

    if (models.length === 0) continue; // route doesn't touch multi-tenant data
    if (isAllowlisted(rel)) continue;

    test(`${rel} uses access-scope helper for ${models.join(",")}`, () => {
      const usesHelper = usesAccessScopeHelper(content);
      if (!usesHelper) {
        throw new Error(
          `${rel} queries multi-tenant model(s) [${models.join(",")}] ` +
          `but does NOT import or call an access-scope helper from ` +
          `lib/security/access-scope.ts. This is a Law 7 violation.\n\n` +
          `Fix options:\n` +
          `  1. Import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope" ` +
          `and apply scopeTransactionWhere(scope) to the query.\n` +
          `  2. If this route is legitimately superadmin-context, prefix it ` +
          `to one of the ALLOWLIST_PREFIXES in this test (and explain why ` +
          `in the route's comment header).\n` +
          `  3. If neither applies, add the route to FILE_ALLOWLIST with ` +
          `a documented reason.`,
        );
      }
      expect(usesHelper).toBe(true);
    });
  }
});
