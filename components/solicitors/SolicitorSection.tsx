"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SolicitorPicker, type SolicitorSelection } from "./SolicitorPicker";
import { Phone, EnvelopeSimple, Buildings } from "@phosphor-icons/react";

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

type Props = {
  transactionId: string;
  vendor: SolicitorInfo;
  purchaser: SolicitorInfo;
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
  average: { label: "Average", color: "text-gray-500" },
  slow:    { label: "Slow",    color: "text-red-600" },
  unknown: { label: "—",       color: "text-gray-300" },
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
    <div className="mt-2 pt-2 border-t border-[#f0f4f8]">
      {intel.warning && (
        <div className="flex items-start gap-1.5 mb-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs leading-snug">{intel.warning}</p>
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-400">
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
  onChange,
}: {
  label: string;
  info: SolicitorInfo;
  editLabel: string;
  onChange: (v: SolicitorSelection | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SolicitorSelection | null>(toSelection(info));

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { onChange(draft); setEditing(false); }}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium">Save</button>
            <button type="button" onClick={() => { setDraft(toSelection(info)); setEditing(false); }}
              className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
        <SolicitorPicker label={editLabel} value={draft} onChange={setDraft} />
      </div>
    );
  }

  const handlerInitials = info.contact?.name
    ? info.contact.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <button type="button" onClick={() => setEditing(true)}
          className="text-xs text-gray-300 hover:text-blue-500 transition-colors">
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
              <p className="text-sm font-semibold text-gray-800 leading-snug">{info.firm.name}</p>
              {info.contact && (
                <p className="text-xs text-gray-500 mt-0.5">{info.contact.name}</p>
              )}
              <div className="flex flex-col gap-0.5 mt-1">
                {info.contact?.phone && (
                  <a href={`tel:${info.contact.phone}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-600 transition-colors">
                    <Phone className="w-3 h-3 flex-shrink-0" weight="regular" />
                    {info.contact.phone}
                  </a>
                )}
                {info.contact?.email && (
                  <a href={`mailto:${info.contact.email}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors">
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
        <p className="text-sm text-gray-300 italic">None added</p>
      )}
    </div>
  );
}

export function SolicitorSection({ transactionId, vendor, purchaser }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function save(patch: Record<string, string | null>) {
    setSaving(true);
    try {
      await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function handleVendorChange(sel: SolicitorSelection | null) {
    save({
      vendorSolicitorFirmId: sel?.firmId ?? null,
      vendorSolicitorContactId: sel?.contactId ?? null,
    });
  }

  function handlePurchaserChange(sel: SolicitorSelection | null) {
    save({
      purchaserSolicitorFirmId: sel?.firmId ?? null,
      purchaserSolicitorContactId: sel?.contactId ?? null,
    });
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">
        Solicitors
        {saving && <span className="ml-2 text-gray-300 font-normal normal-case">Saving…</span>}
      </h2>
      <div className="bg-white rounded-xl border border-[#e4e9f0] divide-y divide-[#f0f4f8]"
           style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div className="px-5 py-4">
          <SolicitorCard
            label="Vendor solicitor"
            editLabel="Vendor solicitor firm"
            info={vendor}
            onChange={handleVendorChange}
          />
        </div>
        <div className="px-5 py-4">
          <SolicitorCard
            label="Purchaser solicitor"
            editLabel="Purchaser solicitor firm"
            info={purchaser}
            onChange={handlePurchaserChange}
          />
        </div>
      </div>
    </section>
  );
}
