"use client";

import { useState, useTransition } from "react";
import { NumericFormat } from "react-number-format";
import { Buildings, ArrowSquareOut } from "@phosphor-icons/react";
import { upsertPreferredBrokerAction, removePreferredBrokerAction, addBrokerWithContactAction } from "@/app/actions/brokers";

export type PreferredBroker = {
  firmId: string;
  firmName: string;
  firmWebsite: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  defaultReferralFeePence: number | null;
};

function ensureHttps(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

// ── Populated card ─────────────────────────────────────────────────────────────

function BrokerCard({
  broker,
  saving,
  removing,
  onEdit,
  onRemove,
  onSaveFee,
}: {
  broker: PreferredBroker;
  saving: boolean;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onSaveFee: (pence: number | null) => void;
}) {
  const [feePence, setFeePence] = useState<number | null>(broker.defaultReferralFeePence);
  return (
    <div style={{
      borderRadius: 14,
      border: "1px solid rgba(99,102,241,0.18)",
      background: "linear-gradient(160deg, rgba(99,102,241,0.06) 0%, var(--agent-surface-glass) 100%)",
      overflow: "hidden",
    }}>
      {/* Firm header */}
      <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: "rgba(99,102,241,0.12)",
          border: "1px solid rgba(99,102,241,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Buildings weight="regular" style={{ width: 18, height: 18, color: "#6366f1" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>
            {broker.firmName}
          </p>
          {broker.firmWebsite ? (
            <a
              href={ensureHttps(broker.firmWebsite)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3, fontSize: 11, color: "#6366f1", textDecoration: "none", opacity: 0.8 }}
            >
              {broker.firmWebsite.replace(/^https?:\/\//, "")}
              <ArrowSquareOut size={10} weight="bold" />
            </a>
          ) : (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>No website set</p>
          )}
        </div>
      </div>

      {/* Contact */}
      <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(99,102,241,0.12)" }}>
        {broker.contactName ? (
          <>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{broker.contactName}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 3 }}>
              {broker.contactPhone && (
                <a href={`tel:${broker.contactPhone}`} style={{ fontSize: 11, color: "var(--agent-text-muted)", textDecoration: "none" }}>
                  {broker.contactPhone}
                </a>
              )}
              {broker.contactEmail && (
                <a href={`mailto:${broker.contactEmail}`} style={{ fontSize: 11, color: "#6366f1", textDecoration: "none", opacity: 0.75 }}>
                  {broker.contactEmail}
                </a>
              )}
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>No contact recorded</p>
        )}
      </div>

      {/* Fee + actions */}
      <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(99,102,241,0.12)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>Default referral</span>
        <NumericFormat
          value={feePence != null ? feePence / 100 : ""}
          onValueChange={({ floatValue }) => setFeePence(floatValue != null ? Math.round(floatValue * 100) : null)}
          onBlur={() => onSaveFee(feePence)}
          prefix="£"
          thousandSeparator=","
          decimalScale={2}
          allowNegative={false}
          inputMode="decimal"
          placeholder="£—"
          style={{ width: 90, padding: "4px 8px", fontSize: 13, borderRadius: 8, border: "1px solid rgba(99,102,241,0.20)", background: "var(--agent-surface-glass)", color: "var(--agent-text-primary)", outline: "none" }}
        />
        {saving && <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Saving…</span>}
        <div style={{ flex: 1 }} />
        <button
          onClick={onEdit}
          style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Edit
        </button>
        <span style={{ color: "var(--agent-text-tertiary)", fontSize: 12 }}>·</span>
        <button
          onClick={onRemove}
          disabled={removing}
          style={{ fontSize: 11, color: "var(--agent-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--agent-text-muted)")}
        >
          {removing ? "…" : "Remove"}
        </button>
      </div>
    </div>
  );
}

// ── Profile form (empty state + edit state) ────────────────────────────────────

export function BrokerForm({
  initial,
  isEdit,
  onCancel,
  onSaved,
}: {
  initial: PreferredBroker | null;
  isEdit: boolean;
  onCancel?: () => void;
  onSaved: (broker: PreferredBroker) => void;
}) {
  const [firmName, setFirmName] = useState(initial?.firmName ?? "");
  const [firmWebsite, setFirmWebsite] = useState(initial?.firmWebsite ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [feePence, setFeePence] = useState<number | null>(initial?.defaultReferralFeePence ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!firmName.trim()) { setError("Firm name is required."); return; }
    if (!contactName.trim() || !contactPhone.trim() || !contactEmail.trim()) {
      setError("Contact name, phone and email are all required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await addBrokerWithContactAction({
        firmName: firmName.trim(),
        firmWebsite: firmWebsite.trim() || undefined,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        referralFeePence: feePence,
      });
      onSaved({
        firmId: result.firmId,
        firmName: result.firmName,
        firmWebsite: firmWebsite.trim() || null,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        defaultReferralFeePence: feePence,
      });
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    fontSize: 13,
    borderRadius: 9,
    border: "1px solid rgba(99,102,241,0.20)",
    background: "var(--agent-surface-glass)",
    color: "var(--agent-text-primary)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(99,102,241,0.70)",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Firm name + website */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={labelStyle}>Firm name <span style={{ color: "#f87171" }}>*</span></label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="e.g. Mortgage Masters Ltd"
            style={inputStyle}
            autoFocus={!isEdit}
          />
        </div>
        <div>
          <label style={labelStyle}>Website <span style={{ color: "var(--agent-text-tertiary)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
          <input
            type="url"
            value={firmWebsite}
            onChange={(e) => setFirmWebsite(e.target.value)}
            placeholder="e.g. https://mortgagemasters.co.uk"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Contact details */}
      <div style={{ borderTop: "0.5px solid rgba(99,102,241,0.12)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(99,102,241,0.55)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact details</p>
        <div>
          <label style={labelStyle}>Contact name <span style={{ color: "#f87171" }}>*</span></label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="e.g. James Morris"
            style={inputStyle}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Phone <span style={{ color: "#f87171" }}>*</span></label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              maxLength={20}
              placeholder="07700 900 000"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Email <span style={{ color: "#f87171" }}>*</span></label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              maxLength={100}
              placeholder="james@firm.co.uk"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Referral fee */}
      <div style={{ borderTop: "0.5px solid rgba(99,102,241,0.12)", paddingTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ ...labelStyle, margin: 0, flexShrink: 0 }}>Default referral fee</label>
        <NumericFormat
          value={feePence != null ? feePence / 100 : ""}
          onValueChange={({ floatValue }) => setFeePence(floatValue != null ? Math.round(floatValue * 100) : null)}
          prefix="£"
          thousandSeparator=","
          decimalScale={2}
          allowNegative={false}
          inputMode="decimal"
          placeholder="£250"
          style={{ ...inputStyle, width: 120 }}
        />
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>(optional)</span>
      </div>

      {error && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p>}

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="agent-btn-primary"
          style={{ padding: "8px 18px", fontSize: 13, borderRadius: 9, border: "none" }}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Set as broker partner"}
        </button>

        {isEdit && onCancel && (
          <button
            onClick={onCancel}
            style={{ fontSize: 12, color: "var(--agent-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

export function PreferredBrokerSettings({
  initialBroker,
}: {
  initialBroker: PreferredBroker | null;
}) {
  const [broker, setBroker] = useState<PreferredBroker | null>(initialBroker);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [, startTransition] = useTransition();

  function handleRemove() {
    setRemoving(true);
    startTransition(async () => {
      try {
        await removePreferredBrokerAction();
        setBroker(null);
        setEditing(false);
      } finally {
        setRemoving(false);
      }
    });
  }

  function handleSaveFee(pence: number | null) {
    if (!broker) return;
    setSaving(true);
    startTransition(async () => {
      try {
        await upsertPreferredBrokerAction(broker.firmId, pence);
        setBroker((b) => b ? { ...b, defaultReferralFeePence: pence } : b);
      } finally {
        setSaving(false);
      }
    });
  }

  // Empty state — show form directly
  if (!broker) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.14)",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.16)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Buildings weight="regular" style={{ width: 17, height: 17, color: "#6366f1", opacity: 0.6 }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "rgba(99,102,241,0.75)" }}>Your mortgage broker partner</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Fill in their details below</p>
          </div>
        </div>

        <BrokerForm
          initial={null}
          isEdit={false}
          onSaved={(newBroker) => {
            setBroker(newBroker);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  // Edit state — form pre-filled
  if (editing) {
    return (
      <BrokerForm
        initial={broker}
        isEdit={true}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          setBroker(updated);
          setEditing(false);
        }}
      />
    );
  }

  // Populated state — broker card
  return (
    <BrokerCard
      broker={broker}
      saving={saving}
      removing={removing}
      onEdit={() => setEditing(true)}
      onRemove={handleRemove}
      onSaveFee={handleSaveFee}
    />
  );
}
