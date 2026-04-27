"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  upsertRecommendedSolicitorAction,
  removeRecommendedSolicitorAction,
  addRecommendedSolicitorWithContactAction,
} from "@/app/actions/solicitors";

type RecommendedFirm = {
  id: string;
  firmId: string;
  firmName: string;
  defaultReferralFeePence: number | null;
};

type AllFirm = { id: string; name: string };

function fmtFee(pence: number | null) {
  if (!pence) return "";
  return (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseFee(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) || n <= 0 ? null : Math.round(n * 100);
}

export function RecommendedSolicitorsSettings({
  initialRecommended,
  allFirms,
}: {
  initialRecommended: RecommendedFirm[];
  allFirms: AllFirm[];
}) {
  const [recommended, setRecommended] = useState<RecommendedFirm[]>(initialRecommended);
  const [saving, setSaving] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // search state
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // pending-add state (contact form shown before confirming)
  const [pendingFirm, setPendingFirm] = useState<{ id?: string; name: string } | null>(null);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [pendingFee, setPendingFee] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const recommendedIds = new Set(recommended.map((r) => r.firmId));
  const filtered = allFirms.filter(
    (f) => !recommendedIds.has(f.id) && f.name.toLowerCase().includes(query.toLowerCase()),
  );

  function updateFee(firmId: string, pence: number | null) {
    setRecommended((prev) =>
      prev.map((r) => (r.firmId === firmId ? { ...r, defaultReferralFeePence: pence } : r)),
    );
  }

  function saveFee(firmId: string, pence: number | null) {
    setSaving(firmId);
    startTransition(async () => {
      try { await upsertRecommendedSolicitorAction(firmId, pence); }
      finally { setSaving(null); }
    });
  }

  function handleRemove(firmId: string) {
    setRemoving(firmId);
    startTransition(async () => {
      try {
        await removeRecommendedSolicitorAction(firmId);
        setRecommended((prev) => prev.filter((r) => r.firmId !== firmId));
      } finally { setRemoving(null); }
    });
  }

  function openContactForm(firm: { id?: string; name: string }) {
    setQuery("");
    setShowSearch(false);
    setCName(""); setCPhone(""); setCEmail(""); setPendingFee(""); setAddError("");
    setPendingFirm(firm);
  }

  function cancelPending() {
    setPendingFirm(null);
    setCName(""); setCPhone(""); setCEmail(""); setPendingFee(""); setAddError("");
  }

  async function confirmAdd() {
    if (!cName.trim() || !cPhone.trim() || !cEmail.trim()) {
      setAddError("Case handler name, phone number and email are all required.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const feePence = parseFee(pendingFee);
      const result = await addRecommendedSolicitorWithContactAction({
        firmId: pendingFirm!.id,
        firmName: pendingFirm!.id ? undefined : pendingFirm!.name,
        contactName: cName,
        contactPhone: cPhone,
        contactEmail: cEmail,
        referralFeePence: feePence,
      });
      setRecommended((prev) => [
        ...prev,
        { id: "", firmId: result.firmId, firmName: result.firmName, defaultReferralFeePence: feePence },
      ]);
      cancelPending();
    } catch {
      setAddError("Failed to add. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      {recommended.length === 0 && !pendingFirm && (
        <p className="text-sm text-slate-900/40 italic">No recommended firms yet.</p>
      )}

      {/* Recommended rows */}
      {recommended.map((r) => (
        <div key={r.firmId} className="flex items-center gap-3 py-2 border-b border-white/15 last:border-0">
          <span className="flex-1 text-sm font-medium text-slate-900/80 truncate">{r.firmName}</span>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-900/40">£</span>
            <input
              type="text"
              inputMode="numeric"
              value={fmtFee(r.defaultReferralFeePence)}
              onChange={(e) => updateFee(r.firmId, parseFee(e.target.value))}
              onBlur={() => saveFee(r.firmId, r.defaultReferralFeePence)}
              placeholder="default fee"
              className="w-28 px-2 py-1 text-sm rounded-lg bg-white/50 border border-white/30 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60"
            />
          </div>

          {saving === r.firmId && <span className="text-xs text-slate-900/30 flex-shrink-0">Saving…</span>}

          <button
            onClick={() => handleRemove(r.firmId)}
            disabled={removing === r.firmId}
            className="text-xs text-slate-900/30 hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {removing === r.firmId ? "…" : "Remove"}
          </button>
        </div>
      ))}

      {/* Contact details form — shown after selecting a firm, before confirming */}
      {pendingFirm && (
        <div className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-900/70">
            Adding <span className="text-blue-700">{pendingFirm.name}</span> — enter case handler details
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs text-slate-900/50 mb-1">Case handler name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="e.g. Sarah Jones"
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/70 border border-white/40 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-900/50 mb-1">Phone <span className="text-red-400">*</span></label>
              <input
                type="tel"
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value)}
                maxLength={20}
                placeholder="e.g. 01234 567890"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/70 border border-white/40 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-900/50 mb-1">Email <span className="text-red-400">*</span></label>
              <input
                type="email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
                maxLength={100}
                placeholder="e.g. sarah@firmname.co.uk"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/70 border border-white/40 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs text-slate-900/50 mb-1">Default referral fee (£, optional)</label>
              <input
                type="text"
                inputMode="numeric"
                value={pendingFee}
                onChange={(e) => setPendingFee(e.target.value)}
                placeholder="e.g. 250"
                className="w-40 px-3 py-2 text-sm rounded-lg bg-white/70 border border-white/40 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60"
              />
            </div>
          </div>

          {addError && <p className="text-xs text-red-500">{addError}</p>}

          <div className="flex gap-2">
            <button
              onClick={confirmAdd}
              disabled={adding}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
            >
              {adding ? "Adding…" : "Confirm add"}
            </button>
            <button
              onClick={cancelPending}
              disabled={adding}
              className="px-4 py-1.5 text-xs text-slate-900/50 hover:text-slate-900/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search / add — hidden while contact form is open */}
      {!pendingFirm && (
        <div ref={searchRef} className="relative pt-1">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search or add a solicitor firm…"
            className="w-full px-3 py-2 text-sm rounded-lg bg-white/50 border border-white/30 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60"
          />

          {showSearch && (query.length > 0 || filtered.length > 0) && (
            <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-white/90 border border-white/40 shadow-lg overflow-hidden max-h-52 overflow-y-auto">
              {filtered.map((f) => (
                <button
                  key={f.id}
                  onMouseDown={() => openContactForm({ id: f.id, name: f.name })}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-900/80 hover:bg-blue-50/60 transition-colors"
                >
                  {f.name}
                </button>
              ))}
              {query.trim() && !allFirms.some((f) => f.name.toLowerCase() === query.trim().toLowerCase()) && (
                <button
                  onMouseDown={() => openContactForm({ name: query.trim() })}
                  className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50/60 transition-colors border-t border-white/30"
                >
                  + Add &ldquo;{query.trim()}&rdquo; as a new firm
                </button>
              )}
              {filtered.length === 0 && !query.trim() && (
                <p className="px-4 py-3 text-sm text-slate-900/40 italic">All known firms already added.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
