"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { NumericFormat } from "react-number-format";
import { Scales, FolderSimple, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";
import {
  upsertRecommendedSolicitorAction,
  removeRecommendedSolicitorAction,
  addRecommendedSolicitorWithContactAction,
} from "@/app/actions/solicitors";
import { VatToggle } from "@/components/agent/partners/VatToggle";
import type { FeeVatTreatment } from "@prisma/client";

const BLUE = "#2f74e0";
const BLUE_RGB = "59,130,246";

type RecommendedFirm = {
  id: string;
  firmId: string;
  firmName: string;
  defaultReferralFeePence: number | null;
  defaultReferralFeeVat: FeeVatTreatment;
};

type AllFirm = { id: string; name: string };

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
  // In the filled card the search is revealed by the "+ Add firm" link.
  const [addOpen, setAddOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // pending-add state (contact form shown before confirming)
  const [pendingFirm, setPendingFirm] = useState<{ id?: string; name: string } | null>(null);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [pendingFee, setPendingFee] = useState<number | null>(null);
  const [pendingVat, setPendingVat] = useState<FeeVatTreatment>("plus");
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

  function persist(firmId: string, pence: number | null, vat: FeeVatTreatment) {
    setSaving(firmId);
    startTransition(async () => {
      try { await upsertRecommendedSolicitorAction(firmId, pence, vat); }
      finally { setSaving(null); }
    });
  }

  // Changing the VAT toggle updates state and saves immediately (a discrete
  // choice, not a blur-to-save field like the fee).
  function saveVat(firmId: string, vat: FeeVatTreatment) {
    let pence: number | null = null;
    setRecommended((prev) =>
      prev.map((r) => {
        if (r.firmId !== firmId) return r;
        pence = r.defaultReferralFeePence;
        return { ...r, defaultReferralFeeVat: vat };
      }),
    );
    persist(firmId, pence, vat);
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
    setCName(""); setCPhone(""); setCEmail(""); setPendingFee(null); setPendingVat("plus"); setAddError("");
    setPendingFirm(firm);
  }

  function cancelPending() {
    setPendingFirm(null);
    setAddOpen(false);
    setCName(""); setCPhone(""); setCEmail(""); setPendingFee(null); setPendingVat("plus"); setAddError("");
  }

  async function confirmAdd() {
    if (!cName.trim() || !cPhone.trim() || !cEmail.trim()) {
      setAddError("Case handler name, phone number and email are all required.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const result = await addRecommendedSolicitorWithContactAction({
        firmId: pendingFirm!.id,
        firmName: pendingFirm!.id ? undefined : pendingFirm!.name,
        contactName: cName,
        contactPhone: cPhone,
        contactEmail: cEmail,
        referralFeePence: pendingFee,
        referralFeeVat: pendingVat,
      });
      setRecommended((prev) => [
        ...prev,
        { id: "", firmId: result.firmId, firmName: result.firmName, defaultReferralFeePence: pendingFee, defaultReferralFeeVat: pendingVat },
      ]);
      cancelPending();
    } catch {
      setAddError("Failed to add. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  const empty = recommended.length === 0;
  // The search box shows in the empty card, or when "+ Add firm" is open.
  const showSearchBox = !pendingFirm && (empty || addOpen);

  const searchBox = (
    <div ref={searchRef} style={{ position: "relative" }}>
      <MagnifyingGlass size={16} weight="bold" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }} />
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowSearch(true); }}
        onFocus={() => setShowSearch(true)}
        placeholder="Search or add a solicitor firm…"
        autoFocus={addOpen}
        className="pf-input"
        style={{ paddingLeft: 38 }}
      />
      {showSearch && (query.length > 0 || filtered.length > 0) && (
        <div style={{
          position: "absolute", zIndex: 30, left: 0, right: 0, marginTop: 6,
          borderRadius: 12, overflow: "hidden", maxHeight: 220, overflowY: "auto",
          background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-default)",
          boxShadow: "0 12px 30px rgba(15,23,42,0.14)",
        }}>
          {filtered.map((f) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={() => openContactForm({ id: f.id, name: f.name })}
              className="agent-hover-row"
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13.5, color: "var(--agent-text-primary)", background: "none", border: "none", cursor: "pointer" }}
            >
              {f.name}
            </button>
          ))}
          {query.trim() && !allFirms.some((f) => f.name.toLowerCase() === query.trim().toLowerCase()) && (
            <button
              type="button"
              onMouseDown={() => openContactForm({ name: query.trim() })}
              className="agent-hover-row"
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--agent-coral-deep)", background: "none", border: "none", borderTop: "1px solid var(--agent-border-subtle)", cursor: "pointer" }}
            >
              + Add &ldquo;{query.trim()}&rdquo; as a new firm
            </button>
          )}
          {filtered.length === 0 && !query.trim() && (
            <p style={{ margin: 0, padding: "12px 14px", fontSize: 13, color: "var(--agent-text-muted)", fontStyle: "italic" }}>All known firms already added.</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 18, position: "relative", zIndex: 5 }}>
      {/* Header */}
      {empty ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ flexShrink: 0, color: BLUE, display: "flex", alignItems: "center", marginTop: 1 }}><Scales size={24} weight="regular" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>Recommended solicitors</p>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>Add the firms you recommend to clients and set a default referral fee.</p>
          </div>
          <StatusPill>0 firms</StatusPill>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>Recommended solicitors</p>
          {!pendingFirm && !addOpen && (
            <button type="button" className="pf-addfirm" onClick={() => { setAddOpen(true); setShowSearch(true); }}>
              <Plus size={14} weight="bold" /> Add firm
            </button>
          )}
        </div>
      )}

      {/* Filled rows */}
      {!empty && (
        <div>
          <div style={{ borderTop: "1px solid var(--agent-border-subtle)", marginBottom: 4 }} />
          {recommended.map((r, i) => (
            <div
              key={r.firmId}
              style={{
                display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                padding: "12px 4px",
                borderTop: i === 0 ? "none" : "1px solid var(--agent-border-subtle)",
              }}
            >
              <span style={{ flex: 1, minWidth: 140, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.firmName}</span>
              <NumericFormat
                value={r.defaultReferralFeePence != null ? r.defaultReferralFeePence / 100 : ""}
                onValueChange={({ floatValue }) => updateFee(r.firmId, floatValue != null ? Math.round(floatValue * 100) : null)}
                onBlur={() => persist(r.firmId, r.defaultReferralFeePence, r.defaultReferralFeeVat)}
                prefix="£"
                thousandSeparator=","
                decimalScale={2}
                allowNegative={false}
                inputMode="decimal"
                placeholder="£ fee"
                className="pf-input"
                style={{ width: 100 }}
              />
              <VatToggle value={r.defaultReferralFeeVat} onChange={(v) => saveVat(r.firmId, v)} disabled={saving === r.firmId} />
              {saving === r.firmId && <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Saving…</span>}
              <button
                type="button"
                onClick={() => handleRemove(r.firmId)}
                disabled={removing === r.firmId}
                style={{ fontSize: 12, color: "var(--agent-text-muted)", background: "none", border: "none", cursor: removing === r.firmId ? "default" : "pointer", padding: 0, flexShrink: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f05252")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--agent-text-muted)")}
              >
                {removing === r.firmId ? "…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pending contact form — after selecting a firm, before confirming */}
      {pendingFirm && (
        <div style={{ borderRadius: 12, border: `1px solid rgba(${BLUE_RGB},0.3)`, background: `rgba(${BLUE_RGB},0.05)`, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            Adding <span style={{ color: BLUE }}>{pendingFirm.name}</span>: enter case handler details
          </p>
          <Field label="Case handler name" req>
            <input type="text" value={cName} onChange={(e) => setCName(e.target.value)} onBlur={(e) => { if (e.target.value.trim()) setCName(titleCaseKeepAcronyms(e.target.value)); }} placeholder="e.g. Sarah Jones" autoFocus className="pf-input" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Phone" req>
              <input type="tel" value={cPhone} onChange={(e) => setCPhone(cleanPhone(e.target.value))} onBlur={(e) => { if (e.target.value.trim()) setCPhone(formatUKPhone(e.target.value)); }} maxLength={20} placeholder="e.g. 01234 567890" className="pf-input" />
            </Field>
            <Field label="Email" req>
              <input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} onBlur={(e) => { if (e.target.value.trim()) setCEmail(e.target.value.trim().toLowerCase()); }} maxLength={100} placeholder="e.g. sarah@firmname.co.uk" className="pf-input" />
            </Field>
          </div>
          <div>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 6 }}>
              Default referral fee <span style={{ color: "var(--agent-text-muted)", fontWeight: 400 }}>(optional)</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <NumericFormat
                value={pendingFee != null ? pendingFee / 100 : ""}
                onValueChange={({ floatValue }) => setPendingFee(floatValue != null ? Math.round(floatValue * 100) : null)}
                prefix="£"
                thousandSeparator=","
                decimalScale={2}
                allowNegative={false}
                inputMode="decimal"
                placeholder="£250"
                className="pf-input"
                style={{ width: 96 }}
              />
              <VatToggle value={pendingVat} onChange={setPendingVat} disabled={adding} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                <button type="button" onClick={cancelPending} disabled={adding} className="agent-btn agent-btn-ghost agent-btn-md">Cancel</button>
                <button type="button" onClick={confirmAdd} disabled={adding} className="agent-btn agent-btn-primary agent-btn-md">
                  {adding ? "Adding…" : "Confirm add"}
                </button>
              </div>
            </div>
          </div>
          {addError && <p style={{ margin: 0, fontSize: 12, color: "#e5484d" }}>{addError}</p>}
        </div>
      )}

      {/* Empty body (empty card) or revealed search box (filled card) */}
      {empty && !pendingFirm ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "20px 8px 8px" }}>
          <span style={{
            width: 86, height: 86, borderRadius: "50%", color: BLUE,
            background: `radial-gradient(circle at 50% 42%, rgba(${BLUE_RGB},0.16), rgba(${BLUE_RGB},0.06) 70%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><FolderSimple size={34} weight="duotone" /></span>
          <div style={{ maxWidth: 320 }}>
            <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>Your recommended firms will appear here</p>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Build your list of trusted solicitors and set referral fees for each firm.</p>
          </div>
          <div style={{ width: "100%", maxWidth: 320, marginTop: 4 }}>{searchBox}</div>
        </div>
      ) : (
        showSearchBox && <div>{searchBox}</div>
      )}

      <style>{`
        .pf-input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:13.5px;border-radius:10px;outline:none;font-family:inherit;color:var(--agent-text-primary);background:var(--agent-surface-elevated);border:1px solid var(--agent-border-default);transition:border-color 140ms ease}
        .pf-input::placeholder{color:var(--agent-text-muted)}
        .pf-input:hover{border-color:var(--agent-coral-deep)}
        .pf-input:focus{border-color:#C0381C}
        .pf-addfirm{display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:0;cursor:pointer;font-size:13.5px;font-weight:600;color:var(--agent-coral-deep);text-decoration:none;transition:color 140ms}
        .pf-addfirm:hover{color:#C0381C}
      `}</style>
    </div>
  );
}

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 5 }}>
        {label}
        {req && <span style={{ color: "#e5484d", marginLeft: 3 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
      color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)",
      border: "1px solid var(--agent-border-subtle)", whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {children}
    </span>
  );
}
