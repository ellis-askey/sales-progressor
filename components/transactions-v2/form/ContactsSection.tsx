"use client";

import { CheckCircle, Link as LinkIcon } from "@phosphor-icons/react";
import type { ContactEntry, MemoSource } from "@/components/transactions-v2/types";
import { FieldIndicator, FieldHint } from "./FieldIndicator";
import { titleCase } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";

function HealthDots({ level }: { level: 0 | 1 | 2 | 3 }) {
  if (level === 0) return null;
  const dot = (filled: boolean) => (
    <span style={{
      width: 7, height: 7, borderRadius: "50%",
      background: filled
        ? level === 3 ? "var(--agent-success)" : "var(--agent-coral-deep)"
        : "var(--nv2-border-medium)",
      transition: "background 250ms",
      display: "inline-block",
      flexShrink: 0,
    }} />
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {dot(level >= 1)}
      {dot(level >= 2)}
      {dot(level === 3)}
    </div>
  );
}

export function ContactCard({
  contact,
  index,
  label,
  canRemove,
  isOutsourced,
  progressedBy,
  onChange,
  onRemove,
  onEdit,
}: {
  contact: ContactEntry;
  index: number;
  label: string;
  canRemove: boolean;
  isOutsourced: boolean;
  progressedBy?: "agent" | "progressor";
  onChange: (field: keyof ContactEntry, value: string) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const numbered = `${label} ${index + 1}`;
  const hasName  = contact.name.trim().length > 0;
  const hasPhone = contact.phone.trim().length > 0;
  const hasEmail = contact.email.trim().length > 0;
  const mode = progressedBy ?? "agent";

  const healthLevel: 0 | 1 | 2 | 3 =
    !hasName              ? 0 :
    !hasPhone && !hasEmail ? 1 :
    !hasPhone || !hasEmail ? 2 :
    3;

  const isComplete = healthLevel === 3;

  return (
    <div
      style={{
        background: isComplete ? "rgba(5,150,105,0.04)" : "var(--nv2-surface-glass)",
        borderRadius: 12,
        border: isComplete
          ? "0.5px solid rgba(5,150,105,0.22)"
          : "0.5px solid var(--nv2-border-dark)",
        padding: "14px 14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "background 300ms, border-color 300ms",
      }}
    >
      {/* Header row: label + dots + remove */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canRemove && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nv2-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{numbered}</span>
          )}
          <HealthDots level={healthLevel} />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{ fontSize: 11, color: "var(--nv2-text-ghost)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-secondary)", marginBottom: 5 }}>
          Full name{isOutsourced && <span style={{ color: "var(--agent-coral-deep)", marginLeft: 2 }}>*</span>}
        </label>
        <input
          className="agent-input"
          value={contact.name}
          onChange={(e) => { onChange("name", e.target.value); onEdit(); }}
          onBlur={(e) => { if (e.target.value.trim()) onChange("name", titleCase(e.target.value)); }}
          placeholder="e.g. Sarah Johnson"
          maxLength={80}
        />
      </div>

      {/* Phone + Email */}
      <div>
        <div className="contact-detail-grid">
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-secondary)", marginBottom: 5 }}>Phone</label>
            <input
              className="agent-input"
              value={contact.phone}
              onChange={(e) => { onChange("phone", cleanPhone(e.target.value)); onEdit(); }}
              onBlur={(e) => {
                const formatted = formatUKPhone(e.target.value);
                if (formatted !== e.target.value) onChange("phone", formatted);
              }}
              placeholder="07700 900000"
              maxLength={20}
              type="tel"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-secondary)", marginBottom: 5 }}>Email</label>
            <input
              className="agent-input"
              value={contact.email}
              onChange={(e) => { onChange("email", e.target.value); onEdit(); }}
              placeholder="sarah@example.com"
              maxLength={120}
              type="email"
            />
          </div>
        </div>
        {isOutsourced && (
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--nv2-text-muted)" }}>
            At least one required
          </p>
        )}
      </div>

      {/* Bottom hint */}
      {isComplete ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(5,150,105,0.08)",
          border: "0.5px solid rgba(5,150,105,0.22)",
          borderRadius: 100,
          padding: "4px 10px",
          alignSelf: "flex-start",
          marginTop: 2,
        }}>
          <CheckCircle size={12} weight="fill" color="var(--agent-success)" />
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-success)" }}>
            {mode === "agent" ? "Portal invite ready" : "Ready to contact"}
          </span>
        </div>
      ) : (
        <>
          {mode === "progressor" && hasName && (hasPhone || hasEmail) && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <CheckCircle size={12} weight="fill" color="var(--agent-success)" />
              <span style={{ fontSize: 10, fontWeight: 500, color: "var(--agent-success)" }}>
                We can reach this {label.toLowerCase()}
              </span>
            </div>
          )}
          {mode === "progressor" && hasName && !hasPhone && !hasEmail && (
            <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 500, color: "var(--agent-warning)" }}>
              Add a phone or email so we can reach them
            </p>
          )}
          {mode === "agent" && hasName && (hasPhone || hasEmail) && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <LinkIcon size={12} color="var(--agent-coral-deep)" />
              <span style={{ fontSize: 10, fontWeight: 500, color: "var(--agent-coral-deep)" }}>
                Eligible for portal invite
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ContactGroup({
  label,
  contacts,
  memoSource,
  isOutsourced,
  error,
  onChange,
  onEdit,
}: {
  label: string;
  contacts: ContactEntry[];
  memoSource: MemoSource;
  isOutsourced: boolean;
  error: string | null;
  onChange: (contacts: ContactEntry[]) => void;
  onEdit: () => void;
}) {
  function updateContact(i: number, field: keyof ContactEntry, value: string) {
    const next = contacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c);
    onChange(next);
  }
  function addContact() {
    if (contacts.length >= 2) return;
    onChange([...contacts, { name: "", phone: "", email: "" }]);
  }
  function removeContact(i: number) {
    onChange(contacts.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isOutsourced ? 4 : 10 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--nv2-text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center" }}>
          {label}
          {isOutsourced && <span style={{ color: "var(--agent-coral-deep)", marginLeft: 2, fontWeight: 700 }}>*</span>}
          <FieldIndicator source={memoSource} />
        </p>
        {contacts.length < 2 && (
          <button
            type="button"
            onClick={addContact}
            style={{ fontSize: 12, color: "var(--agent-coral-deep)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
          >
            + Add {label.slice(0, -1).toLowerCase()}
          </button>
        )}
      </div>

      {/* Outsourced required hint */}
      {isOutsourced && (
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--agent-warning)" }}>
          At least one {label.slice(0, -1).toLowerCase()} with name and contact method required
        </p>
      )}

      {/* Validation error */}
      {error && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--agent-danger)", fontWeight: 500 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {contacts.map((contact, i) => (
          <ContactCard
            key={i}
            contact={contact}
            index={i}
            label={label.slice(0, -1)}
            canRemove={contacts.length > 1}
            isOutsourced={isOutsourced}
            onChange={(field, value) => updateContact(i, field, value)}
            onRemove={() => removeContact(i)}
            onEdit={onEdit}
          />
        ))}
      </div>

      <FieldHint source={memoSource} failedText="Couldn't read this — add contact details manually." />
    </div>
  );
}

type Props = {
  vendors: ContactEntry[];
  purchasers: ContactEntry[];
  vendorMemoSource: MemoSource;
  purchaserMemoSource: MemoSource;
  isOutsourced: boolean;
  vendorError: string | null;
  purchaserError: string | null;
  onVendorsChange: (v: ContactEntry[]) => void;
  onPurchasersChange: (v: ContactEntry[]) => void;
  onEdit: (field: string) => void;
};

export function ContactsSection({
  vendors, purchasers, vendorMemoSource, purchaserMemoSource,
  isOutsourced, vendorError, purchaserError,
  onVendorsChange, onPurchasersChange, onEdit,
}: Props) {
  return (
    <div
      className="contacts-section-grid"
      style={{
        borderRadius: 16,
        background: "var(--nv2-surface-glass)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "0.5px solid var(--nv2-border-glass)",
        padding: "18px",
      }}
    >
      <ContactGroup
        label="Vendors"
        contacts={vendors}
        memoSource={vendorMemoSource}
        isOutsourced={isOutsourced}
        error={vendorError}
        onChange={onVendorsChange}
        onEdit={() => onEdit("vendors")}
      />
      <div className="contacts-section-divider" style={{ width: "0.5px", background: "var(--nv2-border-dark)", alignSelf: "stretch" }} />
      <ContactGroup
        label="Purchasers"
        contacts={purchasers}
        memoSource={purchaserMemoSource}
        isOutsourced={isOutsourced}
        error={purchaserError}
        onChange={onPurchasersChange}
        onEdit={() => onEdit("purchasers")}
      />
    </div>
  );
}
