// Route-level loading for /agent/hub. Renders as soon as the user navigates
// here, before the RSC finishes. Uses the shared LoadingCard (v05 glass +
// three pulsating dots) — same visual language every route-level loader
// in the app uses from 2026-08-09 onwards.
//
// Once the RSC starts streaming, kinetic-hub / legacy-hub replace this
// with their per-section Suspense boundaries (each with its own inline
// LoadingCard fallback) and content fades in section by section.

import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

function loadingGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.";
}

export default function HubLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PageHeader title={loadingGreeting()} subtitle="Here's what matters today.">
        <Link
          href="/agent/transactions/new"
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ textDecoration: "none" }}
        >
          <Plus size={14} weight="bold" />
          New sale
        </Link>
      </PageHeader>

      <div
        className="hub-content-pad"
        style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}
      >
        <LoadingCard label="Loading your hub" />
      </div>
    </div>
  );
}
