"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { AddressFields, parseAddressForEdit } from "@/components/transactions-v2/form/AddressFields";
import { Pill } from "@/components/ui/Pill";

function joinAddress(street: string, city: string, postcode: string): string {
  return [street.trim(), city.trim(), postcode.trim()].filter(Boolean).join(", ");
}

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

export type AddNodeSavedResult = {
  kind: "added" | "edited";
  inviteSent: boolean;
};

type Props = {
  // Existing-chain context: chainId present → API call on save
  chainId?: string;
  transactionId?: string;
  direction: "above" | "below";
  editingLink?: EditingLinkData;
  // When set, this adds an EXTRA onward purchase (a branch) forking above the
  // given sale, rather than a normal above/below stub.
  forkFromLinkId?: string;
  // When set, this adds a sale at the TOP of that link's column (the spine or a
  // branch) — "add above" scoped to one ladder rather than the whole chain.
  aboveOfLinkId?: string;
  // New-transaction context: onSaveToMemory captures stub in parent state
  onSaveToMemory?: (data: StubFormData, direction: "above" | "below") => void;
  onClose: () => void;
  onSaved: (result?: AddNodeSavedResult) => void;
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
  forkFromLinkId,
  aboveOfLinkId,
  onSaveToMemory,
  onClose,
  onSaved,
}: Props) {
  const isBranch = !!forkFromLinkId;
  const { theme } = usePortalTheme();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  function doClose() {
    if (!closing) {
      setClosing(true);
      closeTimer.current = setTimeout(onClose, 200);
    }
  }
  const isEditMode = !!editingLink;
  const isExistingChain = !!chainId;

  const initialAddress = editingLink
    ? parseAddressForEdit(editingLink.stubPropertyAddress ?? "")
    : { streetAddress: "", city: "", postcode: "" };

  const [streetAddress, setStreetAddress] = useState(initialAddress.streetAddress);
  const [city, setCity] = useState(initialAddress.city);
  const [postcode, setPostcode] = useState(initialAddress.postcode);

  const [form, setForm] = useState<Omit<StubFormData, "stubPropertyAddress">>(() =>
    editingLink
      ? {
          stubAgencyName: editingLink.stubAgencyName ?? "",
          stubAgentName: editingLink.stubAgentName ?? "",
          stubAgentEmail: editingLink.stubAgentEmail ?? "",
          stubAgentPhone: editingLink.stubAgentPhone ?? "",
          stubNotes: editingLink.stubNotes ?? "",
        }
      : {
          stubAgencyName: "",
          stubAgentName: "",
          stubAgentEmail: "",
          stubAgentPhone: "",
          stubNotes: "",
        },
  );

  const stubPropertyAddress = joinAddress(streetAddress, city, postcode);

  const [emailError, setEmailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  // Add mode: a hand-typed placeholder ("stub") or one of your own live files
  // ("own"). Self-linking only makes sense on an existing chain (there's an API
  // to hit) and never while editing an existing link.
  const canSelfLink = isExistingChain && !isEditMode;
  const [mode, setMode] = useState<"stub" | "own">("stub");
  const [fileQuery, setFileQuery] = useState("");
  const [fileResults, setFileResults] = useState<{ id: string; propertyAddress: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ id: string; propertyAddress: string } | null>(null);
  const [searching, setSearching] = useState(false);

  // Debounced search over your own eligible files when in "own" mode.
  useEffect(() => {
    if (mode !== "own" || !chainId) return;
    let active = true;
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/chains/${chainId}/link-candidates?q=${encodeURIComponent(fileQuery.trim())}`)
        .then((r) => r.json().catch(() => ({ files: [] })))
        .then((data: { files?: { id: string; propertyAddress: string }[] }) => {
          if (active) setFileResults(data.files ?? []);
        })
        .catch(() => { if (active) setFileResults([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 220);
    return () => { active = false; clearTimeout(t); };
  }, [mode, fileQuery, chainId]);

  // Esc key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  type FormField = Exclude<keyof StubFormData, "stubPropertyAddress">;

  function update(field: FormField) {
    return (v: string) => setForm((f) => ({ ...f, [field]: v }));
  }

  function applyTitleCase(field: FormField) {
    return () => {
      const val = form[field];
      if (val.trim()) {
        setForm((f) => ({ ...f, [field]: titleCaseKeepAcronyms(val) }));
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
    stubPropertyAddress.trim().length >= 3 &&
    form.stubAgencyName.trim().length >= 2;

  const hasValidEmail =
    !!form.stubAgentEmail.trim() && EMAIL_RE.test(form.stubAgentEmail.trim());

  function helperText(): string {
    if (!requiredFilled) return "Add a property address and agency name to continue.";
    if (form.stubAgentEmail.trim() && !hasValidEmail) return "Enter a valid email address";
    // Editing never sends an invite (sendInviteNow is false in edit mode) — say so
    // honestly rather than promising an invite that won't go out.
    if (isEditMode) return "Changes saved. To invite them, use Send invite on their card.";
    if (!form.stubAgentEmail.trim()) return "No invite sent yet. You can add an email later.";
    if (isExistingChain) return "Saved without an invite. Use Send invite on their card when you're ready.";
    return "Invite sent when you save the chain.";
  }

  async function handleSave() {
    // Self-link mode: drop one of your own files in as a claimed node.
    if (mode === "own") {
      if (!chainId || !selectedFile) return;
      setSaving(true);
      setServerError("");
      try {
        const res = await fetch(`/api/chains/${chainId}/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            linkTransactionId: selectedFile.id,
            ...(isBranch
              ? { forkFromLinkId }
              : aboveOfLinkId
                ? { aboveOfLinkId }
                : { direction }),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          setServerError(data.error ?? "Something went wrong. Try again.");
          return;
        }
        onSaved({ kind: "added", inviteSent: false });
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!requiredFilled) return;
    if (!validateEmail()) return;

    // In-memory context (new transaction page)
    if (onSaveToMemory) {
      onSaveToMemory({ ...form, stubPropertyAddress }, direction);
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
          // Three add shapes: a branch (extra onward, forkFromLinkId), a
          // column-top add (aboveOfLinkId), or a plain spine above/below stub.
          ...(isBranch
            ? { forkFromLinkId }
            : aboveOfLinkId
              ? { aboveOfLinkId }
              : { direction }),
          stubPropertyAddress: stubPropertyAddress.trim(),
          stubAgencyName: form.stubAgencyName.trim(),
          stubAgentName: form.stubAgentName.trim() || null,
          stubAgentEmail: form.stubAgentEmail.trim().toLowerCase() || null,
          stubAgentPhone: form.stubAgentPhone.trim() || null,
          stubNotes: form.stubNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setServerError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      if (isEditMode) {
        onSaved({ kind: "edited", inviteSent: false });
      } else {
        const data = await res.json().catch(() => ({})) as { inviteSent?: boolean };
        onSaved({ kind: "added", inviteSent: !!data.inviteSent });
      }
    } finally {
      setSaving(false);
    }
  }

  const title = isEditMode
    ? "Edit sale"
    : isBranch
    ? "Add another onward purchase"
    : direction === "above"
    ? "Add sale above"
    : "Add sale below";

  const submitLabel = mode === "own"
    ? "Add to chain"
    : isEditMode
    ? "Save changes"
    : isBranch
    ? "Save onward purchase"
    : direction === "above"
    ? "Save and add above"
    : "Save and add below";

  // Whether the primary button is enabled: a picked file in own mode, or the
  // required stub fields in stub mode.
  const canSubmit = mode === "own" ? !!selectedFile : requiredFilled;

  const directionPill = !isEditMode && (
    <Pill glass tone="info" size="sm">
      {direction === "above" ? "↑ Above" : "↓ Below"}
    </Pill>
  );

  return createPortal(
    <div data-theme={theme} className="fixed inset-0 flex justify-end" style={{ zIndex: 1000 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={doClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={title}
        className="relative z-10 flex flex-col h-full"
        style={{
          width: "min(440px, 100vw)",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing
            ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
            : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</p>
            {directionPill}
          </div>
          <button onClick={doClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm">
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Mode toggle — placeholder vs one of your own files. Only on an
              existing chain (self-link needs the API). */}
          {canSelfLink && (
            <div className="chain-addmode" role="tablist" aria-label="What to add">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "stub"}
                onClick={() => setMode("stub")}
                className={`chain-addmode-tab${mode === "stub" ? " is-active" : ""}`}
              >
                Add a placeholder
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "own"}
                onClick={() => setMode("own")}
                className={`chain-addmode-tab${mode === "own" ? " is-active" : ""}`}
              >
                One of my sales
              </button>
            </div>
          )}

          {/* Own-file search (self-link) */}
          {mode === "own" && (
            <div>
              <SectionLabel>Your sale</SectionLabel>
              {selectedFile ? (
                <div className="rounded-xl bg-white/40 border border-white/50 px-4 py-3 flex items-center gap-3">
                  <p className="text-sm font-semibold text-slate-900/90 flex-1 min-w-0 truncate">
                    {selectedFile.propertyAddress}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setFileQuery(""); }}
                    className="text-xs font-semibold text-slate-900/55 hover:text-slate-900/80 transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-white/40 border border-white/50 px-4 py-3 space-y-2">
                  <input
                    type="text"
                    value={fileQuery}
                    onChange={(e) => setFileQuery(e.target.value)}
                    placeholder="Search your files by address…"
                    className="w-full glass-input agent-focus text-sm px-3 py-2 rounded-lg text-slate-900/90 placeholder:text-slate-900/30 transition-all"
                    autoFocus
                  />
                  <div className="max-h-52 overflow-y-auto -mx-1">
                    {searching && fileResults.length === 0 && (
                      <p className="px-2 py-2 text-xs text-slate-900/45">Searching…</p>
                    )}
                    {!searching && fileResults.length === 0 && (
                      <p className="px-2 py-2 text-xs text-slate-900/45">
                        {fileQuery.trim()
                          ? "No matching files that can be added."
                          : "No files ready to add. Only active sales not already in a chain show here."}
                      </p>
                    )}
                    {fileResults.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFile(f)}
                        className="chain-menu-item block w-full text-left px-2 py-2 rounded-lg text-sm text-slate-900/85"
                      >
                        {f.propertyAddress}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-900/45">
                We&apos;ll link your file directly, with its real progress. No invite needed.
              </p>
            </div>
          )}

          {/* Property section */}
          {mode === "stub" && (
          <div>
            <SectionLabel>Property</SectionLabel>
            <div className="rounded-xl bg-white/40 border border-white/50 px-4 py-3">
              <AddressFields
                streetAddress={streetAddress}
                city={city}
                postcode={postcode}
                onStreetAddressChange={setStreetAddress}
                onCityChange={setCity}
                onPostcodeChange={setPostcode}
              />
            </div>
          </div>
          )}

          {/* Agency section */}
          {mode === "stub" && (
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
          )}

          {/* Agent contact section */}
          {mode === "stub" && (
          <div>
            <SectionLabel>
              Agent contact{" "}
              <span className="normal-case font-normal">(optional)</span>
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
                {!form.stubAgentEmail.trim() && !emailError && <p className="text-xs text-slate-900/40">Add an email to send them an invite</p>}
              </div>
              <Field
                label="Contact number"
                type="tel"
                value={form.stubAgentPhone}
                onChange={(v) => update("stubAgentPhone")(cleanPhone(v))}
                onBlur={() => {
                  const formatted = formatUKPhone(form.stubAgentPhone);
                  if (formatted !== form.stubAgentPhone) update("stubAgentPhone")(formatted);
                }}
                placeholder="07700 900000"
              />
            </div>
          </div>
          )}

          {/* Notes section */}
          {mode === "stub" && (
          <div>
            <SectionLabel>
              Notes <span className="normal-case font-normal">(only you see this)</span>
            </SectionLabel>
            <div className="rounded-xl bg-white/40 border border-white/50 px-4 py-3">
              <Field
                label=""
                value={form.stubNotes}
                onChange={update("stubNotes")}
                placeholder="Anything useful about this link…"
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
          )}

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
              disabled={!canSubmit || saving}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl agent-btn-color-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : submitLabel}
            </button>
          </div>
          <p className="text-[11px] text-slate-900/45 text-center">
            {mode === "own"
              ? (selectedFile ? "We'll link this file to the chain now." : "Pick one of your files to add.")
              : helperText()}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
