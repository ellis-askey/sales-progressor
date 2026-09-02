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
import { Buildings, Check } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { PriceInput } from "@/components/ui/PriceInput";
import type { BrokerSelection } from "@/components/brokers/BrokerPicker";
import { addBrokerForSaleAction } from "@/app/actions/brokers";
import { titleCaseKeepAcronyms, isValidEmail } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";

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

// A rounded checkbox whose tick fades and scales in, driven by a visually
// hidden native input (so it stays keyboard-accessible).
function NiceCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className="broker-check-box"
      aria-hidden
      style={{
        flexShrink: 0, width: 18, height: 18, borderRadius: 6, marginTop: 1,
        display: "grid", placeItems: "center",
        background: checked ? "var(--agent-coral-deep)" : "transparent",
        boxShadow: checked ? "none" : "inset 0 0 0 1.5px var(--agent-border-default)",
        transition: "background 160ms ease, box-shadow 160ms ease",
      }}
    >
      <Check
        size={12}
        weight="bold"
        color="#fff"
        style={{
          opacity: checked ? 1 : 0,
          transform: checked ? "scale(1)" : "scale(0.5)",
          transition: "opacity 160ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </span>
  );
}

export function BrokerField({
  value, onChange, preferredBroker,
  referralFee, onReferralFeeChange, preferredBrokerDefaultFee,
  onReferralChange,
}: {
  value: BrokerSelection | null;
  onChange: (v: BrokerSelection | null) => void;
  preferredBroker: BrokerSelection | null;
  referralFee: number | null;
  onReferralFeeChange: (v: number | null) => void;
  preferredBrokerDefaultFee: number | null;
  // Whether this assignment is the agency's own referral (usual/recommended
  // broker = true, so it earns a fee and shows on the buyer's portal Team). A
  // plain buyer's broker you record is NOT a referral.
  onReferralChange: (referred: boolean) => void;
}) {
  // `open` = the section is expanded (toggle on). A broker may or may not be
  // assigned to the sale yet.
  const [open, setOpen] = useState(!!value);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsRecommended, setSaveAsRecommended] = useState(false);
  // True once a manually-entered broker has been assigned AND saved as the
  // agency's recommended broker — the referral fee belongs to it (the passed
  // preferredBroker prop won't reflect the just-saved one this render).
  const [savedAsRecommended, setSavedAsRecommended] = useState(false);
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
      onReferralChange(false);
      setForm(emptyForm); setError(null); setSaveAsRecommended(false); setSavedAsRecommended(false);
    } else {
      setOpen(true);
    }
  }

  // One-tap: use the agency's saved broker for this sale (with its saved fee).
  // This IS the agency's referral.
  function useUsual() {
    if (!preferredBroker) return;
    onChange(preferredBroker);
    onReferralFeeChange(preferredBrokerDefaultFee);
    onReferralChange(true);
  }

  // Back to the entry form to attach a different broker.
  function changeBroker() {
    onChange(null);
    onReferralFeeChange(null);
    onReferralChange(false);
    setForm(emptyForm); setError(null); setSaveAsRecommended(false); setSavedAsRecommended(false);
  }

  async function assign() {
    if (!form.firmName.trim()) { setError("Add the brokerage name."); return; }
    setSaving(true); setError(null);
    try {
      const recommended = !hasUsual && saveAsRecommended;
      const created = await addBrokerForSaleAction({
        firmName: form.firmName,
        contactName: form.contactName,
        contactPhone: form.phone,
        contactEmail: form.email,
        saveToPartners: recommended,
        referralFeePence: recommended ? referralFee : null,
      });
      onChange(created);
      setSavedAsRecommended(recommended);
      // A manually-entered broker is only a referral if you saved it as your
      // recommended broker; otherwise it's just the buyer's broker on the file.
      onReferralChange(recommended);
      if (!recommended) onReferralFeeChange(null);
      setForm(emptyForm);
    } catch {
      setError("We couldn't save the broker. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const contactBits = value ? [value.phone, value.email].filter(Boolean).join(" · ") : "";
  // Assign is only available once every field is filled and the email is valid.
  const canAssign = !!form.firmName.trim() && !!form.contactName.trim() && !!form.phone.trim() && isValidEmail(form.email);

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
            {/* Entry ⇆ assigned morph. Assigning (or using the usual broker)
                fades the entry out, animates the card down to the shorter
                height, then fades the broker in. Both panels stay mounted so
                the grid-rows heights can cross-animate. */}
            <div className={`broker-morph${assigned ? " open" : ""}`}>
              <div className="broker-morph-inner">
                {value && (
                  /* ── Assigned broker ─────────────────────────────────── */
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

                {/* Referral fee only for the agency's own recommended broker,
                    not a one-off buyer's broker. */}
                {(isUsual || savedAsRecommended) && <FeeRow value={referralFee} onChange={onReferralFeeChange} />}

                <button
                  type="button"
                  onClick={changeBroker}
                  style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)" }}
                >
                  Use a different broker
                </button>
                  </div>
                )}
              </div>
            </div>

            <div className={`broker-morph${!assigned ? " open" : ""}`}>
              <div className="broker-morph-inner">
                {/* ── Entry ─────────────────────────────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* This buyer's broker */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Brokerage name</label>
                    <input
                      ref={firmRef}
                      value={form.firmName}
                      onChange={(e) => setForm({ ...form, firmName: e.target.value })}
                      onBlur={() => setForm((f) => ({ ...f, firmName: titleCaseKeepAcronyms(f.firmName) }))}
                      placeholder="e.g. Bright Future Mortgages"
                      className="agent-input"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Contact name</label>
                    <input
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      onBlur={() => setForm((f) => ({ ...f, contactName: titleCaseKeepAcronyms(f.contactName) }))}
                      placeholder="e.g. Aisha Rahman"
                      className="agent-input"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Phone</label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: cleanPhone(e.target.value) })}
                        onBlur={() => setForm((f) => ({ ...f, phone: formatUKPhone(f.phone) }))}
                        placeholder="020 …"
                        inputMode="tel"
                        className="agent-input"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
                        placeholder="name@firm.co.uk"
                        inputMode="email"
                        className="agent-input"
                      />
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

                {/* Opt-in: only when the agency has no saved broker yet. The
                    referral fee belongs to the agency's own broker, so it lives
                    beneath this tick and only appears once it's on. */}
                {!hasUsual && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <label className="broker-check" style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", userSelect: "none", position: "relative" }}>
                      <input
                        type="checkbox"
                        checked={saveAsRecommended}
                        onChange={(e) => { const c = e.target.checked; setSaveAsRecommended(c); if (!c) onReferralFeeChange(null); }}
                        style={{ position: "absolute", opacity: 0, width: 1, height: 1, margin: 0 }}
                      />
                      <NiceCheck checked={saveAsRecommended} />
                      <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>
                        This is our recommended broker. Save it to Partners so it&rsquo;s ready next time.
                      </span>
                    </label>
                    {saveAsRecommended && (
                      <div style={{ paddingLeft: 27 }}>
                        <FeeRow value={referralFee} onChange={onReferralFeeChange} />
                      </div>
                    )}
                  </div>
                )}

                {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--agent-danger, #dc2626)" }}>{error}</p>}

                <button
                  type="button"
                  onClick={assign}
                  disabled={saving || !canAssign}
                  className="agent-btn agent-btn-primary agent-btn-sm"
                  style={{ alignSelf: "flex-start", opacity: saving || !canAssign ? 0.5 : 1, cursor: saving || !canAssign ? "not-allowed" : "pointer" }}
                >
                  {saving ? "Assigning" : "Assign broker to this sale"}
                </button>
                </div>
              </div>
            </div>
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
