// /dev/gallery — canonical primitive showcase + visual regression target.
//
// Blocked in production at the page level. Renders every approved
// primitive in every state at desktop AND mobile widths. The page is
// the **Phase 2 acceptance gate** per docs/BUILD_PLAN.md — founder
// walks every primitive on desktop and on a real phone before Phase 3
// (surface remediation) begins.
//
// Visual regression in CI ([Law 18](../../../CLAUDE.md#law-18--visual--behavioural-regression-in-ci))
// captures `toHaveScreenshot()` of every gallery state. Any unexplained
// pixel diff blocks the PR.
//
// As primitives ship, each gets a section/route under /dev/gallery/<name>
// linked from this index.

import Link from "next/link";
import { notFound } from "next/navigation";

const PRIMITIVES: Array<{ name: string; path: string; status: string }> = [
  { name: "Card",   path: "/dev/gallery/card",   status: "shipped 2026-06-26" },
  { name: "Button", path: "/dev/gallery/button", status: "shipped 2026-06-27" },
  { name: "Banner", path: "/dev/gallery/banner", status: "shipped 2026-06-27 (alias of AgentBanner)" },
  // Future: Pill, Modal, Drawer, Accordion, Skeleton, Toast
];

export default function GalleryIndex() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main style={{ minHeight: "100vh", padding: "48px 32px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: 40 }}>
          <h1 style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 700,
            color: "var(--agent-text-primary)",
            letterSpacing: "var(--agent-tracking-tight)",
          }}>
            Canonical primitives
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Every primitive in <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>components/ui/</code> rendered in every state. Phase 2 acceptance gate.
          </p>
        </header>

        <section>
          <p style={{
            margin: "0 0 16px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--agent-text-muted)",
          }}>
            Shipped ({PRIMITIVES.length})
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {PRIMITIVES.map((p) => (
              <li key={p.name}>
                <Link href={p.path} className="glass-card" style={{
                  display: "block",
                  padding: "16px 20px",
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "var(--agent-text-primary)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{p.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
