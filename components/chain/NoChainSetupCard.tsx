"use client";

// Compact card for a live sale that isn't in a chain. It resolves one of two
// ways: set up a chain, or confirm no chain is needed — so the "Needs chain
// setup" queue trends to zero. States: default, no-chain-likely (one-click
// confirm), awaiting the client's onward answer, resurfaced (client now buying
// onward), on hold, stale (age chip), and confirmed (in the "No chain" tab).
// Used only by the chains workspace.

import { CheckCircle } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ViewChainButton } from "@/components/chain/ViewChainButton";
import { saleAgreedAgo } from "@/components/chain/chain-format";
import type { NoChainSale } from "@/lib/services/chains";

function monthsSince(iso: string): number {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  return Math.floor(days / 30);
}

// Text-link action matching ViewChainButton's agent-link hover language.
function LinkAction({ children, tone, onClick }: { children: React.ReactNode; tone: "success" | "muted"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="agent-link"
      style={{ fontSize: 13, fontWeight: 500, color: tone === "success" ? "var(--agent-success)" : "var(--agent-text-muted)" }}
    >
      {children}
    </button>
  );
}

export function NoChainSetupCard({
  sale,
  currentUserId,
  currentUserRole,
  showAgency,
  onConfirmNoChain,
  onUndoNoChain,
}: {
  sale: NoChainSale;
  currentUserId: string;
  currentUserRole?: string | null;
  showAgency: boolean;
  onConfirmNoChain: (transactionId: string) => void;
  onUndoNoChain: (transactionId: string) => void;
}) {
  const agreed = saleAgreedAgo(sale.createdAt);
  const agencyName = showAgency ? sale.agencyName : null;
  const metaLine = [agreed, agencyName].filter(Boolean).join("  ·  ");

  // Split the address like the In-chains cards: street on line 1, town/postcode
  // smaller underneath.
  const commaIdx = sale.address.indexOf(",");
  const line1 = commaIdx >= 0 ? sale.address.slice(0, commaIdx).trim() : sale.address;
  const line2 = commaIdx >= 0 ? sale.address.slice(commaIdx + 1).trim() : "";

  const confirmed = sale.noChainConfirmedAt != null && !sale.resurfaced;
  const months = monthsSince(sale.createdAt);
  const showAge = !confirmed && months >= 3;

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
              {line1}
            </span>
            {sale.status === "on_hold" && (
              <Pill glass tone="warning" size="sm" style={{ flexShrink: 0 }}>On hold</Pill>
            )}
          </div>
          {line2 && (
            <div data-sensitive="true" style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {line2}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {metaLine && <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>{metaLine}</span>}
            {sale.buyerPosition && (
              <Pill tone="muted" size="sm" outline>{sale.buyerPosition}</Pill>
            )}
            {showAge && (
              <Pill glass tone="warning" size="sm">{months} months, no chain</Pill>
            )}
            {sale.resurfaced && (
              <Pill glass tone="danger" size="sm">Client now buying onward</Pill>
            )}
            {!confirmed && !sale.resurfaced && !sale.noChainRequired && sale.awaitingClientOnward && (
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Asked the seller · awaiting reply</span>
            )}
            {!confirmed && sale.noChainRequired && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)" }}>Looks chain-free</span>
            )}
          </div>
        </div>

        {/* Action / state */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          {confirmed ? (
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 650, color: "var(--agent-success)", whiteSpace: "nowrap" }}>
                <CheckCircle size={16} weight="fill" aria-hidden />
                No chain
              </span>
              <LinkAction tone="muted" onClick={() => onUndoNoChain(sale.transactionId)}>Set up chain instead</LinkAction>
            </>
          ) : sale.noChainRequired ? (
            <>
              <LinkAction tone="success" onClick={() => onConfirmNoChain(sale.transactionId)}>Confirm no chain</LinkAction>
              <ViewChainButton transactionId={sale.transactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} label="Set up chain" />
            </>
          ) : (
            <>
              <ViewChainButton transactionId={sale.transactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} label="Set up chain" />
              <LinkAction tone="muted" onClick={() => onConfirmNoChain(sale.transactionId)}>No chain</LinkAction>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
