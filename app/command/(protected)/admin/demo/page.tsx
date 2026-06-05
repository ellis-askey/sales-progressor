// /command/admin/demo — Reset Demo surface.
//
// Tears down the "Fairview Estates" demo agency and reseeds it. Superadmin
// only (the (protected) layout's middleware + assertion gates this). Uses
// the same safety rails as scripts/seed-demo.ts (see DEMO_FEATURE_INVENTORY.md
// §E): aborts unless DATABASE_URL contains the staging Supabase project id
// (and not the production one), and DEMO_SEED_ALLOWED=true is set.
//
// The action requires a typed "RESET" confirmation in the form below before
// running.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import {
  DEMO_AGENCY_NAME,
  DEMO_DIRECTOR_EMAIL,
  DEMO_NEGOTIATOR_EMAIL,
} from "@/scripts/seed-demo";
import { ResetDemoForm } from "./ResetDemoForm";

const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";
const PROD_PROJECT_ID    = "gmkfustgwipgihpmpjpr";

function checkSafety(): { ok: boolean; reasons: string[] } {
  const url = process.env.DATABASE_URL ?? "";
  const reasons: string[] = [];
  if (!url) reasons.push("DATABASE_URL is not set.");
  if (url.includes(PROD_PROJECT_ID)) {
    reasons.push("DATABASE_URL points to PRODUCTION. Refusing.");
  }
  if (!url.includes(STAGING_PROJECT_ID) && !url.includes(PROD_PROJECT_ID)) {
    reasons.push(`DATABASE_URL does not contain the staging project id (${STAGING_PROJECT_ID}).`);
  }
  if (process.env.DEMO_SEED_ALLOWED !== "true") {
    reasons.push("DEMO_SEED_ALLOWED is not set to 'true'. Set it in the staging Vercel env to enable this surface.");
  }
  return { ok: reasons.length === 0, reasons };
}

export default async function CommandResetDemoPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");

  const safety = checkSafety();

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-[20px] font-semibold text-[#fafafa] tracking-tight mb-1">Reset Demo</h1>
      <p className="text-[13px] text-[#737373] mb-6">
        Tear down the <code className="px-1 py-0.5 bg-[#1a1a1a] border border-[#262626] rounded text-[#a3a3a3] font-mono">{DEMO_AGENCY_NAME}</code> agency
        on staging and reseed it from <code className="px-1 py-0.5 bg-[#1a1a1a] border border-[#262626] rounded text-[#a3a3a3] font-mono">scripts/seed-demo.ts</code>.
        Destructive — every transaction, contact, milestone, reminder, chase task, and message under that agency is deleted before the reseed.
      </p>

      {/* Safety rail status */}
      <section className="mb-6">
        <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2">Safety status</p>
        <div className={`px-3 py-2.5 rounded-md border ${safety.ok ? "border-[#14532d] bg-[#0c2418]" : "border-[#7c2d12] bg-[#2a1505]"}`}>
          {safety.ok ? (
            <p className="text-[12px] text-[#a7f3d0]">
              All safety rails pass — staging DB target confirmed, DEMO_SEED_ALLOWED is set.
            </p>
          ) : (
            <>
              <p className="text-[12px] text-[#fed7aa] font-semibold mb-1.5">
                Reset is disabled — fix the following before retrying:
              </p>
              <ul className="text-[12px] text-[#fdba74] list-disc pl-5 space-y-0.5">
                {safety.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Logins (visible always so the demoer can copy without running reset) */}
      <section className="mb-6">
        <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2">Demo logins</p>
        <div className="px-3 py-2.5 rounded-md border border-[#262626] bg-[#111111] text-[12px] text-[#a3a3a3] font-mono space-y-1">
          <p>Director:   <span className="text-[#fafafa]">{DEMO_DIRECTOR_EMAIL}</span></p>
          <p>Negotiator: <span className="text-[#fafafa]">{DEMO_NEGOTIATOR_EMAIL}</span></p>
          <p className="text-[#525252] text-[11px] mt-1.5">Passwords are revealed after a successful reset.</p>
        </div>
      </section>

      {/* Confirm + reset */}
      <section>
        <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2">Confirm reset</p>
        <ResetDemoForm safetyOk={safety.ok} />
      </section>
    </div>
  );
}
