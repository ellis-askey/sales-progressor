"use client";

import { useState, useMemo, useTransition } from "react";
import { submitQuoteRequest, type QuoteSubmitResult } from "./actions";
import type { QuoteContactMethod, QuoteContactWindow, QuoteUrgency } from "@prisma/client";
import { A } from "./ui";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { CheckCardGroup } from "@/components/arc/check-card-group/check-card-group";
import { LabelInput } from "@/components/ui/LabelInput";
import "@/components/arc/cookie-consent/scope.css";

// The brand coral, for the arc token overrides (radio highlight + chip tint).
const CORAL = "#FF6B4A";
const chipScope = { "--accent": CORAL, "--accent-strong": CORAL, "--accent-foreground": "#ffffff", "--foreground": A.coralDark } as React.CSSProperties;

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
  firstName,
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
  // The client's first name, for the page header. Extracted server-side.
  firstName: string;
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
  // Onward only: the seller can add the price they agreed for the property
  // they're buying (we don't hold it on their file). Optional.
  const [onwardPrice, setOnwardPrice] = useState("");
  const onwardPricePence = (() => {
    const digits = onwardPrice.replace(/[^\d]/g, "");
    if (!digits) return null;
    const pounds = parseInt(digits, 10);
    return Number.isFinite(pounds) && pounds > 0 ? pounds * 100 : null;
  })();
  // The price shown to the firm: the seller's typed onward price, or the file's
  // own price for a normal buyer request.
  const effectivePriceLabel = onward
    ? (onwardPricePence != null ? `£${(onwardPricePence / 100).toLocaleString("en-GB")}` : null)
    : priceLabel;

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
        onwardPricePence,
      });
      setResult(r);
      if (r.ok) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Success-screen "Request something else" — clears the picker back to step 1
  // but keeps the client's contact details so they don't retype them (e.g. a
  // surveyor request followed by a mortgage broker).
  function requestAnother() {
    setResult(null);
    setServiceTypeId(null);
    setSelectedFirms(new Set());
    setNotes("");
    // Re-open the category choice only when there's more than one to pick from.
    if (kinds.length > 1) setKind(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        <QuoteHeader sent firstName={firstName} address={propertyAddress} count={result.count} />

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
                background: A.coralDeep,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: A.textPrimary, margin: "0 0 6px" }}>Request sent</h2>
            <p style={{ fontSize: 14, color: A.textSecondary, margin: 0, lineHeight: 1.5 }}>
              Your request for {serviceLabel.toLowerCase()} has been sent to {result.count} firm{result.count === 1 ? "" : "s"}. They'll be in touch directly.
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
          <p style={{ ...labelStyle, marginBottom: 10 }}>Your request</p>

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
          {effectivePriceLabel && <ShareRow label="Price" value={effectivePriceLabel} />}
          {tenureLabel && <ShareRow label="Tenure" value={tenureLabel} />}

          {notes.trim() && (
            <>
              <div style={{ borderTop: `1px solid ${A.cardBorder}`, margin: "10px 0" }} />
              <p style={{ ...labelStyle, marginBottom: 6 }}>Your note to the firm{result.count === 1 ? "" : "s"}</p>
              <p style={{ fontSize: 13, color: A.textPrimary, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{notes.trim()}</p>
            </>
          )}
        </div>

        <button
          onClick={requestAnother}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 14,
            border: `1.5px solid ${A.coralTintBorder}`,
            background: A.coralTint,
            color: A.coralDark,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Request another quote
        </button>

        <p style={{ fontSize: 13, color: A.textMuted, margin: 0, lineHeight: 1.5, textAlign: "center", padding: "0 8px" }}>
          If you don't hear back within a couple of days, let your agent know.
        </p>
      </div>
    );
  }

  // ── Zero coverage — friendly empty state ────────────────────────────────
  if (firms.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <QuoteHeader sent={false} firstName={firstName} address={propertyAddress} count={0} />
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
      <style>{`.quote-rg-nolegend legend { position: absolute; width: 1px; height: 1px; padding: 0; margin: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }`}</style>
      <QuoteHeader sent={false} firstName={firstName} address={propertyAddress} count={0} />

      {/* Step 1: pick provider category (hidden when only one is available) */}
      {showKindStep && (
        <StepCard number={1} title="What type of firm do you need?">
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
      <StepCard number={n(1)} title="Which service do you need?">
        {/* Canonical arc RadioGroup — its legend is sr-only here because the
            StepCard title owns the visible heading. */}
        <div className="quote-rg-nolegend">
          {kindServiceTypes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: A.textMuted, lineHeight: 1.5 }}>
              Nothing available here yet. Please ask your agent for a recommendation.
            </p>
          ) : (
            <RadioGroup
              label="Service"
              name="quote-service"
              value={serviceTypeId ?? ""}
              onValueChange={(v) => {
                setServiceTypeId(v);
                // Clear firm selection when switching service — some firms might not offer the new one
                setSelectedFirms(new Set());
              }}
              options={kindServiceTypes.map((s) => ({ value: s.id, label: s.label, description: s.description ?? undefined }))}
            />
          )}
        </div>
      </StepCard>
      )}

      {/* Pick firms (only visible after a service is chosen) */}
      {serviceTypeId && (
        <StepCard
          number={n(2)}
          title={`Choose your firms (${eligibleFirms.length})`}
          subtitle="You can select more than one to compare quotes."
        >
          {eligibleFirms.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted, padding: "12px 0", margin: 0 }}>
              None of the available firms offer this service. Try picking a different service above.
            </p>
          ) : (
            // Canonical arc CheckCardGroup — legend sr-only (StepCard owns the heading).
            <div className="quote-rg-nolegend">
              <CheckCardGroup
                label="Firms"
                name="quote-firms"
                value={Array.from(selectedFirms)}
                onValueChange={(ids) => setSelectedFirms(new Set(ids))}
                options={eligibleFirms.map((f) => ({
                  value: f.id,
                  label: f.name,
                  description: f.notes ?? undefined,
                  leading: <FirmLogo firm={f} />,
                }))}
              />
            </div>
          )}
        </StepCard>
      )}

      {/* Step 3: preferences (visible after firm picked) */}
      {serviceTypeId && selectedFirms.size > 0 && (
        <StepCard number={n(3)} title="How should they contact you?">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <RadioRow
              label="Preferred contact method"
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
              label="Best time to contact you"
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12, "--lbi-top": "0px" } as React.CSSProperties}>
            <LabelInput
              label="Full name" type="text" name="quote-name" accent={CORAL} fullWidth
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              onBlur={(e) => { if (e.target.value.trim()) setClientName(titleCaseKeepAcronyms(e.target.value)); }}
            />
            <LabelInput
              label="Email address" type="email" name="quote-email" autoComplete="email" accent={CORAL} fullWidth
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              onBlur={(e) => { if (e.target.value.trim()) setClientEmail(e.target.value.trim().toLowerCase()); }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <LabelInput
                label="Phone number" type="tel" name="quote-phone"
                accent={phoneRequired && !clientPhone.trim() ? A.danger : CORAL}
                fullWidth
                value={clientPhone}
                onChange={(e) => setClientPhone(cleanPhone(e.target.value))}
                onBlur={(e) => { if (e.target.value.trim()) setClientPhone(formatUKPhone(e.target.value)); }}
              />
              <p style={{ fontSize: 11, color: phoneRequired && !clientPhone.trim() ? A.danger : A.textMuted, margin: 0, lineHeight: 1.4 }}>
                {phoneRequired ? "Required for the way you chose to be contacted" : "Optional but recommended"}
              </p>
            </div>
            {onward && (
              <div>
                <label style={labelStyle}>
                  Agreed purchase price <span style={{ color: A.textMuted, fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: A.textMuted, fontSize: 15, pointerEvents: "none" }}>&pound;</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={onwardPrice}
                    onChange={(e) => setOnwardPrice(e.target.value)}
                    placeholder="e.g. 450,000"
                    style={{ ...inputStyle, paddingLeft: 26 }}
                  />
                </div>
                <p style={{ fontSize: 12, color: A.textMuted, margin: "4px 0 0", lineHeight: 1.4 }}>
                  What you agreed to pay for the property. Helps the surveyor quote accurately.
                </p>
              </div>
            )}

            {/* What the firm will see — folded into this card (2026-08-27) so
                the property summary and the client's details read as one. */}
            <div style={{ borderTop: `1px solid ${A.cardBorder}`, marginTop: 2, paddingTop: 14 }}>
              <p style={{ ...labelStyle, marginBottom: 8 }}>What the firm will see</p>
              <ShareRow label="Property" value={propertyAddress} />
              {effectivePriceLabel && <ShareRow label="Price" value={effectivePriceLabel} />}
              {tenureLabel && <ShareRow label="Tenure" value={tenureLabel} />}
              {!effectivePriceLabel && !tenureLabel && (
                <p style={{ fontSize: 12, color: A.textMuted, margin: "8px 0 0", lineHeight: 1.4 }}>
                  We'll pass on the property details we hold on your file.
                </p>
              )}
            </div>
          </div>
        </StepCard>
      )}

      {/* Sticky submit — rises + fades in once a service and firm are picked, so
          it's always in reach instead of buried below four cards. Same frosted
          glass as the cards above it (A.card* tokens). Page bottom padding
          (page.tsx) gives the footer room to clear it. */}
      {serviceTypeId && selectedFirms.size > 0 && (
        <div
          className="quote-enter"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            background: A.cardBg,
            backdropFilter: A.cardBlur,
            WebkitBackdropFilter: A.cardBlur,
            borderTop: `1px solid ${A.cardBorder}`,
            padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
            boxShadow: "0 -6px 24px rgba(45,24,16,0.08)",
          }}
        >
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            {result?.ok === false && (
              <div
                style={{
                  marginBottom: 10,
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
                background: canSubmit ? A.coralDeep : A.bgWarm,
                color: canSubmit ? "white" : A.textFaint,
                fontSize: 15,
                fontWeight: 700,
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "all 0.15s",
                boxShadow: "none",
              }}
            >
              {pending ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <span className="quote-spinner" aria-hidden="true" />
                  Sending…
                </span>
              ) : (
                `Request quote${selectedFirms.size > 1 ? "s" : ""} from ${selectedFirms.size} firm${selectedFirms.size === 1 ? "" : "s"}`
              )}
            </button>
            <p style={{ margin: "12px 0 0", fontSize: 12, color: A.textFaint, textAlign: "center", lineHeight: 1.5 }}>
              By requesting a quote you agree to our{" "}
              <a href="/provider-terms" target="_blank" rel="noopener noreferrer" className="quote-link">
                Provider Request Service Terms
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────

// Page header that reacts to where you are in the flow. While choosing it
// asks "what do you need?"; once sent it becomes a warm confirmation. The
// `key` flips on state change so the new copy rises + fades in (.quote-enter,
// silenced under reduced motion) — the "fade out, fade in" the brief asked for.
function QuoteHeader({
  sent,
  firstName,
  address,
  count,
}: {
  sent: boolean;
  firstName: string;
  address: string;
  count: number;
}) {
  return (
    <header key={sent ? "sent" : "ask"} className="quote-enter" style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: A.coralDeep, margin: "0 0 6px" }}>
        {sent ? "All done" : "Request a quote"}
      </p>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: A.textPrimary, letterSpacing: "-0.02em", margin: "0 0 6px", lineHeight: 1.15 }}>
        {sent ? `That's sorted, ${firstName}` : `Let's get you some quotes, ${firstName}`}
      </h1>
      <p style={{ fontSize: 14, color: A.textMuted, margin: 0, lineHeight: 1.5 }}>
        {sent ? (
          `Here's everything we sent. The ${count === 1 ? "firm" : "firms"} will be in touch directly.`
        ) : (
          <>
            For <strong style={{ color: A.textSecondary }}>{address}</strong>. We'll only share your details with the firms you choose.
          </>
        )}
      </p>
    </header>
  );
}

// The firm's logo tile (or a letter avatar), used as the CheckCardGroup leading.
function FirmLogo({ firm }: { firm: Firm }) {
  return firm.logoUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={firm.logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", background: A.paper }} />
  ) : (
    <div style={{ width: 44, height: 44, borderRadius: 10, background: A.bgMid, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: A.textFaint }}>{firm.name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

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
            background: A.coralDeep,
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
      {/* Canonical arc ChipGroup — single-select, coral accent. Clicking the
          chosen chip would clear it; we ignore the empty so one stays chosen. */}
      <div className="arc-scope" style={chipScope}>
        <ChipGroup
          label={label}
          multiple={false}
          options={options}
          value={value ? [value] : []}
          onValueChange={(next) => { const v = next[0]; if (v) onChange(v); }}
        />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: A.textSecondary,
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
