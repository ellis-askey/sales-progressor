"use client";

import { useState, useEffect, useRef } from "react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { titleCaseKeepAcronyms, normalizePhone } from "@/lib/utils";

type Handler = { id: string; name: string; phone: string | null; email: string | null };
type Firm = { id: string; name: string };

type Props = {
  prefillName: string;
  // Subtext under the title. Defaults to the purchase phrasing (a mortgage
  // broker only ever helps with a purchase). Overridable so a future non-file
  // entry point (e.g. an agency broker directory) can pass its own line.
  subtitle?: string;
  onClose: () => void;
  onCreated: (firm: Firm, handler: Handler | null) => void;
};

export function AddBrokerModal({ prefillName, subtitle = "Add the broker helping with this purchase.", onClose, onCreated }: Props) {
  const { theme } = usePortalTheme();
  const [firmName, setFirmName] = useState(prefillName);
  const [handlerName, setHandlerName] = useState("");
  const [handlerPhone, setHandlerPhone] = useState("");
  const [handlerEmail, setHandlerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function blurFirm() { setFirmName((v) => titleCaseKeepAcronyms(v)); }
  function blurName() { setHandlerName((v) => titleCaseKeepAcronyms(v)); }
  function blurPhone() { setHandlerPhone((v) => normalizePhone(v)); }
  function blurEmail() {
    const formatted = handlerEmail.trim().toLowerCase();
    setHandlerEmail(formatted);
    if (formatted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formatted)) {
      setEmailError("Enter a valid email address");
    } else {
      setEmailError(null);
    }
  }

  // Modal primitive auto-focuses the first focusable on open; we additionally
  // select() the prefilled firm name so the user can type to replace. setTimeout
  // ensures we run AFTER Modal's focus effect so the selection isn't cleared.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.select(), 0);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firmName.trim()) return;
    if (handlerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handlerEmail.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/broker-firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: titleCaseKeepAcronyms(firmName),
          handler: handlerName.trim()
            ? { name: titleCaseKeepAcronyms(handlerName), phone: normalizePhone(handlerPhone), email: handlerEmail.trim().toLowerCase() || null }
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create brokerage");

      const handler: Handler | null = data.handlers?.[0] ?? null;
      onCreated({ id: data.id, name: data.name }, handler);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  // zLayer="deep" (=2000) - this modal can be invoked from the BrokerPicker
  // inside RelistFileModal which sits at the "escalated" 1500 layer. Bug
  // baseline 2026-06-05 (Ellis).
  return (
    <Modal
      open={true}
      onClose={onClose}
      ariaLabel="Add mortgage broker"
      size="md"
      zLayer="deep"
      dismissOnBackdrop={false}
      closeTone="onDark"
    >
      <div data-theme={theme} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Modal.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader title="Add mortgage broker" subtitle={subtitle} />
        </Modal.Header>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Modal.Body>
            <div className="space-y-5">
              {/* Brokerage — required */}
              <div>
                <label className="block text-sm font-semibold text-slate-900/80 mb-2">
                  Brokerage <span style={{ color: "var(--agent-coral-deep)", marginLeft: 1 }}>*</span>
                </label>
                <input
                  ref={inputRef}
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  onBlur={blurFirm}
                  placeholder="e.g. Bright Future Mortgages"
                  required
                  className="agent-input"
                />
              </div>

              {/* Broker name + Contact number — optional, side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-900/80 mb-2">Broker name</label>
                  <input
                    value={handlerName}
                    onChange={(e) => setHandlerName(e.target.value)}
                    onBlur={blurName}
                    placeholder="e.g. James Morris"
                    className="agent-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900/80 mb-2">Contact number</label>
                  <input
                    type="tel"
                    value={handlerPhone}
                    onChange={(e) => setHandlerPhone(e.target.value)}
                    onBlur={blurPhone}
                    placeholder="e.g. 07700 900 000"
                    className="agent-input"
                  />
                </div>
              </div>

              {/* Email — full width, optional */}
              <div>
                <label className="block text-sm font-semibold text-slate-900/80 mb-2">Email address</label>
                <input
                  type="email"
                  value={handlerEmail}
                  onChange={(e) => { setHandlerEmail(e.target.value); setEmailError(null); }}
                  onBlur={blurEmail}
                  placeholder="e.g. james@broker.co.uk"
                  className={`agent-input${emailError ? " agent-input-error" : ""}`}
                />
                {emailError && <p className="agent-helper-error">{emailError}</p>}
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{error}</p>
              )}
            </div>
          </Modal.Body>

          {/* Cancel link-style + Save flex-1 primary. Both keep their existing
              raw classes - the Save button uses agent-btn-color-primary which
              is the escape-hatch class Button.tsx explicitly grandfathered
              (cascade-pollution workaround for modal context). Cancel is a
              ghost link variant the Button primitive doesn't expose. */}
          <Modal.Footer style={{ padding: "16px 24px 20px", gap: 12, justifyContent: undefined }}>
            <button
              type="button"
              onClick={onClose}
              className="agent-btn agent-btn-neutral agent-btn-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!firmName.trim() || loading}
              className="flex-1 py-2.5 agent-btn-color-primary text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {loading ? "Adding…" : "Add broker"}
            </button>
          </Modal.Footer>
        </form>
      </div>
    </Modal>
  );
}
