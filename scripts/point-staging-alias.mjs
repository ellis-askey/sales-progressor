// Point the staging branch URL at the newest Ready staging deployment.
//
// Why this exists (perf audit F3, root-caused 2026-10-12): Vercel's
// automatic branch aliasing is broken for this project — staging builds
// complete Ready, correctly tagged githubCommitRef=staging, but
// salesprogressor-git-staging-….vercel.app never repoints to them. The
// result is silently testing weeks-old code (how the F3 stale-staging
// finding stayed hidden). Until the dashboard-side cause is fixed (see
// ELLIS_MANUAL_TODO), run this after every staging push:
//
//   npm run staging:alias
//
// Uses the local Vercel CLI auth (no token needed). Waits up to 12
// minutes for the newest staging build to go Ready, then aliases it.
// Registered in docs/SCRIPTS_REGISTRY.md per Law 15. Lifetime: ongoing
// until Vercel branch aliasing works again (then delete + deregister).
import { execSync } from "node:child_process";

const BRANCH_URL = "salesprogressor-git-staging-ellis-askeys-projects.vercel.app";
const DEADLINE = Date.now() + 12 * 60 * 1000;

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function newestStagingDeployment() {
  // stdout of `vercel ls` is the bare URL list, newest first; the pretty
  // table goes to stderr.
  const out = sh("npx vercel ls --meta githubCommitRef=staging --yes 2>nul || npx vercel ls --meta githubCommitRef=staging --yes");
  const lines = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("https://"));
  return lines[0] ?? null;
}

function isReady(url) {
  try {
    const info = sh(`npx vercel inspect ${url} 2>&1`);
    return /Ready/.test(info);
  } catch {
    return false;
  }
}

const url = newestStagingDeployment();
if (!url) {
  console.error("No staging-branch deployment found. Did the push trigger a build?");
  process.exit(1);
}
console.log(`Newest staging deployment: ${url}`);

while (!isReady(url)) {
  if (Date.now() > DEADLINE) {
    console.error("Timed out waiting for the deployment to go Ready (12m). Check the Vercel dashboard for a failed build.");
    process.exit(1);
  }
  console.log("Not Ready yet - waiting 30s...");
  await new Promise((r) => setTimeout(r, 30_000));
}

console.log(`Ready. Pointing ${BRANCH_URL} at it...`);
console.log(sh(`npx vercel alias set ${url} ${BRANCH_URL} 2>&1`));
console.log("Done. Staging URL now serves the newest build.");
