"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { MemoSource } from "@/components/transactions-v2/types";
import { FieldIndicator, FieldHint } from "./FieldIndicator";
import { titleCase } from "@/lib/utils";
import { formatPostcode, isValidUKPostcode } from "@/lib/utils/address";
import { useSolidMode } from "@/lib/hooks/useSolidMode";

function isLookupReady(postcode: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i.test(postcode.trim());
}

// ── Pill button ───────────────────────────────────────────────────────────────

function Pill({
  label,
  note,
  selected,
  onClick,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isSolid = useSolidMode();
  return (
    <button
      type="button"
      className="stage1-option-pill"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: note ? "12px 14px" : "10px 14px",
        borderRadius: 12,
        border: selected
          ? "2px solid var(--agent-coral-deep)"
          : hovered
          ? "2px solid var(--agent-coral)"
          : "2px solid var(--agent-border-default)",
        background: selected || hovered
          ? "var(--agent-coral-bg-tint)"
          : (isSolid ? "#ffffff" : "rgba(255,255,255,0.50)"),
        color: selected ? "var(--agent-coral-deep)" : "var(--agent-text-primary)",
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        transition: "border-color 150ms, background 150ms, color 150ms",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span>{label}</span>
      {note && (
        <span style={{ fontSize: 11, fontWeight: 400, color: selected ? "rgba(var(--agent-coral-base-rgb), 0.80)" : "var(--agent-text-secondary)" }}>
          {note}
        </span>
      )}
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center" }}>
      {children}
    </p>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MemoSrc = {
  streetAddress: MemoSource;
  city: MemoSource;
  postcode: MemoSource;
  tenure: MemoSource;
  purchaseType: MemoSource;
};

type Props = {
  streetAddress: string;
  city: string;
  postcode: string;
  tenure: "freehold" | "leasehold" | "";
  purchaseType: "mortgage" | "cash_buyer" | "cash_from_proceeds" | "";
  progressedBy: "agent" | "progressor";
  memoSources: MemoSrc;
  onStreetAddressChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onPostcodeChange: (v: string) => void;
  onTenureChange: (v: "freehold" | "leasehold") => void;
  onPurchaseTypeChange: (v: "mortgage" | "cash_buyer" | "cash_from_proceeds") => void;
  onProgressedByChange: (v: "agent" | "progressor") => void;
  onEdit: (field: string) => void;
  showContinueButton?: boolean;
  onContinue?: () => void;
  onLookup?: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function Stage1Fields({
  streetAddress, city, postcode, tenure, purchaseType, progressedBy,
  memoSources,
  onStreetAddressChange, onCityChange, onPostcodeChange,
  onTenureChange, onPurchaseTypeChange, onProgressedByChange,
  onEdit,
  showContinueButton = false,
  onContinue,
  onLookup,
}: Props) {
  const [postcodeError, setPostcodeError] = useState("");
  const [touched, setTouched] = useState({ street: false, city: false, postcode: false });

  const streetValid = touched.street && streetAddress.trim().length >= 2;
  const cityValid   = touched.city   && city.trim().length >= 1;
  const postcodeValid = touched.postcode && postcode.trim().length > 0 && isValidUKPostcode(postcode);

  return (
    <div
      className="v2-stage1-card"
      style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "0.5px solid rgba(255,255,255,0.65)",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Who progresses — first so it's always visible from the start */}
      <div>
        <SectionLabel>Who will progress this file?</SectionLabel>
        <div style={{ display: "flex", gap: 10 }}>
          <Pill
            label="Self-progress"
            note="You manage this file yourself"
            selected={progressedBy === "agent"}
            onClick={() => { onProgressedByChange("agent"); onEdit("progressedBy"); }}
          />
          <Pill
            label="Send to us"
            note="Hand off to the progression team"
            selected={progressedBy === "progressor"}
            onClick={() => { onProgressedByChange("progressor"); onEdit("progressedBy"); }}
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(15,23,42,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Property address
          </p>
          {onLookup && (
            <button
              type="button"
              onClick={onLookup}
              disabled={!isLookupReady(postcode)}
              className={isLookupReady(postcode) ? "agent-link" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", padding: 0,
                cursor: isLookupReady(postcode) ? "pointer" : "default",
                fontSize: 11, fontWeight: 600,
                color: isLookupReady(postcode) ? "var(--agent-coral-deep)" : "rgba(15,23,42,0.25)",
              }}
            >
              <MagnifyingGlass size={11} weight="bold" />
              Look up this property
            </button>
          )}
        </div>

        {/* Street address */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "rgba(15,23,42,0.60)", marginBottom: 6 }}>
            Street address
            <FieldIndicator source={memoSources.streetAddress} valid={streetValid} />
          </label>
          <input
            className="agent-input"
            value={streetAddress}
            onChange={(e) => {
              onStreetAddressChange(e.target.value);
              onEdit("streetAddress");
            }}
            onBlur={(e) => { if (e.target.value.trim()) onStreetAddressChange(titleCase(e.target.value)); setTouched(t => ({ ...t, street: true })); }}
            placeholder="e.g. 14 Hartwell Avenue"
            maxLength={120}
          />
          <FieldHint source={memoSources.streetAddress} />
        </div>

        {/* City + Postcode */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "rgba(15,23,42,0.60)", marginBottom: 6 }}>
              City / Town
              <FieldIndicator source={memoSources.city} valid={cityValid} />
            </label>
            <input
              className="agent-input"
              value={city}
              onChange={(e) => {
                onCityChange(e.target.value);
                onEdit("city");
              }}
              onBlur={(e) => { if (e.target.value.trim()) onCityChange(titleCase(e.target.value)); setTouched(t => ({ ...t, city: true })); }}
              placeholder="e.g. Bristol"
              maxLength={60}
            />
            <FieldHint source={memoSources.city} />
          </div>
          <div>
            <label style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "rgba(15,23,42,0.60)", marginBottom: 6 }}>
              Postcode
              <FieldIndicator source={memoSources.postcode} valid={postcodeValid} />
            </label>
            <input
              className="agent-input"
              value={postcode}
              onChange={(e) => {
                onPostcodeChange(e.target.value.toUpperCase());
                onEdit("postcode");
                setPostcodeError("");
              }}
              onBlur={(e) => {
                if (!e.target.value.trim()) { setPostcodeError(""); setTouched(t => ({ ...t, postcode: true })); return; }
                const formatted = formatPostcode(e.target.value);
                onPostcodeChange(formatted);
                setPostcodeError(isValidUKPostcode(formatted) ? "" : "Doesn't look like a valid UK postcode");
                setTouched(t => ({ ...t, postcode: true }));
              }}
              placeholder="e.g. BS6 7TH"
              maxLength={8}
            />
            {postcodeError && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#dc2626", fontWeight: 500 }}>{postcodeError}</p>
            )}
            <FieldHint source={memoSources.postcode} />
          </div>
        </div>
      </div>

      {/* Tenure */}
      <div>
        <SectionLabel>
          Tenure
          <FieldIndicator source={memoSources.tenure} />
        </SectionLabel>
        <div style={{ display: "flex", gap: 10 }}>
          <Pill
            label="Freehold"
            note="Management pack not required"
            selected={tenure === "freehold"}
            onClick={() => { onTenureChange("freehold"); onEdit("tenure"); }}
          />
          <Pill
            label="Leasehold"
            note="Management pack required"
            selected={tenure === "leasehold"}
            onClick={() => { onTenureChange("leasehold"); onEdit("tenure"); }}
          />
        </div>
        <FieldHint source={memoSources.tenure} />
      </div>

      {/* Purchase type */}
      <div>
        <SectionLabel>
          Purchase type
          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400, color: "rgba(15,23,42,0.38)", textTransform: "none", letterSpacing: 0 }}>
            not on memos
          </span>
        </SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Pill
            label="Mortgage"
            note="All mortgage steps apply"
            selected={purchaseType === "mortgage"}
            onClick={() => { onPurchaseTypeChange("mortgage"); onEdit("purchaseType"); }}
          />
          <Pill
            label="Cash"
            note="Mortgage steps not required"
            selected={purchaseType === "cash_buyer"}
            onClick={() => { onPurchaseTypeChange("cash_buyer"); onEdit("purchaseType"); }}
          />
          <Pill
            label="Cash from Proceeds"
            note="Mortgage + deposit not required"
            selected={purchaseType === "cash_from_proceeds"}
            onClick={() => { onPurchaseTypeChange("cash_from_proceeds"); onEdit("purchaseType"); }}
          />
        </div>
      </div>

      {/* Continue button — manual mode only, shows when Stage 1 is valid */}
      {showContinueButton && (
        <div style={{ paddingTop: 4 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "rgba(15,23,42,0.38)", textAlign: "center", lineHeight: 1.5 }}>
            That&rsquo;s enough to create the file — continue to add contacts and details
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="agent-btn-color-primary"
            style={{ width: "100%", padding: "12px", borderRadius: 12, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            Continue — add contacts &amp; details
          </button>
        </div>
      )}
    </div>
  );
}
