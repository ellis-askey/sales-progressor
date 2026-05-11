"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { titleCase } from "@/lib/utils";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

export type StubFormData = {
  stubPropertyAddress: string;
  stubAgencyName: string;
  stubAgentName: string;
  stubAgentEmail: string;
  stubAgentPhone: string;
  stubNotes: string;
};

// Minimal editing contract — superset types like ChainLinkV2 are accepted via structural typing
export type EditingLinkData = {
  id: string;
  stubPropertyAddress?: string | null;
  stubAgencyName?: string | null;
  stubAgentName?: string | null;
  stubAgentEmail?: string | null;
  stubAgentPhone?: string | null;
  stubNotes?: string | null;
};

type Props = {
  // Existing-chain context: chainId present → API call on save
  chainId?: string;
  transactionId?: string;
  direction: "above" | "below";
  editingLink?: EditingLinkData;
  // New-transaction context: onSaveToMemory captures stub in parent state
  onSaveToMemory?: (data: StubFormData, direction: "above" | "below") => void;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY_FORM: StubFormData = {
  stubPropertyAddress: "",
  stubAgencyName: "",
  stubAgentName: "",
  stubAgentEmail: "",
  stubAgentPhone: "",
  stubNotes: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="agent-section-label mb-2">
      {children}
    </p>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  required,
  error,
  maxLength,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  rows?: number;
}) {
  const inputClass =
    "w-full glass-input agent-focus text-sm px-3 py-2 rounded-lg text-slate-900/90 placeholder:text-slate-900/30 transition-all";

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-semibold text-slate-900/65">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          className={inputClass}
        />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function AddNodeDrawer({
  chainId,
  transactionId: _transactionId,
  direction,
  editingLink,
  onSaveToMemory,
  onClose,
  onSaved,
}: Props) {
  const theme = usePortalTheme();
  const isEditMode = !!editingLink;
  const isExistingChain = !!chainId;

  const [form, setForm] = useState<StubFormData>(() =>
    editingLink
      ? {
          stubPropertyAddress: editingLink.stubPropertyAddress ?? "",
          stubAgencyName: editingLink.stubAgencyName ?? "",
          stubAgentName: editingLink.stubAgentName ?? "",
          stubAgentEmail: editingLink.stubAgentEmail ?? "",
          stubAgentPhone: editingLink.stubAgentPhone ?? "",
          stubNotes: editingLink.stubNotes ?? "",
        }
      : EMPTY_FORM,
  );

  const [emailError, setEmailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  // Esc key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function update(field: keyof StubFormData) {
    return (v: string) => setForm((f) => ({ ...f, [field]: v }));
  }

  function applyTitleCase(field: keyof StubFormData) {
    return () => {
      const val = form[field];
      if (typeof val === "string" && val.trim()) {
        setForm((f) => ({ ...f, [field]: titleCase(val) }));
      }
    };
  }

  function validateEmail(): boolean {
    if (!form.stubAgentEmail.trim()) {
      setEmailError("");
      return true;
    }
    if (!EMAIL_RE.test(form.stubAgentEmail.trim())) {
      setEmailError("Enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  }

  const requiredFilled =
    form.stubPropertyAddress.trim().length >= 3 &&
    form.stubAgencyName.trim().length >= 2;

  const hasValidEmail =
    !!form.stubAgentEmail.trim() && EMAIL_RE.test(form.stubAgentEmail.trim());

  function helperText(): string {
    if (!requiredFilled) return "Property address and agency name are required";
    if (!form.stubAgentEmail.trim()) return "No invite will be sent — you can add an email later";
    if (!hasValidEmail) return "Enter a valid email address";
    if (isExistingChain) return "Invite will be sent now";
    return "Invite will be sent when you save the chain";
  }

  async function handleSave() {
    if (!requiredFilled) return;
    if (!validateEmail()) return;

    // In-memory context (new transaction page)
    if (onSaveToMemory) {
      onSaveToMemory(form, direction);
      onSaved();
      return;
    }

    // Existing chain context — API call
    if (!chainId) return;
    setSaving(true);
    setServerError("");

    try {
      const url = isEditMode && editingLink
        ? `/api/chains/${chainId}/links/${editingLink.id}`
        : `/api/chains/${chainId}/links`;

      const res = await fetch(url, {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          stubPropertyAddress: form.stubPropertyAddress.trim(),
          stubAgencyName: form.stubAgencyName.trim(),
          stubAgentName: form.stubAgentName.trim() || null,
          stubAgentEmail: form.stubAgentEmail.trim().toLowerCase() || null,
          stubAgentPhone: form.stubAgentPhone.trim() || null,
          stubNotes: form.stubNotes.trim() || null,
          sendInviteNow: isExistingChain && hasValidEmail && !isEditMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setServerError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const title = isEditMode
    ? "Edit sale"
    : direction === "above"
    ? "Add sale above"
    : "Add sale below";

  const submitLabel = isEditMode
    ? "Save changes"
    : direction === "above"
    ? "Save and add above"
    : "Save and add below";

  const directionPill = !isEditMode && (
    <span className="agent-chain-callout text-[10px] font-semibold px-2 py-0.5 rounded-full">
      {direction === "above" ? "↑ Above" : "↓ Below"}
    </span>
  );

  return createPortal(
    <div data-theme={theme} className="fixed inset-0 flex justify-end" style={{ zIndex: 1000 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={onClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={title}
        className="relative z-10 w-full sm:max-w-[440px] flex flex-col h-full"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(32px) saturate(1.8)",
          WebkitBackdropFilter: "blur(32px) saturate(1.8)",
          borderTop: "2px solid var(--agent-coral-deep)",
          borderLeft: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.20)",
          animation: "agent-drawer-in 280ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/40 bg-white/20 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-semibold text-slate-900/85">{title}</h2>
              {directionPill}
            </div>
            <p className="text-xs text-slate-900/50">Tell us about this sale</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Property section */}
          <div>
            <SectionLabel>Property</SectionLabel>
            <div className="rounded-xl bg-white/40 border border-white/50 px-4 py-3">
              <Field
                label="Property address"
                required
                value={form.stubPropertyAddress}
                onChange={update("stubPropertyAddress")}
                onBlur={applyTitleCase("stubPropertyAddress")}
                placeholder="e.g. 47 Oak Road, Bristol"
                maxLength={200}
              />
            </div>
          </div>

          {/* Agency section */}
          <div>
            <SectionLabel>Agency</SectionLabel>
            <div className="rounded-xl bg-white/40 border border-white/50 px-4 py-3">
              <Field
                label="Agency name"
                required
                value={form.stubAgencyName}
                onChange={update("stubAgencyName")}
                onBlur={applyTitleCase("stubAgencyName")}
                placeholder="e.g. Bristol Estates"
                maxLength={100}
              />
            </div>
          </div>

          {/* Agent contact section */}
          <div>
            <SectionLabel>
              Agent contact{" "}
              <span className="normal-case font-normal">(optional — add email to send invite)</span>
            </SectionLabel>
            <div className="rounded-xl agent-chain-callout px-4 py-3 space-y-3">
              <Field
                label="Agent name"
                value={form.stubAgentName}
                onChange={update("stubAgentName")}
                onBlur={applyTitleCase("stubAgentName")}
                placeholder="e.g. Sarah Jones"
                maxLength={100}
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-900/65">Agent email</label>
                <input
                  type="email"
                  value={form.stubAgentEmail}
                  onChange={(e) => { update("stubAgentEmail")(e.target.value); setEmailError(""); }}
                  onBlur={() => validateEmail()}
                  placeholder="agent@agency.co.uk"
                  className="w-full glass-input agent-focus text-sm px-3 py-2 rounded-lg text-slate-900/90 placeholder:text-slate-900/30 transition-all"
                />
                {emailError && <p className="text-xs text-red-500">{emailError}</p>}
              </div>
              <Field
                label="Contact number"
                type="tel"
                value={form.stubAgentPhone}
                onChange={update("stubAgentPhone")}
                placeholder="07700 900000"
              />
            </div>
          </div>

          {/* Notes section */}
          <div>
            <SectionLabel>
              Notes <span className="normal-case font-normal">(only you see this)</span>
            </SectionLabel>
            <div className="rounded-xl bg-white/40 border border-white/50 px-4 py-3">
              <Field
                label=""
                value={form.stubNotes}
                onChange={update("stubNotes")}
                placeholder="Any context about this link…"
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>

          {serverError && (
            <p className="text-xs text-red-600 bg-red-50/60 border border-red-100 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/30 bg-white/20">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={onClose}
              className="w-24 py-2.5 text-xs rounded-xl agent-btn-ghost-bordered"
            >
              Cancel
            </button>
            <button
              onClick={() => { void handleSave(); }}
              disabled={!requiredFilled || saving}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl agent-btn-color-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : submitLabel}
            </button>
          </div>
          <p className="text-[11px] text-slate-900/45 text-center">{helperText()}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
