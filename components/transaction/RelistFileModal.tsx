"use client";

// Phase 1 commit 6b — relist-file UI surface.
//
// Two stages in a single modal:
//   Stage 1 — collect new buyer details + optional new price + optional
//             solicitor + optional broker.
//   Stage 2 — confirmation step that states plainly what carries over and
//             what resets. Copy below is the voice-passed text from Ellis;
//             do not paraphrase. "step" not "milestone", "sale" not
//             "transaction", no em dashes.
//
// Wired to relistTransactionAction. Server-side preconditions
// (status === "withdrawn", exchangedAt IS NULL, agency scope) are the
// canonical guard — the form's visibility is convenience only.
//
// Modal chrome mirrors SwitchServiceTypeModal: createPortal + usePortalTheme
// + Escape-to-dismiss + agent-modal-in animation.

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SolicitorPicker, type SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { BrokerPicker, type BrokerSelection } from "@/components/brokers/BrokerPicker";
import { relistTransactionAction } from "@/app/actions/transactions";
// Same input-hygiene helpers used in the new-sale ContactsSection so
// the relist form behaves identically: name title-cased on blur, phone
// trimmed on input and pretty-formatted on blur, email trimmed.
import { titleCase } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";

type Stage = "form" | "confirm";

type Props = {
  open: boolean;
  transactionId: string;
  previousPurchasePrice: number | null;
  onClose: () => void;
};

function formatPriceForInput(p: number | null): string {
  if (p === null) return "";
  // schema stores pence
  const pounds = Math.floor(p / 100);
  return String(pounds);
}

function parsePriceInputToPence(s: string): number | null {
  const trimmed = s.trim().replace(/[,£\s]/g, "");
  if (trimmed === "") return null;
  const pounds = Number(trimmed);
  if (!Number.isFinite(pounds) || pounds <= 0) return null;
  return Math.round(pounds * 100);
}

export function RelistFileModal({ open, transactionId, previousPurchasePrice, onClose }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [stage, setStage] = useState<Stage>("form");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form fields.
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [priceInput, setPriceInput] = useState(formatPriceForInput(previousPurchasePrice));
  const [solicitor, setSolicitor] = useState<SolicitorSelection | null>(null);
  const [broker, setBroker] = useState<BrokerSelection | null>(null);

  // Reset when modal opens.
  useEffect(() => {
    if (open) {
      setStage("form");
      setError(null);
      setBuyerName("");
      setBuyerEmail("");
      setBuyerPhone("");
      setPriceInput(formatPriceForInput(previousPurchasePrice));
      setSolicitor(null);
      setBroker(null);
    }
  }, [open, previousPurchasePrice]);

  // Escape to dismiss (only when not pending).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, isPending]);

  if (!open) return null;

  const newPrice = parsePriceInputToPence(priceInput);
  const formValid = buyerName.trim().length > 0;

  function goToConfirm() {
    if (!formValid) {
      setError("New buyer name is required.");
      return;
    }
    // Normalise once at the form → confirm transition so the lead-in
    // ("You're relisting this sale with X…") shows the polished name,
    // and the submit path doesn't have to re-normalise. Mirrors the
    // onBlur handlers above for the user who clicks Continue without
    // blurring the field first.
    setBuyerName((v) => v.trim() ? titleCase(v) : v);
    setBuyerEmail((v) => v.trim());
    setBuyerPhone((v) => {
      const cleaned = cleanPhone(v);
      const formatted = formatUKPhone(cleaned);
      return formatted;
    });
    setError(null);
    setStage("confirm");
  }

  function submit() {
    setError(null);
    // Submit-time normalisation in case the user clicked Continue
    // without blurring the inputs first (the onBlur handlers wouldn't
    // have fired). titleCase the name; format the phone to the same
    // shape as new-sale; trim the email. Belt-and-braces; matches the
    // hygiene the rest of the agent app expects on contacts.
    const normalisedName  = titleCase(buyerName.trim());
    const normalisedEmail = buyerEmail.trim();
    const normalisedPhone = formatUKPhone(cleanPhone(buyerPhone));
    startTransition(async () => {
      try {
        await relistTransactionAction({
          transactionId,
          newBuyer: {
            name: normalisedName,
            email: normalisedEmail || null,
            phone: normalisedPhone || null,
          },
          newPurchasePrice: newPrice,
          newPurchaserSolicitorFirmId: solicitor?.firmId ?? null,
          newPurchaserSolicitorContactId: solicitor?.contactId ?? null,
          newBrokerFirmId: broker?.firmId ?? null,
          newBrokerContactId: broker?.contactId ?? null,
        });
        onClose();
        // Force a refresh so the file detail rerenders with the new round
        // active. Next.js's revalidatePath inside the action handles the
        // server cache; this nudges the client view.
        if (typeof window !== "undefined") window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong relisting the file.");
      }
    });
  }

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      className="nv2-night fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 1500 }}
      onClick={isPending ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl w-full"
        style={{
          maxWidth: stage === "form" ? 520 : 560,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-2">
            {stage === "confirm" && (
              <button
                type="button"
                onClick={() => setStage("form")}
                disabled={isPending}
                aria-label="Back to form"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "transparent",
                  border: "none",
                  cursor: isPending ? "default" : "pointer",
                  color: "var(--agent-text-muted, #6b7280)",
                }}
                className="hover:bg-black/[0.05]"
              >
                <ArrowLeft size={14} weight="bold" />
              </button>
            )}
            <p className="text-sm font-semibold text-slate-900">
              {stage === "form" ? "Relist this sale" : "Confirm relist"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: isPending ? "default" : "pointer",
              color: "var(--agent-text-muted, #6b7280)",
              opacity: isPending ? 0.4 : 1,
            }}
            className="hover:bg-black/[0.05]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        {stage === "form" ? (
          <div className="px-5 py-5 space-y-4">
            {/* Buyer details */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                New buyer name <span style={{ color: "var(--agent-danger, #C73E3E)" }}>*</span>
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                onBlur={(e) => { if (e.target.value.trim()) setBuyerName(titleCase(e.target.value)); }}
                disabled={isPending}
                placeholder="e.g. Sarah Johnson"
                maxLength={80}
                className="w-full text-sm rounded-lg px-3 py-2 border bg-white"
                style={{ borderColor: "rgba(0,0,0,0.12)" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  onBlur={(e) => setBuyerEmail(e.target.value.trim())}
                  disabled={isPending}
                  placeholder="sarah@example.com"
                  maxLength={120}
                  className="w-full text-sm rounded-lg px-3 py-2 border bg-white"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(cleanPhone(e.target.value))}
                  onBlur={(e) => {
                    const formatted = formatUKPhone(e.target.value);
                    if (formatted !== e.target.value) setBuyerPhone(formatted);
                  }}
                  disabled={isPending}
                  placeholder="07700 900000"
                  maxLength={20}
                  className="w-full text-sm rounded-lg px-3 py-2 border bg-white"
                  style={{ borderColor: "rgba(0,0,0,0.12)" }}
                />
              </div>
            </div>

            {/* New price */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                Agreed price (£)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                disabled={isPending}
                placeholder={previousPurchasePrice ? `Previous: £${formatPriceForInput(previousPurchasePrice)}` : "e.g. 500000"}
                className="w-full text-sm rounded-lg px-3 py-2 border bg-white"
                style={{ borderColor: "rgba(0,0,0,0.12)" }}
              />
            </div>

            {/* Solicitor + broker — both optional. Labels match the
                rest of the agent app: plain noun phrase, no parenthetical
                "(optional)" since the absence of a required asterisk
                already conveys it. */}
            <SolicitorPicker
              label="Buyer's solicitor"
              value={solicitor}
              onChange={setSolicitor}
            />
            <BrokerPicker
              label="Buyer's broker"
              value={broker}
              onChange={setBroker}
            />

            {error && (
              <p className="text-xs" style={{ color: "var(--agent-danger, #C73E3E)" }} role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          /* CONFIRM STAGE — copy is voice-passed by Ellis. Do not paraphrase. */
          <ConfirmStage
            buyerName={buyerName.trim()}
            newPrice={newPrice}
            previousPrice={previousPurchasePrice}
            error={error}
          />
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          {stage === "form" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--agent-text-secondary, #4b5563)",
                  background: "transparent",
                  border: "0.5px solid var(--agent-border-default, rgba(0,0,0,0.12))",
                  cursor: isPending ? "default" : "pointer",
                  opacity: isPending ? 0.5 : 1,
                }}
                className="hover:bg-black/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={goToConfirm}
                disabled={isPending || !formValid}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--agent-coral-deep, #E5502E)",
                  border: "none",
                  cursor: isPending || !formValid ? "default" : "pointer",
                  opacity: !formValid ? 0.5 : 1,
                  minWidth: 110,
                  justifyContent: "center",
                }}
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStage("form")}
                disabled={isPending}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--agent-text-secondary, #4b5563)",
                  background: "transparent",
                  border: "0.5px solid var(--agent-border-default, rgba(0,0,0,0.12))",
                  cursor: isPending ? "default" : "pointer",
                  opacity: isPending ? 0.5 : 1,
                }}
                className="hover:bg-black/[0.04]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--agent-coral-deep, #E5502E)",
                  border: "none",
                  cursor: isPending ? "default" : "pointer",
                  opacity: isPending ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 150,
                  justifyContent: "center",
                }}
              >
                {isPending && (
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.35)",
                      borderTopColor: "#fff",
                      animation: "agent-spin 700ms linear infinite",
                      display: "inline-block",
                    }}
                  />
                )}
                {isPending ? "Relisting…" : "Relist sale"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Confirmation-stage body. Copy locked by Ellis 2026-06-04 (verbatim;
// any change requires a fresh approval from Ellis before merge).
// House rules baked in: no em dashes, "step" not "milestone", "sale"
// not "transaction". The "Carries over" list MUST match the preserved
// VM codes from the locked reset map (lib/services/relist reset list:
// VM1, VM3-VM6, VM8-VM9), and the "Starts fresh" list MUST match the
// reset VM codes + every PM code. Drift between this copy and the
// reset map is a correctness bug agents will act on.
// ─────────────────────────────────────────────────────────────────────────
function ConfirmStage({
  buyerName,
  newPrice,
  previousPrice,
  error,
}: {
  buyerName: string;
  newPrice: number | null;
  previousPrice: number | null;
  error: string | null;
}) {
  const priceChanged = newPrice !== null && previousPrice !== null && newPrice !== previousPrice;
  return (
    <div className="px-5 py-5 space-y-4">
      <p className="text-sm" style={{ color: "var(--agent-text-primary, #1a1d29)" }}>
        
        You're relisting this sale with <strong>{buyerName}</strong>
        {priceChanged && newPrice !== null && (
          <> at £{Math.floor(newPrice / 100).toLocaleString("en-GB")}</>
        )}
        {". "}
        Here's what happens.
      </p>

      <div
        className="rounded-lg px-4 py-3"
        style={{
          background: "var(--agent-surface-subtle, rgba(0,0,0,0.03))",
          border: "0.5px solid var(--agent-border-default, rgba(0,0,0,0.08))",
        }}
      >
        <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--agent-text-muted, #6b7280)" }}>
          
          Carries over
        </p>
        <ul className="text-sm space-y-1" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
          <li>• The seller's solicitor instruction, client care pack, ID and AML checks, property information forms, and the management pack.</li>
          <li>• The seller's contact details and portal access.</li>
          <li>• The full sale history in the seller's view.</li>
        </ul>
      </div>

      <div
        className="rounded-lg px-4 py-3"
        style={{
          background: "var(--agent-surface-subtle, rgba(0,0,0,0.03))",
          border: "0.5px solid var(--agent-border-default, rgba(0,0,0,0.08))",
        }}
      >
        <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: "var(--agent-text-muted, #6b7280)" }}>
          
          Starts fresh
        </p>
        <ul className="text-sm space-y-1" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
          <li>• A new memorandum of sale to send to both solicitors.</li>
          <li>• Every step on {buyerName}'s side.</li>
          <li>• The draft contract pack, reissued to the new buyer's solicitor, and enquiries from scratch.</li>
          <li>• Contract signing, exchange and completion steps.</li>
          <li>• Expected exchange and completion dates are cleared.</li>
        </ul>
      </div>

      <div
        className="rounded-lg px-4 py-3 text-xs"
        style={{
          background: "rgba(255, 173, 51, 0.10)",
          border: "0.5px solid rgba(255, 173, 51, 0.25)",
          color: "var(--agent-text-secondary, #4b5563)",
        }}
      >
        
        The previous buyer's portal link will land on a "this link is no longer active" page. Their progress is kept in the file's history but won't drive anything new.
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--agent-danger, #C73E3E)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
