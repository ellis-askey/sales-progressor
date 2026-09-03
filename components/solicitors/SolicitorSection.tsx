"use client";

import { useState, useEffect, useTransition } from "react";
import { Phone, ChatCircleText, EnvelopeSimple, PencilSimple, GlobeSimple, ArrowSquareOut } from "@phosphor-icons/react";
import { SolicitorPicker, type SolicitorSelection } from "./SolicitorPicker";
import { saveSolicitorsAction, getSolicitorPortalLinkAction } from "@/app/actions/transactions";
import { PriceInput } from "@/components/ui/PriceInput";
import { Pill } from "@/components/ui/Pill";
import { SavingPulse } from "@/components/ui/SavingPulse";
import { GlassCard } from "@/components/glass/GlassCard";
import { CommsButton } from "@/components/ui/CommsButton";
import { ContactAvatar } from "@/components/ui/Avatar";

type SolicitorIntel = {
  totalFiles: number;
  completedFiles: number;
  medianWeeksToExchange: number | null;
  medianDaysSearches: number | null;
  rating: "fast" | "average" | "slow" | "unknown";
  warning: string | null;
  resolvedFiles: number;
  fallThroughCount: number;
  fallThroughRate: number | null;
  stalledUnresolved: number;
};

type SolicitorInfo = {
  firm: { id: string; name: string } | null;
  contact: { id: string; name: string; phone: string | null; email: string | null; secondaryEmail?: string | null } | null;
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
  // Internal staff see the full coverage denominator ("6 of 40 sales") on the
  // firm intel; agents just see the count it's based on ("6 sales"). PR 11.
  isInternalStaff?: boolean;
  // When true, render without the outer GlassCard shell (PeoplePanel wraps it
  // with the card + Clients/Professionals toggle). 2026-08-10.
  embedded?: boolean;
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
    secondaryEmail: info.contact?.secondaryEmail ?? null,
  };
}

function solicitorEmailSubject(address: string, clientNames: string[]): string {
  if (clientNames.length === 0) return `Sale of ${address} - Sale Progression`;
  const joined =
    clientNames.length === 1
      ? clientNames[0]
      : clientNames.slice(0, -1).join(", ") + " & " + clientNames[clientNames.length - 1];
  return `Sale of ${address} - Clients: ${joined}`;
}

const RATING_LABEL: Record<string, string> = {
  fast: "Fast", average: "Average", slow: "Slow", unknown: "—",
};

function SolicitorIntelChips({ firmId, isInternalStaff = false }: { firmId: string; isInternalStaff?: boolean }) {
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
  // Honest coverage (PR 11): the "Typical Xw" median is based only on files that
  // actually exchanged (completedFiles), not every file, so show that basis
  // rather than the misleading total. Internal staff also see the total ("of Y")
  // so they can judge how representative it is; agents just see the count it's
  // based on.
  const coverageText = intel.medianWeeksToExchange !== null
    ? (isInternalStaff
        ? `${intel.completedFiles} of ${intel.totalFiles} sales`
        : `${intel.completedFiles} sale${intel.completedFiles !== 1 ? "s" : ""}`)
    : `${intel.totalFiles} file${intel.totalFiles !== 1 ? "s" : ""}`;
  const parts = [
    ratingLabel,
    intel.medianWeeksToExchange !== null ? `Typical ${intel.medianWeeksToExchange}w` : null,
    coverageText,
  ].filter(Boolean).join(" · ");
  const intelTone: "success" | "danger" | "muted" =
    intel.rating === "fast" ? "success" : intel.rating === "slow" ? "danger" : "muted";

  // Fall-through chip: only once there are enough resolved sales to be honest.
  // Zero fall-throughs is a positive signal; anything above just states the fact
  // in a low-key tone. Stalled-unresolved files (PR 11) are surfaced so a clean
  // rate next to rotting deals can't be read as a genuinely clean record.
  const stalledSuffix = intel.stalledUnresolved > 0
    ? ` · ${intel.stalledUnresolved} stalled, unresolved`
    : "";
  const showFallThrough = intel.fallThroughRate !== null;
  const fallThroughText = intel.fallThroughRate === 0
    ? `No fall-throughs across ${intel.resolvedFiles} sales${stalledSuffix}`
    : `${intel.fallThroughRate}% fell through (${intel.fallThroughCount} of ${intel.resolvedFiles} sales)${stalledSuffix}`;
  const fallThroughTone: "success" | "muted" = intel.fallThroughRate === 0 ? "success" : "muted";
  // When there aren't enough resolved sales for a rate but deals are stalling,
  // still surface that on its own so the firm doesn't read as untested-but-safe.
  const showStalledOnly = intel.fallThroughRate === null && intel.stalledUnresolved > 0;

  return (
    <div className="agent-reveal-in" style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
      <Pill glass tone={intelTone} size="sm" style={{ alignSelf: "flex-start" }}>{parts}</Pill>
      {showFallThrough && (
        <Pill glass tone={fallThroughTone} size="sm" style={{ alignSelf: "flex-start" }}>{fallThroughText}</Pill>
      )}
      {showStalledOnly && (
        <Pill glass tone="warning" size="sm" style={{ alignSelf: "flex-start" }}>
          {`${intel.stalledUnresolved} sale${intel.stalledUnresolved !== 1 ? "s" : ""} stalled, outcome unresolved`}
        </Pill>
      )}
      {intel.warning && (
        <Pill glass tone="warning" size="sm" style={{ alignSelf: "flex-start" }}>{intel.warning}</Pill>
      )}
    </div>
  );
}

function SolicitorTile({
  transactionId,
  side,
  info,
  recommendedFirms,
  address,
  clientNames,
  isInternalStaff,
  referralFee,
  showReferralFee,
  onChange,
  onRemove,
}: {
  transactionId: string;
  side: "vendor" | "purchaser";
  info: SolicitorInfo;
  recommendedFirms?: RecommendedFirm[];
  address?: string;
  clientNames?: string[];
  isInternalStaff?: boolean;
  // Referral fee (in pence) - only rendered when showReferralFee=true.
  // Passed through unconditionally so the caller controls when it applies.
  referralFee?: number | null;
  showReferralFee?: boolean;
  onChange: (v: SolicitorSelection | null, referral: ReferralData) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [draft, setDraft] = useState<SolicitorSelection | null>(toSelection(info));

  // Solicitors have no stored portal token — mint one via the server action
  // (it's the same signed link our chase emails send) and copy it. There's no
  // "invite" flow for solicitors, so the card's Invite button stays disabled.
  async function copyPortalLink() {
    try {
      const token = await getSolicitorPortalLinkAction(transactionId, side);
      await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore — transient / permission
    }
  }
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

  // Vendor = seller-blue, purchaser = buyer-green, matching the side-tinted
  // avatars and the Contacts card pills.
  const roleTone: "info" | "success" = side === "vendor" ? "info" : "success";
  const roleLabel = side === "vendor" ? "Vendor" : "Purchaser";

  // CC the handler's assistant/secretary on the agent's own email too.
  const ccParam = info.contact?.secondaryEmail
    ? `cc=${encodeURIComponent(info.contact.secondaryEmail)}&`
    : "";
  const emailHref =
    info.contact?.email && address
      ? `mailto:${info.contact.email}?${ccParam}subject=${encodeURIComponent(solicitorEmailSubject(address, clientNames ?? []))}`
      : info.contact?.email
      ? `mailto:${info.contact.email}${ccParam ? `?${ccParam.replace(/&$/, "")}` : ""}`
      : null;

  const tileWrapperStyle: React.CSSProperties = {
    border: "0.5px solid var(--agent-border-default)",
    borderRadius: 12,
    background: "var(--agent-surface-nested)",
    overflow: "hidden",
    // Expand to full width when editing so the picker + save row fit.
    gridColumn: editing || exiting ? "1 / -1" : "auto",
  };

  // Empty row - no firm assigned yet (roster-style, matches ContactsSection)
  if (!info.firm && !editing && !exiting) {
    return (
      <div style={tileWrapperStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px" }}>
          <ContactAvatar contact={{ name: roleLabel, roleType: "solicitor" }} size={40} sideTint={side} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <Pill glass tone={roleTone} size="sm">{roleLabel}</Pill>
            </div>
            <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1, fontStyle: "italic" }}>
              No {side} solicitor yet
            </div>
          </div>
          <button type="button" onClick={openEdit} className="agent-link" style={{ fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
            + Add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={tileWrapperStyle}>
      {/* Display view — collapsed roster row + expand, matches ContactsSection */}
      {info.firm && !editing && !exiting && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <ContactAvatar contact={{ name: info.firm.name, roleType: "solicitor" }} size={40} sideTint={side} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{info.firm.name}</span>
                  <Pill glass tone={roleTone} size="sm">{roleLabel}</Pill>
                </div>
                <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {info.contact?.name ? info.contact.name : "No handler on file"}
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ flexShrink: 0, color: "var(--agent-text-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}>
                <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* Comms + edit stay on the row (never hidden), like ContactsSection */}
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
              <CommsButton compact href={info.contact?.phone ? `tel:${info.contact.phone.replace(/\s/g, "")}` : undefined} label="Call" icon={<Phone size={15} weight="regular" />} disabled={!info.contact?.phone} title={info.contact?.phone ? "Call" : "No phone number on file"} />
              <CommsButton compact href={info.contact?.phone ? `https://wa.me/${info.contact.phone.replace(/[^\d]/g, "")}` : undefined} label="WhatsApp" icon={<ChatCircleText size={15} weight="regular" />} disabled={!info.contact?.phone} title={info.contact?.phone ? "WhatsApp" : "No phone number on file"} />
              <CommsButton compact href={emailHref ?? undefined} label="Email" icon={<EnvelopeSimple size={15} weight="regular" />} disabled={!info.contact?.email} title={info.contact?.email ? "Email" : "No email on file"} />
              <button
                type="button"
                onClick={openEdit}
                aria-label={`Edit ${side} solicitor`}
                title="Edit"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", color: "var(--agent-text-muted)", cursor: "pointer", flexShrink: 0 }}
              >
                <PencilSimple size={15} weight="regular" />
              </button>
            </div>
          </div>

          {/* Expanded detail — intel, contact details, referral. Nothing lost;
              the old always-open card's content lives here now. */}
          <div className={`agent-acc${expanded ? " open" : ""}`}>
            <div className="agent-acc-in">
              <div style={{ padding: "0 12px 12px 63px", display: "flex", flexDirection: "column", gap: 10 }}>
                <SolicitorIntelChips firmId={info.firm.id} isInternalStaff={isInternalStaff} />
                {showReferralFee && referralFee != null && (
                  <span style={{ alignSelf: "flex-start", fontSize: 10, fontWeight: 500, borderRadius: 4, padding: "2px 7px", background: "rgba(16,185,129,0.12)", color: "#059669" }}>
                    Referral £{(referralFee / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                )}
                {info.contact?.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Phone size={13} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                    <a href={`tel:${info.contact.phone.replace(/\s/g, "")}`} className="agent-link agent-link-muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.contact.phone}</a>
                  </div>
                )}
                {info.contact?.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <EnvelopeSimple size={13} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                    <a href={emailHref ?? `mailto:${info.contact.email}`} className="agent-link agent-link-muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.contact.email}</a>
                  </div>
                )}
                {info.contact?.secondaryEmail && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }} title="Assistant, cc'd on every email">
                    <EnvelopeSimple size={13} weight="regular" style={{ color: "var(--agent-text-muted)", opacity: 0.6, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>cc {info.contact.secondaryEmail}</span>
                  </div>
                )}

                {/* Portal access — mirrors the clients' Portal card. Solicitors
                    reach it via chase-email links (no invite flow), so the
                    Invite button is shown disabled and the link is copyable. */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-nested-strong)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, color: "#64748b", flexShrink: 0 }}>
                    <GlobeSimple size={28} weight="regular" />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>Portal access</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--agent-text-muted)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
                      Portal link ready
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled
                      aria-disabled
                      title="Solicitors reach their portal through the links in our chase emails, so there's no separate invite to send."
                      className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                      style={{ opacity: 0.45, cursor: "default", pointerEvents: "none" }}
                    >
                      Invite
                    </button>
                    <button
                      type="button"
                      onClick={copyPortalLink}
                      title="Copy the solicitor's portal link"
                      aria-label="Copy portal link"
                      className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                      style={{ minWidth: 34, padding: "0 8px" }}
                    >
                      {linkCopied ? "✓" : <ArrowSquareOut size={12} weight="regular" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
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
            <Pill glass tone={roleTone} size="sm">{roleLabel} solicitor</Pill>
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

export function SolicitorSection({ transactionId, vendor, purchaser, recommendedFirms, referredFirmId, referralFee, address, contacts, isInternalStaff = false, embedded = false }: Props) {
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
        ? { id: sel.contactId, name: sel.contactName ?? "", phone: sel.phone, email: sel.email, secondaryEmail: sel.secondaryEmail ?? null }
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

  const shell = (children: React.ReactNode) =>
    embedded ? (
      <div style={{ overflow: "hidden" }}>{children}</div>
    ) : (
      <GlassCard glassId="overview-solicitors" label="Overview · Solicitors" defaultVariant="v05" style={{ borderRadius: 10, overflow: "hidden" }}>
        {children}
      </GlassCard>
    );

  return shell(
    <>
      {/* Header - mirrors the Contacts card exactly: no icon, title + count
          pill on top, subtext beneath, so Clients and Professionals read
          identically. Saving pulse tucks in next to the title. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>Solicitors</h3>
            {assignedCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", padding: "1px 7px", borderRadius: 10, background: "rgba(15,23,42,0.06)" }}>
                {assignedCount}
              </span>
            )}
            {(saving || isPending) && <SavingPulse />}
          </div>
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Solicitors acting on this transaction</span>
        </div>
      </div>

      {/* Full-width stacked tiles — matches the ContactsSection layout so
          Clients and Professionals read identically in the People card. */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
      }}>
        <SolicitorTile
          transactionId={transactionId}
          side="vendor"
          info={vendorState}
          recommendedFirms={recommendedFirms}
          address={address}
          clientNames={clientNames}
          isInternalStaff={isInternalStaff}
          referralFee={referralFee ?? null}
          showReferralFee={vendorHasReferral}
          onChange={handleVendorChange}
          onRemove={handleVendorRemove}
        />
        <SolicitorTile
          transactionId={transactionId}
          side="purchaser"
          info={purchaserState}
          recommendedFirms={recommendedFirms}
          address={address}
          clientNames={clientNames}
          isInternalStaff={isInternalStaff}
          referralFee={referralFee ?? null}
          showReferralFee={purchaserHasReferral}
          onChange={handlePurchaserChange}
          onRemove={handlePurchaserRemove}
        />
      </div>
    </>
  );
}
