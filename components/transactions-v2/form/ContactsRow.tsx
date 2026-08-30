"use client";

import { useRef, useEffect } from "react";
import { ContactCarousel } from "./ContactCarousel";
import { useCardSurface } from "@/lib/glass/use-card-surface";
import type { ContactEntry, MemoSource } from "@/components/transactions-v2/types";

type ContactConflict = { kind: "phone" | "email"; withName: string };

type Props = {
  vendors: ContactEntry[];
  purchasers: ContactEntry[];
  vendorMemoSource: MemoSource;
  purchaserMemoSource: MemoSource;
  isOutsourced: boolean;
  progressedBy: "agent" | "progressor";
  vendorError: string | null;
  purchaserError: string | null;
  vendorConflicts?: Record<number, ContactConflict>;
  purchaserConflicts?: Record<number, ContactConflict>;
  onVendorsChange: (v: ContactEntry[]) => void;
  onPurchasersChange: (v: ContactEntry[]) => void;
  onEdit: (field: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
};

const glassCardStyle: React.CSSProperties = { borderRadius: 16, padding: "18px" };

export function ContactsRow({
  vendors, purchasers,
  vendorMemoSource, purchaserMemoSource,
  isOutsourced, progressedBy, vendorError, purchaserError,
  vendorConflicts, purchaserConflicts,
  onVendorsChange, onPurchasersChange,
  onEdit,
  scrollRef,
}: Props) {
  const vendorSurface = useCardSurface("new-sale-vendors", "New sale · Sellers", "agent-glass-strong");
  const purchaserSurface = useCardSurface("new-sale-purchasers", "New sale · Buyers", "agent-glass-strong");
  return (
    <div ref={scrollRef} className="contacts-section-grid" style={{ gap: 12 }}>
      <div className={vendorSurface.surfaceClass} {...vendorSurface.tag} style={glassCardStyle}>
        <ContactCarousel
          label="Vendors"
          contacts={vendors}
          memoSource={vendorMemoSource}
          isOutsourced={isOutsourced}
          progressedBy={progressedBy}
          error={vendorError}
          conflicts={vendorConflicts}
          onChange={onVendorsChange}
          onEdit={() => onEdit("vendors")}
        />
      </div>
      <div className={purchaserSurface.surfaceClass} {...purchaserSurface.tag} style={glassCardStyle}>
        <ContactCarousel
          label="Purchasers"
          contacts={purchasers}
          memoSource={purchaserMemoSource}
          isOutsourced={isOutsourced}
          progressedBy={progressedBy}
          error={purchaserError}
          conflicts={purchaserConflicts}
          onChange={onPurchasersChange}
          onEdit={() => onEdit("purchasers")}
        />
      </div>
    </div>
  );
}
