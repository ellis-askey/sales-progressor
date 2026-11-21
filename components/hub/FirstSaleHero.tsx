// First-sale welcome hero (Hub). Shown to a brand-new user who reached us by
// claiming a chain invite and has exactly one real sale — the one they claimed.
// Retires the moment they add another (see getClaimedFirstSale in
// lib/services/hub.ts). Full-width, transparent container over a right-anchored
// house-sketch background (/first-sale-hero.png). Desktop: card left, writing
// top-right, CTAs below. Mobile: background hidden, stacked writing -> card ->
// CTAs (DOM order below is that mobile order; the desktop grid places the card
// on the left via grid-template-areas).

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  CaretRight,
  CheckCircle,
  LinkSimple,
  ArrowRight,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { FirstSalePhoto } from "@/components/hub/FirstSalePhoto";
import { Pill } from "@/components/ui/Pill";
import { buttonClasses } from "@/components/arc/button/button";

export function FirstSaleHero({
  sale,
  photoUrl,
}: {
  sale: { id: string; address: string };
  photoUrl: string | null;
}) {
  const [rawLine1, ...rest] = sale.address.split(",");
  const line1 = rawLine1.trim();
  const line2 = rest.join(",").trim();

  return (
    <section className="fsh" data-testid="hub-first-sale-hero">
      {/* Writing (first on mobile) */}
      <div className="fsh-writing">
        <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.06, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>
          Your first sale <span style={{ color: "var(--agent-coral-deep)" }}>is in.</span>
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)", maxWidth: 430 }}>
          TSP keeps the progress, chasing, updates and people around the sale together as it moves towards exchange.
        </p>
      </div>

      {/* Card (middle on mobile, left on desktop) */}
      <div
        className="fsh-card"
        style={{
          background: "var(--agent-surface-glass, #fff)",
          borderRadius: 16,
          overflow: "hidden",
          border: "0.5px solid var(--agent-border-subtle)",
          boxShadow: "0 6px 24px rgba(30,45,74,0.10)",
        }}
      >
        <FirstSalePhoto transactionId={sale.id} photoUrl={photoUrl} />
        <div style={{ padding: "12px 14px 14px" }}>
          <Link href={`/agent/transactions/${sale.id}`} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span data-sensitive="true" style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{line1}</span>
            <CaretRight size={14} weight="bold" color="var(--agent-coral-deep)" />
          </Link>
          {line2 && (
            <p data-sensitive="true" style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>{line2}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <Pill glass tone="success" size="md">
              <CheckCircle size={13} weight="fill" /> Just added
            </Pill>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--agent-text-muted)" }}>
              <LinkSimple size={13} /> Added via chain
            </span>
          </div>
        </div>
      </div>

      {/* CTAs (last on mobile) */}
      <div className="fsh-ctas" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link
          href={`/agent/transactions/${sale.id}`}
          className={buttonClasses({ variant: "primary" })}
          style={{ textDecoration: "none", padding: "11px 18px", fontSize: 14, ["--foreground"]: "#FF6B4A", ["--background"]: "#ffffff" } as CSSProperties}
        >
          Continue with {line1} <ArrowRight size={15} weight="bold" />
        </Link>
        <Link
          href="/agent/transactions/new"
          className={buttonClasses({ variant: "outline" })}
          style={{ textDecoration: "none", padding: "11px 18px", fontSize: 14 }}
        >
          <Plus size={15} weight="bold" /> Add another sale
        </Link>
      </div>
    </section>
  );
}
