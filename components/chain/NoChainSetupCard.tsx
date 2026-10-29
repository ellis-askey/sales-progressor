"use client";

// Compact card for a live sale that isn't in a chain. It resolves one of two
// ways: set up a chain, or confirm no chain is needed — so the "Needs chain
// setup" queue trends to zero. States: default, no-chain-likely (one-click
// confirm), awaiting the client's onward answer, resurfaced (client now buying
// onward), on hold, stale (age chip), and confirmed (in the "No chain" tab).
// Used only by the chains workspace.

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
function LinkAction({ children, tone, onClick, disabled }: { children: React.ReactNode; tone: "success" | "muted"; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="agent-link"
      style={{ fontSize: 13, fontWeight: 500, color: tone === "success" ? "var(--agent-success)" : "var(--agent-text-muted)", opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }}
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
  pending = false,
}: {
  sale: NoChainSale;
  currentUserId: string;
  currentUserRole?: string | null;
  showAgency: boolean;
  onConfirmNoChain: (transactionId: string) => void;
  onUndoNoChain: (transactionId: string) => void;
  // True while a confirm/undo for this sale is in flight — dims + locks the
  // action link so it reads as working rather than dead.
  pending?: boolean;
}) {
  const agreed = saleAgreedAgo(sale.createdAt);
  const agencyName = showAgency ? sale.agencyName : null;

  // Split the address like the In-chains cards: street on line 1, town/postcode
  // smaller underneath.
  const commaIdx = sale.address.indexOf(",");
  const line1 = commaIdx >= 0 ? sale.address.slice(0, commaIdx).trim() : sale.address;
  const line2 = commaIdx >= 0 ? sale.address.slice(commaIdx + 1).trim() : "";

  const confirmed = sale.noChainConfirmedAt != null && !sale.resurfaced;
  const months = monthsSince(sale.createdAt);
  const showAge = !confirmed && months >= 3;

  return (
    <GlassCard glassId="chains-nochain-card" label="Chains · needs setup card" defaultVariant="v05" className="chain-prop-card ncs-card" data-bloom style={{ padding: 14, borderRadius: 14, position: "relative" }}>
      <div className="ncs-row" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <PropertyThumb photoUrl={sale.photoUrl} size={52} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span
              data-sensitive="true"
              className="ncs-addr-text"
              style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
            >
              {line1}
            </span>
            {sale.status === "on_hold" && (
              // Mobile: lifted to the card's top-right (see .ncs-hold) so the
              // address line has room (critique #289).
              <span className="ncs-hold">
                <Pill glass tone="warning" size="sm" style={{ flexShrink: 0 }}>On hold</Pill>
              </span>
            )}
          </div>
          {line2 && (
            <div data-sensitive="true" className="ncs-addr-text" style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {line2}
            </div>
          )}
          <div className="ncs-meta" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {/* Age carries its own staleness signal: it turns amber once the sale
                has sat unresolved for 3+ months, so no separate "N months, no
                chain" pill is needed (it only restated the age + the section).
                Mobile: age + agency stack on their own lines, the dot is hidden. */}
            {agreed && (
              <span style={{ fontSize: 10.5, fontWeight: showAge ? 600 : 400, color: showAge ? "var(--agent-warning)" : "var(--agent-text-muted)" }}>
                {agreed}
              </span>
            )}
            {agreed && agencyName && <span className="ncs-dot" style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>·</span>}
            {agencyName && <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>{agencyName}</span>}
            {sale.resurfaced && (
              <Pill glass tone="danger" size="sm">Client now buying onward</Pill>
            )}
            {!confirmed && sale.chainSetupPending && (
              <Pill glass tone="warning" size="sm">Onward not confirmed</Pill>
            )}
            {!confirmed && !sale.resurfaced && !sale.noChainRequired && !sale.chainSetupPending && sale.awaitingClientOnward && (
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Seller hasn&apos;t said if they&apos;re buying onward</span>
            )}
            {!confirmed && sale.noChainRequired && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)" }}>Looks chain-free</span>
            )}
          </div>
        </div>

        {/* Action / state */}
        <div className="ncs-actions" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          {confirmed ? (
            // Whole tab is no-chain, so the "No chain ✓" tick on every row was
            // noise — just the "Set up chain instead" escape hatch (critique #288).
            <LinkAction tone="muted" disabled={pending} onClick={() => onUndoNoChain(sale.transactionId)}>Set up chain instead</LinkAction>
          ) : sale.noChainRequired ? (
            <>
              <LinkAction tone="success" disabled={pending} onClick={() => onConfirmNoChain(sale.transactionId)}>Confirm no chain</LinkAction>
              <ViewChainButton transactionId={sale.transactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} label="Set up chain" />
            </>
          ) : (
            <>
              <ViewChainButton transactionId={sale.transactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} label="Set up chain" />
              <LinkAction tone="muted" disabled={pending} onClick={() => onConfirmNoChain(sale.transactionId)}>No chain</LinkAction>
            </>
          )}
        </div>
      </div>

      {/* Mobile tidy (critiques #289/#290/#297). On a narrow screen the horizontal
          3-column row cramps and the address line clips, so: the "On hold" pill
          lifts to the card's top-right, the age + agency stack onto their own
          lines (dot hidden), the address takes the full width and wraps instead
          of clipping, and the actions drop to a full-width footer row in the
          bottom-right (primary "Set up chain" above the secondary). */}
      <style>{`
        @media (max-width: 640px) {
          .ncs-card .ncs-row { flex-wrap: wrap; align-items: flex-start; }
          .ncs-card .ncs-hold { position: absolute; top: 12px; right: 12px; }
          .ncs-card .ncs-meta { flex-direction: column; align-items: flex-start; gap: 2px; }
          .ncs-card .ncs-dot { display: none; }
          /* Actions no longer share the row with the address — they wrap onto
             their own full-width line below, staying right-aligned and stacked. */
          .ncs-card .ncs-actions { flex-basis: 100%; justify-content: flex-end; }
          /* With the actions gone from its right, the address uses the full width
             and wraps rather than clipping (mirrors critique #298). This also
             removes the horizontal overflow the nowrap line forced on the row. */
          .ncs-card .ncs-addr-text { white-space: normal; overflow: visible; text-overflow: clip; }
        }
      `}</style>
    </GlassCard>
  );
}
