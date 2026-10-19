"use client";

import { useRef, useEffect, useState } from "react";
import type { MemoSources, ContactEntry } from "@/components/transactions-v2/types";
import type { FormFields, SolicitorSelection } from "./types";
import { ContactsRow } from "./ContactsRow";
import { SolicitorSection } from "./SolicitorSection";
import { SectionAccordion } from "./SectionAccordion";
import { OutsourcedBanner } from "./OutsourcedBanner";
import { PortalInvitePrompt } from "./PortalInvitePrompt";

function Section({ delayMs, zIndex, children }: { delayMs: number; zIndex?: number; children: React.ReactNode }) {
  // Once the entrance animation ends, drop the animation + will-change so this
  // wrapper stops being a backdrop root — otherwise it severs descendant glass
  // cards' backdrop-filter from the fixed WebGL background (no frost). 2026-08-10.
  const [settled, setSettled] = useState(false);
  return (
    <div
      onAnimationEnd={() => setSettled(true)}
      style={{
        ...(settled
          ? {}
          : {
              animation: `agent-section-in 360ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) ${delayMs}ms both`,
              willChange: "transform, opacity",
            }),
        ...(zIndex != null ? { position: "relative" as const, zIndex } : {}),
      }}
    >
      {children}
    </div>
  );
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
  // True only when an agency user is adding the sale — gates the broker
  // recommended/referral opt-in (hidden for a sales progression company).
  canSaveToPartners: boolean;
  // Server-resolved one-shot gate for the portal-invite prompt. False after
  // the agent's first added sale OR after they've clicked the prompt once.
  showPortalPrompt: boolean;
  // Per-card phone/email duplication conflicts (keyed by card index)
  // computed by NewSaleFlow via mapPairwiseConflicts. Drives the inline
  // error message under the conflicting field and the amber-dot on the
  // conflicting tab pill.
  vendorConflicts?: Record<number, { kind: "phone" | "email"; withName: string }>;
  purchaserConflicts?: Record<number, { kind: "phone" | "email"; withName: string }>;
  // Outsourced banner wording: who's handling the sale. A named external
  // progressor is used verbatim ("{name} is handling this sale"); otherwise it
  // falls back to "Your progressor" (external, not yet picked) or "Our team" (TSP).
  progressorName?: string | null;
  hasExternalProgressor?: boolean;
  // Multi-progressor agency: the per-sale picker above already names who's
  // handling the sale, and the seller/buyer ask is covered by the contact cards
  // below, so the outsourced banner is suppressed to avoid repetition.
  multiProgressor?: boolean;
};

export function Stage2Sections({
  fields, memoSources, onChange, onEdit,
  startDelay = 0,
  isOutsourced, vendorError, purchaserError,
  isFillingVendorSolicitor, isFillingPurchaserSolicitor,
  vendorSolicitorHint, purchaserSolicitorHint,
  recommendedFirms, preferredBroker, preferredBrokerDefaultFee, canSaveToPartners,
  showPortalPrompt,
  vendorConflicts,
  purchaserConflicts,
  progressorName = null,
  hasExternalProgressor = false,
  multiProgressor = false,
}: Props) {
  const recommendedFirmIds = recommendedFirms.map((f) => f.id);
  const contactsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vendorError && !purchaserError) return;
    contactsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [vendorError, purchaserError]);

  function ms(n: number) { return (startDelay + n) * 80; }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>

      {/* The self-progress umbrella line now lives at the top of the form
          column (RequiredPrompt in NewSaleFlow), so it can also guide the
          required fields during stage 1. */}

      {/* Outsourced banner (progressor mode only). Hidden for a multi-progressor
          agency: the per-sale picker above already names who's handling it, and
          the seller/buyer ask is covered by the contact cards below. */}
      {isOutsourced && !multiProgressor && (
        <Section delayMs={ms(0)}>
          <OutsourcedBanner progressorName={progressorName} hasExternalProgressor={hasExternalProgressor} />
        </Section>
      )}

      {/* Portal-invite prompt (self-progress mode only, and one-shot:
          server gate is the agent's first added sale + never-clicked) */}
      {!isOutsourced && showPortalPrompt && (
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
          vendorConflicts={vendorConflicts}
          purchaserConflicts={purchaserConflicts}
          onVendorsChange={(v: ContactEntry[]) => { onChange({ vendors: v }); onEdit("vendors"); }}
          onPurchasersChange={(v: ContactEntry[]) => { onChange({ purchasers: v }); onEdit("purchasers"); }}
          onEdit={onEdit}
        />
      </Section>

      {/* 2 — Solicitors & Broker (expanded by default) */}
      <Section delayMs={ms(2)} zIndex={10}>
        <SectionAccordion title="Solicitors & Broker" defaultExpanded glassId="new-sale-solicitors" glassLabel="New sale · Solicitors & Broker">
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
              // Just record the broker on the file (professionals section).
              // Whether it's the agency's referral is a separate signal below.
              onChange({ broker: v });
              onEdit("broker");
            }}
            brokerReferralFee={fields.brokerReferralFee}
            onBrokerReferralFeeChange={(v) => onChange({ brokerReferralFee: v })}
            preferredBrokerDefaultFee={preferredBrokerDefaultFee}
            onBrokerReferredChange={(referred) => onChange({ purchaserBrokerReferral: referred })}
            canSaveToPartners={canSaveToPartners}
            showOnwardBroker={fields.chainStubs.some((s) => s.direction === "above")}
            onwardBroker={fields.onwardBroker}
            onOnwardBrokerChange={(v) => { onChange({ onwardBroker: v }); onEdit("onwardBroker"); }}
            onwardBrokerReferralFee={fields.onwardBrokerReferralFee}
            onOnwardBrokerReferralFeeChange={(v) => onChange({ onwardBrokerReferralFee: v })}
            onOnwardBrokerReferredChange={(referred) => onChange({ onwardBrokerReferral: referred })}
            onEdit={onEdit}
          />
        </SectionAccordion>
      </Section>

      {/* Price & Fees moved to the right-column earnings builder (EarningsBuilder). */}
      {/* Notes moved to the right column, under the File worth / Sold prices tabs. */}
      {/* Chain lifted to a full-width "builder + live map" card below the two
          columns — see NewSaleFlow (with the auto-open logic that used to live
          here). */}

    </div>
  );
}
