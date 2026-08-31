"use client";

// One stacked bottom-sheet drawer for the portal's three editable things —
// the client's own details, their chain agent, and their solicitor. Opened via
// the `portal:open-edit-drawer` window event (detail = EditDrawerConfig) from
// the Settings sections and the Overview team card. PortalShell slides the
// Settings drawer down while this is up, then restores it.
//
// Formatting: names + agency/firm title-case keeping acronyms; phone via the
// same normalizePhone the agent forms use (spaces 01992 / 020 correctly);
// email lowercased; postcode formatted + validated.

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { P } from "./portal-ui";
import { PortalButton } from "./PortalButton";
import { titleCaseKeepAcronyms, normalizePhone } from "@/lib/utils";
import { formatPostcode, isValidUKPostcode, normaliseAddressString } from "@/lib/utils/address";
import { updateMyContactAction, updateMyChainAgentAction, switchMySolicitorFirmAction, saveMyBrokerAction } from "@/app/actions/portal-menu";
import { portalChangeOnwardPlaceAction, portalAbandonOnwardAction } from "@/app/actions/portal-onward";
import type { Tenure, PurchaseType } from "@prisma/client";

export type EditDrawerConfig = {
  // "onward-change" = the seller's onward moved to a different place (address +
  // agent + tenure + method, resets the reported steps). "onward-stop" = a
  // confirm that they're no longer buying onward. "broker" = the client names
  // their own mortgage broker (only offered when no in-house/TSP broker resolved).
  kind: "details" | "agent" | "solicitor" | "onward-change" | "onward-stop" | "broker";
  mode: "add" | "edit" | "switch" | "change" | "stop";
  direction?: "above" | "below"; // agent copy: above = seller's onward, below = buyer's selling agent
  initial: {
    name?: string; email?: string; phone?: string;
    agency?: string; agentName?: string; propertyAddress?: string;
    firmName?: string; contactName?: string; brokerContact?: string;
  };
};

type F = Record<string, string>;

function parseAddress(combined?: string): { street: string; city: string; postcode: string } {
  if (!combined) return { street: "", city: "", postcode: "" };
  const parts = combined.split(",").map((s) => s.trim()).filter(Boolean);
  let postcode = "";
  if (parts.length) {
    const maybe = formatPostcode(parts[parts.length - 1]!);
    if (isValidUKPostcode(maybe)) { parts.pop(); postcode = maybe; }
  }
  const city = parts.length > 1 ? parts.pop()! : "";
  const street = parts.join(", ");
  return { street, city, postcode };
}

function headerFor(config: EditDrawerConfig): { title: string; sub: string } {
  if (config.kind === "details") return { title: "Your details", sub: "Keep your contact details up to date." };
  if (config.kind === "solicitor") return { title: "Your solicitor", sub: "Add the firm and case handler looking after your file." };
  if (config.kind === "onward-change") return { title: "Moving somewhere new?", sub: "Tell us about the property you're buying so we can show you the right steps." };
  if (config.kind === "onward-stop") return { title: "No longer buying onward?", sub: "We'll let your team know and pause your onward steps. You can pick it back up anytime." };
  if (config.kind === "broker") return { title: "Your mortgage broker", sub: config.direction === "above" ? "Using your own broker for your onward purchase? Add their details." : "Using your own broker? Add their details so we can keep in touch." };
  // agent
  return config.direction === "below"
    ? { title: "Your selling agent", sub: "Add the estate agent handling your sale so we can keep in touch and help keep the chain moving." }
    : { title: "Your onward purchase agent", sub: "Add the estate agent handling the property you're buying so we can keep in touch and help keep the chain moving." };
}

export function PortalEditDrawer({
  open, config, token, onClose,
}: {
  open: boolean;
  config: EditDrawerConfig | null;
  token: string;
  onClose: () => void;
}) {
  const [f, setF] = useState<F>({});
  const [showErrors, setShowErrors] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    const i = config.initial;
    const addr = parseAddress(i.propertyAddress);
    setF({
      name: i.name ?? "", email: i.email ?? "", phone: i.phone ?? "",
      agency: i.agency ?? "", agentName: i.agentName ?? "",
      street: addr.street, city: addr.city, postcode: addr.postcode,
      firmName: i.firmName ?? "", contactName: i.contactName ?? "",
      brokerContact: i.brokerContact ?? "",
      tenure: "", purchaseType: "", shareOfFreehold: "",
    });
    setShowErrors(false); setPostcodeError(""); setError(null);
  }, [config]);

  // Lock the page behind while the drawer is open (no scroll-through).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (typeof document === "undefined") return null;

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const blurName = (k: string) => () => setF((p) => (p[k]?.trim() ? { ...p, [k]: titleCaseKeepAcronyms(p[k]!) } : p));
  const blurPhone = (k: string) => () => setF((p) => (p[k]?.trim() ? { ...p, [k]: normalizePhone(p[k]!) } : p));
  const blurEmail = (k: string) => () => setF((p) => (p[k]?.trim() ? { ...p, [k]: p[k]!.trim().toLowerCase() } : p));
  function blurPostcode() {
    setF((p) => {
      if (!p.postcode?.trim()) { setPostcodeError(""); return p; }
      const pc = formatPostcode(p.postcode);
      setPostcodeError(isValidUKPostcode(pc) ? "" : "Doesn't look like a valid UK postcode");
      return { ...p, postcode: pc };
    });
  }

  const header = config ? headerFor(config) : { title: "", sub: "" };

  // Validation per kind.
  const postcodeOk = !!f.postcode?.trim() && isValidUKPostcode(formatPostcode(f.postcode));
  let canSave = false;
  if (config?.kind === "details") canSave = !!f.name?.trim();
  else if (config?.kind === "agent") canSave = !!f.agency?.trim() && !!f.street?.trim() && !!f.city?.trim() && postcodeOk;
  else if (config?.kind === "onward-change") canSave = !!f.agency?.trim() && !!f.street?.trim() && !!f.city?.trim() && postcodeOk && !!f.tenure && !!f.purchaseType;
  else if (config?.kind === "onward-stop") canSave = true;
  else if (config?.kind === "broker") canSave = !!f.firmName?.trim();
  else if (config?.kind === "solicitor") {
    const base = !!f.firmName?.trim() && !!f.contactName?.trim();
    // Add / switch require every field; editing an existing one needs only firm + handler.
    canSave = config.mode === "edit" ? base : base && !!f.email?.trim() && !!f.phone?.trim();
  }
  canSave = canSave && !busy;

  function save() {
    if (!config) return;
    if (!canSave) { setShowErrors(true); return; }
    setError(null);
    const email = f.email?.trim() ? f.email.trim().toLowerCase() : null;
    const phone = f.phone?.trim() ? normalizePhone(f.phone) : null;
    startTransition(async () => {
      let res: { ok: boolean; error?: string };
      let onwardChanged = false;
      if (config.kind === "details") {
        res = await updateMyContactAction({ token, name: titleCaseKeepAcronyms(f.name!), email, phone });
      } else if (config.kind === "agent") {
        const address = normaliseAddressString(`${f.street!.trim()}, ${f.city!.trim()}, ${formatPostcode(f.postcode!)}`);
        res = await updateMyChainAgentAction({
          token,
          agencyName: f.agency?.trim() ? titleCaseKeepAcronyms(f.agency) : null,
          agentName: f.agentName?.trim() ? titleCaseKeepAcronyms(f.agentName) : null,
          agentEmail: email,
          agentPhone: phone,
          propertyAddress: address,
        });
      } else if (config.kind === "onward-change") {
        const address = normaliseAddressString(`${f.street!.trim()}, ${f.city!.trim()}, ${formatPostcode(f.postcode!)}`);
        const r = await portalChangeOnwardPlaceAction({
          token,
          newAddress: address,
          agencyName: f.agency?.trim() ? titleCaseKeepAcronyms(f.agency) : null,
          agentName: f.agentName?.trim() ? titleCaseKeepAcronyms(f.agentName) : null,
          agentEmail: email,
          agentPhone: phone,
          tenure: f.tenure as Tenure,
          purchaseType: f.purchaseType as PurchaseType,
          isShareOfFreehold: f.shareOfFreehold === "1",
        });
        res = r == null ? { ok: false, error: "We couldn't save that. Try again." } : r;
        onwardChanged = res.ok;
      } else if (config.kind === "onward-stop") {
        const r = await portalAbandonOnwardAction(token);
        res = r == null ? { ok: false, error: "We couldn't save that. Try again." } : { ok: true };
        onwardChanged = res.ok;
      } else if (config.kind === "broker") {
        const r = await saveMyBrokerAction({
          token,
          name: titleCaseKeepAcronyms(f.firmName!),
          contactName: f.contactName?.trim() ? titleCaseKeepAcronyms(f.contactName) : null,
          contact: f.brokerContact?.trim() || null,
        });
        res = r == null ? { ok: false, error: "We couldn't save that. Try again." } : r;
      } else {
        res = await switchMySolicitorFirmAction({
          token,
          firmName: titleCaseKeepAcronyms(f.firmName!),
          contactName: titleCaseKeepAcronyms(f.contactName!),
          email,
          phone,
        });
      }
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("portal:details-updated"));
        if (onwardChanged) window.dispatchEvent(new CustomEvent("portal:onward-updated"));
        onClose();
      } else {
        setError(res.error ?? "We couldn't save that. Try again.");
      }
    });
  }

  const ctaLabel =
    config?.kind === "onward-change" ? "Start my new purchase"
    : config?.kind === "onward-stop" ? "Yes, I'm no longer buying onward"
    : config?.kind === "broker" ? "Save broker"
    : config?.mode === "edit" ? "Save changes"
    : config?.mode === "switch" ? "Switch firm"
    : "Confirm";

  return createPortal(
    <div aria-hidden={!open} style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: open ? "auto" : "none" }}>
      <div
        onClick={() => { if (!busy) onClose(); }}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(15,23,42,0.35)",
          backdropFilter: open ? "blur(4px)" : "blur(0px)",
          WebkitBackdropFilter: open ? "blur(4px)" : "blur(0px)",
          opacity: open ? 1 : 0,
          transition: "opacity 220ms ease, backdrop-filter 260ms ease",
        }}
      />
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
          {config && (
            <>
              <h2 className="text-[20px] font-bold leading-tight mb-1" style={{ color: P.textPrimary }}>{header.title}</h2>
              <p className="text-[13px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>{header.sub}</p>

              {config.kind === "details" && (
                <>
                  <LabeledInput label="Name" value={f.name ?? ""} onChange={set("name")} onBlur={blurName("name")} required error={showErrors && !f.name?.trim() ? "Enter your name" : ""} />
                  <LabeledInput label="Email" value={f.email ?? ""} onChange={set("email")} onBlur={blurEmail("email")} type="email" />
                  <LabeledInput label="Phone" value={f.phone ?? ""} onChange={set("phone")} onBlur={blurPhone("phone")} type="tel" />
                </>
              )}

              {config.kind === "agent" && (
                <>
                  <LabeledInput label="Agency" value={f.agency ?? ""} onChange={set("agency")} onBlur={blurName("agency")} required error={showErrors && !f.agency?.trim() ? "Enter the agency" : ""} />
                  <LabeledInput label="Agent name" value={f.agentName ?? ""} onChange={set("agentName")} onBlur={blurName("agentName")} />
                  <LabeledInput label="Email" value={f.email ?? ""} onChange={set("email")} onBlur={blurEmail("email")} type="email" />
                  <LabeledInput label="Phone" value={f.phone ?? ""} onChange={set("phone")} onBlur={blurPhone("phone")} type="tel" />
                  <div style={{ height: 1, background: P.border, margin: "10px 0 12px" }} />
                  <LabeledInput label="Street address" value={f.street ?? ""} onChange={set("street")} onBlur={blurName("street")} required error={showErrors && !f.street?.trim() ? "Enter the street address" : ""} />
                  <LabeledInput label="City / Town" value={f.city ?? ""} onChange={set("city")} onBlur={blurName("city")} required error={showErrors && !f.city?.trim() ? "Enter the city or town" : ""} />
                  <LabeledInput label="Postcode" value={f.postcode ?? ""} onChange={(v) => { set("postcode")(v.toUpperCase()); setPostcodeError(""); }} onBlur={blurPostcode} required error={postcodeError || (showErrors && !postcodeOk ? "Enter a valid postcode" : "")} />
                </>
              )}

              {config.kind === "solicitor" && (
                <>
                  <LabeledInput label="Firm name" value={f.firmName ?? ""} onChange={set("firmName")} onBlur={blurName("firmName")} required error={showErrors && !f.firmName?.trim() ? "Enter the firm name" : ""} />
                  <LabeledInput label="Handler name" value={f.contactName ?? ""} onChange={set("contactName")} onBlur={blurName("contactName")} required error={showErrors && !f.contactName?.trim() ? "Enter the handler's name" : ""} />
                  <LabeledInput label="Email" value={f.email ?? ""} onChange={set("email")} onBlur={blurEmail("email")} type="email" required={config.mode !== "edit"} error={showErrors && config.mode !== "edit" && !f.email?.trim() ? "Enter the email" : ""} />
                  <LabeledInput label="Phone" value={f.phone ?? ""} onChange={set("phone")} onBlur={blurPhone("phone")} type="tel" required={config.mode !== "edit"} error={showErrors && config.mode !== "edit" && !f.phone?.trim() ? "Enter the phone number" : ""} />
                </>
              )}

              {config.kind === "broker" && (
                <>
                  <LabeledInput label="Broker name or firm" value={f.firmName ?? ""} onChange={set("firmName")} onBlur={blurName("firmName")} required error={showErrors && !f.firmName?.trim() ? "Enter the broker name" : ""} />
                  <LabeledInput label="Contact name (optional)" value={f.contactName ?? ""} onChange={set("contactName")} onBlur={blurName("contactName")} />
                  <LabeledInput label="Phone or email (optional)" value={f.brokerContact ?? ""} onChange={set("brokerContact")} />
                </>
              )}

              {config.kind === "onward-change" && (
                <>
                  <LabeledInput label="Agency" value={f.agency ?? ""} onChange={set("agency")} onBlur={blurName("agency")} required error={showErrors && !f.agency?.trim() ? "Enter the agency" : ""} />
                  <LabeledInput label="Agent name" value={f.agentName ?? ""} onChange={set("agentName")} onBlur={blurName("agentName")} />
                  <LabeledInput label="Email" value={f.email ?? ""} onChange={set("email")} onBlur={blurEmail("email")} type="email" />
                  <LabeledInput label="Phone" value={f.phone ?? ""} onChange={set("phone")} onBlur={blurPhone("phone")} type="tel" />
                  <div style={{ height: 1, background: P.border, margin: "10px 0 12px" }} />
                  <LabeledInput label="Street address" value={f.street ?? ""} onChange={set("street")} onBlur={blurName("street")} required error={showErrors && !f.street?.trim() ? "Enter the street address" : ""} />
                  <LabeledInput label="City / Town" value={f.city ?? ""} onChange={set("city")} onBlur={blurName("city")} required error={showErrors && !f.city?.trim() ? "Enter the city or town" : ""} />
                  <LabeledInput label="Postcode" value={f.postcode ?? ""} onChange={(v) => { set("postcode")(v.toUpperCase()); setPostcodeError(""); }} onBlur={blurPostcode} required error={postcodeError || (showErrors && !postcodeOk ? "Enter a valid postcode" : "")} />
                  <div style={{ height: 1, background: P.border, margin: "10px 0 12px" }} />
                  <PillGroup label="Property type" error={showErrors && !f.tenure ? "Pick one" : ""}>
                    <Pill on={f.tenure === "freehold"} onClick={() => setF((p) => ({ ...p, tenure: "freehold", shareOfFreehold: "" }))}>Freehold</Pill>
                    <Pill on={f.tenure === "leasehold"} onClick={() => setF((p) => ({ ...p, tenure: "leasehold" }))}>Leasehold</Pill>
                  </PillGroup>
                  {f.tenure === "leasehold" && (
                    <label className="flex items-center gap-2 mb-3 text-[13px] portal-reveal-fade" style={{ color: P.textSecondary }}>
                      <input type="checkbox" checked={f.shareOfFreehold === "1"} onChange={(e) => setF((p) => ({ ...p, shareOfFreehold: e.target.checked ? "1" : "" }))} />
                      Share of freehold
                    </label>
                  )}
                  <PillGroup label="How you're buying" error={showErrors && !f.purchaseType ? "Pick one" : ""}>
                    <Pill on={f.purchaseType === "mortgage"} onClick={() => setF((p) => ({ ...p, purchaseType: "mortgage" }))}>Mortgage</Pill>
                    <Pill on={f.purchaseType === "cash_buyer"} onClick={() => setF((p) => ({ ...p, purchaseType: "cash_buyer" }))}>Cash</Pill>
                    <Pill on={f.purchaseType === "cash_from_proceeds"} onClick={() => setF((p) => ({ ...p, purchaseType: "cash_from_proceeds" }))}>Cash from this sale</Pill>
                  </PillGroup>
                  <p className="text-[12px] leading-relaxed mt-1 mb-1" style={{ color: P.textMuted }}>
                    We&apos;ll clear your current purchase steps so you can set up your new property.
                  </p>
                </>
              )}

              {error && <p className="text-[12px] mt-1 portal-reveal-fade" style={{ color: P.warning }}>{error}</p>}
            </>
          )}
        </div>

        <div className="px-6 pt-3 flex-shrink-0" style={{ borderTop: `1px solid ${P.border}`, paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}>
          <PortalButton onClick={save} loading={busy} disabled={!canSave}>{ctaLabel}</PortalButton>
          <button
            type="button"
            onClick={() => { if (!busy) onClose(); }}
            className="w-full mt-1.5 py-2.5 text-[15px] font-medium rounded-xl pbtn-press"
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
      {error && <p className="text-[11px] mt-1 portal-reveal-fade" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );
}

function PillGroup({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: P.textSecondary }}>
        {label}<span style={{ color: "#EF4444" }}> *</span>
      </label>
      <div className="flex gap-2 flex-wrap">{children}</div>
      {error && <p className="text-[11px] mt-1" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="portal-pill pbtn-press"
      style={{
        fontSize: 13, padding: "7px 13px", borderRadius: 999, cursor: "pointer",
        border: on ? `1px solid ${P.primary}` : `1px solid ${P.border}`,
        background: on ? P.primaryBg : P.cardBg,
        color: on ? P.primaryText : P.textSecondary,
        fontWeight: on ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}
