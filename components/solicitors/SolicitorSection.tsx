"use client";

import { useState, useEffect, useTransition } from "react";
import { SolicitorPicker, type SolicitorSelection } from "./SolicitorPicker";
import { saveSolicitorsAction } from "@/app/actions/transactions";
import { Phone, EnvelopeSimple, Buildings } from "@phosphor-icons/react";
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

const RATING_STYLE: Record<string, { label: string; color: string }> = {
  fast:    { label: "Fast",    color: "text-emerald-600" },
  average: { label: "Average", color: "text-slate-900/50" },
  slow:    { label: "Slow",    color: "text-red-600" },
  unknown: { label: "—",       color: "text-slate-900/30" },
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

  const { label, color } = RATING_STYLE[intel.rating];

  return (
    <div className="mt-2 pt-2 border-t border-white/20">
      {intel.warning && (
        <div className="flex items-start gap-1.5 mb-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs leading-snug">{intel.warning}</p>
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-slate-900/40">
        <span>{intel.totalFiles} file{intel.totalFiles !== 1 ? "s" : ""} on record</span>
        {intel.avgWeeksToExchange !== null && (
          <span>Avg {intel.avgWeeksToExchange}w to exchange</span>
        )}
        {intel.avgDaysSearches !== null && (
          <span>Searches: {intel.avgDaysSearches}d</span>
        )}
        <span className={`font-medium ${color}`}>{label}</span>
      </div>
    </div>
  );
}

function SolicitorCard({
  label,
  info,
  editLabel,
  recommendedFirms,
  onChange,
}: {
  label: string;
  info: SolicitorInfo;
  editLabel: string;
  recommendedFirms?: RecommendedFirm[];
  onChange: (v: SolicitorSelection | null, referral: ReferralData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SolicitorSelection | null>(toSelection(info));
  const [referralFeeDraft, setReferralFeeDraft] = useState<number | null>(null);

  const selectedRecommended = draft?.firmId
    ? (recommendedFirms ?? []).find((f) => f.id === draft.firmId) ?? null
    : null;

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
    setEditing(false);
  }

  function handleCancel() {
    setDraft(toSelection(info));
    setReferralFeeDraft(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-900/50 uppercase tracking-wide">{label}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSave}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium">Save</button>
            <button type="button" onClick={handleCancel}
              className="text-xs text-slate-900/40 hover:text-slate-900/70">Cancel</button>
          </div>
        </div>
        <SolicitorPicker label={editLabel} value={draft} onChange={handlePickerChange} />
        {selectedRecommended && (
          <div>
            <label className="block text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-1.5">
              Referral fee
            </label>
            <PriceInput
              value={referralFeeDraft}
              onChange={setReferralFeeDraft}
              variant="referral"
              placeholder="0"
            />
          </div>
        )}
      </div>
    );
  }

  const handlerInitials = info.contact?.name
    ? info.contact.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">{label}</p>
        <button type="button" onClick={() => setEditing(true)}
          className="text-xs text-slate-900/30 hover:text-blue-500 transition-colors">
          {info.firm ? "Edit" : "+ Add"}
        </button>
      </div>

      {info.firm ? (
        <>
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
              {handlerInitials ?? (
                <Buildings className="w-4 h-4 text-violet-400" weight="regular" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900/90 leading-snug">{info.firm.name}</p>
              {info.contact && (
                <p className="text-xs text-slate-900/60 mt-0.5">{info.contact.name}</p>
              )}
              <div className="flex flex-col gap-0.5 mt-1">
                {info.contact?.phone && (
                  <a href={`tel:${info.contact.phone}`} className="flex items-center gap-1.5 text-xs text-slate-900/40 hover:text-green-600 transition-colors">
                    <Phone className="w-3 h-3 flex-shrink-0" weight="regular" />
                    {info.contact.phone}
                  </a>
                )}
                {info.contact?.email && (
                  <a href={`mailto:${info.contact.email}`} className="flex items-center gap-1.5 text-xs text-slate-900/40 hover:text-blue-500 transition-colors">
                    <EnvelopeSimple className="w-3 h-3 flex-shrink-0" weight="regular" />
                    {info.contact.email}
                  </a>
                )}
              </div>
            </div>
          </div>
          <SolicitorIntelBadge firmId={info.firm.id} />
        </>
      ) : (
        <p className="text-sm text-slate-900/30 italic">None added</p>
      )}
    </div>
  );
}

export function SolicitorSection({ transactionId, vendor, purchaser, recommendedFirms, referredFirmId, referralFee }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

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

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">
        Solicitors
        {(saving || isPending) && <span className="ml-2 text-slate-900/30 font-normal normal-case">Saving…</span>}
      </h2>
      <div className="glass-card divide-y divide-white/20">
        <div className="px-5 py-4">
          <SolicitorCard
            label="Vendor solicitor"
            editLabel="Vendor solicitor firm"
            info={vendor}
            recommendedFirms={recommendedFirms}
            onChange={handleVendorChange}
          />
        </div>
        <div className="px-5 py-4">
          <SolicitorCard
            label="Purchaser solicitor"
            editLabel="Purchaser solicitor firm"
            info={purchaser}
            recommendedFirms={recommendedFirms}
            onChange={handlePurchaserChange}
          />
        </div>
        {referredFirmId && referralFee != null && (
          <div className="px-5 py-3">
            <p className="text-xs text-slate-900/40">
              Referral fee: <span className="font-medium text-slate-900/70">£{(referralFee / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
