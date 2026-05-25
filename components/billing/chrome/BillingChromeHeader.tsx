// components/billing/chrome/BillingChromeHeader.tsx
//
// Minimal billing-environment header. Replaces the working-app sidebar +
// topbar on the billing surface — the "step out" piece. Logo on the left,
// clear ← Back on the right so the director never feels stranded.
//
// Renders as a thin sticky bar. Near-white sub-canvas with a hairline
// bottom border. Theme accent (--agent-coral) used sparingly for the
// brand mark only — the chrome itself stays neutral so the document
// content can carry the colour.

import Link from "next/link";
import { ArrowLeft, FolderOpen } from "@phosphor-icons/react/dist/ssr";

export function BillingChromeHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "saturate(140%) blur(8px)",
        WebkitBackdropFilter: "saturate(140%) blur(8px)",
        borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        minHeight: 56,
      }}
    >
      <Link
        href="/agent/hub"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
        }}
        aria-label="Sales Progressor"
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            background:
              "linear-gradient(135deg, var(--agent-coral, #FF6B4A) 0%, var(--agent-coral-deep, #E84F2D) 100%)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <FolderOpen weight="fill" style={{ width: 14, height: 14, color: "#fff" }} />
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--agent-text-primary, #111827)",
            letterSpacing: "-0.005em",
          }}
        >
          Sales Progressor
        </span>
      </Link>

      <Link
        href="/agent/hub"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          fontSize: 12.5,
          color: "#374151",
          textDecoration: "none",
          borderRadius: 8,
          transition: "background 150ms",
        }}
        className="hover:bg-black/[0.05]"
      >
        <ArrowLeft weight="bold" style={{ width: 13, height: 13 }} />
        Back to Sales Progressor
      </Link>
    </header>
  );
}
