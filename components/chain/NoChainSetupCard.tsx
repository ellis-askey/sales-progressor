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

// Secondary action (no-chain confirm / undo). Canonical flat secondary via the
// .agent-canon-cta footer; a real spinner replaces the label while a confirm or
// undo is in flight, so it reads as working rather than dead.
function ActionButton({ children, onClick, pending }: { children: React.ReactNode; onClick: () => void; pending?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="agent-btn agent-btn-sm agent-btn-secondary"
      style={{ minWidth: 96, justifyContent: "center" }}
    >
      {pending ? <span className="agent-spinner agent-spinner-sm" aria-label="Saving" /> : children}
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
    <GlassCard glassId="chains-nochain-card" label="Chains · needs setup card" defaultVariant="v05" className="chain-prop-card ncs-card" data-bloom style={{ padding: 12, borderRadius: 14, position: "relative", display: "flex", flexDirection: "column" }}>
      {/* The flex row lives on an inner element (not the card itself) so the
          container query below can flip it to a column — a container query can
          only style descendants of the container, never the container itself.
          The card stays a flex column (align-items: stretch by default) so this
          inner row fills the full width instead of the glass card centring it.
          The row's flex props live in CSS (not inline) so the container query can
          actually override align-items on narrow — an inline style would win. */}
      <div className="ncs-inner">
      {/* Left column: photo + address, with the meta beneath. */}
      <div className="ncs-main" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Photo + address — the address sits beside the photo, vertically centred. */}
      <div className="ncs-row" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <PropertyThumb photoUrl={sale.photoUrl} size={52} />
        <div className="ncs-addr" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span
              data-sensitive="true"
              className="ncs-addr-text"
              style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
            >
              {line1}
            </span>
            {sale.status === "on_hold" && (
              // Narrow cards: lifted to the card's top-right (see .ncs-hold) so the
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
        </div>
      </div>

      {/* "Sale agreed · agency" then the onward hint — a full-width row under the
          photo, hard left (not indented to the address). Age turns amber once the
          sale has sat unresolved for 3+ months. */}
      <div className="ncs-meta" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0 }}>
        <div className="ncs-meta-top" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {agreed && (
            <span style={{ fontSize: 10.5, fontWeight: showAge ? 600 : 400, color: showAge ? "var(--agent-warning)" : "var(--agent-text-muted)" }}>
              {agreed}
            </span>
          )}
          {agreed && agencyName && <span className="ncs-dot" style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>·</span>}
          {agencyName && <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>{agencyName}</span>}
        </div>
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

      {/* Actions — stacked on the right, vertically centred against the left
          column. "Set up chain" primary (keeps its drawer + hover-prefetch) on
          top; the no-chain confirm / undo secondary (real spinner while saving)
          below. On a narrow card they drop under the content, full-width. */}
      <div className="ncs-actions agent-canon-cta" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        {confirmed ? (
          // Whole tab is no-chain, so just the "Set up chain instead" escape
          // hatch (critique #288) — a single secondary button.
          <ActionButton pending={pending} onClick={() => onUndoNoChain(sale.transactionId)}>Set up chain instead</ActionButton>
        ) : (
          <>
            <ViewChainButton transactionId={sale.transactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} label="Set up chain" variant="primary" />
            <ActionButton pending={pending} onClick={() => onConfirmNoChain(sale.transactionId)}>{sale.noChainRequired ? "Confirm no chain" : "No chain"}</ActionButton>
          </>
        )}
      </div>
      </div>

      <style>{`
        .ncs-card { container-type: inline-size; }
        .ncs-card .ncs-inner { display: flex; align-items: center; gap: 12px; width: 100%; }
        /* Narrow card: the inner row flips to a full-width column — the buttons
           drop under the content — and the "On hold" pill lifts clear of the
           address line. Styles a descendant of the container (never the container
           itself), and in CSS (not inline) so align-items: stretch actually wins. */
        @container (max-width: 540px) {
          .ncs-card .ncs-inner { flex-direction: column; align-items: stretch; }
          .ncs-card .ncs-hold { position: absolute; top: 12px; right: 12px; }
        }
      `}</style>
    </GlassCard>
  );
}
