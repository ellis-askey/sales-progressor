"use client";

import { useRef, useEffect } from "react";
import { ContactCarousel } from "./ContactCarousel";
import type { ContactEntry, MemoSource } from "@/components/transactions-v2/types";

type Props = {
  vendors: ContactEntry[];
  purchasers: ContactEntry[];
  vendorMemoSource: MemoSource;
  purchaserMemoSource: MemoSource;
  isOutsourced: boolean;
  progressedBy: "agent" | "progressor";
  vendorError: string | null;
  purchaserError: string | null;
  onVendorsChange: (v: ContactEntry[]) => void;
  onPurchasersChange: (v: ContactEntry[]) => void;
  onEdit: (field: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
};

const glassCard: React.CSSProperties = {
  borderRadius: 16,
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "0.5px solid rgba(255,255,255,0.65)",
  padding: "18px",
};

export function ContactsRow({
  vendors, purchasers,
  vendorMemoSource, purchaserMemoSource,
  isOutsourced, progressedBy, vendorError, purchaserError,
  onVendorsChange, onPurchasersChange,
  onEdit,
  scrollRef,
}: Props) {
  return (
    <div ref={scrollRef} className="contacts-section-grid" style={{ gap: 12 }}>
      <div style={glassCard}>
        <ContactCarousel
          label="Vendors"
          contacts={vendors}
          memoSource={vendorMemoSource}
          isOutsourced={isOutsourced}
          progressedBy={progressedBy}
          error={vendorError}
          onChange={onVendorsChange}
          onEdit={() => onEdit("vendors")}
        />
      </div>
      <div style={glassCard}>
        <ContactCarousel
          label="Purchasers"
          contacts={purchasers}
          memoSource={purchaserMemoSource}
          isOutsourced={isOutsourced}
          progressedBy={progressedBy}
          error={purchaserError}
          onChange={onPurchasersChange}
          onEdit={() => onEdit("purchasers")}
        />
      </div>
    </div>
  );
}
