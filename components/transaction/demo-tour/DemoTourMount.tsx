"use client";

// Thin client wrapper that lets the server-rendered file page mount the tour:
// it supplies the onClose callback (a server action can't be created in the
// page and passed as a plain function to a client component, so it lives here)
// and forwards the serialisable autoStart flag. Rendered as PropertyFileTabs'
// tourSlot so it sits inside TabContext and can drive tab switches.

import { DemoTourController } from "./DemoTourController";
import { AGENT_DEMO_TOUR_STEPS, AGENT_DEMO_FINISH, DEMO_TOUR_STEPS, ONBOARDING_FINISH } from "./types";
import { markDemoTourSeenAction } from "@/app/actions/demo-tour";

export function DemoTourMount({ autoStart, demoKind }: { autoStart: boolean; demoKind?: string | null }) {
  // The agent demo (external progressor pitching an agent) uses its own copy +
  // closing card; the in-app onboarding demo keeps the original.
  const isAgentDemo = demoKind === "agent_demo";
  return (
    <DemoTourController
      autoStart={autoStart}
      steps={isAgentDemo ? AGENT_DEMO_TOUR_STEPS : DEMO_TOUR_STEPS}
      finish={isAgentDemo ? AGENT_DEMO_FINISH : ONBOARDING_FINISH}
      onClose={(reason) => { void markDemoTourSeenAction(reason); }}
    />
  );
}
