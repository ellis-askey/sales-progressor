// Route-level loading for /agent/hub. Renders as soon as the user navigates
// here, before the RSC finishes. Uses the shared LoadingCard (v05 glass +
// three pulsating dots) — same visual language every route-level loader
// in the app uses from 2026-08-09 onwards.
//
// Once the RSC starts streaming, the hub replaces this with its per-section
// Suspense boundaries (each with its own inline LoadingCard fallback) and
// content fades in section by section.

import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";

export default function HubLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Greeting is intentionally blank here (non-breaking spaces reserve the
          height): the real header only appears once the name + subtitle are
          known, then types itself in — so nothing flashes or pops in late. */}
      <PageHeader title={" "} subtitle={" "}>
        <Link
          href="/agent/transactions/new"
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ textDecoration: "none" }}
        >
          <Plus size={14} weight="bold" />
          New sale
        </Link>
      </PageHeader>

      {/* No loading card here: the hub decides empty-vs-full behind a brief
          blank, and a populated hub shows its own loading card via the
          in-component Suspense boundary. This keeps a brand-new account from
          ever seeing a skeleton, and avoids a card→blank→card flicker. */}
      <div
        className="hub-content-pad"
        style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}
      />
    </div>
  );
}
