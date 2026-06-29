// /dev/gallery — canonical primitive showcase + visual regression target.
//
// Three groups documented:
//   1. SHIPPED — primitives with full gallery stories + visual regression
//   2. CANONICAL (no gallery yet) — pre-existing primitives that are
//      canonical per the catalog but predate the Phase 2 gallery format.
//      Each gets a gallery as Phase 3 surface remediation surfaces a real
//      consumer that needs one.
//   3. DEFERRED — patterns intentionally not built yet, with Law 14 rationale.
//
// Blocked in production at the page level.

import Link from "next/link";
import { notFound } from "next/navigation";

type Shipped = { name: string; path: string; status: string };
type Canonical = { name: string; path: string; note: string };
type Deferred = { name: string; reason: string };

const SHIPPED: Shipped[] = [
  { name: "Card",      path: "/dev/gallery/card",      status: "shipped 2026-06-26" },
  { name: "Button",    path: "/dev/gallery/button",    status: "shipped 2026-06-27" },
  { name: "Banner",    path: "/dev/gallery/banner",    status: "shipped 2026-06-27 (alias of AgentBanner)" },
  { name: "Pill",      path: "/dev/gallery/pill",      status: "shipped 2026-06-27" },
  { name: "Modal",     path: "/dev/gallery/modal",     status: "shipped 2026-06-29" },
  { name: "Drawer",    path: "/dev/gallery/drawer",    status: "shipped 2026-06-29" },
  { name: "Accordion", path: "/dev/gallery/accordion", status: "shipped 2026-06-29" },
  { name: "Skeleton",  path: "/dev/gallery/skeleton",  status: "shipped 2026-06-29" },
  { name: "Toast",     path: "/dev/gallery/toast",     status: "shipped 2026-06-29 (alias of AgentToaster)" },
];

const CANONICAL_NO_GALLERY: Canonical[] = [
  {
    name: "Avatar",
    path: "components/ui/Avatar.tsx",
    note: "Initials-in-a-circle avatar with optional photo. Atomic; no states to render. Gallery emerges from a real consumer.",
  },
  {
    name: "EmptyState",
    path: "components/ui/EmptyState.tsx",
    note: "Empty-pool surface (illustration + heading + description + optional CTA). Used by lists and hub cards.",
  },
  {
    name: "PageHeader",
    path: "components/ui/PageHeader.tsx",
    note: "Title + subtitle + optional actions slot at the top of a route. Used by every /agent/* page.",
  },
  {
    name: "PriceInput",
    path: "components/ui/PriceInput.tsx",
    note: "£ input with formatting and locale. Form-context only.",
  },
  {
    name: "RoleIcon",
    path: "components/ui/RoleIcon.tsx",
    note: "Small role-typed glyph (vendor / purchaser / solicitor / broker). Pure icon mapping.",
  },
  {
    name: "SavingPulse",
    path: "components/ui/SavingPulse.tsx",
    note: '"Saving…" micro-indicator, debounced. Inline form context.',
  },
  {
    name: "StatusBadge",
    path: "components/ui/StatusBadge.tsx",
    note: "Status pill mapping transaction status to label + colour. To be re-implemented internally using Pill in a follow-up commit per the catalog §2.7 migration note.",
  },
  {
    name: "TimelineIcon",
    path: "components/ui/TimelineIcon.tsx",
    note: "Small glyph for activity / timeline rows.",
  },
];

const DEFERRED: Deferred[] = [
  {
    name: "Tabs",
    reason:
      "Only one prominent consumer (file detail's Overview / Steps / Reminders / To-Do / Activity tabs). Defer to Phase 3 of file-detail remediation so the primitive emerges from real consumer needs rather than designed in vacuum. Catalog §2.12.",
  },
  {
    name: "Field / Input / Select / TextArea (form fields)",
    reason:
      "Forms use raw HTML elements with bespoke styling today. Building form primitives in isolation tends to mis-shape — they emerge better from a real form-heavy Phase 3 surface (probably the agent transaction list filters or the new-sale form). Catalog §2.10.",
  },
  {
    name: "ButtonLink",
    reason:
      "Link-shaped button (today: <Link className='agent-btn'>). Polymorphic <button> / <a> typing pulls in significant complexity for marginal value. Emerges if a real consumer needs it. Catalog §2.5.",
  },
  {
    name: "Section",
    reason:
      "20+ files have a Section in their name. The catalog declares this NOT a primitive — it's a layout composition. Card-shaped sections use Card; accordion-wrapped sections use Accordion. No standalone Section primitive will ship. Catalog §2.9.",
  },
  {
    name: "Modal.Confirm / Modal.Wizard / Modal.Form compounds",
    reason:
      "Modal sub-compound parts intentionally not shipped. Emerge from real consumers (Law 14).",
  },
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

        {/* ── Shipped this phase ───────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <p style={{
            margin: "0 0 16px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--agent-text-muted)",
          }}>
            Shipped Phase 2 — full gallery ({SHIPPED.length})
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {SHIPPED.map((p) => (
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

        {/* ── Canonical without a Phase 2 gallery ──────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <p style={{
            margin: "0 0 4px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--agent-text-muted)",
          }}>
            Canonical, no gallery yet ({CANONICAL_NO_GALLERY.length})
          </p>
          <p style={{
            margin: "0 0 16px",
            fontSize: 13,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.5,
          }}>
            Pre-existing canonical primitives. Each gets a gallery story as Phase 3 surface remediation surfaces a real consumer that needs one — building galleries in isolation for atomic primitives (RoleIcon, SavingPulse, etc) is low-value.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {CANONICAL_NO_GALLERY.map((p) => (
              <li key={p.name} className="glass-card" style={{
                padding: "14px 20px",
                borderRadius: 12,
                opacity: 0.85,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>{p.name}</span>
                  <code style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{p.path}</code>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                  {p.note}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Deferred ─────────────────────────────────────────────── */}
        <section>
          <p style={{
            margin: "0 0 4px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--agent-text-muted)",
          }}>
            Deferred ({DEFERRED.length})
          </p>
          <p style={{
            margin: "0 0 16px",
            fontSize: 13,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.5,
          }}>
            Documented in the catalog. Not built yet — each carries an explicit Law 14 rationale (don&apos;t roll a primitive without writing down what it is first; primitives emerge from real consumers, not designed in vacuum).
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {DEFERRED.map((p) => (
              <li key={p.name} style={{
                padding: "14px 20px",
                borderRadius: 12,
                border: "1px dashed rgba(15,23,42,0.18)",
                background: "rgba(15,23,42,0.02)",
              }}>
                <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 14, color: "var(--agent-text-primary)" }}>
                  {p.name}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                  {p.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
