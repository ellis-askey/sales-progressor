"use client";

// Add / edit the client's chain agent (their onward or selling agent) in a
// dedicated bottom-sheet drawer. Opened from the Overview team card and from
// Settings > Your agents via the `portal:add-agent` window event; PortalShell
// slides the Settings drawer down while this one comes up, then restores it.
//
// Structured, REQUIRED address (Street / City / Postcode). Names + agency are
// title-cased keeping acronyms; postcode is formatted. Saves via the existing
// updateMyChainAgentAction; the address is recombined into one string.

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { P } from "./portal-ui";
import { PortalButton } from "./PortalButton";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { formatPostcode, isValidUKPostcode, normaliseAddressString } from "@/lib/utils/address";
import { getMyPortalDetailsAction, updateMyChainAgentAction } from "@/app/actions/portal-menu";

function parseAddress(combined: string): { street: string; city: string; postcode: string } {
  if (!combined) return { street: "", city: "", postcode: "" };
  const parts = combined.split(",").map((s) => s.trim()).filter(Boolean);
  let postcode = "";
  if (parts.length) {
    const maybe = formatPostcode(parts[parts.length - 1]!);
    if (isValidUKPostcode(maybe)) {
      parts.pop();
      postcode = maybe;
    }
  }
  const city = parts.length > 1 ? parts.pop()! : "";
  const street = parts.join(", ");
  return { street, city, postcode };
}

export function PortalAddAgentDrawer({ open, onClose, token }: { open: boolean; onClose: () => void; token: string }) {
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("Your agent");
  const [manageable, setManageable] = useState(true);

  const [agent, setAgent] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Load the current agent when the drawer opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setShowErrors(false);
    getMyPortalDetailsAction(token)
      .then((d) => {
        if (cancelled) return;
        const ca = d.chainAgent;
        setLabel(ca.label ?? "Your agent");
        setManageable(!!ca.canManage && (!ca.present || !!ca.editable));
        setAgent(ca.agentName ?? "");
        setAgency(ca.agencyName ?? "");
        setEmail(ca.agentEmail ?? "");
        setPhone(ca.agentPhone ?? "");
        const parsed = parseAddress(ca.propertyAddress ?? "");
        setStreet(parsed.street);
        setCity(parsed.city);
        setPostcode(parsed.postcode);
      })
      .catch(() => { if (!cancelled) setError("We couldn't load this. Try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, token]);

  const streetOk = street.trim().length > 0;
  const cityOk = city.trim().length > 0;
  const postcodeOk = postcode.trim().length > 0 && isValidUKPostcode(formatPostcode(postcode));
  const agentOk = agent.trim().length > 0;
  const canSave = agentOk && streetOk && cityOk && postcodeOk && !busy && !loading;

  function save() {
    if (!canSave) { setShowErrors(true); return; }
    setError(null);
    const fullAddress = normaliseAddressString(`${street.trim()}, ${city.trim()}, ${formatPostcode(postcode)}`);
    startTransition(async () => {
      const res = await updateMyChainAgentAction({
        token,
        agentName: agent ? titleCaseKeepAcronyms(agent) : null,
        agencyName: agency ? titleCaseKeepAcronyms(agency) : null,
        agentEmail: email || null,
        agentPhone: phone || null,
        propertyAddress: fullAddress,
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("portal:agent-updated"));
        onClose();
      } else {
        setError(res.error ?? "We couldn't save that. Try again.");
      }
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div aria-hidden={!open} style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: open ? "auto" : "none" }}>
      {/* Backdrop */}
      <div
        onClick={() => { if (!busy) onClose(); }}
        style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", opacity: open ? 1 : 0, transition: "opacity 220ms ease" }}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg mx-auto"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          maxHeight: "88vh", display: "flex", flexDirection: "column",
          background: P.cardBg,
          borderRadius: `${P.radiusXl} ${P.radiusXl} 0 0`,
          boxShadow: P.shadowXl,
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(139,145,163,0.30)" }} />
        </div>

        <div className="px-6 pt-1 overflow-y-auto" style={{ flex: 1 }}>
          <h2 className="text-[20px] font-bold leading-tight mb-1" style={{ color: P.textPrimary }}>{label}</h2>
          {loading ? (
            <p className="text-[13px] py-6" style={{ color: P.textMuted }}>Loading…</p>
          ) : !manageable ? (
            <p className="text-[13px] py-4" style={{ color: P.textMuted }}>Your agent will add this for you.</p>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
                Add the agent for the place you&apos;re buying so we can keep the chain moving. We won&apos;t contact them automatically.
              </p>

              <LabeledInput label="Agent name" value={agent} onChange={setAgent} onBlur={() => agent.trim() && setAgent(titleCaseKeepAcronyms(agent))} required error={showErrors && !agentOk ? "Enter the agent's name" : ""} />
              <LabeledInput label="Agency" value={agency} onChange={setAgency} onBlur={() => agency.trim() && setAgency(titleCaseKeepAcronyms(agency))} />
              <LabeledInput label="Email" value={email} onChange={setEmail} type="email" />
              <LabeledInput label="Phone" value={phone} onChange={setPhone} type="tel" />

              <div style={{ height: 1, background: P.border, margin: "10px 0 12px" }} />

              <LabeledInput label="Street address" value={street} onChange={setStreet} onBlur={() => street.trim() && setStreet(titleCaseKeepAcronyms(street))} required error={showErrors && !streetOk ? "Enter the street address" : ""} />
              <LabeledInput label="City / Town" value={city} onChange={setCity} onBlur={() => city.trim() && setCity(titleCaseKeepAcronyms(city))} required error={showErrors && !cityOk ? "Enter the city or town" : ""} />
              <LabeledInput
                label="Postcode"
                value={postcode}
                onChange={(v) => { setPostcode(v.toUpperCase()); setPostcodeError(""); }}
                onBlur={() => {
                  if (!postcode.trim()) { setPostcodeError(""); return; }
                  const f = formatPostcode(postcode);
                  setPostcode(f);
                  setPostcodeError(isValidUKPostcode(f) ? "" : "Doesn't look like a valid UK postcode");
                }}
                required
                error={postcodeError || (showErrors && !postcodeOk ? "Enter a valid postcode" : "")}
              />

              {error && <p className="text-[12px] mt-1" style={{ color: P.warning }}>{error}</p>}
            </>
          )}
        </div>

        {/* Sticky confirm CTA */}
        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${P.border}`, paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          {manageable && !loading && (
            <PortalButton onClick={save} loading={busy} disabled={!canSave}>Confirm</PortalButton>
          )}
          <button
            type="button"
            onClick={() => { if (!busy) onClose(); }}
            className="w-full mt-2 py-3 text-[15px] font-medium rounded-xl"
            style={{ color: P.textSecondary, background: "none", border: "none", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LabeledInput({
  label, value, onChange, onBlur, type = "text", required = false, error = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="block text-[12px] font-semibold mb-1" style={{ color: P.textSecondary }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-xl text-[15px]"
        style={{ padding: "10px 12px", border: `1px solid ${error ? "#EF4444" : P.border}`, background: P.pageBg, color: P.textPrimary }}
      />
      {error && <p className="text-[11px] mt-1" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );
}
