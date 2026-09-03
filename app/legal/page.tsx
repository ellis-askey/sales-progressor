// app/legal/page.tsx
//
// Policy hub — single index of every legal document. Standard SaaS pattern:
// users (and counsel) get one URL that links to every policy at once.
// Each policy still serves at its established URL (privacy, cookie-policy,
// terms, dpa) — this is the index, not a route reorg.

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyNavBar } from "@/components/policies/PolicyNavBar";

export const metadata: Metadata = {
  title: "Legal — Sales Progressor",
  description: "Privacy, cookies, terms, billing, and data processing — the policies that govern your use of Sales Progressor.",
  robots: { index: true, follow: true },
};

type LegalDoc = {
  title: string;
  description: string;
  href: string;
};

const DOCS: LegalDoc[] = [
  {
    title: "Privacy Policy",
    description: "How we collect, use, and protect personal data, and the rights you have over your data.",
    href: "/privacy",
  },
  {
    title: "Cookie Policy",
    description: "What cookies and similar technologies we use, and how to control your preferences.",
    href: "/cookie-policy",
  },
  {
    title: "Terms of Service",
    description: "The contract between you (or your agency) and us — covering accounts, acceptable use, our AI features, and liability.",
    href: "/terms",
  },
  {
    title: "Outsourced Sales Progression Terms",
    description: "The terms that apply when an agency instructs us to progress a sale on its behalf — our role, how we chase, dates, fees, and liability.",
    href: "/outsourced-terms",
  },
  {
    title: "Billing Terms",
    description: "Pricing and payment terms — what you pay, when, and how payment failures are handled. Shown to directors when adding a payment card.",
    href: "/billing-terms",
  },
  {
    title: "Data Processing Agreement",
    description: "The UK GDPR Article 28 agreement between an estate agency (data controller) and us (data processor) for the personal data of the agency's clients. Available as a downloadable PDF.",
    href: "/legal/dpa",
  },
  {
    title: "Provider Request Service Terms",
    description: "The terms that apply when a buyer or seller asks to be put in touch with a third-party provider (such as a mortgage broker or surveyor) through us.",
    href: "/provider-terms",
  },
];

export default function LegalIndexPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", color: "#111827", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 32px", background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "saturate(140%) blur(8px)",
        WebkitBackdropFilter: "saturate(140%) blur(8px)",
        borderBottom: "0.5px solid rgba(0, 0, 0, 0.08)",
        minHeight: 52,
      }}>
        <Link href="/" style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}>
          <span aria-hidden="true">←</span> Sales Progressor
        </Link>
      </header>

      {/* Same policy tab bar that appears on every individual policy page —
          on the hub none of the tabs is active (the hub itself isn't a
          policy), so it acts as a jump-to-any-policy bar. */}
      <PolicyNavBar />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "72px 32px 96px" }}>
        <h1 style={{
          fontSize: 36, fontWeight: 700, color: "#111827",
          margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15,
          textAlign: "center",
        }}>
          Legal
        </h1>
        <p style={{
          fontSize: 16, color: "#6b7280",
          margin: "14px auto 0", maxWidth: 520,
          textAlign: "center", lineHeight: 1.55,
        }}>
          The policies and contracts that govern your use of Sales Progressor.
        </p>

        <div style={{ width: 60, height: 0.5, background: "rgba(0, 0, 0, 0.18)", margin: "36px auto 48px" }} />

        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
          {DOCS.map((doc, i) => (
            <li
              key={doc.href}
              style={{
                borderTop: i === 0 ? "0.5px solid rgba(0,0,0,0.08)" : "none",
                borderBottom: "0.5px solid rgba(0,0,0,0.08)",
              }}
            >
              <Link
                href={doc.href}
                className="legal-doc-link"
                style={{
                  display: "block",
                  padding: "24px 4px",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "background 150ms",
                }}
              >
                <h2 style={{
                  fontSize: 17, fontWeight: 600, color: "#111827",
                  margin: 0, lineHeight: 1.35,
                }}>
                  {doc.title}
                  <span style={{
                    marginLeft: 10, fontSize: 14, color: "var(--agent-coral-deep, #E84F2D)",
                    transition: "transform 180ms", display: "inline-block",
                  }}>→</span>
                </h2>
                <p style={{
                  fontSize: 14, color: "#6b7280",
                  margin: "6px 0 0", lineHeight: 1.55,
                }}>
                  {doc.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p style={{
          fontSize: 13, color: "#9ca3af",
          margin: "48px 0 0", textAlign: "center", lineHeight: 1.6,
        }}>
          Questions about any of these documents:{" "}
          <a href="mailto:support@thesalesprogressor.co.uk" style={{
            color: "#6b7280", textDecoration: "underline", textUnderlineOffset: 2,
          }}>
            support@thesalesprogressor.co.uk
          </a>
        </p>
      </div>

      <style>{`
        .legal-doc-link:hover { background: rgba(0,0,0,0.02); }
        .legal-doc-link:hover h2 span { transform: translateX(3px); }
        @media (prefers-reduced-motion: reduce) {
          .legal-doc-link, .legal-doc-link h2 span { transition: none; }
        }
      `}</style>
    </div>
  );
}
