"use client";

import { useState, useEffect, useTransition } from "react";
import { Scales, Phone, ChatCircleText, EnvelopeSimple } from "@phosphor-icons/react";
import { SolicitorPicker, type SolicitorSelection } from "./SolicitorPicker";
import { saveSolicitorsAction } from "@/app/actions/transactions";
import { PriceInput } from "@/components/ui/PriceInput";
import { SavingPulse } from "@/components/ui/SavingPulse";
import { GlassCard } from "@/components/glass/GlassCard";

type SolicitorIntel = {
  totalFiles: number;
  completedFiles: number;
  avgWeeksToExchange: number | null;
  avgDaysSearches: number | null;
  rating: "fast" | "average" | "slow" | "unknown";
  warning: string | null;
};

type SolicitorInfo = {
  firm: { id: string; name: string } | null;
  contact: { id: string; name: string; phone: string | null; email: string | null } | null;
};

type RecommendedFirm = {
  id: string;
  name: string;
  defaultReferralFeePence: number | null;
};

type ReferralData = { firmId: string; fee: number | null } | null;

type Props = {
  transactionId: string;
  vendor: SolicitorInfo;
  purchaser: SolicitorInfo;
  recommendedFirms?: RecommendedFirm[];
  referredFirmId?: string | null;
  referralFee?: number | null;
  address?: string;
  contacts?: Array<{ name: string; roleType: string }>;
};

function toSelection(info: SolicitorInfo): SolicitorSelection | null {
  if (!info.firm) return null;
  return {
    firmId: info.firm.id,
    firmName: info.firm.name,
    contactId: info.contact?.id ?? null,
    contactName: info.contact?.name ?? null,
    phone: info.contact?.phone ?? null,
    email: info.contact?.email ?? null,
  };
}

function getFirmInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 2 && w !== "&");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function solicitorEmailSubject(address: string, clientNames: string[]): string {
  if (clientNames.length === 0) return `Sale of ${address} - Sale Progression`;
  const joined =
    clientNames.length === 1
      ? clientNames[0]
      : clientNames.slice(0, -1).join(", ") + " & " + clientNames[clientNames.length - 1];
  return `Sale of ${address} - Clients: ${joined}`;
}

const INTEL_PILL: Record<string, { bg: string; color: string }> = {
  fast:    { bg: "rgba(16,185,129,.1)", color: "#059669" },
  average: { bg: "rgba(15,23,42,.06)",  color: "var(--agent-text-muted)" },
  slow:    { bg: "rgba(239,68,68,.1)",  color: "#dc2626" },
  unknown: { bg: "rgba(15,23,42,.06)",  color: "var(--agent-text-muted)" },
};

const RATING_LABEL: Record<string, string> = {
  fast: "Fast", average: "Average", slow: "Slow", unknown: "—",
};

function SolicitorIntelChips({ firmId }: { firmId: string }) {
  const [intel, setIntel] = useState<SolicitorIntel | null>(null);

  useEffect(() => {
    fetch(`/api/solicitor-intel?firmId=${firmId}`)
      .then((r) => r.json())
      .then(setIntel)
      .catch(() => {});
  }, [firmId]);

  if (!intel || intel.totalFiles === 0) return null;

  // 2026-07-07 fix: drop the leading em-dash from the "unknown" rating -
  // when there's no rating yet, we just show file count + avg weeks. The
  // rating label only joins the chip if it's a real rating (fast /
  // average / slow).
  const ratingLabel = intel.rating === "unknown" ? null : RATING_LABEL[intel.rating];
  const parts = [
    ratingLabel,
    `${intel.totalFiles} file${intel.totalFiles !== 1 ? "s" : ""}`,
    intel.avgWeeksToExchange !== null ? `Avg ${intel.avgWeeksToExchange}w` : null,
  ].filter(Boolean).join(" · ");
  const pill = intel.rating === "unknown"
    ? INTEL_PILL.unknown
    : (INTEL_PILL[intel.rating] ?? INTEL_PILL.unknown);

  return (
    <div className="agent-reveal-in" style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
      <span style={{
        fontSize: 10,
        fontWeight: 500,
        borderRadius: 4,
        padding: "2px 7px",
        alignSelf: "flex-start",
        ...pill,
      }}>{parts}</span>
      {intel.warning && (
        <span style={{
          fontSize: 10,
          color: "#b45309",
          background: "rgba(245,158,11,.10)",
          border: "0.5px solid rgba(245,158,11,.25)",
          borderRadius: 4,
          padding: "2px 7px",
          alignSelf: "flex-start",
        }}>{intel.warning}</span>
      )}
    </div>
  );
}

// Role pill colours - mirrors ContactsSection.tsx so vendor/purchaser
// solicitor tiles read as a family with the contacts card above.
const ROLE_TILE_STYLE: Record<"vendor" | "purchaser", { pillBg: string; pillColor: string; avatarBg: string; avatarColor: string }> = {
  vendor: {
    pillBg: "rgba(var(--agent-coral-rgb), 0.12)",
    pillColor: "var(--agent-coral-deep)",
    avatarBg: "rgba(var(--agent-coral-rgb), 0.14)",
    avatarColor: "var(--agent-coral-deep)",
  },
  purchaser: {
    pillBg: "rgba(59, 130, 246, 0.12)",
    pillColor: "#1d4ed8",
    avatarBg: "rgba(59, 130, 246, 0.14)",
    avatarColor: "#1d4ed8",
  },
};

// Small square icon-button used for the phone/email/whatsapp actions on
// each solicitor tile. Same shape + tokens as the ContactsSection grid
// tile so the two cards visually match.
const solicitorTileIconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 7,
  background: "rgba(15, 23, 42, 0.04)",
  color: "var(--agent-text-secondary)",
  textDecoration: "none",
  transition: "background 140ms ease",
};

function SolicitorTile({
  side,
  info,
  recommendedFirms,
  address,
  clientNames,
  referralFee,
  showReferralFee,
  onChange,
  onRemove,
}: {
  side: "vendor" | "purchaser";
  info: SolicitorInfo;
  recommendedFirms?: RecommendedFirm[];
  address?: string;
  clientNames?: string[];
  // Referral fee (in pence) - only rendered when showReferralFee=true.
  // Passed through unconditionally so the caller controls when it applies.
  referralFee?: number | null;
  showReferralFee?: boolean;
  onChange: (v: SolicitorSelection | null, referral: ReferralData) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [draft, setDraft] = useState<SolicitorSelection | null>(toSelection(info));
  const [referralFeeDraft, setReferralFeeDraft] = useState<number | null>(null);

  const selectedRecommended = draft?.firmId
    ? (recommendedFirms ?? []).find((f) => f.id === draft.firmId) ?? null
    : null;

  function openEdit() {
    setEditing(true);
    setExiting(false);
  }

  function closeEdit() {
    setExiting(true);
    setTimeout(() => {
      setEditing(false);
      setExiting(false);
      setDraft(toSelection(info));
      setReferralFeeDraft(null);
    }, 150);
  }

  function handlePickerChange(sel: SolicitorSelection | null) {
    setDraft(sel);
    if (sel?.firmId) {
      const rec = (recommendedFirms ?? []).find((f) => f.id === sel.firmId);
      setReferralFeeDraft(rec?.defaultReferralFeePence ?? null);
    } else {
      setReferralFeeDraft(null);
    }
  }

  function handleSave() {
    const referral: ReferralData = selectedRecommended
      ? { firmId: selectedRecommended.id, fee: referralFeeDraft }
      : null;
    onChange(draft, referral);
    setExiting(true);
    setTimeout(() => {
      setEditing(false);
      setExiting(false);
    }, 150);
  }

  const tileTone = ROLE_TILE_STYLE[side];
  const roleLabel = side === "vendor" ? "Vendor" : "Purchaser";

  const emailHref =
    info.contact?.email && address
      ? `mailto:${info.contact.email}?subject=${encodeURIComponent(solicitorEmailSubject(address, clientNames ?? []))}`
      : info.contact?.email
      ? `mailto:${info.contact.email}`
      : null;

  const tileWrapperStyle: React.CSSProperties = {
    border: "0.5px solid var(--agent-border-default)",
    borderRadius: 12,
    background: "var(--agent-surface-elevated)",
    overflow: "hidden",
    // Expand to full width when editing so the picker + save row fit.
    gridColumn: editing || exiting ? "1 / -1" : "auto",
  };

  // Empty tile - no firm assigned yet
  if (!info.firm && !editing && !exiting) {
    return (
      <div style={tileWrapperStyle}>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 500,
              borderRadius: 4, padding: "1px 6px",
              background: tileTone.pillBg, color: tileTone.pillColor,
            }}>
              {roleLabel} solicitor
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic" }}>
            No {side} solicitor yet
          </p>
          <div>
            <button type="button" onClick={openEdit} className="agent-link" style={{ fontSize: 12, fontWeight: 500 }}>
              + Add {side} solicitor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={tileWrapperStyle}>
      {/* Display view - shown when NOT editing */}
      {info.firm && !editing && !exiting && (
        <div style={{ padding: "14px 16px" }}>
          {/* Header row: avatar + firm name + role pill */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
            <div
              className="agent-avatar agent-avatar-sm"
              style={{
                flexShrink: 0,
                background: tileTone.avatarBg,
                color: tileTone.avatarColor,
              }}
            >
              {getFirmInitials(info.firm.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{info.firm.name}</span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 10, fontWeight: 500,
                  borderRadius: 4, padding: "1px 6px",
                  background: tileTone.pillBg, color: tileTone.pillColor,
                }}>
                  {roleLabel}
                </span>
              </div>
              {info.contact && (
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
                  {info.contact.name}
                </p>
              )}
              <SolicitorIntelChips firmId={info.firm.id} />
              {showReferralFee && referralFee != null && (
                <span style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: 10, fontWeight: 500,
                  borderRadius: 4, padding: "2px 7px",
                  background: "rgba(16,185,129,0.12)",
                  color: "#059669",
                }}>
                  Referral £{(referralFee / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>

          {/* Contact-method rows - same pattern as ContactsSection tile:
              text on the left, action icons on the right. Only render a
              row when its target field exists. */}
          {(info.contact?.phone || info.contact?.email) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {info.contact?.phone && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{
                    fontSize: 12, color: "var(--agent-text-secondary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    minWidth: 0, flex: 1,
                  }}>{info.contact.phone}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <a href={`tel:${info.contact.phone.replace(/\s/g, "")}`} title="Call" style={solicitorTileIconBtnStyle}>
                      <Phone size={14} weight="regular" />
                    </a>
                    <a href={`https://wa.me/${info.contact.phone.replace(/[^\d]/g, "")}`} title="WhatsApp" style={solicitorTileIconBtnStyle}>
                      <ChatCircleText size={14} weight="regular" />
                    </a>
                  </span>
                </div>
              )}
              {emailHref && info.contact?.email && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{
                    fontSize: 12, color: "var(--agent-text-secondary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    minWidth: 0, flex: 1,
                  }}>{info.contact.email}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <a href={emailHref} title="Email" style={solicitorTileIconBtnStyle}>
                      <EnvelopeSimple size={14} weight="regular" />
                    </a>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bottom: Edit link, right-aligned. Remove lives inside the
              edit form's action row (below), matching the pattern where
              destructive actions sit inside their editing context. */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={openEdit}
              className="agent-link"
              style={{
                fontSize: 12, fontWeight: 500,
                color: "var(--agent-coral-deep)",
                background: "transparent", border: "none", padding: 0,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Edit form - shown when editing. Spans full width (via
          gridColumn: 1 / -1 on the wrapper). Save / Cancel / Remove
          actions live at the bottom of the form so Remove is
          discoverable from within the editing context, not duplicated
          as a separate tile-level control. */}
      {(editing || exiting) && (
        <div
          className={exiting ? "agent-reveal-out" : "agent-reveal-in"}
          style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 500,
              borderRadius: 4, padding: "1px 6px",
              background: tileTone.pillBg, color: tileTone.pillColor,
            }}>
              {roleLabel} solicitor
            </span>
          </div>
          <SolicitorPicker
            label=""
            value={draft}
            onChange={handlePickerChange}
            onFirmCreated={(sel) => {
              setDraft(sel);
              setReferralFeeDraft(null);
              onChange(sel, null);
              setExiting(true);
              setTimeout(() => {
                setEditing(false);
                setExiting(false);
              }, 150);
            }}
          />
          {selectedRecommended && (
            <div>
              <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">Referral fee</label>
              <PriceInput value={referralFeeDraft} onChange={setReferralFeeDraft} variant="referral" placeholder="0" />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={closeEdit} className="agent-btn agent-btn-xs agent-btn-ghost-bordered">Cancel</button>
              <button type="button" onClick={handleSave} className="agent-btn agent-btn-xs agent-btn-primary">Save</button>
            </div>
            {info.firm && (
              <button
                type="button"
                onClick={() => { onRemove(); closeEdit(); }}
                className="agent-link"
                style={{ fontSize: 11, color: "var(--agent-danger, #dc2626)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SolicitorSection({ transactionId, vendor, purchaser, recommendedFirms, referredFirmId, referralFee, address, contacts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  // Local optimistic copies — initialized from prop. Updated immediately
  // when the user saves a change so the row reflects the new firm/handler
  // without waiting for the server roundtrip + page revalidation. Synced
  // back to prop value once the prop refreshes (server data lands).
  const [vendorState, setVendorState] = useState<SolicitorInfo>(vendor);
  const [purchaserState, setPurchaserState] = useState<SolicitorInfo>(purchaser);
  useEffect(() => { setVendorState(vendor); }, [vendor]);
  useEffect(() => { setPurchaserState(purchaser); }, [purchaser]);

  const clientNames = (contacts ?? [])
    .filter((c) => c.roleType === "vendor" || c.roleType === "purchaser")
    .map((c) => c.name);

  function save(patch: Parameters<typeof saveSolicitorsAction>[1]) {
    setSaving(true);
    startTransition(async () => {
      try {
        await saveSolicitorsAction(transactionId, patch);
      } finally {
        setSaving(false);
      }
    });
  }

  // Optimistic firm/handler row shape from the picker selection. We don't
  // have the full recommended-firm intel locally, but the picker's
  // SolicitorSelection has everything the row's display needs.
  function selectionToInfo(sel: SolicitorSelection | null): SolicitorInfo {
    if (!sel) return { firm: null, contact: null };
    return {
      firm: { id: sel.firmId, name: sel.firmName },
      contact: sel.contactId
        ? { id: sel.contactId, name: sel.contactName ?? "", phone: sel.phone, email: sel.email }
        : null,
    };
  }

  function handleVendorChange(sel: SolicitorSelection | null, referral: ReferralData) {
    setVendorState(selectionToInfo(sel));
    save({
      vendorSolicitorFirmId: sel?.firmId ?? null,
      vendorSolicitorContactId: sel?.contactId ?? null,
      ...(referral ? { referredFirmId: referral.firmId, referralFee: referral.fee } : {}),
    });
  }

  function handlePurchaserChange(sel: SolicitorSelection | null, referral: ReferralData) {
    setPurchaserState(selectionToInfo(sel));
    save({
      purchaserSolicitorFirmId: sel?.firmId ?? null,
      purchaserSolicitorContactId: sel?.contactId ?? null,
      ...(referral ? { referredFirmId: referral.firmId, referralFee: referral.fee } : {}),
    });
  }

  function handleVendorRemove() {
    setVendorState({ firm: null, contact: null });
    save({ vendorSolicitorFirmId: null, vendorSolicitorContactId: null });
  }

  function handlePurchaserRemove() {
    setPurchaserState({ firm: null, contact: null });
    save({ purchaserSolicitorFirmId: null, purchaserSolicitorContactId: null });
  }

  // Count solicitors that have a firm assigned - matches the count
  // pattern used by the redesigned ContactsSection header.
  const assignedCount = (vendorState.firm ? 1 : 0) + (purchaserState.firm ? 1 : 0);

  const vendorHasReferral = referredFirmId != null && vendorState.firm?.id === referredFirmId;
  const purchaserHasReferral = referredFirmId != null && purchaserState.firm?.id === referredFirmId;

  return (
    // Design Lab: `overview-solicitors`. Default v05 (Heavy frost) per
    // Ellis's final pick set, 2026-08-08 evening pass. Surface treatment
    // (background/border) moved from inline styles to the variant class.
    <GlassCard glassId="overview-solicitors" label="Overview · Solicitors" defaultVariant="v05" style={{
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Header - mirrors the Contacts card: small coral icon square +
          title + count on the left. Saving pulse tucks in next to the
          title for save-in-flight feedback. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 7,
            background: "rgba(var(--agent-coral-rgb), 0.12)",
            color: "var(--agent-coral-deep)",
          }}>
            <Scales size={14} weight="regular" />
          </span>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>Solicitors</h3>
          {assignedCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-muted)" }}>{assignedCount}</span>
          )}
          {(saving || isPending) && <SavingPulse />}
        </div>
      </div>

      {/* 2-column tile grid. Auto-fills into 1 column on narrow viewports
          via minmax(240, 1fr). Same pattern as the redesigned Contacts
          grid so the two cards read as siblings. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 10,
        padding: 12,
      }}>
        <SolicitorTile
          side="vendor"
          info={vendorState}
          recommendedFirms={recommendedFirms}
          address={address}
          clientNames={clientNames}
          referralFee={referralFee ?? null}
          showReferralFee={vendorHasReferral}
          onChange={handleVendorChange}
          onRemove={handleVendorRemove}
        />
        <SolicitorTile
          side="purchaser"
          info={purchaserState}
          recommendedFirms={recommendedFirms}
          address={address}
          clientNames={clientNames}
          referralFee={referralFee ?? null}
          showReferralFee={purchaserHasReferral}
          onChange={handlePurchaserChange}
          onRemove={handlePurchaserRemove}
        />
      </div>
    </GlassCard>
  );
}
