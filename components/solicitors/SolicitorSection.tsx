"use client";

import { useState, useEffect, useTransition } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { SolicitorPicker, type SolicitorSelection } from "./SolicitorPicker";
import { saveSolicitorsAction } from "@/app/actions/transactions";
import { PriceInput } from "@/components/ui/PriceInput";

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

function SolicitorIntelBadge({ firmId }: { firmId: string }) {
  const [intel, setIntel] = useState<SolicitorIntel | null>(null);

  useEffect(() => {
    fetch(`/api/solicitor-intel?firmId=${firmId}`)
      .then((r) => r.json())
      .then(setIntel)
      .catch(() => {});
  }, [firmId]);

  if (!intel || intel.totalFiles === 0) return null;

  const pill = INTEL_PILL[intel.rating] ?? INTEL_PILL.unknown;
  const parts = [
    RATING_LABEL[intel.rating],
    `${intel.totalFiles} file${intel.totalFiles !== 1 ? "s" : ""}`,
    intel.avgWeeksToExchange !== null ? `Avg ${intel.avgWeeksToExchange}w` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="agent-reveal-in" style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
      {intel.warning && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "rgba(245,158,11,.08)", border: "0.5px solid rgba(245,158,11,.3)", borderRadius: 6, padding: "6px 10px" }}>
          <svg style={{ width: 12, height: 12, flexShrink: 0, marginTop: 1, color: "#d97706" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p style={{ fontSize: 10, color: "#d97706", margin: 0 }}>{intel.warning}</p>
        </div>
      )}
      <span style={{ fontSize: 10, borderRadius: 4, padding: "2px 6px", display: "inline-block", alignSelf: "flex-start", ...pill }}>{parts}</span>
    </div>
  );
}

function SolicitorCard({
  label,
  info,
  editLabel,
  recommendedFirms,
  isLast,
  address,
  clientNames,
  onChange,
  onRemove,
}: {
  label: string;
  info: SolicitorInfo;
  editLabel: string;
  recommendedFirms?: RecommendedFirm[];
  isLast?: boolean;
  address?: string;
  clientNames?: string[];
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

  const rowStyle: React.CSSProperties = {
    borderBottom: isLast ? "none" : "0.5px solid var(--agent-border-default)",
  };

  const emailHref =
    info.contact?.email && address
      ? `mailto:${info.contact.email}?subject=${encodeURIComponent(solicitorEmailSubject(address, clientNames ?? []))}`
      : info.contact?.email
      ? `mailto:${info.contact.email}`
      : null;

  return (
    <div style={rowStyle}>
      {/* Display row — always visible */}
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>

        {info.firm ? (
          <>
            {/* Avatar */}
            <div className="agent-avatar agent-avatar-sm" style={{ flexShrink: 0 }}>
              {getFirmInitials(info.firm.name)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
                <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{label}</span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>{info.firm.name}</p>
              {info.contact && (
                <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: "1px 0 0" }}>{info.contact.name}</p>
              )}
              <SolicitorIntelBadge firmId={info.firm.id} />
              {(info.contact?.phone || info.contact?.email) && (
                <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                  {info.contact.phone && (
                    <a
                      href={`tel:${info.contact.phone.replace(/\s/g, "")}`}
                      className="agent-link agent-link-muted"
                      style={{ fontSize: 10 }}
                    >
                      {info.contact.phone}
                    </a>
                  )}
                  {emailHref && (
                    <a
                      href={emailHref}
                      className="agent-link agent-link-muted"
                      style={{ fontSize: 10, wordBreak: "break-all" }}
                    >
                      {info.contact!.email}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Actions — hidden when editing */}
            {!editing && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  disabled
                  className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                  style={{ opacity: 0.45, cursor: "default" }}
                  title="Coming soon"
                >
                  Invite
                </button>
                {/* Desktop: text link */}
                <button type="button" onClick={openEdit} className="agent-link agent-link-muted hidden md:inline" style={{ fontSize: 11 }}>
                  Edit
                </button>
                {/* Mobile: icon button */}
                <button type="button" onClick={openEdit} className="agent-icon-btn agent-icon-btn-sm md:hidden" aria-label="Edit solicitor">
                  <PencilSimple weight="regular" style={{ width: 13, height: 13 }} />
                </button>
                {/* Desktop: text link */}
                <button type="button" onClick={onRemove} className="agent-link agent-link-muted hidden md:inline" style={{ fontSize: 11 }}>
                  Remove
                </button>
                {/* Mobile: icon button */}
                <button type="button" onClick={onRemove} className="agent-icon-btn agent-icon-btn-sm md:hidden" aria-label="Remove solicitor">
                  &times;
                </button>
              </div>
            )}
          </>
        ) : (
          /* No firm — compact empty row */
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)", display: "block", marginBottom: 2 }}>{label}</span>
              <p style={{ fontSize: 11, fontStyle: "italic", color: "var(--agent-text-muted)", margin: 0 }}>None added</p>
            </div>
            {!editing && (
              <button type="button" onClick={openEdit} className="agent-link" style={{ fontSize: 11, flexShrink: 0 }}>
                + Add
              </button>
            )}
          </>
        )}
      </div>

      {/* Edit form — slides in below with B8 animation */}
      {(editing || exiting) && (
        <div
          className={exiting ? "agent-reveal-out" : "agent-reveal-in"}
          style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}
        >
          <SolicitorPicker label="" value={draft} onChange={handlePickerChange} />
          {selectedRecommended && (
            <div>
              <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">Referral fee</label>
              <PriceInput value={referralFeeDraft} onChange={setReferralFeeDraft} variant="referral" placeholder="0" />
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={closeEdit} className="agent-btn agent-btn-xs agent-btn-ghost-bordered">Cancel</button>
            <button type="button" onClick={handleSave} className="agent-btn agent-btn-xs agent-btn-primary">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SolicitorSection({ transactionId, vendor, purchaser, recommendedFirms, referredFirmId, referralFee, address, contacts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

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

  function handleVendorChange(sel: SolicitorSelection | null, referral: ReferralData) {
    save({
      vendorSolicitorFirmId: sel?.firmId ?? null,
      vendorSolicitorContactId: sel?.contactId ?? null,
      ...(referral ? { referredFirmId: referral.firmId, referralFee: referral.fee } : {}),
    });
  }

  function handlePurchaserChange(sel: SolicitorSelection | null, referral: ReferralData) {
    save({
      purchaserSolicitorFirmId: sel?.firmId ?? null,
      purchaserSolicitorContactId: sel?.contactId ?? null,
      ...(referral ? { referredFirmId: referral.firmId, referralFee: referral.fee } : {}),
    });
  }

  function handleVendorRemove() {
    save({ vendorSolicitorFirmId: null, vendorSolicitorContactId: null });
  }

  function handlePurchaserRemove() {
    save({ purchaserSolicitorFirmId: null, purchaserSolicitorContactId: null });
  }

  return (
    <div className="glass-card overflow-hidden rounded-[12px]">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", margin: 0 }}>Solicitors</h3>
          {(saving || isPending) && <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Saving…</span>}
        </div>
      </div>

      <SolicitorCard
        label="Vendor solicitor"
        editLabel="Vendor solicitor firm"
        info={vendor}
        recommendedFirms={recommendedFirms}
        address={address}
        clientNames={clientNames}
        onChange={handleVendorChange}
        onRemove={handleVendorRemove}
      />
      <SolicitorCard
        label="Purchaser solicitor"
        editLabel="Purchaser solicitor firm"
        info={purchaser}
        recommendedFirms={recommendedFirms}
        isLast
        address={address}
        clientNames={clientNames}
        onChange={handlePurchaserChange}
        onRemove={handlePurchaserRemove}
      />

      {referredFirmId && referralFee != null && (
        <div style={{ padding: "8px 16px", borderTop: "0.5px solid var(--agent-border-default)" }}>
          <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: 0 }}>
            Referral fee: <span style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>£{(referralFee / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          </p>
        </div>
      )}
    </div>
  );
}
