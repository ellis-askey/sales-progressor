"use client";

// Compact card for a live sale that isn't in a chain yet. Rebuilds the old plain
// table row in the workspace's card language. We're already inside the "Needs
// chain setup" view, so we drop the repeated "Active" / "Not in a chain" noise —
// the Set up chain action carries the state. Files we can tell genuinely need no
// chain (buyer chain-free AND seller not buying onward) get a distinct, calm
// "No chain required" treatment instead. Used only by the chains workspace.

import { CheckCircle } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ViewChainButton } from "@/components/chain/ViewChainButton";
import { saleAgreedAgo } from "@/components/chain/chain-format";
import type { NoChainSale } from "@/lib/services/chains";

export function NoChainSetupCard({
  sale,
  currentUserId,
  currentUserRole,
  showAgency,
}: {
  sale: NoChainSale;
  currentUserId: string;
  currentUserRole?: string | null;
  // Agency users only ever see their own agency, so the name is redundant.
  showAgency: boolean;
}) {
  const agreed = saleAgreedAgo(sale.createdAt);
  const metaLine = [agreed, showAgency ? sale.agencyName : null].filter(Boolean).join("  ·  ");

  return (
    <GlassCard glassId="chains-nochain-card" label="Chains · needs setup card" defaultVariant="v05" style={{ padding: 14, borderRadius: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <PropertyThumb photoUrl={sale.photoUrl} size={52} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span
              data-sensitive="true"
              style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
            >
              {sale.address}
            </span>
            {sale.status === "on_hold" && (
              <Pill glass tone="warning" size="sm" style={{ flexShrink: 0 }}>On hold</Pill>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {metaLine && (
              <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{metaLine}</span>
            )}
            {sale.buyerPosition && (
              <Pill tone="muted" size="sm" outline>{sale.buyerPosition}</Pill>
            )}
          </div>
        </div>

        {/* Action / state */}
        {sale.noChainRequired ? (
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--agent-success)", whiteSpace: "nowrap" }}>
              <CheckCircle size={16} weight="fill" aria-hidden />
              No chain required
            </span>
            <ViewChainButton transactionId={sale.transactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} label="Set up chain anyway" />
          </div>
        ) : (
          <div style={{ flexShrink: 0 }}>
            <ViewChainButton transactionId={sale.transactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} label="Set up chain" />
          </div>
        )}
      </div>
    </GlassCard>
  );
}
