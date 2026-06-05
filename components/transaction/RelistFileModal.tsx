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
import type { PurchaseType } from "@prisma/client";
// Same input-hygiene helpers used in the new-sale ContactsSection so
// the relist form behaves identically: name title-cased on blur, phone
// trimmed on input and pretty-formatted on blur, email trimmed.
import { titleCase } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";

type Stage = "form" | "confirm";

// Closed-loop chain arc (2026-06-05). Captures the new buyer's onward-sale
// status so the relist commit can attach a fresh chain link (no orphan
// dangling refs) or flag the file as chainSetupPending if the agent
// doesn't know yet. Mirrors the structured WithdrawalReason picker on
// the withdraw side — both are required steps, "Skip" is loud not silent.
type OnwardSale =
  | { kind: "none" }
  | { kind: "internal"; agentEmail: string }
  | { kind: "external"; agencyName: string; agentName: string; agentEmail: string }
  | { kind: "unknown" };

type Props = {
  open: boolean;
  transactionId: string;
  previousPurchasePrice: number | null;
  // True when the file currently has a chainLinkId. Only when true does
  // the modal show the "buyer's onward sale" section — files that aren't
  // in a chain at all skip it (there's nothing for the closed-loop arc
  // to reattach to).
  inChain: boolean;
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

export function RelistFileModal({ open, transactionId, previousPurchasePrice, inChain, onClose }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [stage, setStage] = useState<Stage>("form");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form fields.
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [priceInput, setPriceInput] = useState(formatPriceForInput(previousPurchasePrice));
  // Buyer's purchase method — required step. Mirrors the new-sale flow
  // (components/transactions-v2/form/Stage1Fields.tsx). Drives the auto-NR
  // set on the new round's PMs (cash buyer skips mortgage steps, etc.), so
  // we collect it fresh per buyer rather than inheriting the previous one.
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(null);
  const [solicitor, setSolicitor] = useState<SolicitorSelection | null>(null);
  const [broker, setBroker] = useState<BrokerSelection | null>(null);

  // Closed-loop chain arc (2026-06-05). Only collected when inChain=true.
  // Required step — no submission until the agent picks one. "unknown"
  // is the explicit safety valve that flags the file as chainSetupPending.
  const [onwardKind, setOnwardKind] = useState<OnwardSale["kind"] | null>(null);
  const [onwardInternalEmail, setOnwardInternalEmail] = useState("");
  const [onwardExternalAgency, setOnwardExternalAgency] = useState("");
  const [onwardExternalAgent, setOnwardExternalAgent] = useState("");
  const [onwardExternalEmail, setOnwardExternalEmail] = useState("");

  // Reset when modal opens.
  useEffect(() => {
    if (open) {
      setStage("form");
      setError(null);
      setBuyerName("");
      setBuyerEmail("");
      setBuyerPhone("");
      setPriceInput(formatPriceForInput(previousPurchasePrice));
      setPurchaseType(null);
      setSolicitor(null);
      setBroker(null);
      setOnwardKind(null);
      setOnwardInternalEmail("");
      setOnwardExternalAgency("");
      setOnwardExternalAgent("");
      setOnwardExternalEmail("");
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

  // Onward-sale validity: only the picked branch's fields are required.
  // Email regex matches CHAIN_EMAIL_RE in app/actions/transactions.ts so a
  // form-side accept means a server-side accept on the invite step.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const onwardValid =
    !inChain // section hidden — auto-valid
    || onwardKind === "none"
    || onwardKind === "unknown"
    || (onwardKind === "internal" && EMAIL_RE.test(onwardInternalEmail.trim()))
    || (onwardKind === "external"
        && onwardExternalAgency.trim().length > 0
        && onwardExternalAgent.trim().length > 0
        && EMAIL_RE.test(onwardExternalEmail.trim()));

  const formValid = buyerName.trim().length > 0 && purchaseType !== null && onwardValid;

  function buildOnwardPayload(): OnwardSale | null {
    if (!inChain || !onwardKind) return null;
    if (onwardKind === "none") return { kind: "none" };
    if (onwardKind === "unknown") return { kind: "unknown" };
    if (onwardKind === "internal") {
      return { kind: "internal", agentEmail: onwardInternalEmail.trim().toLowerCase() };
    }
    return {
      kind: "external",
      agencyName: onwardExternalAgency.trim(),
      agentName: onwardExternalAgent.trim(),
      agentEmail: onwardExternalEmail.trim().toLowerCase(),
    };
  }

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
          newPurchaseType: purchaseType,
          newPurchaserSolicitorFirmId: solicitor?.firmId ?? null,
          newPurchaserSolicitorContactId: solicitor?.contactId ?? null,
          newBrokerFirmId: broker?.firmId ?? null,
          newBrokerContactId: broker?.contactId ?? null,
          // Closed-loop arc (2026-06-05): the chain-attach decision the
          // agent made in the modal. Server-side, drives chainSetupPending
          // / new-link creation / chain invite emails.
          onwardSale: buildOnwardPayload(),
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
        className="relative bg-white rounded-2xl w-full flex flex-col"
        style={{
          maxWidth: stage === "form" ? 520 : 560,
          // Cap modal height to the viewport (minus the outer p-4 padding on
          // each side) so the new onward-sale step doesn't push the header
          // and footer off-screen. Body section below gets flex:1 + scroll
          // so it pages internally — header / footer stay sticky.
          maxHeight: "calc(100vh - 32px)",
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

        {/* Body — flex:1 + overflow-y:auto so the body scrolls internally
          * when the form is taller than the viewport (the new onward-sale
          * step pushed total height past ~700px on shorter monitors). */}
        {stage === "form" ? (
          <div className="px-5 py-5 space-y-4 overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
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

            {/* Buyer's purchase method — required. Mirrors the new-sale
              * Stage 1 picker (Stage1Fields.tsx): same three options, same
              * helper notes, same labels. Drives auto-NR codes on the new
              * round's PMs (cash buyers skip mortgage milestones, etc.). */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                Buyer&apos;s purchase method <span style={{ color: "var(--agent-danger, #C73E3E)" }}>*</span>
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {([
                  { value: "mortgage",           label: "Mortgage",            note: "All mortgage steps apply" },
                  { value: "cash_buyer",         label: "Cash",                note: "Mortgage steps not required" },
                  { value: "cash_from_proceeds", label: "Cash from Proceeds",  note: "Mortgage + deposit not required" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPurchaseType(opt.value)}
                    disabled={isPending}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      purchaseType === opt.value
                        ? "border-[var(--agent-coral-deep,#E5502E)] bg-[rgba(255,107,74,0.06)] font-medium"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 agent-hover-row"
                    }`}
                  >
                    <div className="text-sm font-medium" style={{ color: purchaseType === opt.value ? "var(--agent-coral-deep, #E5502E)" : "var(--agent-text-primary)" }}>{opt.label}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: purchaseType === opt.value ? "rgba(229,80,46,0.85)" : "rgba(15,23,42,0.5)" }}>
                      {opt.note}
                    </div>
                  </button>
                ))}
              </div>
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

            {/* Closed-loop chain arc (2026-06-05) — only shown when the
              * file is in a chain. Skip is loud ("Don't know yet" flags
              * the file as chainSetupPending so the hub surfaces a
              * prompt until resolved). */}
            {inChain && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                  Buyer&apos;s onward sale <span style={{ color: "var(--agent-danger, #C73E3E)" }}>*</span>
                </label>
                <div className="space-y-1.5">
                  {([
                    { value: "none",     label: "No — first-time buyer or cash buyer", helper: "Chain ends below us. Nothing to attach." },
                    { value: "internal", label: "Yes — managed by another Sales Progressor agent", helper: "We'll send them a chain invite by email." },
                    { value: "external", label: "Yes — managed by an external agency", helper: "We'll send a stub invite to their agent." },
                    { value: "unknown",  label: "Don't know yet — set up later", helper: "File flagged. The hub will prompt until cleared." },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOnwardKind(opt.value)}
                      disabled={isPending}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        onwardKind === opt.value
                          ? "border-[var(--agent-coral-deep,#E5502E)] bg-[rgba(255,107,74,0.06)] font-medium"
                          : "border-slate-200 text-slate-700 hover:border-slate-300 agent-hover-row"
                      }`}
                    >
                      <div className="text-sm font-medium" style={{ color: onwardKind === opt.value ? "var(--agent-coral-deep, #E5502E)" : "var(--agent-text-primary)" }}>{opt.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: onwardKind === opt.value ? "rgba(229,80,46,0.85)" : "rgba(15,23,42,0.5)" }}>
                        {opt.helper}
                      </div>
                    </button>
                  ))}
                </div>

                {onwardKind === "internal" && (
                  <div className="agent-reveal-in mt-3">
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                      Their agent&apos;s email <span style={{ color: "var(--agent-danger, #C73E3E)" }}>*</span>
                    </label>
                    <input
                      type="email"
                      value={onwardInternalEmail}
                      onChange={(e) => setOnwardInternalEmail(e.target.value)}
                      onBlur={(e) => setOnwardInternalEmail(e.target.value.trim().toLowerCase())}
                      disabled={isPending}
                      placeholder="agent@theirsalesprogressor.account"
                      maxLength={120}
                      className="w-full text-sm rounded-lg px-3 py-2 border bg-white"
                      style={{ borderColor: "rgba(0,0,0,0.12)" }}
                    />
                  </div>
                )}

                {onwardKind === "external" && (
                  <div className="agent-reveal-in mt-3 grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                        Agency name <span style={{ color: "var(--agent-danger, #C73E3E)" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={onwardExternalAgency}
                        onChange={(e) => setOnwardExternalAgency(e.target.value)}
                        disabled={isPending}
                        placeholder="e.g. Hartwell Partners"
                        maxLength={80}
                        className="w-full text-sm rounded-lg px-3 py-2 border bg-white"
                        style={{ borderColor: "rgba(0,0,0,0.12)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                        Agent name <span style={{ color: "var(--agent-danger, #C73E3E)" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={onwardExternalAgent}
                        onChange={(e) => setOnwardExternalAgent(e.target.value)}
                        onBlur={(e) => setOnwardExternalAgent(titleCase(e.target.value.trim()))}
                        disabled={isPending}
                        placeholder="e.g. Sarah Johnson"
                        maxLength={80}
                        className="w-full text-sm rounded-lg px-3 py-2 border bg-white"
                        style={{ borderColor: "rgba(0,0,0,0.12)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                        Agent email <span style={{ color: "var(--agent-danger, #C73E3E)" }}>*</span>
                      </label>
                      <input
                        type="email"
                        value={onwardExternalEmail}
                        onChange={(e) => setOnwardExternalEmail(e.target.value)}
                        onBlur={(e) => setOnwardExternalEmail(e.target.value.trim().toLowerCase())}
                        disabled={isPending}
                        placeholder="sarah@hartwellpartners.co.uk"
                        maxLength={120}
                        className="w-full text-sm rounded-lg px-3 py-2 border bg-white"
                        style={{ borderColor: "rgba(0,0,0,0.12)" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

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
    <div className="px-5 py-5 space-y-4 overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
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
