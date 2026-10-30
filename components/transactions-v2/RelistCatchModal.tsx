"use client";

// Shown at the Create step of the new-sale flow when the address matches an
// existing on-hold / fallen-through file that can take a new buyer. Instead of
// spawning a duplicate file (critique #296: 2 Magnolia Way grew five files), we
// offer to add the new buyer onto the existing file. Design signed off at
// /dev/relist-link. The buyer details the agent already typed are carried over
// by the caller (it opens RelistFileModal pre-filled); "create a separate file"
// falls back to the normal forceCreate path.

import { ArrowUDownLeft } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { PropertyThumb } from "@/components/ui/PropertyThumb";

function shortPrice(pence: number | null): string | null {
  if (pence == null) return null;
  const pounds = Math.round(pence / 100);
  return pounds >= 1000 ? `£${Math.round(pounds / 1000)}k` : `£${pounds}`;
}

export function RelistCatchModal({
  open,
  address,
  status,
  previousPurchasePrice,
  previousBuyerName,
  onAddNewBuyer,
  onCreateSeparate,
  onClose,
}: {
  open: boolean;
  address: string;
  status: "on_hold" | "withdrawn" | string | null;
  previousPurchasePrice: number | null;
  previousBuyerName: string | null;
  onAddNewBuyer: () => void;
  onCreateSeparate: () => void;
  onClose: () => void;
}) {
  const statusLabel = status === "withdrawn" ? "Fell through" : "On hold";
  const price = shortPrice(previousPurchasePrice);
  // First line of the address for the summary heading; full address stays below.
  const firstLine = address.split(",")[0]?.trim() || address;
  // Solid, glossy status pill (our gradient treatment) rather than a faded tint:
  // amber for on-hold, red for fallen-through.
  const pillGradient = status === "withdrawn"
    ? "linear-gradient(180deg, #E05A5A, var(--agent-danger, #C73E3E))"
    : "linear-gradient(180deg, #E8A020, var(--agent-warning, #D08700))";
  const pillShadowRgb = status === "withdrawn" ? "var(--agent-danger-rgb, 199,62,62)" : "var(--agent-warning-rgb, 208,135,0)";

  return (
    <Modal open={open} onClose={onClose} ariaLabel="You already have a file for this address" size="md" closeTone="onDark" dismissOnBackdrop={false}>
      <Modal.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader title="You already have a file for this address" subtitle="We found an existing file for this property." />
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex", gap: 12, alignItems: "center",
              padding: "12px 14px", borderRadius: 12,
              background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)",
            }}
          >
            <PropertyThumb photoUrl={null} size={44} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{firstLine}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, color: "#fff", background: pillGradient, boxShadow: `0 2px 7px rgba(${pillShadowRgb}, 0.35), inset 0 1px 0 rgba(255,255,255,0.28)` }}>{statusLabel}</span>
                {price && <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{price}</span>}
                {previousBuyerName && <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>Buyer: {previousBuyerName}</span>}
              </div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
            You can add the new buyer to the existing file or create a separate one. Adding them to the existing file
            keeps the property&rsquo;s history together, including the previous buyer, and carries over everything
            you&rsquo;ve entered so far.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="agent-btn agent-btn-sm agent-btn-secondary" onClick={onCreateSeparate}>
          No, create a separate file
        </button>
        <button type="button" className="agent-btn agent-btn-sm agent-btn-primary" onClick={onAddNewBuyer} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowUDownLeft size={14} weight="bold" /> Add new buyer to this file
        </button>
      </Modal.Footer>
    </Modal>
  );
}
