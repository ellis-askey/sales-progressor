// Route-level loading for /agent/hub. Renders as soon as the user navigates
// here, before the RSC finishes. Design pivoted 2026-08-10 from a full
// grey-skeleton composition to a lightweight real-structure shell:
//
//   - Real page-header (greeting + subtitle + "New sale" CTA) — no fake
//     shape, this is content the user genuinely arrives to.
//   - A single calm "Loading your hub…" line inside a real card container.
//     No shimmer, no pulse, no repeated ghost blocks.
//
// The moment the RSC starts streaming, kinetic-hub replaces this with its
// per-section Suspense boundaries (each with its own inline "Loading X…"
// text inside real card frames) and content fades in section by section.
// Legacy hub does the same via its BodyGate → FullHubBody split.
//
// Minimum height on the placeholder keeps the page from jumping when the
// real content arrives. See components/hub/SectionReveal.tsx for the fade.

import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingDots } from "@/components/hub/LoadingDots";

function loadingGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.";
}

export default function HubLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PageHeader title={loadingGreeting()} subtitle="Here's what matters today.">
        <Link
          href="/agent/transactions/new-v2"
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
        <div
          className="agent-glass-strong"
          style={{
            borderRadius: "var(--agent-radius-xl)",
            padding: "20px 24px",
            minHeight: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LoadingDots label="Loading your hub" />
        </div>
      </div>
    </div>
  );
}
