"use client";

// The New Sale "Mortgage broker" field. Off by default. Switching on reveals
// (smoothly) a short flow: enter this buyer's broker, OR one-tap your agency's
// usual broker shown underneath. A referral fee sits alongside, prefilled from
// the saved default and editable by click-and-type. Nothing is attached to the
// sale until you press "Assign to this sale" — we never assume a broker you
// type is the agency's. Only when your agency has no saved broker do we offer
// an opt-in "this is our recommended broker" (unticked), which saves it to
// Partners for next time. No cross-agency search.
// See app/actions/brokers.ts (addBrokerForSaleAction).

import { useState, useEffect, useRef } from "react";
import { Buildings } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { PriceInput } from "@/components/ui/PriceInput";
import type { BrokerSelection } from "@/components/brokers/BrokerPicker";
import { addBrokerForSaleAction } from "@/app/actions/brokers";

const emptyForm = { firmName: "", contactName: "", phone: "", email: "" };

function FeeRow({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Referral fee</p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>What you earn for referring the buyer</p>
      </div>
      <PriceInput value={value} onChange={onChange} placeholder="" className="sale-price-pill" />
    </div>
  );
}

export function BrokerField({
  value, onChange, preferredBroker,
  referralFee, onReferralFeeChange, preferredBrokerDefaultFee,
}: {
  value: BrokerSelection | null;
  onChange: (v: BrokerSelection | null) => void;
  preferredBroker: BrokerSelection | null;
  referralFee: number | null;
  onReferralFeeChange: (v: number | null) => void;
  preferredBrokerDefaultFee: number | null;
}) {
  // `open` = the section is expanded (toggle on). A broker may or may not be
  // assigned to the sale yet.
  const [open, setOpen] = useState(!!value);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsRecommended, setSaveAsRecommended] = useState(false);
  const firmRef = useRef<HTMLInputElement>(null);

  const assigned = !!value;
  const isUsual = !!value && preferredBroker?.firmId === value.firmId;
  const hasUsual = !!preferredBroker?.firmId;

  // Focus the firm field when the agent opens the section to enter a broker
  // (only when there's no usual broker to one-tap, so we don't push past it).
  // The collapse keeps the form mounted, so we focus on open rather than via
  // autoFocus (which would fire while hidden on first render).
  useEffect(() => {
    if (open && !assigned && !hasUsual) {
      const t = setTimeout(() => firmRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, assigned, hasUsual]);

  function toggle() {
    if (open) {
      setOpen(false);
      onChange(null);
      onReferralFeeChange(null);
      setForm(emptyForm); setError(null); setSaveAsRecommended(false);
    } else {
      setOpen(true);
    }
  }

  // One-tap: use the agency's saved broker for this sale (with its saved fee).
  function useUsual() {
    if (!preferredBroker) return;
    onChange(preferredBroker);
    onReferralFeeChange(preferredBrokerDefaultFee);
  }

  // Back to the entry form to attach a different broker.
  function changeBroker() {
    onChange(null);
    onReferralFeeChange(null);
    setForm(emptyForm); setError(null);
  }

  async function assign() {
    if (!form.firmName.trim()) { setError("Add the brokerage name."); return; }
    setSaving(true); setError(null);
    try {
      const created = await addBrokerForSaleAction({
        firmName: form.firmName,
        contactName: form.contactName,
        contactPhone: form.phone,
        contactEmail: form.email,
        saveToPartners: !hasUsual && saveAsRecommended,
        referralFeePence: referralFee,
      });
      onChange(created);
      setForm(emptyForm);
    } catch {
      setError("We couldn't save the broker. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const contactBits = value ? [value.phone, value.email].filter(Boolean).join(" · ") : "";

  return (
    <div>
      {/* Toggle row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>
          {open ? "Mortgage broker involved in this sale" : "Is a mortgage broker involved in this sale?"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Mortgage broker involved in this sale"
          onClick={toggle}
          style={{
            flexShrink: 0, width: 44, height: 25, borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
            position: "relative", transition: "background 150ms",
            background: open ? "var(--agent-coral-deep)" : "var(--nv2-border-medium, rgba(0,0,0,0.16))",
          }}
        >
          <span style={{
            position: "absolute", top: 3, left: open ? 22 : 3, width: 19, height: 19, borderRadius: "50%",
            background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 150ms",
          }} />
        </button>
      </div>

      {/* Smoothly revealed body */}
      <div className={`agent-collapse${open ? " open" : ""}`}>
        <div className="agent-collapse-inner">
          <div style={{ paddingTop: 14 }}>
            {assigned ? (
              /* ── Assigned broker ─────────────────────────────────────── */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(var(--agent-coral-base-rgb), 0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Buildings size={12} weight="bold" color="var(--agent-coral-deep)" />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {value!.firmName}
                  </p>
                  {isUsual && <Pill glass tone="success" size="sm" style={{ flexShrink: 0 }}>Your usual broker</Pill>}
                </div>

                {(value!.contactName || contactBits) && (
                  <div style={{ background: "var(--nv2-surface-glass)", border: "0.5px solid var(--nv2-border-dark)", borderRadius: 8, padding: "8px 10px" }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)" }}>
                      {value!.contactName ?? "No contact added"}
                    </p>
                    {contactBits && value!.contactName && (
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>{contactBits}</p>
                    )}
                  </div>
                )}

                <FeeRow value={referralFee} onChange={onReferralFeeChange} />

                <button
                  type="button"
                  onClick={changeBroker}
                  style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)" }}
                >
                  Use a different broker
                </button>
              </div>
            ) : (
              /* ── Entry ───────────────────────────────────────────────── */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* This buyer's broker */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Brokerage name</label>
                    <input ref={firmRef} value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} placeholder="e.g. Bright Future Mortgages" className="glass-input w-full px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label style={labelStyle}>Contact name</label>
                    <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="e.g. Aisha Rahman" className="glass-input w-full px-3 py-2.5 text-sm" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Phone</label>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="020 …" className="glass-input w-full px-3 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@firm.co.uk" className="glass-input w-full px-3 py-2.5 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Agency's usual broker — one tap to use it instead of typing. */}
                {hasUsual && (
                  <button
                    type="button"
                    onClick={useUsual}
                    className="broker-usual-pick"
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(var(--agent-coral-base-rgb), 0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Buildings size={13} weight="bold" color="var(--agent-coral-deep)" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Your usual broker</p>
                      <p style={{ margin: "1px 0 0", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preferredBroker!.firmName}</p>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--agent-coral-deep)" }}>Use</span>
                  </button>
                )}

                <FeeRow value={referralFee} onChange={onReferralFeeChange} />

                {/* Opt-in: only when the agency has no saved broker yet. */}
                {!hasUsual && (
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={saveAsRecommended}
                      onChange={(e) => setSaveAsRecommended(e.target.checked)}
                      style={{ width: 14, height: 14, marginTop: 1, borderRadius: 4, accentColor: "var(--agent-coral-deep)", cursor: "pointer", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>
                      This is our recommended broker. Save it to Partners so it&rsquo;s ready next time.
                    </span>
                  </label>
                )}

                {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--agent-danger, #dc2626)" }}>{error}</p>}

                <button type="button" onClick={assign} disabled={saving} className="agent-btn agent-btn-primary agent-btn-sm" style={{ alignSelf: "flex-start", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Assigning" : "Assign broker to this sale"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10.5, fontWeight: 650, letterSpacing: "0.04em",
  textTransform: "uppercase", color: "var(--nv2-text-ghost, #9C9086)", marginBottom: 5,
};
