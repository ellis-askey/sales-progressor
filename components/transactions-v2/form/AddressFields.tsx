"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { MemoSource } from "@/components/transactions-v2/types";
import { FieldIndicator, FieldHint } from "./FieldIndicator";
import { titleCase } from "@/lib/utils";
import { formatPostcode, isValidUKPostcode } from "@/lib/utils/address";

function isLookupReady(postcode: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i.test(postcode.trim());
}

type AddressMemoSources = {
  streetAddress: MemoSource;
  city: MemoSource;
  postcode: MemoSource;
};

type Props = {
  streetAddress: string;
  city: string;
  postcode: string;
  onStreetAddressChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onPostcodeChange: (v: string) => void;
  // Optional adornments (new-sale-only):
  memoSources?: AddressMemoSources;
  onEdit?: (field: string) => void;
  onLookup?: () => void;
};

export function AddressFields({
  streetAddress,
  city,
  postcode,
  onStreetAddressChange,
  onCityChange,
  onPostcodeChange,
  memoSources,
  onEdit,
  onLookup,
}: Props) {
  const [postcodeError, setPostcodeError] = useState("");
  const [touched, setTouched] = useState({ street: false, city: false, postcode: false });

  const streetValid = touched.street && streetAddress.trim().length >= 2;
  const cityValid = touched.city && city.trim().length >= 1;
  const postcodeValid = touched.postcode && postcode.trim().length > 0 && isValidUKPostcode(postcode);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--nv2-text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
              color: isLookupReady(postcode) ? "var(--agent-coral-deep)" : "var(--nv2-text-ghost)",
            }}
          >
            <MagnifyingGlass size={11} weight="bold" />
            Look up this property
          </button>
        )}
      </div>

      {/* Street address */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-reading)", marginBottom: 6 }}>
          Street address
          {memoSources && <FieldIndicator source={memoSources.streetAddress} valid={streetValid} />}
        </label>
        <input
          className="agent-input"
          value={streetAddress}
          onChange={(e) => {
            onStreetAddressChange(e.target.value);
            onEdit?.("streetAddress");
          }}
          onBlur={(e) => {
            if (e.target.value.trim()) onStreetAddressChange(titleCase(e.target.value));
            setTouched((t) => ({ ...t, street: true }));
          }}
          placeholder="e.g. 14 Hartwell Avenue"
          maxLength={120}
        />
        {memoSources && <FieldHint source={memoSources.streetAddress} />}
      </div>

      {/* City + Postcode */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-reading)", marginBottom: 6 }}>
            City / Town
            {memoSources && <FieldIndicator source={memoSources.city} valid={cityValid} />}
          </label>
          <input
            className="agent-input"
            value={city}
            onChange={(e) => {
              onCityChange(e.target.value);
              onEdit?.("city");
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) onCityChange(titleCase(e.target.value));
              setTouched((t) => ({ ...t, city: true }));
            }}
            placeholder="e.g. Bristol"
            maxLength={60}
          />
          {memoSources && <FieldHint source={memoSources.city} />}
        </div>
        <div>
          <label style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-reading)", marginBottom: 6 }}>
            Postcode
            {memoSources && <FieldIndicator source={memoSources.postcode} valid={postcodeValid} />}
          </label>
          <input
            className="agent-input"
            value={postcode}
            onChange={(e) => {
              onPostcodeChange(e.target.value.toUpperCase());
              onEdit?.("postcode");
              setPostcodeError("");
            }}
            onBlur={(e) => {
              if (!e.target.value.trim()) { setPostcodeError(""); setTouched((t) => ({ ...t, postcode: true })); return; }
              const formatted = formatPostcode(e.target.value);
              onPostcodeChange(formatted);
              setPostcodeError(isValidUKPostcode(formatted) ? "" : "Doesn't look like a valid UK postcode");
              setTouched((t) => ({ ...t, postcode: true }));
            }}
            placeholder="e.g. BS6 7TH"
            maxLength={8}
          />
          {postcodeError && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#dc2626", fontWeight: 500 }}>{postcodeError}</p>
          )}
          {memoSources && <FieldHint source={memoSources.postcode} />}
        </div>
      </div>
    </div>
  );
}

// Reverse-parse helper for EDIT mode only — extracts street / city / postcode
// from a combined string. NEW stubs start with empty fields and don't call this.
//
// Strategy:
//   1. Comma-split. ≥3 parts → street / city / postcode clean.
//   2. <3 parts → regex-detect postcode on trailing tokens (last two, then last one).
//      If found, postcode field gets it, remainder → street, city blank.
//   3. No postcode detectable → whole string → street, city + postcode blank.
export function parseAddressForEdit(combined: string | null | undefined): {
  streetAddress: string;
  city: string;
  postcode: string;
} {
  if (!combined || !combined.trim()) {
    return { streetAddress: "", city: "", postcode: "" };
  }

  const commaParts = combined.split(",").map((t) => t.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    return {
      streetAddress: commaParts.slice(0, -2).join(", "),
      city: commaParts[commaParts.length - 2],
      postcode: commaParts[commaParts.length - 1],
    };
  }

  const tokens = combined.trim().split(/\s+/);
  if (tokens.length >= 3) {
    const lastTwo = tokens.slice(-2).join(" ");
    if (isValidUKPostcode(lastTwo)) {
      return { streetAddress: tokens.slice(0, -2).join(" "), city: "", postcode: lastTwo };
    }
  }
  if (tokens.length >= 2) {
    const lastOne = tokens[tokens.length - 1];
    const reformatted = formatPostcode(lastOne);
    if (isValidUKPostcode(reformatted)) {
      return { streetAddress: tokens.slice(0, -1).join(" "), city: "", postcode: reformatted };
    }
  }

  return { streetAddress: combined, city: "", postcode: "" };
}
