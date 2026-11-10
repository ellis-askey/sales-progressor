"use client";

import { useState, useTransition } from "react";
import { NumericFormat } from "react-number-format";
import { ArrowSquareOut } from "@phosphor-icons/react";
import {
  Briefcase,
  Plus,
  ChartLineUp,
  Info,
  PencilSimple,
  Phone,
  EnvelopeSimple,
} from "@phosphor-icons/react";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";
import { upsertPreferredBrokerAction, removePreferredBrokerAction, addBrokerWithContactAction } from "@/app/actions/brokers";
import { VatToggle } from "@/components/agent/partners/VatToggle";
import type { FeeVatTreatment } from "@prisma/client";

const CORAL = "var(--agent-coral-deep)";
const CORAL_RGB = "var(--agent-coral-rgb)";

export type PreferredBroker = {
  firmId: string;
  firmName: string;
  firmWebsite: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  defaultReferralFeePence: number | null;
  defaultReferralFeeVat: FeeVatTreatment;
};

function ensureHttps(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

// Shared input / link / icon-button styling for the Partners rework forms.
function PartnersFormStyles() {
  return (
    <style>{`
      .pf-input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:13.5px;border-radius:10px;outline:none;font-family:inherit;color:var(--agent-text-primary);background:var(--agent-surface-elevated);border:1px solid var(--agent-border-default);transition:border-color 140ms ease}
      .pf-input::placeholder{color:var(--agent-text-muted)}
      .pf-input:hover{border-color:var(--agent-coral-deep)}
      .pf-input:focus{border-color:#C0381C}
      .conv-icon-btn{width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--agent-text-muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 140ms,color 140ms}
      .conv-icon-btn:hover{background:rgba(var(--agent-coral-rgb),0.1);color:var(--agent-coral-deep)}
    `}</style>
  );
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
  onSaveFee: (pence: number | null, vat: FeeVatTreatment) => void;
}) {
  const [feePence, setFeePence] = useState<number | null>(broker.defaultReferralFeePence);
  const [feeVat, setFeeVat] = useState<FeeVatTreatment>(broker.defaultReferralFeeVat);
  return (
    <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>Preferred mortgage broker</p>
        <button type="button" className="conv-icon-btn" title="Edit" aria-label="Edit broker" onClick={onEdit}><PencilSimple size={17} /></button>
      </div>
      <div style={{ borderTop: "1px solid var(--agent-border-subtle)", margin: "14px 0 16px" }} />
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)", display: "inline-flex", alignItems: "center", gap: 7 }}>
            {broker.firmName}
            {broker.firmWebsite && (
              <a href={ensureHttps(broker.firmWebsite)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", color: CORAL }} title={broker.firmWebsite.replace(/^https?:\/\//, "")}>
                <ArrowSquareOut size={15} weight="bold" />
              </a>
            )}
          </p>
          {broker.contactName && (
            <p style={{ margin: "2px 0 12px", fontSize: 13, color: "var(--agent-text-secondary)" }}>{broker.contactName}</p>
          )}
          {broker.contactPhone && (
            <p style={{ margin: "0 0 7px", display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--agent-text-secondary)" }}>
              <Phone size={15} weight="regular" style={{ color: "var(--agent-text-muted)" }} />
              <a href={`tel:${broker.contactPhone}`} style={{ color: "inherit", textDecoration: "none" }}>{broker.contactPhone}</a>
            </p>
          )}
          {broker.contactEmail && (
            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--agent-text-secondary)" }}>
              <EnvelopeSimple size={15} weight="regular" style={{ color: "var(--agent-text-muted)" }} />
              <a href={`mailto:${broker.contactEmail}`} style={{ color: "inherit", textDecoration: "none" }}>{broker.contactEmail}</a>
            </p>
          )}
        </div>
        <div style={{ borderLeft: "1px solid var(--agent-border-subtle)", paddingLeft: 20, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--agent-text-muted)" }}>Referral fee</p>
          <NumericFormat
            value={feePence != null ? feePence / 100 : ""}
            onValueChange={({ floatValue }) => setFeePence(floatValue != null ? Math.round(floatValue * 100) : null)}
            onBlur={() => onSaveFee(feePence, feeVat)}
            prefix="£"
            thousandSeparator=","
            decimalScale={2}
            allowNegative={false}
            inputMode="decimal"
            placeholder="£"
            className="pf-input"
            style={{ width: 110 }}
          />
          <VatToggle value={feeVat} onChange={(v) => { setFeeVat(v); onSaveFee(feePence, v); }} disabled={saving} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
            {saving && <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Saving…</span>}
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              style={{ fontSize: 12, color: "var(--agent-text-muted)", background: "none", border: "none", cursor: removing ? "default" : "pointer", padding: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f05252")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--agent-text-muted)")}
            >
              {removing ? "…" : "Remove"}
            </button>
          </div>
        </div>
      </div>
      <PartnersFormStyles />
    </div>
  );
}

// ── Profile form (add / edit state) ────────────────────────────────────────────

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
  const [feeVat, setFeeVat] = useState<FeeVatTreatment>(initial?.defaultReferralFeeVat ?? "plus");
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
        referralFeeVat: feeVat,
      });
      onSaved({
        firmId: result.firmId,
        firmName: result.firmName,
        firmWebsite: firmWebsite.trim() || null,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        defaultReferralFeePence: feePence,
        defaultReferralFeeVat: feeVat,
      });
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Firm name" req>
        <input
          type="text"
          value={firmName}
          onChange={(e) => setFirmName(e.target.value)}
          onBlur={(e) => { if (e.target.value.trim()) setFirmName(titleCaseKeepAcronyms(e.target.value)); }}
          placeholder="e.g. Mortgage Masters Ltd"
          className="pf-input"
          autoFocus={!isEdit}
        />
      </Field>
      <Field label="Website" opt>
        <input
          type="url"
          value={firmWebsite}
          onChange={(e) => setFirmWebsite(e.target.value)}
          placeholder="e.g. https://mortgagemasters.co.uk"
          className="pf-input"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Contact name" req>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            onBlur={(e) => { if (e.target.value.trim()) setContactName(titleCaseKeepAcronyms(e.target.value)); }}
            placeholder="e.g. James Morris"
            className="pf-input"
          />
        </Field>
        <Field label="Phone" req>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(cleanPhone(e.target.value))}
            onBlur={(e) => { if (e.target.value.trim()) setContactPhone(formatUKPhone(e.target.value)); }}
            maxLength={20}
            placeholder="07700 900 000"
            className="pf-input"
          />
        </Field>
      </div>
      <Field label="Email" req>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          onBlur={(e) => { if (e.target.value.trim()) setContactEmail(e.target.value.trim().toLowerCase()); }}
          maxLength={100}
          placeholder="james@firm.co.uk"
          className="pf-input"
        />
      </Field>

      {/* Referral fee + actions share one wrapping row */}
      <div>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 6 }}>
          Default referral fee <span style={{ color: "var(--agent-text-muted)", fontWeight: 400 }}>(optional)</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <NumericFormat
            value={feePence != null ? feePence / 100 : ""}
            onValueChange={({ floatValue }) => setFeePence(floatValue != null ? Math.round(floatValue * 100) : null)}
            prefix="£"
            thousandSeparator=","
            decimalScale={2}
            allowNegative={false}
            inputMode="decimal"
            placeholder="£250"
            className="pf-input"
            style={{ width: 96 }}
          />
          <VatToggle value={feeVat} onChange={setFeeVat} disabled={saving} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            {onCancel && (
              <button type="button" onClick={onCancel} className="agent-btn agent-btn-ghost agent-btn-md">
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="agent-btn agent-btn-color-primary agent-btn-md"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add broker"}
            </button>
          </div>
        </div>
      </div>

      {error && <p style={{ margin: 0, fontSize: 12, color: "var(--agent-danger, #dc2626)" }}>{error}</p>}
      <PartnersFormStyles />
    </div>
  );
}

function Field({ label, req, opt, children }: { label: string; req?: boolean; opt?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 5 }}>
        {label}
        {req && <span style={{ color: "#e5484d", marginLeft: 3 }}>*</span>}
        {opt && <span style={{ color: "var(--agent-text-muted)", fontWeight: 400, marginLeft: 5 }}>(optional)</span>}
      </span>
      {children}
    </label>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

export function PreferredBrokerSettings({
  initialBroker,
}: {
  initialBroker: PreferredBroker | null;
}) {
  const [broker, setBroker] = useState<PreferredBroker | null>(initialBroker);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Inline add/edit form (mirrors the solicitor card's inline "Adding …" panel).
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  function handleRemove() {
    setRemoving(true);
    startTransition(async () => {
      try {
        await removePreferredBrokerAction();
        setBroker(null);
      } finally {
        setRemoving(false);
      }
    });
  }

  function handleSaveFee(pence: number | null, vat: FeeVatTreatment) {
    if (!broker) return;
    setSaving(true);
    startTransition(async () => {
      try {
        await upsertPreferredBrokerAction(broker.firmId, pence, vat);
        setBroker((b) => b ? { ...b, defaultReferralFeePence: pence, defaultReferralFeeVat: vat } : b);
      } finally {
        setSaving(false);
      }
    });
  }

  // Inline add / edit form, rendered in-card.
  if (editing) {
    return (
      <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ flexShrink: 0, color: CORAL, display: "flex", alignItems: "center", marginTop: 1 }}><Briefcase size={24} weight="regular" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>Preferred mortgage broker</p>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{broker ? "Update your agency's mortgage broker." : "Enter the broker your agency works with."}</p>
          </div>
        </div>
        <div style={{ borderRadius: 12, border: `1px solid rgba(${CORAL_RGB},0.3)`, background: `rgba(${CORAL_RGB},0.05)`, padding: 16 }}>
          <BrokerForm
            initial={broker}
            isEdit={!!broker}
            onCancel={() => setEditing(false)}
            onSaved={(b) => { setBroker(b); setEditing(false); }}
          />
        </div>
      </div>
    );
  }

  if (broker) {
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

  // Empty state
  return (
    <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Head: icon tile + title + status pill */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ flexShrink: 0, color: CORAL, display: "flex", alignItems: "center", marginTop: 1 }}><Briefcase size={24} weight="regular" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>Preferred mortgage broker</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>Set your preferred broker. Their details will be pre-filled on new sales.</p>
        </div>
        <StatusPill dot>Not set up</StatusPill>
      </div>

      {/* Centred empty body */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "20px 8px 8px" }}>
        <span style={{ position: "relative", display: "inline-flex" }}>
          <span style={{
            width: 86, height: 86, borderRadius: "50%", color: CORAL,
            background: `radial-gradient(circle at 50% 42%, rgba(${CORAL_RGB},0.16), rgba(${CORAL_RGB},0.06) 70%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Briefcase size={34} weight="duotone" /></span>
          <span style={{
            position: "absolute", right: -2, bottom: 2, width: 28, height: 28, borderRadius: "50%",
            background: CORAL, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            border: "3px solid var(--agent-surface-elevated)", boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
          }}><Plus size={14} weight="bold" /></span>
        </span>
        <div style={{ maxWidth: 320 }}>
          <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>Add your preferred broker</p>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Save their details once and we&apos;ll pre-fill them on new sales, including your referral fee.</p>
        </div>
        <div style={{ marginTop: 4 }}>
          <button type="button" onClick={() => setEditing(true)} className="agent-btn agent-btn-primary agent-btn-md">
            <Plus size={16} weight="bold" /> Add mortgage broker
          </button>
        </div>
      </div>

      {/* Referral-income footer */}
      <div style={{ marginTop: 2, paddingTop: 16, borderTop: "1px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: CORAL, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 3px 10px rgba(${CORAL_RGB}, 0.32)`,
        }}><ChartLineUp size={18} weight="bold" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Track your referral income</p>
          <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.4 }}>Referral fees are included in your income analytics.</p>
        </div>
        <span style={{ color: "var(--agent-text-muted)", flexShrink: 0, display: "flex" }} title="Set a default fee when you add the broker"><Info size={17} weight="regular" /></span>
      </div>
    </div>
  );
}

// ── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ dot, children }: { dot?: boolean; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
      color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)",
      border: "1px solid var(--agent-border-subtle)", whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--agent-text-muted)", flexShrink: 0 }} />}
      {children}
    </span>
  );
}
