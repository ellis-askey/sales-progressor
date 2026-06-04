// GET /api/healthz — public.
//
// Returns the deployed commit SHA and build timestamp so the prod
// release runbook's MANDATORY HASH CHECK is executable:
//
//   git rev-parse HEAD                        # approved release SHA
//   curl <prod-url>/api/healthz | jq .commitSha   # deployed SHA
//   # the two MUST match
//
// Filed against the runbook after Vercel was observed silently
// skipping the auto-build for commit fbea564 on 2026-06-04
// (docs/active/TODO.md → "Vercel silently skipping auto-builds for
// some pushes"). A deploy pipeline that drops a commit is a runbook
// risk; this endpoint is the cheap detector.
//
// Implementation notes:
//   - VERCEL_GIT_COMMIT_SHA is set automatically by Vercel at build
//     time. Falls back to "unknown" for local dev / non-Vercel hosts.
//   - builtAt is the moment this build was packaged; computed at
//     build by reading the current Date inside Next's build-time
//     codepath (the route is a server component, evaluated at build
//     for static export OR at request time for dynamic). We force
//     dynamic with `revalidate = 0` to ensure builtAt reflects the
//     server's notion of "now this build started serving", not a
//     stale static prerender.
//   - Public by design. The endpoint exposes no secret state; the
//     SHA and the build time are already implied by what Vercel
//     surfaces in its UI for the same deploy.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUILT_AT = new Date().toISOString();

export async function GET() {
  return NextResponse.json({
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    builtAt: BUILT_AT,
    // Echo Vercel deployment metadata that's already public via the
    // dashboard, useful for hash-match operators.
    deployment: {
      environment: process.env.VERCEL_ENV ?? "local",
      region: process.env.VERCEL_REGION ?? null,
    },
  });
}
