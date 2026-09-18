import type { Metadata } from "next";
import Hub from "./hub-view";

export const metadata: Metadata = {
  title: "Hub · Sales Progressor",
  description: "Your pipeline, attention items, and exchange forecast at a glance.",
};

export default function HubPage() {
  return <Hub />;
}

// Phase 3 perceived-performance (2026-09-18, PERF-05): let the client
// router reuse this page for 30s after a visit (Back/Forward + quick
// hop-backs skip the server round-trip). Per-page opt-in rather than a
// global staleTimes so buyer/seller portal navigation keeps its default
// always-fresh behaviour. Mutations still purge this via revalidatePath.
export const unstable_dynamicStaleTime = 30;
