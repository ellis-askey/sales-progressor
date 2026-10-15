import type { Metadata } from "next";
import Hub from "./hub-view";
import { CardNudgeBanner } from "@/components/progression/CardNudgeBanner";
import { ConnectionRequestBanner } from "@/components/progression/ConnectionRequestBanner";

export const metadata: Metadata = {
  title: "Hub · Sales Progressor",
  description: "Your pipeline, attention items, and exchange forecast at a glance.",
};

export default function HubPage() {
  return (
    <>
      {/* Item 9: the "add a card" nudge for a progression owner (null for everyone
          else, and when a card is on file / nothing's owed). */}
      <CardNudgeBanner />
      {/* Agency director with pending progressor connection requests (multi-progressor). */}
      <ConnectionRequestBanner />
      <Hub />
    </>
  );
}

// Perceived-performance (2026-09-18): let the client router reuse this
// page for 5 minutes after a visit — moving around a working burst never
// re-renders a page you just saw. Per-page opt-in rather than a global
// staleTimes so buyer/seller portal navigation keeps its default
// always-fresh behaviour. Every mutation still purges this via its
// revalidatePath calls, and the "As of" button force-refreshes.
export const unstable_dynamicStaleTime = 300;
