"use client";

import { Buildings, CheckCircle } from "@phosphor-icons/react";
import { SolicitorPicker, type SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { BrokerPicker, type BrokerSelection } from "@/components/brokers/BrokerPicker";
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
  purchaseType: string;
  purchaserBrokerReferral: boolean;
  onPurchaserBrokerReferralChange: (v: boolean) => void;
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
            color: "rgba(15,23,42,0.35)",
            padding: 0,
          }}
        >
          Change
        </button>
      </div>

      {/* Handler sub-card */}
      <div style={{
        background: "rgba(255,255,255,0.75)",
        border: "0.5px solid rgba(15,23,42,0.08)",
        borderRadius: 8,
        padding: "8px 10px",
      }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)" }}>
          {solicitor.contactName ?? "No case handler selected"}
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
  return (
    <div style={{
      borderRadius: 10,
      border: "1.5px dashed rgba(15,23,42,0.12)",
      padding: "12px",
      background: "rgba(255,255,255,0.30)",
    }}>
      {children}
    </div>
  );
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
  purchaseType, purchaserBrokerReferral, onPurchaserBrokerReferralChange,
  onEdit,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

      {/* Seller's solicitor */}
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 500, color: "rgba(15,23,42,0.60)", display: "flex", alignItems: "center", gap: 4 }}>
          Seller&rsquo;s solicitor
          {vendorSolicitor && (
            <CheckCircle size={12} weight="fill" color="var(--agent-success)" />
          )}
        </p>

        {isFillingVendor ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, paddingLeft: 2 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--agent-coral-deep)", borderTopColor: "transparent", display: "inline-block", animation: "agent-spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(15,23,42,0.45)" }}>Searching for solicitor…</span>
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
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, display: "inline-block" }} />
            We found <strong style={{ fontWeight: 600 }}>{vendorHint}</strong> on the memo — search above to add
          </p>
        )}
        <FieldHint source={!vendorHint && !isFillingVendor ? vendorMemoSource : null} />
      </div>

      {/* Buyer's solicitor */}
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 500, color: "rgba(15,23,42,0.60)", display: "flex", alignItems: "center", gap: 4 }}>
          Buyer&rsquo;s solicitor
          {purchaserSolicitor && (
            <CheckCircle size={12} weight="fill" color="var(--agent-success)" />
          )}
        </p>

        {isFillingPurchaser ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, paddingLeft: 2 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--agent-coral-deep)", borderTopColor: "transparent", display: "inline-block", animation: "agent-spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(15,23,42,0.45)" }}>Searching for solicitor…</span>
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
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, display: "inline-block" }} />
            We found <strong style={{ fontWeight: 600 }}>{purchaserHint}</strong> on the memo — search above to add
          </p>
        )}
        <FieldHint source={!purchaserHint && !isFillingPurchaser ? purchaserMemoSource : null} />
      </div>

    </div>{/* end two-column solicitor grid */}

      {/* Broker — full width below solicitors */}
      <div style={{ borderTop: "0.5px solid rgba(15,23,42,0.07)", paddingTop: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.42)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 6 }}>
          Mortgage broker
          <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(15,23,42,0.32)", background: "rgba(15,23,42,0.06)", borderRadius: 4, padding: "2px 5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Optional
          </span>
          {broker?.firmId && (
            <CheckCircle size={12} weight="fill" color="var(--agent-success)" />
          )}
        </p>
        <BrokerPicker
          label=""
          value={broker}
          onChange={(v) => { onBrokerChange(v); onEdit("broker"); }}
          preferredBroker={preferredBroker}
        />

        {purchaseType === "mortgage" && broker?.firmId && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", marginTop: 10 }}>
            <input
              type="checkbox"
              checked={purchaserBrokerReferral}
              onChange={(e) => { onPurchaserBrokerReferralChange(e.target.checked); onEdit("purchaserBrokerReferral"); }}
              style={{ width: 13, height: 13, borderRadius: 4, accentColor: "var(--agent-coral-deep)", cursor: "pointer" }}
            />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--agent-coral-deep)" }}>
              Purchaser referred to {broker.firmName}
            </span>
          </label>
        )}
      </div>

    </div>
  );
}
