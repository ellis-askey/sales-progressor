"use client";

// Director's team-script editor (Settings → Welcome call). Binds the shared
// editor to the agency-level actions; reset drops the team override back to the
// platform default.

import { WelcomeCallScriptEditor } from "./WelcomeCallScriptEditor";
import { updateAgencyWelcomeCallScript } from "@/app/actions/welcome-call-script";
import { DEFAULT_WELCOME_CALL_SCRIPT, type WelcomeCallPoint } from "@/lib/intro-call/script";

export function AgencyWelcomeCallEditor({ initialPoints }: { initialPoints: WelcomeCallPoint[] }) {
  return (
    <WelcomeCallScriptEditor
      initialPoints={initialPoints}
      defaultPoints={DEFAULT_WELCOME_CALL_SCRIPT}
      resetLabel="Reset to our default"
      onSave={(pts) => updateAgencyWelcomeCallScript(pts)}
      onReset={() => updateAgencyWelcomeCallScript(null)}
    />
  );
}
