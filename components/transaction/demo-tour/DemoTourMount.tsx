"use client";

// Thin client wrapper that lets the server-rendered file page mount the tour:
// it supplies the onClose callback (a server action can't be created in the
// page and passed as a plain function to a client component, so it lives here)
// and forwards the serialisable autoStart flag. Rendered as PropertyFileTabs'
// tourSlot so it sits inside TabContext and can drive tab switches.

import { DemoTourController } from "./DemoTourController";
import { markDemoTourSeenAction } from "@/app/actions/demo-tour";

export function DemoTourMount({ autoStart }: { autoStart: boolean }) {
  return (
    <DemoTourController
      autoStart={autoStart}
      onClose={(reason) => { void markDemoTourSeenAction(reason); }}
    />
  );
}
