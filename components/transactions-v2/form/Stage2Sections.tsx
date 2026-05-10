"use client";

import { useRef, useEffect } from "react";
import type { MemoSources, ContactEntry } from "@/components/transactions-v2/types";
import type { FormFields, SolicitorSelection, InMemoryStub } from "./types";
import type { StubFormData } from "@/components/chain/AddNodeDrawer";
import { ContactsRow } from "./ContactsRow";
import { SolicitorSection } from "./SolicitorSection";
import { PriceFeesSection } from "./PriceFeesSection";
import { NotesSection } from "./NotesSection";
import { FormChainSection } from "./FormChainSection";
import { SectionAccordion } from "./SectionAccordion";
import { CollapsibleSection } from "./CollapsibleSection";
import { OutsourcedBanner } from "./OutsourcedBanner";
import { PortalInvitePrompt } from "./PortalInvitePrompt";

function Section({ delayMs, zIndex, children }: { delayMs: number; zIndex?: number; children: React.ReactNode }) {
  return (
    <div style={{
      animation: `agent-section-in 360ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) ${delayMs}ms both`,
      willChange: "transform, opacity",
      ...(zIndex != null ? { position: "relative" as const, zIndex } : {}),
    }}>
      {children}
    </div>
  );
}

// ── Summary formatters ─────────────────────────────────────────────────────────

function priceSummary(fields: FormFields): string {
  const price = fields.purchasePricePence;
  const feeType = fields.agentFeeType;
  const feeAmount = fields.agentFeeAmount;
  const feePct = fields.agentFeePercentStr;
  const vat = fields.agentFeeVat === "exclusive" ? " + VAT" : " inc. VAT";

  if (!price && !feeAmount && !feePct) return "Set price and fees";

  const parts: string[] = [];

  if (price) {
    parts.push("£" + Math.round(price / 100).toLocaleString("en-GB"));
  }

  if (feeType === "amount" && feeAmount != null) {
    parts.push("£" + Math.round(feeAmount / 100).toLocaleString("en-GB") + " fee" + vat);
  } else if (feeType === "percent" && feePct) {
    parts.push(feePct + "% fee" + vat);
  } else if (price) {
    parts.push("No fee set");
  }

  if (fields.referralFee != null && fields.referralFee > 0) {
    parts.push("with referral");
  }

  return parts.join(" · ") || "Set price and fees";
}

function notesSummary(notes: string): string {
  const trimmed = notes.trim();
  if (!trimmed) return "Add any context about this transaction";
  return trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed;
}

function chainSummary(stubs: InMemoryStub[]): string {
  if (stubs.length === 0) return "Add chain (optional)";
  return `${stubs.length} link${stubs.length !== 1 ? "s" : ""} added`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  fields: FormFields;
  memoSources: MemoSources;
  onChange: (updates: Partial<FormFields>) => void;
  onEdit: (field: string) => void;
  startDelay?: number;
  isOutsourced: boolean;
  vendorError: string | null;
  purchaserError: string | null;
  isFillingVendorSolicitor: boolean;
  isFillingPurchaserSolicitor: boolean;
  vendorSolicitorHint: string | null;
  purchaserSolicitorHint: string | null;
  recommendedFirms: { id: string; defaultReferralFeePence: number | null }[];
  preferredBroker: import("@/components/brokers/BrokerPicker").BrokerSelection | null;
  preferredBrokerDefaultFee: number | null;
};

export function Stage2Sections({
  fields, memoSources, onChange, onEdit,
  startDelay = 0,
  isOutsourced, vendorError, purchaserError,
  isFillingVendorSolicitor, isFillingPurchaserSolicitor,
  vendorSolicitorHint, purchaserSolicitorHint,
  recommendedFirms, preferredBroker, preferredBrokerDefaultFee,
}: Props) {
  const recommendedFirmIds = recommendedFirms.map((f) => f.id);
  const originatorAddress = [fields.streetAddress, fields.city, fields.postcode].filter(Boolean).join(", ");
  const contactsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vendorError && !purchaserError) return;
    contactsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [vendorError, purchaserError]);

  function ms(n: number) { return (startDelay + n) * 80; }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>

      {/* Outsourced banner (progressor mode only) */}
      {isOutsourced && (
        <Section delayMs={ms(0)}>
          <OutsourcedBanner />
        </Section>
      )}

      {/* Portal-invite prompt (self-progress mode only) */}
      {!isOutsourced && (
        <Section delayMs={ms(0)}>
          <PortalInvitePrompt />
        </Section>
      )}

      {/* 1 — Contacts (two-column) */}
      <Section delayMs={ms(1)}>
        <ContactsRow
          scrollRef={contactsRef}
          vendors={fields.vendors}
          purchasers={fields.purchasers}
          vendorMemoSource={memoSources.vendors}
          purchaserMemoSource={memoSources.purchasers}
          isOutsourced={isOutsourced}
          progressedBy={fields.progressedBy}
          vendorError={vendorError}
          purchaserError={purchaserError}
          onVendorsChange={(v: ContactEntry[]) => { onChange({ vendors: v }); onEdit("vendors"); }}
          onPurchasersChange={(v: ContactEntry[]) => { onChange({ purchasers: v }); onEdit("purchasers"); }}
          onEdit={onEdit}
        />
      </Section>

      {/* 2 — Solicitors & Broker (expanded by default) */}
      <Section delayMs={ms(2)} zIndex={10}>
        <SectionAccordion title="Solicitors & Broker" defaultExpanded>
          <SolicitorSection
            vendorSolicitor={fields.vendorSolicitor}
            purchaserSolicitor={fields.purchaserSolicitor}
            onVendorChange={(v: SolicitorSelection | null) => { onChange({ vendorSolicitor: v }); onEdit("vendorSolicitor"); }}
            onPurchaserChange={(v: SolicitorSelection | null) => { onChange({ purchaserSolicitor: v }); onEdit("purchaserSolicitor"); }}
            vendorIsReferral={fields.vendorIsReferral}
            purchaserIsReferral={fields.purchaserIsReferral}
            onVendorReferralChange={(v) => {
              const defaultFee = v
                ? (recommendedFirms.find((f) => f.id === fields.vendorSolicitor?.firmId)?.defaultReferralFeePence ?? null)
                : null;
              onChange({ vendorIsReferral: v, referralFee: defaultFee });
              onEdit("vendorIsReferral");
            }}
            onPurchaserReferralChange={(v) => {
              const defaultFee = v
                ? (recommendedFirms.find((f) => f.id === fields.purchaserSolicitor?.firmId)?.defaultReferralFeePence ?? null)
                : null;
              onChange({ purchaserIsReferral: v, referralFee: defaultFee });
              onEdit("purchaserIsReferral");
            }}
            vendorMemoSource={memoSources.vendorSolicitor}
            purchaserMemoSource={memoSources.purchaserSolicitor}
            isFillingVendor={isFillingVendorSolicitor}
            isFillingPurchaser={isFillingPurchaserSolicitor}
            vendorHint={vendorSolicitorHint}
            purchaserHint={purchaserSolicitorHint}
            recommendedFirmIds={recommendedFirmIds}
            broker={fields.broker}
            preferredBroker={preferredBroker}
            onBrokerChange={(v) => {
              const defaultFee = v && preferredBroker?.firmId === v.firmId
                ? preferredBrokerDefaultFee
                : null;
              onChange({ broker: v, brokerReferralFee: defaultFee });
              onEdit("broker");
            }}
            purchaseType={fields.purchaseType}
            purchaserBrokerReferral={fields.purchaserBrokerReferral}
            onPurchaserBrokerReferralChange={(v) => {
              onChange({ purchaserBrokerReferral: v });
              onEdit("purchaserBrokerReferral");
            }}
            onEdit={onEdit}
          />
        </SectionAccordion>
      </Section>

      {/* 3 — Price & Fees (collapsed by default) */}
      <Section delayMs={ms(3)}>
        <CollapsibleSection title="Price & Fees" summary={priceSummary(fields)}>
          <PriceFeesSection
            purchasePricePence={fields.purchasePricePence}
            priceMemoSource={memoSources.purchasePricePence}
            agentFeeType={fields.agentFeeType}
            agentFeeAmount={fields.agentFeeAmount}
            agentFeePercentStr={fields.agentFeePercentStr}
            agentFeeVat={fields.agentFeeVat}
            agentFeeMemoSource={memoSources.agentFee}
            referralFee={fields.referralFee}
            brokerReferralFee={fields.brokerReferralFee}
            onPurchasePriceChange={(v) => { onChange({ purchasePricePence: v }); onEdit("purchasePricePence"); }}
            onAgentFeeTypeChange={(v) => { onChange({ agentFeeType: v }); onEdit("agentFeeType"); }}
            onAgentFeeAmountChange={(v) => { onChange({ agentFeeAmount: v }); onEdit("agentFeeAmount"); }}
            onAgentFeePercentStrChange={(v) => { onChange({ agentFeePercentStr: v }); onEdit("agentFeePercentStr"); }}
            onAgentFeeVatChange={(v) => { onChange({ agentFeeVat: v }); onEdit("agentFeeVat"); }}
            onEdit={onEdit}
          />
        </CollapsibleSection>
      </Section>

      {/* 4 — Notes (collapsed by default) */}
      <Section delayMs={ms(4)}>
        <CollapsibleSection title="Notes" summary={notesSummary(fields.notes)}>
          <NotesSection
            notes={fields.notes}
            onNotesChange={(v) => { onChange({ notes: v }); onEdit("notes"); }}
          />
        </CollapsibleSection>
      </Section>

      {/* 5 — Chain (collapsed by default) */}
      <Section delayMs={ms(5)}>
        <CollapsibleSection title="Chain" summary={chainSummary(fields.chainStubs)}>
          <FormChainSection
            stubs={fields.chainStubs}
            expanded={fields.chainExpanded}
            originatorAddress={originatorAddress}
            onExpand={() => onChange({ chainExpanded: true })}
            onCollapse={() => onChange({ chainExpanded: false, chainStubs: [] })}
            onAddStub={(stub: InMemoryStub) => onChange({ chainStubs: [...fields.chainStubs, stub] })}
            onEditStub={(id: string, data: StubFormData) =>
              onChange({ chainStubs: fields.chainStubs.map((s) => (s.id === id ? { ...s, ...data } : s)) })
            }
            onRemoveStub={(id: string) =>
              onChange({ chainStubs: fields.chainStubs.filter((s) => s.id !== id) })
            }
          />
        </CollapsibleSection>
      </Section>

    </div>
  );
}
