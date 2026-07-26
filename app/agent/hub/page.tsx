import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { shouldSeeKineticHub } from "@/lib/kinetic/flag";
import LegacyHub from "./legacy-hub";
import KineticHub from "./kinetic-hub";

export const metadata: Metadata = {
  title: "Hub · Sales Progressor",
  description: "Your pipeline, attention items, and exchange forecast at a glance.",
};

// Router — picks kinetic or legacy hub based on the rollout flag.
// Stage 1: internal roles see kinetic, everyone else sees legacy.
// Delete this router + legacy-hub.tsx once rollout completes and
// KineticHub becomes the only hub.
export default async function HubPage() {
  const session = await requireSession();
  if (shouldSeeKineticHub(session)) {
    return <KineticHub />;
  }
  return <LegacyHub />;
}
