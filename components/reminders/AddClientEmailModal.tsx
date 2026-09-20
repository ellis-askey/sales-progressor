"use client";

// Add a client's email from the reminders card, when autopilot couldn't chase
// them ("No email on file for the client"). Mirrors the add-solicitor modal's
// shell. The affordance knows the side, so the contact picker is a dropdown of
// that side's contacts (same shape as the chase card's recipient picker); the
// email is written onto the EXISTING contact, so we never create a duplicate.

import { useState, useRef, useEffect } from "react";
import { CheckCircle, CaretDown, Check } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { SavingPulse } from "@/components/ui/SavingPulse";
import { ContactAvatar } from "@/components/ui/Avatar";
import { saveContactEmailAction } from "@/app/actions/transactions";

type SideContact = { id: string; name: string; roleType: string; email: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddClientEmailModal({
  contacts,
  isBuyer,
  onClose,
  onSaved,
}: {
  contacts: SideContact[];
  isBuyer: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { theme, isNight } = usePortalTheme();
  // Default to the first contact that's missing an email (the one blocking the
  // chase), else the first on the side.
  const initialId = (contacts.find((c) => !c.email) ?? contacts[0])?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const [email, setEmail] = useState(selected?.email ?? "");
  const [touched, setTouched] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const emailValid = EMAIL_RE.test(email.trim());

  // Switching contact loads their current email (usually blank — that's the point).
  function pick(id: string) {
    setSelectedId(id);
    setEmail(contacts.find((c) => c.id === id)?.email ?? "");
    setError(null);
    setMenuOpen(false);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!selected) { setError("Choose a client first."); return; }
    if (!emailValid) { setError("That email address doesn't look right"); return; }
    setSaving(true);
    setError(null);
    try {
      await saveContactEmailAction(selected.id, email);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  const multiple = contacts.length > 1;

  return (
    <Modal
      open={true}
      onClose={onClose}
      ariaLabel="Add client email"
      size="sm"
      zLayer="deep"
      dismissOnBackdrop={false}
      closeTone="onDark"
    >
      <div
        data-theme={theme}
        data-night={isNight ? "" : undefined}
        className="nv2-night"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader
            title="Add client email"
            subtitle={`So we can chase the ${isBuyer ? "buyer" : "seller"} by email and switch this back to autopilot.`}
          />
        </Modal.Header>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Modal.Body>
            <div className="space-y-5">
              {/* Client picker — avatar + name; a dropdown when the side has more
                  than one contact, otherwise a static row. */}
              <div ref={menuRef} style={{ position: "relative" }}>
                <label className="text-xs font-semibold text-slate-900/65 mb-1.5 block">Client</label>
                <button
                  type="button"
                  onClick={() => multiple && setMenuOpen((o) => !o)}
                  aria-haspopup={multiple ? "listbox" : undefined}
                  aria-expanded={multiple ? menuOpen : undefined}
                  className="ace-picker w-full"
                  style={{ cursor: multiple ? "pointer" : "default" }}
                >
                  {selected ? (
                    <>
                      <ContactAvatar contact={{ name: selected.name, roleType: selected.roleType }} size={34} />
                      <span style={{ flex: 1, minWidth: 0, textAlign: "left", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selected.name}
                      </span>
                    </>
                  ) : (
                    <span style={{ flex: 1, textAlign: "left", fontSize: 14, color: "var(--agent-text-muted)" }}>Choose a client</span>
                  )}
                  {multiple && <CaretDown size={15} weight="bold" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />}
                </button>

                {menuOpen && multiple && (
                  <div role="listbox" className="ace-menu">
                    {contacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={c.id === selectedId}
                        onClick={() => pick(c.id)}
                        className="ace-option"
                      >
                        <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={28} />
                        <span style={{ flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name}
                          {c.email && <span style={{ color: "var(--agent-text-muted)", fontWeight: 400 }}> · has email</span>}
                        </span>
                        {c.id === selectedId && <Check size={14} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                  Email address
                  {emailValid
                    ? <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />
                    : touched && !emailValid
                      ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--agent-coral-deep)", display: "inline-block", marginLeft: 4, flexShrink: 0 }} />
                      : null}
                </label>
                <input
                  type="text"
                  inputMode="email"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  onBlur={() => { setTouched(true); setEmail((v) => v.trim().toLowerCase()); }}
                  placeholder="e.g. jamie@email.co.uk"
                  className={`glass-input agent-focus w-full px-3 py-2.5 text-sm${touched && !emailValid ? " agent-input-error" : ""}`}
                />
              </div>

              {error && <p className="agent-helper-error" style={{ fontSize: 12 }}>{error}</p>}
            </div>
          </Modal.Body>

          <Modal.Footer style={{ padding: "16px 24px 20px", gap: 12, justifyContent: undefined }}>
            <button type="button" onClick={onClose} className="agent-btn agent-btn-neutral agent-btn-md">Cancel</button>
            <button
              type="submit"
              disabled={!selected || !emailValid || saving}
              className="flex-1 py-2.5 agent-btn-color-primary text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {saving ? <SavingPulse label="Saving…" tone="muted" /> : "Save email"}
            </button>
          </Modal.Footer>
        </form>
      </div>

      <style jsx global>{`
        .ace-picker {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 12px;
          background: var(--agent-surface-glass, rgba(255,255,255,0.5));
          border: 1px solid var(--agent-border-default, rgba(0,0,0,0.1));
          transition: border-color 140ms;
        }
        .ace-picker:hover { border-color: var(--agent-coral); }
        .ace-menu {
          position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 4px);
          background: var(--agent-surface-raised, #fff);
          border: 1px solid var(--agent-border-default, rgba(0,0,0,0.1));
          border-radius: 12px; padding: 4px; overflow: hidden;
          box-shadow: 0 8px 28px rgba(0,0,0,0.14);
          max-height: 220px; overflow-y: auto;
        }
        .ace-option {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 7px 8px; border-radius: 8px; font-size: 13.5px; font-weight: 600;
          color: var(--agent-text-primary); background: none; border: none; cursor: pointer;
          transition: background 120ms;
        }
        .ace-option:hover { background: var(--agent-hover-tint, rgba(0,0,0,0.04)); }
      `}</style>
    </Modal>
  );
}
