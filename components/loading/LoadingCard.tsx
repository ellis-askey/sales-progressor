// Shared page-loading placeholder. Renders a v05-glass card with the
// three pulsating dots inside — same visual language the hub loader
// established (2026-08-09). Server-safe: v05 is just a CSS class on
// app/styles/glass.css, no client hooks needed.
//
// Use inside a route-level loading.tsx below its PageHeader:
//   <PageHeader title="…" subtitle="…" />
//   <LoadingCard />
//
// Or with a custom label / height when the page's real content will
// occupy noticeably more space:
//   <LoadingCard label="Loading your files" minHeight={220} />

import { LoadingDots } from "@/components/hub/LoadingDots";

export function LoadingCard({
  label = "Loading",
  minHeight = 160,
}: {
  label?: string;
  minHeight?: number;
}) {
  return (
    <div
      className="glass-v05"
      role="status"
      aria-live="polite"
      style={{
        borderRadius: "var(--agent-radius-xl)",
        padding: "24px 28px",
        minHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LoadingDots label={label} />
    </div>
  );
}
