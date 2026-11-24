"use client";

import type { ReactNode } from "react";
import { CheckCircle, Check, Link as LinkIcon } from "@/components/icons/ph";
import type { ContactEntry, MemoSource } from "@/components/transactions-v2/types";
import { FieldIndicator, FieldHint } from "./FieldIndicator";
import { Pill } from "@/components/ui/Pill";
import { LabelInput } from "@/components/ui/LabelInput";
import { titleCaseKeepAcronyms, isValidEmail } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";
import { looksLikeBusiness } from "@/lib/contacts/business";

const CORAL = "#FF6B4A";

// ── Per-field status rail ──────────────────────────────────────────────────────
// A numbered circle beside each input: grey (empty) → coral (typing, not yet
// valid) → green tick (valid). The circles are joined by a vertical line.
type FieldState = "empty" | "typing" | "valid";

function FieldCircle({ n, state, last }: { n: number; state: FieldState; last?: boolean }) {
  // An opaque fill (not transparent) so the connector line is hidden behind the
  // number rather than showing through it.
  const c = state === "valid"
    ? { border: "var(--agent-success)", color: "#fff", bg: "var(--agent-success)" }
    : state === "typing"
    ? { border: "var(--agent-coral-deep)", color: "var(--agent-coral-deep)", bg: "var(--agent-surface-elevated, #fff)" }
    : { border: "var(--agent-border-strong, rgba(45,24,16,0.22))", color: "var(--agent-text-muted)", bg: "var(--agent-surface-elevated, #fff)" };
  return (
    <div style={{ position: "relative", width: 22, height: 48, flexShrink: 0, display: "grid", placeItems: "center" }}>
      {/* Connector down to the next circle (centre-to-centre = row 48 + gap 10). */}
      {!last && <span aria-hidden style={{ position: "absolute", top: 24, left: "calc(50% - 1px)", width: 2, height: 58, background: "var(--agent-border-default)", zIndex: 0 }} />}
      <span style={{
        position: "relative", zIndex: 1, width: 22, height: 22, borderRadius: "50%",
        display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600,
        border: `1.5px solid ${c.border}`, color: c.color, background: c.bg,
        fontVariantNumeric: "tabular-nums",
        transition: "border-color 220ms ease, color 220ms ease, background 220ms ease",
      }}>
        {state === "valid" ? <Check size={12} weight="bold" /> : n}
      </span>
    </div>
  );
}

function FieldRow({ n, state, last, children }: { n: number; state: FieldState; last?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <FieldCircle n={n} state={state} last={last} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function nameFieldState(name: string): FieldState {
  const t = name.trim();
  return !t ? "empty" : t.length >= 2 ? "valid" : "typing";
}
function phoneFieldState(phone: string): FieldState {
  if (!phone.trim()) return "empty";
  return phone.replace(/\D/g, "").length >= 10 ? "valid" : "typing";
}
function emailFieldState(email: string): FieldState {
  if (!email.trim()) return "empty";
  return isValidEmail(email) ? "valid" : "typing";
}

export function ContactCard({
  contact,
  index,
  label,
  canRemove,
  isOutsourced,
  progressedBy,
  conflict,
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
  // Phone/email duplication conflict with another contact on the file.
  // Surfaced inline beneath the conflicting input. Driven by the parent
  // carousel which computes conflicts pairwise across vendors + purchasers.
  conflict?: { kind: "phone" | "email"; withName: string };
  onChange: (patch: Partial<ContactEntry>) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const numbered = `${label} ${index + 1}`;
  // A business when the typed name reads like a company and the agent hasn't
  // said otherwise. Nothing shows for an ordinary person — the contact-person
  // field only appears once the name trips the company check (roughly 1 in 100).
  const isBiz = looksLikeBusiness(contact.name.trim()) && !contact.bizDismissed;
  const hasName  = contact.name.trim().length > 0;
  const hasPhone = contact.phone.trim().length > 0;
  // A valid email — "sarah" no longer counts as a contactable email, so it can't
  // greenlight the contact as complete/ready.
  const hasEmail = isValidEmail(contact.email);
  const emailInvalid = contact.email.trim().length > 0 && !hasEmail;
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
        // No inner border/card — the content spreads across the section card.
        // A small top inset gives the first input's floating label room so it isn't
        // tight against the header / people-pills above (matches the inter-field rhythm).
        padding: 0,
        paddingTop: 6,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        // LabelInput label-lift room off: the floating label overhangs into the
        // gap between fields instead of adding a block of space above each.
        ["--lbi-top" as string]: "0px",
      } as React.CSSProperties}
    >
      {/* Numbered / remove header only when the card removes itself (the carousel
          handles remove + numbering via the stepper). The ●●● health dots are
          retired — completion now reads off the stepper tick. */}
      {canRemove && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nv2-text-muted)" }}>{numbered}</span>
          <button
            type="button"
            onClick={onRemove}
            style={{ fontSize: 11, color: "var(--nv2-text-ghost)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Remove
          </button>
        </div>
      )}

      {/* Full name — circle 1 */}
      <FieldRow n={1} state={nameFieldState(contact.name)}>
        <LabelInput
          field="name"
          label={`${isBiz ? "Company" : "Full name"}${isOutsourced ? " *" : ""}`}
          type="text"
          accent={CORAL}
          fullWidth
          value={contact.name}
          onChange={(e) => { onChange({ name: e.target.value }); onEdit(); }}
          onBlur={(e) => { if (e.target.value.trim()) onChange({ name: titleCaseKeepAcronyms(e.target.value) }); }}
        />
        {isBiz && (
          <div style={{ marginTop: 8 }}>
            {/* "Not a company" moves to a right-aligned link above the field, since the
                canonical LabelInput owns its own floating "Who should we address?" label. */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
              <button
                type="button"
                onClick={() => { onChange({ bizDismissed: true, contactPerson: "" }); onEdit(); }}
                style={{ fontSize: 11, color: "var(--nv2-text-ghost)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}
              >
                Not a company
              </button>
            </div>
            <div style={{ ["--lbi-top" as string]: "0px" } as React.CSSProperties}>
              <LabelInput
                field="contactPerson"
                label="Who should we address?"
                type="text"
                accent={CORAL}
                fullWidth
                value={contact.contactPerson ?? ""}
                onChange={(e) => { onChange({ contactPerson: e.target.value }); onEdit(); }}
                onBlur={(e) => { if (e.target.value.trim()) onChange({ contactPerson: titleCaseKeepAcronyms(e.target.value) }); }}
              />
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--nv2-text-muted)" }}>
              Looks like a company. We&rsquo;ll greet this person in emails, or keep it general if you leave it blank.
            </p>
          </div>
        )}
      </FieldRow>

      {/* Phone — circle 2 */}
      <FieldRow n={2} state={phoneFieldState(contact.phone)}>
        <LabelInput
          field="phone"
          label="Phone"
          type="tel"
          inputMode="tel"
          accent={CORAL}
          fullWidth
          value={contact.phone}
          onChange={(e) => { onChange({ phone: cleanPhone(e.target.value) }); onEdit(); }}
          onBlur={(e) => {
            const formatted = formatUKPhone(e.target.value);
            if (formatted !== e.target.value) onChange({ phone: formatted });
          }}
        />
        {conflict?.kind === "phone" && (
          <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-danger)" }}>
            {conflict.withName} already has this phone on this sale.
          </p>
        )}
      </FieldRow>

      {/* Email — circle 3 */}
      <FieldRow n={3} state={emailFieldState(contact.email)} last>
        <LabelInput
          field="email"
          label="Email"
          type="email"
          inputMode="email"
          accent={CORAL}
          fullWidth
          value={contact.email}
          onChange={(e) => { onChange({ email: e.target.value }); onEdit(); }}
          onBlur={(e) => { if (e.target.value.trim()) onChange({ email: e.target.value.trim().toLowerCase() }); }}
        />
        {conflict?.kind === "email" ? (
          <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-danger)" }}>
            {conflict.withName} already has this email on this sale.
          </p>
        ) : emailInvalid ? (
          <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-warning)" }}>
            Enter a valid email address.
          </p>
        ) : null}
      </FieldRow>

      {/* Bottom hint */}
      {isComplete ? (
        <Pill glass tone="success" size="sm" style={{ alignSelf: "flex-start", marginTop: 2 }}>
          <CheckCircle size={12} weight="fill" color="var(--agent-success)" />
          {mode === "agent" ? "Portal invite ready" : "Ready to contact"}
        </Pill>
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
  function patchContact(i: number, patch: Partial<ContactEntry>) {
    const next = contacts.map((c, idx) => idx === i ? { ...c, ...patch } : c);
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
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--nv2-text-faint)", display: "flex", alignItems: "center" }}>
          {label}
          {isOutsourced && <span style={{ color: "var(--agent-coral-deep)", marginLeft: 2, fontWeight: 700 }}>*</span>}
          <FieldIndicator source={memoSource} />
        </p>
        {contacts.length < 2 && (
          <button
            type="button"
            onClick={addContact}
            aria-label={`Add ${label.slice(0, -1).toLowerCase()}`}
            style={{ fontSize: 12, color: "var(--agent-coral-deep)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
          >
            + Add
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
            onChange={(patch) => patchContact(i, patch)}
            onRemove={() => removeContact(i)}
            onEdit={onEdit}
          />
        ))}
      </div>

      <FieldHint source={memoSource} failedText="Couldn't read this. Add contact details manually." />
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
