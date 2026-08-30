"use client";

// The New Sale "Mortgage broker" field. Off by default — a saved broker is
// never auto-applied and no details show until the agent confirms a broker is
// involved. Switching on either fills in the agency's saved broker (from
// Partners) or opens a short inline form. No cross-agency search. First-time
// adds save to Partners; "Use a different broker" is a per-sale override.
// See app/actions/brokers.ts (addBrokerForSaleAction).

import { useState } from "react";
import { Buildings } from "@phosphor-icons/react";
import type { BrokerSelection } from "@/components/brokers/BrokerPicker";
import { addBrokerForSaleAction } from "@/app/actions/brokers";

const empty = { firmName: "", contactName: "", phone: "", email: "" };

export function BrokerField({ value, onChange, preferredBroker }: {
  value: BrokerSelection | null;
  onChange: (v: BrokerSelection | null) => void;
  preferredBroker: BrokerSelection | null;
}) {
  const [adding, setAdding] = useState(false);
  const [addingDifferent, setAddingDifferent] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const on = !!value;
  const openState = on || adding;
  const isSaved = !!value && preferredBroker?.firmId === value.firmId;

  function toggle() {
    if (openState) {
      onChange(null);
      setAdding(false); setAddingDifferent(false); setError(null); setForm(empty);
    } else if (preferredBroker?.firmId) {
      onChange(preferredBroker);
    } else {
      setAdding(true);
    }
  }

  function useDifferent() {
    onChange(null);
    setForm(empty);
    setAddingDifferent(true);
    setAdding(true);
  }

  function cancelAdd() {
    setAdding(false); setAddingDifferent(false); setError(null); setForm(empty);
    if (addingDifferent && preferredBroker?.firmId) onChange(preferredBroker);
  }

  async function save() {
    if (!form.firmName.trim()) { setError("Add the brokerage name."); return; }
    setSaving(true); setError(null);
    try {
      const saveToPartners = !addingDifferent && !preferredBroker?.firmId;
      const created = await addBrokerForSaleAction({
        firmName: form.firmName,
        contactName: form.contactName,
        contactPhone: form.phone,
        contactEmail: form.email,
        saveToPartners,
      });
      onChange(created);
      setAdding(false); setAddingDifferent(false); setForm(empty);
    } catch {
      setError("We couldn't save the broker. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const contactLine = value ? [value.contactName, value.phone, value.email].filter(Boolean).join(" · ") : "";
  // Saving to Partners only on a first-ever add (not a per-sale override).
  const willSaveToPartners = adding && !addingDifferent && !preferredBroker?.firmId;

  return (
    <div>
      {/* Confirm gate */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>
          {openState ? "Mortgage broker involved in this sale" : "Is a mortgage broker involved in this sale?"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={openState}
          aria-label="Mortgage broker involved in this sale"
          onClick={toggle}
          style={{
            flexShrink: 0, width: 44, height: 25, borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
            position: "relative", transition: "background 150ms",
            background: openState ? "var(--agent-coral-deep)" : "var(--nv2-border-medium, rgba(0,0,0,0.16))",
          }}
        >
          <span style={{
            position: "absolute", top: 3, left: openState ? 22 : 3, width: 19, height: 19, borderRadius: "50%",
            background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 150ms",
          }} />
        </button>
      </div>

      {/* Off hint */}
      {!openState && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          {preferredBroker?.firmId
            ? <>Switch on and we&rsquo;ll use your saved broker, <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>{preferredBroker.firmName}</strong>.</>
            : <>Switch on to add the broker. We&rsquo;ll save it to your Partners for next time.</>}
        </p>
      )}

      {/* Saved / selected broker card */}
      {on && value && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(var(--agent-coral-base-rgb), 0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Buildings size={12} weight="bold" color="var(--agent-coral-deep)" />
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value.firmName}
            </p>
            {isSaved && (
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 650, letterSpacing: "0.02em", padding: "2px 8px", borderRadius: 999, background: "var(--agent-success-bg)", color: "var(--agent-success)" }}>
                Your saved broker
              </span>
            )}
          </div>
          <div style={{ background: "var(--nv2-surface-glass)", border: "0.5px solid var(--nv2-border-dark)", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)" }}>
              {value.contactName ?? "No contact added"}
            </p>
            {contactLine && value.contactName && (
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>{[value.phone, value.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <button type="button" onClick={useDifferent} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)" }}>
            Use a different broker
          </button>
        </div>
      )}

      {/* Inline add form */}
      {adding && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={labelStyle}>Brokerage name</label>
            <input autoFocus value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} placeholder="e.g. Bright Future Mortgages" className="glass-input w-full px-3 py-2.5 text-sm" />
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
          {willSaveToPartners && (
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
              We&rsquo;ll save this to your Partners and use it on this sale.
            </p>
          )}
          {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--agent-danger, #dc2626)" }}>{error}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button type="button" onClick={save} disabled={saving} className="agent-btn agent-btn-primary agent-btn-sm" style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving" : "Save broker"}
            </button>
            <button type="button" onClick={cancelAdd} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-muted)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10.5, fontWeight: 650, letterSpacing: "0.04em",
  textTransform: "uppercase", color: "var(--nv2-text-ghost, #9C9086)", marginBottom: 5,
};
