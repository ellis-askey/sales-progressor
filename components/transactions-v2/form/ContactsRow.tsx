"use client";

import { useRef, useEffect } from "react";
import { ContactCarousel } from "./ContactCarousel";
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
  return (
    <div ref={scrollRef} className="contacts-section-grid" style={{ gap: 12 }}>
      <div className="agent-glass-strong" style={glassCardStyle}>
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
      <div className="agent-glass-strong" style={glassCardStyle}>
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
