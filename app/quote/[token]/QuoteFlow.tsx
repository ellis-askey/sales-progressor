"use client";

import { useState, useMemo, useTransition } from "react";
import { submitQuoteRequest, type QuoteSubmitResult } from "./actions";
import type { QuoteContactMethod, QuoteContactWindow, QuoteUrgency } from "@prisma/client";
import { A } from "./ui";

type Kind = { kind: string; label: string };
type ServiceType = { id: string; kind: string; label: string; description: string | null };
type Firm = {
  id: string;
  name: string;
  kind: string;
  notes: string | null;
  website: string | null;
  logoUrl: string | null;
  serviceTypeIds: string[];
};

// Contact methods that reach the client on a phone number — picking one makes
// the phone field required.
const PHONE_METHODS: QuoteContactMethod[] = ["phone", "text", "whatsapp"];

export function QuoteFlow({
  token,
  propertyAddress,
  outwardCode,
  priceLabel,
  tenureLabel,
  kinds,
  serviceTypes,
  firms,
  contactName,
  contactEmail,
  contactPhone,
  onward = false,
}: {
  token: string;
  propertyAddress: string;
  outwardCode: string | null;
  priceLabel: string | null;
  tenureLabel: string | null;
  kinds: Kind[];
  serviceTypes: ServiceType[];
  firms: Firm[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // When true this request is for the seller's ONWARD purchase (a different
  // property), not the file it opened from. Sent to the action so it stores the
  // onward address on the quote.
  onward?: boolean;
}) {
  // When there's only one category available, pre-select it and hide the step.
  const [kind, setKind] = useState<string | null>(kinds.length === 1 ? kinds[0].kind : null);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [selectedFirms, setSelectedFirms] = useState<Set<string>>(new Set());
  const [contactMethod, setContactMethod] = useState<QuoteContactMethod>("either");
  const [contactWindow, setContactWindow] = useState<QuoteContactWindow>("anytime");
  const [urgency, setUrgency] = useState<QuoteUrgency>("flexible");
  const [notes, setNotes] = useState("");
  const [clientName, setClientName] = useState(contactName);
  const [clientEmail, setClientEmail] = useState(contactEmail);
  const [clientPhone, setClientPhone] = useState(contactPhone);

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<QuoteSubmitResult | null>(null);

  const phoneRequired = PHONE_METHODS.includes(contactMethod);

  // Service types for the chosen category.
  const kindServiceTypes = useMemo(
    () => (kind ? serviceTypes.filter((s) => s.kind === kind) : []),
    [serviceTypes, kind],
  );
  // Firms in the chosen category that offer the picked service type.
  const eligibleFirms = useMemo(() => {
    if (!kind || !serviceTypeId) return [] as Firm[];
    return firms.filter((f) => f.kind === kind && f.serviceTypeIds.includes(serviceTypeId));
  }, [firms, kind, serviceTypeId]);

  // Step numbers shift by one when the category dropdown is shown.
  const showKindStep = kinds.length > 1;
  const n = (base: number) => base + (showKindStep ? 1 : 0);

  function toggleFirm(id: string) {
    const next = new Set(selectedFirms);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedFirms(next);
  }

  function submit() {
    if (pending) return;
    startTransition(async () => {
      const r = await submitQuoteRequest({
        token,
        serviceTypeId: serviceTypeId ?? "",
        providerIds: Array.from(selectedFirms),
        contactMethod,
        contactWindow,
        urgency,
        notes,
        clientName,
        clientEmail,
        clientPhone,
        onward,
      });
      setResult(r);
      if (r.ok) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ── Success screen — full receipt of what was sent (2026-08-19) ─────────
  if (result?.ok) {
    const serviceLabel = serviceTypes.find((s) => s.id === serviceTypeId)?.label ?? "Service";
    const methodLabel: Record<QuoteContactMethod, string> = {
      either: "Phone or email", phone: "Phone", email: "Email", text: "Text message", whatsapp: "WhatsApp",
    };
    const windowLabel: Record<QuoteContactWindow, string> = {
      anytime: "Anytime", morning: "Mornings", afternoon: "Afternoons", evening: "Evenings",
    };
    const urgencyLabel: Record<QuoteUrgency, string> = {
      asap: "As soon as possible", within_week: "Within a week", flexible: "Flexible",
    };
    const sentFirms = result.firms ?? [];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Hero: tick + who it went to, surveyors shown like the picker rows */}
        <div
          style={{
            background: A.cardBg,
            backdropFilter: A.cardBlur,
            WebkitBackdropFilter: A.cardBlur,
            border: `1px solid ${A.cardBorder}`,
            borderRadius: 20,
            padding: 24,
            boxShadow: A.cardShadow,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                background: A.coralGradient,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
                boxShadow: "0 4px 14px rgba(255,107,74,0.3)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: A.textPrimary, margin: "0 0 6px" }}>Request sent</h2>
            <p style={{ fontSize: 14, color: A.textSecondary, margin: 0, lineHeight: 1.5 }}>
              Your {serviceLabel.toLowerCase()} request has gone to {result.count} firm{result.count === 1 ? "" : "s"}. They'll contact you directly with a quote.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sentFirms.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${A.inputBorder}`,
                  background: A.inputBg,
                }}
              >
                {f.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={f.logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: A.paper }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: A.bgMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: A.textFaint }}>{f.name.slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: A.textPrimary, margin: 0 }}>{f.name}</p>
                  {f.notes && (
                    <p style={{ fontSize: 12, color: A.textMuted, margin: "3px 0 0", lineHeight: 1.4 }}>{f.notes}</p>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: A.coralDark,
                    background: A.coralTint,
                    borderRadius: 999,
                    padding: "3px 10px",
                    flexShrink: 0,
                  }}
                >
                  Sent
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Receipt: everything that was sent, neatly grouped */}
        <div
          style={{
            background: A.cardBg,
            backdropFilter: A.cardBlur,
            WebkitBackdropFilter: A.cardBlur,
            border: `1px solid ${A.cardBorder}`,
            borderRadius: 20,
            padding: "18px 20px",
            boxShadow: A.cardShadow,
          }}
        >
          <p style={{ ...labelStyle, marginBottom: 10 }}>What we sent</p>

          <ShareRow label="Service" value={serviceLabel} />
          <ShareRow label="Contact by" value={methodLabel[contactMethod]} />
          <ShareRow label="Best time" value={windowLabel[contactWindow]} />
          <ShareRow label="Timeframe" value={urgencyLabel[urgency]} />

          <div style={{ borderTop: `1px solid ${A.cardBorder}`, margin: "10px 0" }} />
          <p style={{ ...labelStyle, marginBottom: 6 }}>Your details</p>
          <ShareRow label="Name" value={clientName} />
          <ShareRow label="Email" value={clientEmail} />
          {clientPhone.trim() && <ShareRow label="Phone" value={clientPhone} />}

          <div style={{ borderTop: `1px solid ${A.cardBorder}`, margin: "10px 0" }} />
          <p style={{ ...labelStyle, marginBottom: 6 }}>Property</p>
          <ShareRow label="Address" value={propertyAddress} />
          {priceLabel && <ShareRow label="Price" value={priceLabel} />}
          {tenureLabel && <ShareRow label="Tenure" value={tenureLabel} />}

          {notes.trim() && (
            <>
              <div style={{ borderTop: `1px solid ${A.cardBorder}`, margin: "10px 0" }} />
              <p style={{ ...labelStyle, marginBottom: 6 }}>Your note to the firm{result.count === 1 ? "" : "s"}</p>
              <p style={{ fontSize: 13, color: A.textPrimary, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{notes.trim()}</p>
            </>
          )}
        </div>

        <p style={{ fontSize: 13, color: A.textMuted, margin: 0, lineHeight: 1.5, textAlign: "center", padding: "0 8px" }}>
          If you don't hear back within a couple of days, let your agent know.
        </p>
      </div>
    );
  }

  // ── Zero coverage — friendly empty state ────────────────────────────────
  if (firms.length === 0) {
    return (
      <div
        style={{
          background: A.cardBg,
          backdropFilter: A.cardBlur,
          WebkitBackdropFilter: A.cardBlur,
          border: `1px solid ${A.cardBorder}`,
          borderRadius: 20,
          padding: 24,
          textAlign: "center",
          boxShadow: A.cardShadow,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: A.textPrimary, margin: "0 0 8px" }}>
          No firms available yet
        </h2>
        <p style={{ fontSize: 14, color: A.textMuted, margin: 0, lineHeight: 1.5 }}>
          We don't currently have any firms covering{" "}
          <strong style={{ color: A.textSecondary, fontFamily: "monospace" }}>
            {outwardCode ?? "your postcode"}
          </strong>
          . We're expanding our network. In the meantime, please ask your agent for a recommendation.
        </p>
      </div>
    );
  }

  const canSubmit =
    !!serviceTypeId &&
    selectedFirms.size > 0 &&
    !!clientName.trim() &&
    !!clientEmail.trim() &&
    (!phoneRequired || !!clientPhone.trim()) &&
    !pending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Step 1: pick provider category (hidden when only one is available) */}
      {showKindStep && (
        <StepCard number={1} title="What do you need?">
          <select
            value={kind ?? ""}
            onChange={(e) => {
              setKind(e.target.value || null);
              setServiceTypeId(null);
              setSelectedFirms(new Set());
            }}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="">Choose a type of provider…</option>
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </StepCard>
      )}

      {/* Service type (after a category is chosen) */}
      {kind && (
      <StepCard number={n(1)} title="What service do you need?">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kindServiceTypes.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServiceTypeId(s.id);
                // Clear firm selection when switching service — some firms might not offer the new one
                setSelectedFirms(new Set());
              }}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 12,
                border: serviceTypeId === s.id ? `2px solid ${A.coralTintBorder}` : `1px solid ${A.inputBorder}`,
                background: serviceTypeId === s.id ? A.coralTint : A.inputBg,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: A.textPrimary, margin: "0 0 3px" }}>{s.label}</p>
              {s.description && (
                <p style={{ fontSize: 12, color: A.textMuted, margin: 0, lineHeight: 1.4 }}>{s.description}</p>
              )}
            </button>
          ))}
        </div>
      </StepCard>
      )}

      {/* Pick firms (only visible after a service is chosen) */}
      {serviceTypeId && (
        <StepCard
          number={n(2)}
          title={`Pick a firm (${eligibleFirms.length})`}
          subtitle="You can select more than one. They'll each send you a quote."
        >
          {eligibleFirms.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted, padding: "12px 0", margin: 0 }}>
              None of the available firms offer this service. Try picking a different service above.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {eligibleFirms.map((f) => {
                const isSelected = selectedFirms.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFirm(f.id)}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: isSelected ? `2px solid ${A.coralTintBorder}` : `1px solid ${A.inputBorder}`,
                      background: isSelected ? A.coralTint : A.inputBg,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {f.logoUrl ? (
                      <img
                        src={f.logoUrl}
                        alt=""
                        style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: A.paper }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: A.bgMid,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: 18, fontWeight: 700, color: A.textFaint }}>
                          {f.name.slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: A.textPrimary, margin: "0 0 3px" }}>{f.name}</p>
                      {f.notes && (
                        <p style={{ fontSize: 12, color: A.textMuted, margin: 0, lineHeight: 1.4 }}>{f.notes}</p>
                      )}
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        border: isSelected ? "none" : `2px solid ${A.inputBorder}`,
                        background: isSelected ? A.coralDeep : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </StepCard>
      )}

      {/* Step 3: preferences (visible after firm picked) */}
      {serviceTypeId && selectedFirms.size > 0 && (
        <StepCard number={n(3)} title="How should they contact you?">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <RadioRow
              label="Best way to reach you"
              value={contactMethod}
              onChange={(v) => setContactMethod(v as QuoteContactMethod)}
              options={[
                { value: "either", label: "Either phone or email" },
                { value: "phone", label: "Phone" },
                { value: "email", label: "Email" },
                { value: "text", label: "Text message" },
                { value: "whatsapp", label: "WhatsApp" },
              ]}
            />
            <RadioRow
              label="Best time of day"
              value={contactWindow}
              onChange={(v) => setContactWindow(v as QuoteContactWindow)}
              options={[
                { value: "anytime", label: "Anytime" },
                { value: "morning", label: "Morning" },
                { value: "afternoon", label: "Afternoon" },
                { value: "evening", label: "Evening" },
              ]}
            />
            <RadioRow
              label="How soon do you need this?"
              value={urgency}
              onChange={(v) => setUrgency(v as QuoteUrgency)}
              options={[
                { value: "asap", label: "As soon as possible" },
                { value: "within_week", label: "Within a week" },
                { value: "flexible", label: "Flexible" },
              ]}
            />
            <div>
              <label style={labelStyle}>Anything else they should know? (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. There's tenants until the end of the month. Or specific concerns you'd like them to look at."
                style={{
                  ...inputStyle,
                  resize: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </StepCard>
      )}

      {/* Step 4: your contact details */}
      {serviceTypeId && selectedFirms.size > 0 && (
        <StepCard number={n(4)} title="Your details" subtitle="We've pre-filled from your file. Edit anything that needs updating.">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Phone {phoneRequired ? "(required for the way you chose to be contacted)" : "(optional but recommended)"}
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                style={{
                  ...inputStyle,
                  border: phoneRequired && !clientPhone.trim() ? `1.5px solid ${A.dangerBorder}` : inputStyle.border,
                }}
              />
            </div>
          </div>
        </StepCard>
      )}

      {/* Read-only: what the surveyor will see about the property */}
      {serviceTypeId && selectedFirms.size > 0 && (
        <div
          style={{
            background: A.cardBg,
            backdropFilter: A.cardBlur,
            WebkitBackdropFilter: A.cardBlur,
            border: `1px solid ${A.cardBorder}`,
            borderRadius: 20,
            padding: "16px 20px",
            boxShadow: A.cardShadow,
          }}
        >
          <p style={{ ...labelStyle, marginBottom: 10 }}>What the firm will see</p>
          <ShareRow label="Property" value={propertyAddress} />
          {priceLabel && <ShareRow label="Price" value={priceLabel} />}
          {tenureLabel && <ShareRow label="Tenure" value={tenureLabel} />}
          {!priceLabel && !tenureLabel && (
            <p style={{ fontSize: 12, color: A.textMuted, margin: "8px 0 0", lineHeight: 1.4 }}>
              We'll pass on the property details we hold on your file.
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      {serviceTypeId && selectedFirms.size > 0 && (
        <div>
          {result?.ok === false && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: A.dangerBg,
                border: `1px solid ${A.dangerBorder}`,
                color: A.danger,
                fontSize: 13,
              }}
            >
              {result.error}
            </div>
          )}
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 14,
              border: "none",
              background: canSubmit ? A.coralGradient : A.bgWarm,
              color: canSubmit ? "white" : A.textFaint,
              fontSize: 15,
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.15s",
              boxShadow: canSubmit ? "0 6px 22px -6px rgba(255, 107, 74, 0.5)" : "none",
            }}
          >
            {pending
              ? "Sending…"
              : `Request quote${selectedFirms.size > 1 ? "s" : ""} from ${selectedFirms.size} firm${selectedFirms.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

function ShareRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "5px 0", alignItems: "baseline" }}>
      <span style={{ fontSize: 12, color: A.textMuted, width: 96, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: A.textPrimary, fontWeight: 600, lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

function StepCard({
  number,
  title,
  subtitle,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: A.cardBg,
        backdropFilter: A.cardBlur,
        WebkitBackdropFilter: A.cardBlur,
        border: `1px solid ${A.cardBorder}`,
        borderRadius: 20,
        padding: 20,
        boxShadow: A.cardShadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: subtitle ? 4 : 14 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: A.coralGradient,
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {number}
        </span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: A.textPrimary, margin: 0 }}>{title}</h2>
      </div>
      {subtitle && (
        <p style={{ fontSize: 12, color: A.textMuted, margin: "0 0 14px", paddingLeft: 34 }}>
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

function RadioRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: value === o.value ? `1.5px solid ${A.coralTintBorder}` : `1px solid ${A.inputBorder}`,
              background: value === o.value ? A.coralTint : A.inputBg,
              color: value === o.value ? A.coralDark : A.textSecondary,
              fontSize: 13,
              fontWeight: value === o.value ? 600 : 500,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: A.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${A.inputBorder}`,
  background: A.inputBg,
  fontSize: 14,
  color: A.textPrimary,
  outline: "none",
  transition: "border-color 0.15s",
};
