"use client";

import { Buildings, CheckCircle } from "@phosphor-icons/react";
import { SolicitorPicker, type SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { type BrokerSelection } from "@/components/brokers/BrokerPicker";
import { BrokerField } from "@/components/brokers/BrokerField";
import type { MemoSource } from "@/components/transactions-v2/types";
import { FieldIndicator, FieldHint } from "./FieldIndicator";
export { autoFillSolicitor } from "@/lib/utils/solicitor-autofill";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  vendorSolicitor: SolicitorSelection | null;
  purchaserSolicitor: SolicitorSelection | null;
  onVendorChange: (v: SolicitorSelection | null) => void;
  onPurchaserChange: (v: SolicitorSelection | null) => void;
  vendorIsReferral: boolean;
  purchaserIsReferral: boolean;
  onVendorReferralChange: (v: boolean) => void;
  onPurchaserReferralChange: (v: boolean) => void;
  vendorMemoSource: MemoSource;
  purchaserMemoSource: MemoSource;
  isFillingVendor: boolean;
  isFillingPurchaser: boolean;
  vendorHint: string | null;
  purchaserHint: string | null;
  recommendedFirmIds: string[];
  broker: BrokerSelection | null;
  preferredBroker: BrokerSelection | null;
  onBrokerChange: (v: BrokerSelection | null) => void;
  brokerReferralFee: number | null;
  onBrokerReferralFeeChange: (v: number | null) => void;
  preferredBrokerDefaultFee: number | null;
  onBrokerReferredChange: (referred: boolean) => void;
  onEdit: (field: string) => void;
};

// ── Populated state card ───────────────────────────────────────────────────────

function PopulatedCard({
  solicitor,
  isReferral,
  isRecommended,
  onReferralChange,
  onClear,
  onEdit,
  editField,
}: {
  solicitor: SolicitorSelection;
  isReferral: boolean;
  isRecommended: boolean;
  onReferralChange: (v: boolean) => void;
  onClear: () => void;
  onEdit: () => void;
  editField: string;
}) {
  const contactLine = [solicitor.phone, solicitor.email].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Firm header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: "rgba(var(--agent-coral-base-rgb), 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <Buildings size={12} weight="bold" color="var(--agent-coral-deep)" />
        </div>
        <p style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--agent-text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}>
          {solicitor.firmName}
        </p>
        <button
          type="button"
          onClick={() => { onClear(); onEdit(); }}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            color: "var(--nv2-text-ghost)",
            padding: 0,
          }}
        >
          Change
        </button>
      </div>

      {/* Handler sub-card */}
      <div style={{
        background: "var(--nv2-surface-glass)",
        border: "0.5px solid var(--nv2-border-dark)",
        borderRadius: 8,
        padding: "8px 10px",
      }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)" }}>
          {solicitor.contactName ?? "No contact selected"}
        </p>
        {contactLine && (
          <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>
            {contactLine}
          </p>
        )}
      </div>

      {/* Referral checkbox */}
      {isRecommended && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={isReferral}
            onChange={(e) => { onReferralChange(e.target.checked); onEdit(); }}
            style={{ width: 13, height: 13, borderRadius: 4, accentColor: "var(--agent-coral-deep)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--agent-coral-deep)" }}>Referred by us</span>
        </label>
      )}
    </div>
  );
}

// ── Empty state wrapper ────────────────────────────────────────────────────────

function EmptyPickerWrap({ children }: { children: React.ReactNode }) {
  // The picker's own field (Option A: solid + magnifier + coral focus) is the
  // visible control now — no dashed box around it.
  return <>{children}</>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SolicitorSection({
  vendorSolicitor, purchaserSolicitor,
  onVendorChange, onPurchaserChange,
  vendorIsReferral, purchaserIsReferral,
  onVendorReferralChange, onPurchaserReferralChange,
  vendorMemoSource, purchaserMemoSource,
  isFillingVendor, isFillingPurchaser,
  vendorHint, purchaserHint,
  recommendedFirmIds,
  broker, preferredBroker, onBrokerChange,
  brokerReferralFee, onBrokerReferralFeeChange, preferredBrokerDefaultFee,
  onBrokerReferredChange,
  onEdit,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

      {/* Seller's solicitor */}
      <div>
        <p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-reading)", display: "flex", alignItems: "center", gap: 4 }}>
          Seller&rsquo;s solicitor
          {vendorSolicitor && (
            <CheckCircle size={14} weight="fill" color="var(--agent-success)" />
          )}
        </p>

        {isFillingVendor ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, paddingLeft: 2 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--agent-coral-deep)", borderTopColor: "transparent", display: "inline-block", animation: "agent-spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 12, color: "var(--nv2-text-faint)" }}>Searching…</span>
          </div>
        ) : vendorSolicitor?.contactId ? (
          <PopulatedCard
            solicitor={vendorSolicitor}
            isReferral={vendorIsReferral}
            isRecommended={recommendedFirmIds.includes(vendorSolicitor.firmId)}
            onReferralChange={onVendorReferralChange}
            onClear={() => onVendorChange(null)}
            onEdit={() => onEdit("vendorSolicitor")}
            editField="vendorSolicitor"
          />
        ) : (
          <EmptyPickerWrap>
            <SolicitorPicker
              label=""
              value={vendorSolicitor}
              onChange={(v) => { onVendorChange(v); onEdit("vendorSolicitor"); }}
            />
          </EmptyPickerWrap>
        )}

        {!isFillingVendor && !vendorSolicitor && vendorHint && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-warning)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, display: "inline-block" }} />
            <strong style={{ fontWeight: 600 }}>{vendorHint}</strong> is in the memo. Search above to add.
          </p>
        )}
        <FieldHint source={!vendorHint && !isFillingVendor ? vendorMemoSource : null} />
      </div>

      {/* Buyer's solicitor */}
      <div>
        <p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-reading)", display: "flex", alignItems: "center", gap: 4 }}>
          Buyer&rsquo;s solicitor
          {purchaserSolicitor && (
            <CheckCircle size={14} weight="fill" color="var(--agent-success)" />
          )}
        </p>

        {isFillingPurchaser ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, paddingLeft: 2 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--agent-coral-deep)", borderTopColor: "transparent", display: "inline-block", animation: "agent-spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 12, color: "var(--nv2-text-faint)" }}>Searching…</span>
          </div>
        ) : purchaserSolicitor?.contactId ? (
          <PopulatedCard
            solicitor={purchaserSolicitor}
            isReferral={purchaserIsReferral}
            isRecommended={recommendedFirmIds.includes(purchaserSolicitor.firmId)}
            onReferralChange={onPurchaserReferralChange}
            onClear={() => onPurchaserChange(null)}
            onEdit={() => onEdit("purchaserSolicitor")}
            editField="purchaserSolicitor"
          />
        ) : (
          <EmptyPickerWrap>
            <SolicitorPicker
              label=""
              value={purchaserSolicitor}
              onChange={(v) => { onPurchaserChange(v); onEdit("purchaserSolicitor"); }}
            />
          </EmptyPickerWrap>
        )}

        {!isFillingPurchaser && !purchaserSolicitor && purchaserHint && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-warning)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, display: "inline-block" }} />
            <strong style={{ fontWeight: 600 }}>{purchaserHint}</strong> is in the memo. Search above to add.
          </p>
        )}
        <FieldHint source={!purchaserHint && !isFillingPurchaser ? purchaserMemoSource : null} />
      </div>

    </div>{/* end two-column solicitor grid */}

      {/* Broker — full width below solicitors */}
      <div style={{ borderTop: "0.5px solid var(--nv2-border-dark)", paddingTop: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "var(--nv2-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 6 }}>
          Mortgage broker
          {broker?.firmId && (
            <CheckCircle size={14} weight="fill" color="var(--agent-success)" />
          )}
        </p>
        <BrokerField
          value={broker}
          onChange={(v) => { onBrokerChange(v); onEdit("broker"); }}
          preferredBroker={preferredBroker}
          referralFee={brokerReferralFee}
          onReferralFeeChange={(v) => { onBrokerReferralFeeChange(v); onEdit("brokerReferralFee"); }}
          preferredBrokerDefaultFee={preferredBrokerDefaultFee}
          onReferralChange={onBrokerReferredChange}
        />
      </div>

    </div>
  );
}
