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

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft, CurrencyGbp, UploadSimple, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { PriceInput } from "@/components/ui/PriceInput";
import { Pill } from "@/components/ui/Pill";
import { SolicitorPicker, type SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import { BrokerPicker, type BrokerSelection } from "@/components/brokers/BrokerPicker";
import { relistTransactionAction, getPriorEarnedReferralAction, attachRelistMosAction, applyRelistFileUpdatesAction } from "@/app/actions/transactions";
import { autoFillSolicitor } from "@/lib/utils/solicitor-autofill";
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

// Carry-over payload when the modal opens from the new-sale catch (critique #296):
// what to write to the file, the plain-English safe-updates list to show, and the
// tenure/seller/onward conflicts to resolve — each present only when the entered
// value differs from the file.
type RelistCatchUpdates = {
  apply: {
    agentFeeAmount: number | null;
    agentFeePercent: number | null;
    agentFeeIsVatInclusive: boolean | null;
    note: string | null;
    photoStoragePath: string | null;
    assignToUserId: string | null;
    enteredTenure: "freehold" | "leasehold" | null;
    enteredIsShareOfFreehold: boolean;
    enteredVendorContacts: { name: string; companyName?: string; phone?: string; email?: string }[];
    enteredVendorSolicitorFirmId: string | null;
    enteredVendorSolicitorContactId: string | null;
  };
  safeUpdates: { label: string; value: string }[];
  conflicts: {
    tenure?: { file: string; entered: string };
    seller?: { file: string; entered: string };
    onward?: { file: string; entered: string };
  };
};

// Keep / replace segmented control — the same gradient-when-active treatment used
// across the app, so the catch resolutions match the rest of this modal.
function KeepReplace({ value, onChange, keepLabel, replaceLabel }: { value: "keep" | "replace"; onChange: (v: "keep" | "replace") => void; keepLabel: string; replaceLabel: string }) {
  const opts: { id: "keep" | "replace"; label: string }[] = [{ id: "keep", label: keepLabel }, { id: "replace", label: replaceLabel }];
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 3, borderRadius: 10, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)" }}>
      {opts.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            style={{
              fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
              transition: "background 140ms ease, color 140ms ease, box-shadow 140ms ease",
              color: active ? "var(--agent-text-on-coral, #fff)" : "var(--agent-text-secondary)",
              background: active ? "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))" : "transparent",
              boxShadow: active ? "0 2px 8px rgba(var(--agent-coral-rgb), 0.26)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ConflictRow({ title, file, entered, keepLabel, replaceLabel, value, onChange, note }: { title: string; file: string; entered: string; keepLabel: string; replaceLabel: string; value: "keep" | "replace"; onChange: (v: "keep" | "replace") => void; note?: string }) {
  return (
    <div style={{ borderRadius: 12, border: "0.5px solid var(--agent-border-default)", borderLeft: "3px solid var(--agent-warning, #D08700)", background: "var(--agent-surface-glass)", padding: "12px 14px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "stretch", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--agent-text-muted)" }}>On the file</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 3 }}>{file}</div>
        </div>
        <div aria-hidden style={{ width: 1, background: "var(--agent-border-default)", margin: "0 14px", alignSelf: "stretch" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--agent-text-muted)" }}>You entered</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 3 }}>{entered}</div>
        </div>
      </div>
      <KeepReplace value={value} onChange={onChange} keepLabel={keepLabel} replaceLabel={replaceLabel} />
      {note && <p style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>{note}</p>}
    </div>
  );
}

type Props = {
  open: boolean;
  transactionId: string;
  previousPurchasePrice: number | null;
  // True when the file currently has a chainLinkId. Only when true does
  // the modal show the "buyer's onward sale" section — files that aren't
  // in a chain at all skip it (there's nothing for the closed-loop arc
  // to reattach to).
  inChain: boolean;
  // Pre-fill from the new-sale flow when the agent is routed here after the
  // "add new buyer to this file" catch (critique #296). The buyer details they
  // already typed carry over so they don't re-enter them. All undefined on the
  // normal relist entry (the banner on a fallen-through file), so that path is
  // byte-identical to before.
  initialBuyerName?: string;
  initialBuyerEmail?: string;
  initialBuyerPhone?: string;
  initialPricePence?: number | null;
  initialPurchaseType?: PurchaseType | null;
  initialSolicitor?: SolicitorSelection | null;
  initialBroker?: BrokerSelection | null;
  // Called instead of the default page reload after a successful relist. The
  // file-page banner leaves this unset (reloads in place); the new-sale catch
  // flow sets it to navigate to the file the new buyer landed on.
  onRelisted?: () => void;
  // Present only on the new-sale catch flow. Drives the "we'll update the file"
  // section + the tenure/seller/onward keep-or-replace cards, and is applied via
  // applyRelistFileUpdatesAction after the relist commits.
  catchUpdates?: RelistCatchUpdates;
  onClose: () => void;
};

// £-formatted, no decimals — matches formatPrice across the agent app.
function formatPence(p: number): string {
  return "£" + (p / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

// Pounds-with-commas (no symbol) for the price field placeholder — the
// canonical PriceInput prepends the £ itself.
function poundsPlaceholder(p: number | null): string {
  if (p === null) return "e.g. 325,000";
  return (p / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

// The quiet "upload a different memo" / "try another file" link that sits under
// the read pill. Muted by default, coral on hover, never underlined (Ellis,
// critique #4 follow-up).
function MemoRelinkButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: hover && !disabled ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
        background: "transparent",
        border: "none",
        padding: 0,
        textDecoration: "none",
        cursor: disabled ? "default" : "pointer",
        transition: "color 140ms",
      }}
    >
      {label}
    </button>
  );
}

export function RelistFileModal({
  open, transactionId, previousPurchasePrice, inChain,
  initialBuyerName, initialBuyerEmail, initialBuyerPhone, initialPricePence,
  initialPurchaseType, initialSolicitor, initialBroker,
  onRelisted, catchUpdates, onClose,
}: Props) {
  const { theme, isNight } = usePortalTheme();
  const [stage, setStage] = useState<Stage>("form");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form fields.
  const [buyerName, setBuyerName] = useState(initialBuyerName ?? "");
  const [buyerEmail, setBuyerEmail] = useState(initialBuyerEmail ?? "");
  const [buyerPhone, setBuyerPhone] = useState(initialBuyerPhone ?? "");
  // Agreed price in pence — matches the canonical PriceInput used on the
  // new-sale hero (value/onChange both in pence). Seeds from the price just
  // entered in the new-sale flow when pre-filling, else the file's old price.
  const [pricePence, setPricePence] = useState<number | null>(initialPricePence ?? previousPurchasePrice);
  // Buyer's purchase method — required step. Mirrors the new-sale flow
  // (components/transactions-v2/form/Stage1Fields.tsx). Drives the auto-NR
  // set on the new round's PMs (cash buyer skips mortgage steps, etc.), so
  // we collect it fresh per buyer rather than inheriting the previous one.
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(initialPurchaseType ?? null);
  const [solicitor, setSolicitor] = useState<SolicitorSelection | null>(initialSolicitor ?? null);
  const [broker, setBroker] = useState<BrokerSelection | null>(initialBroker ?? null);

  // Optional memo re-upload (critique #4). On a relist the sale is starting
  // over with a NEW buyer, so we read only the BUYER side of the new memo
  // (buyer name/email/phone, agreed price, buyer's solicitor) and auto-fill
  // the fields below. The seller carries over untouched, and tenure is a
  // property fact that never changes, so neither is shown while reading.
  // On submit, an uploaded memo also ticks the "Memorandum of sale received"
  // step for the new round and is filed against the sale.
  const [memoState, setMemoState] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [memoFilled, setMemoFilled] = useState<string[]>([]);
  const [memoDragOver, setMemoDragOver] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [mosMeta, setMosMeta] = useState<{
    mosStoragePath?: string | null;
    mosFileSize?: number | null;
    mosMimeType?: string | null;
    mosFilename?: string | null;
  } | null>(null);
  const memoInputRef = useRef<HTMLInputElement>(null);

  // Reassurance note (referral-ledger arc): if the outgoing buyer had an earned
  // broker referral, tell the agent it stays on record so adding a new buyer
  // never reads as wiping it. Fetched on open; null = nothing to reassure about.
  const [priorReferral, setPriorReferral] = useState<{ amountPence: number | null; buyerName: string } | null>(null);

  // Closed-loop chain arc (2026-06-05). Only collected when inChain=true.
  // Required step — no submission until the agent picks one. "unknown"
  // is the explicit safety valve that flags the file as chainSetupPending.
  const [onwardKind, setOnwardKind] = useState<OnwardSale["kind"] | null>(null);
  const [onwardInternalEmail, setOnwardInternalEmail] = useState("");
  const [onwardExternalAgency, setOnwardExternalAgency] = useState("");
  const [onwardExternalAgent, setOnwardExternalAgent] = useState("");
  const [onwardExternalEmail, setOnwardExternalEmail] = useState("");

  // Catch-flow conflict resolutions (default keep — the safe choice).
  const [tenureRes, setTenureRes] = useState<"keep" | "replace">("keep");
  const [sellerRes, setSellerRes] = useState<"keep" | "replace">("keep");
  const [onwardRes, setOnwardRes] = useState<"keep" | "replace">("keep");

  // Reset when modal opens.
  useEffect(() => {
    if (open) {
      setStage("form");
      setError(null);
      setBuyerName(initialBuyerName ?? "");
      setBuyerEmail(initialBuyerEmail ?? "");
      setBuyerPhone(initialBuyerPhone ?? "");
      setPricePence(initialPricePence ?? previousPurchasePrice);
      setPurchaseType(initialPurchaseType ?? null);
      setSolicitor(initialSolicitor ?? null);
      setBroker(initialBroker ?? null);
      setMemoState("idle");
      setMemoFilled([]);
      setMemoDragOver(false);
      setMemoError(null);
      setMosMeta(null);
      setOnwardKind(null);
      setOnwardInternalEmail("");
      setOnwardExternalAgency("");
      setOnwardExternalAgent("");
      setOnwardExternalEmail("");
      setPriorReferral(null);
      setTenureRes("keep");
      setSellerRes("keep");
      setOnwardRes("keep");
    }
  }, [open, previousPurchasePrice, initialBuyerName, initialBuyerEmail, initialBuyerPhone, initialPricePence, initialPurchaseType, initialSolicitor, initialBroker]);

  // Fetch the outgoing buyer's earned referral (if any) when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getPriorEarnedReferralAction(transactionId)
      .then((r) => { if (!cancelled) setPriorReferral(r); })
      .catch(() => { /* reassurance only — a miss just hides the note */ });
    return () => { cancelled = true; };
  }, [open, transactionId]);

  // Escape to dismiss (only when not pending).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, isPending]);

  // Paste-to-read (critique #4). Mirrors the new-sale hero (HeroCard.tsx): a
  // copied file OR a screenshot blob pasted anywhere in the open form is read
  // as the memo. Ignored while a text field is focused so normal paste works.
  useEffect(() => {
    if (!open || stage !== "form") return;
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const cb = e.clipboardData;
      if (!cb) return;
      const direct = cb.files[0];
      if (direct) {
        e.preventDefault();
        handleMemoFile(direct);
        return;
      }
      const imageItem = Array.from(cb.items).find((i) => i.type.startsWith("image/"));
      if (imageItem) {
        e.preventDefault();
        const blob = imageItem.getAsFile();
        if (blob) {
          const ext = imageItem.type === "image/png" ? "png" : "jpg";
          handleMemoFile(new File([blob], `screenshot.${ext}`, { type: imageItem.type }));
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage]);

  if (!open) return null;

  const newPrice = pricePence;

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

  // Read the uploaded memo and fill BUYER-side fields only. Uses the same
  // /api/agent/memo-parse endpoint as the new-sale flow, but ignores the
  // vendor, address, and tenure it returns (all carry over / unchanged on a
  // relist). Best-effort: a parse miss just leaves the fields for hand entry.
  async function handleMemoFile(file: File) {
    setMemoError(null);
    setMemoFilled([]);
    setMosMeta(null);
    setMemoState("reading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/agent/memo-parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMemoError(typeof data?.error === "string" ? data.error : "Couldn't read that memo.");
        setMemoState("error");
        return;
      }

      const filled: string[] = [];
      const buyer = Array.isArray(data.purchasers) ? data.purchasers[0] : null;
      if (buyer?.name && typeof buyer.name === "string") {
        setBuyerName(titleCase(buyer.name.trim()));
        filled.push("Buyer name");
      }
      if (buyer?.email && typeof buyer.email === "string") {
        setBuyerEmail(buyer.email.trim().toLowerCase());
        filled.push("Email");
      }
      if (buyer?.phone && typeof buyer.phone === "string") {
        setBuyerPhone(formatUKPhone(cleanPhone(buyer.phone)));
        filled.push("Phone");
      }
      if (typeof data.purchasePricePence === "number" && data.purchasePricePence > 0) {
        setPricePence(data.purchasePricePence);
        filled.push("Agreed price");
      }
      if (data.purchaserSolicitor?.firm) {
        await autoFillSolicitor(
          data.purchaserSolicitor.firm,
          {
            name: data.purchaserSolicitor.name ?? undefined,
            phone: data.purchaserSolicitor.phone ?? undefined,
            email: data.purchaserSolicitor.email ?? undefined,
          },
          setSolicitor,
        );
        filled.push("Buyer's solicitor");
      }

      setMosMeta({
        mosStoragePath: data.mosStoragePath ?? null,
        mosFileSize: data.mosFileSize ?? null,
        mosMimeType: data.mosMimeType ?? null,
        mosFilename: data.mosFilename ?? null,
      });
      setMemoFilled(filled);
      setMemoState("done");
    } catch {
      setMemoError("Something went wrong reading that memo.");
      setMemoState("error");
    }
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
        // New-sale catch (critique #296): carry the non-buyer data the agent
        // typed onto the file. The relist already committed, so a failure here
        // doesn't undo it — but we must TELL the agent rather than swallow it
        // (audit 2026), because the fee/notes/seller changes wouldn't be saved.
        let fileUpdatesOk = true;
        if (catchUpdates) {
          try {
            const res = await applyRelistFileUpdatesAction({
              transactionId,
              agentFeeAmount: catchUpdates.apply.agentFeeAmount,
              agentFeePercent: catchUpdates.apply.agentFeePercent,
              agentFeeIsVatInclusive: catchUpdates.apply.agentFeeIsVatInclusive,
              note: catchUpdates.apply.note,
              photoStoragePath: catchUpdates.apply.photoStoragePath,
              assignToUserId: catchUpdates.apply.assignToUserId,
              tenureResolution: catchUpdates.conflicts.tenure ? tenureRes : undefined,
              tenureValue: catchUpdates.apply.enteredTenure,
              isShareOfFreehold: catchUpdates.apply.enteredIsShareOfFreehold,
              sellerResolution: catchUpdates.conflicts.seller ? sellerRes : undefined,
              vendorContacts: catchUpdates.apply.enteredVendorContacts,
              vendorSolicitorFirmId: catchUpdates.apply.enteredVendorSolicitorFirmId,
              vendorSolicitorContactId: catchUpdates.apply.enteredVendorSolicitorContactId,
              sellerOnwardResolution: catchUpdates.conflicts.onward ? onwardRes : undefined,
            });
            fileUpdatesOk = res.ok;
          } catch (e) {
            console.error("relist file-updates failed:", e);
            fileUpdatesOk = false;
          }
        }
        // If the agent uploaded the new memo, tick the "Memorandum of sale
        // received" step for the new round and file the memo against the sale.
        // Runs after the relist commits (which reset that step to available),
        // so the confirm lands on the new buyer. Best-effort — a miss here
        // never fails the relist that already succeeded.
        if (memoState === "done") {
          await attachRelistMosAction({ transactionId, ...(mosMeta ?? {}) }).catch(() => {});
        }
        // The navigation below is a full reload, so a toast wouldn't survive —
        // use a blocking notice to guarantee the agent sees that the file details
        // didn't save (they can add them on the file).
        if (!fileUpdatesOk && typeof window !== "undefined") {
          window.alert("Your new buyer was added, but we couldn't save the extra file details you entered (agent fee, note, photo, or seller changes). Please open the file and add them.");
        }
        onClose();
        // Force a refresh so the file detail rerenders with the new round
        // active. Next.js's revalidatePath inside the action handles the
        // server cache; this nudges the client view. From the new-sale catch
        // flow, onRelisted navigates to the file instead of reloading the
        // (now-stale) new-sale form.
        if (onRelisted) {
          onRelisted();
        } else if (typeof window !== "undefined") {
          window.location.reload();
        }
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
        className="relative rounded-2xl w-full flex flex-col"
        style={{
          background: isNight ? "#161d2e" : "#ffffff",
          maxWidth: stage === "form" ? 520 : 560,
          // Cap modal height to the viewport (minus the outer p-4 padding on
          // each side) so the new onward-sale step doesn't push the header
          // and footer off-screen. Body section below gets flex:1 + scroll
          // so it pages internally — header / footer stay sticky.
          maxHeight: "calc(100vh - 32px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          overflow: "hidden",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={SHEET_BAND_STYLE}
        >
          <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
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
                  flexShrink: 0,
                  background: "transparent",
                  border: "none",
                  cursor: isPending ? "default" : "pointer",
                  color: "rgba(255,255,255,0.85)",
                }}
                className="hover:bg-white/[0.18]"
              >
                <ArrowLeft size={14} weight="bold" />
              </button>
            )}
            <SheetBandHeader
              kicker="New buyer"
              title={stage === "form" ? "Add a new buyer" : "Confirm the new buyer"}
            />
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
              flexShrink: 0,
              background: "transparent",
              border: "none",
              cursor: isPending ? "default" : "pointer",
              color: "rgba(255,255,255,0.85)",
              opacity: isPending ? 0.4 : 1,
            }}
            className="hover:bg-white/[0.18]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body — flex:1 + overflow-y:auto so the body scrolls internally
          * when the form is taller than the viewport (the new onward-sale
          * step pushed total height past ~700px on shorter monitors). */}
        {stage === "form" ? (
          <div
            className="px-5 py-5 space-y-4 overflow-y-auto"
            style={{ flex: 1, minHeight: 0 }}
            onDragOver={(e) => { if (!isPending) { e.preventDefault(); setMemoDragOver(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMemoDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setMemoDragOver(false);
              if (isPending) return;
              const f = e.dataTransfer.files?.[0];
              if (f) handleMemoFile(f);
            }}
          >
            {/* Optional memo re-upload (critique #4) — reads the BUYER side of
              * the new memo and fills the fields below. Seller + tenure are
              * deliberately not shown: the seller carries over and tenure is a
              * fixed property fact. Drop / paste / click all read the memo,
              * matching the new-sale hero. */}
            <input
              ref={memoInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleMemoFile(f);
                e.target.value = "";
              }}
            />
            {memoState === "idle" && (
              <button
                type="button"
                onClick={() => memoInputRef.current?.click()}
                disabled={isPending}
                className="w-full text-left agent-hover-row"
                style={{
                  display: "flex", gap: 10, alignItems: "center",
                  padding: "12px 14px", borderRadius: 12,
                  background: memoDragOver ? "rgba(var(--agent-coral-rgb), 0.06)" : "var(--agent-surface-glass)",
                  border: memoDragOver
                    ? "1px solid var(--agent-coral-deep)"
                    : "1px solid var(--agent-border-default)",
                  cursor: isPending ? "default" : "pointer",
                  transition: "background 160ms, border-color 160ms",
                }}
              >
                <UploadSimple size={18} weight="regular" style={{ flexShrink: 0, color: "var(--agent-coral-deep)" }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                    {memoDragOver ? "Drop the memo here" : "Upload the new memo"}
                  </span>
                  <span style={{ display: "block", fontSize: 12, lineHeight: 1.4, color: "var(--agent-text-secondary)" }}>
                    Optional. Drop it here, paste it, or click to browse. We&rsquo;ll read the buyer&rsquo;s details.
                  </span>
                </span>
              </button>
            )}
            {memoState === "reading" && (
              <div
                style={{
                  display: "flex", gap: 12, alignItems: "center",
                  padding: "12px 14px", borderRadius: 12,
                  background: "var(--agent-surface-glass)",
                  border: "0.5px solid var(--agent-border-default)",
                }}
              >
                <span
                  style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                    border: "2px solid rgba(var(--agent-coral-rgb), 0.3)",
                    borderTopColor: "var(--agent-coral-deep)",
                    animation: "agent-spin 700ms linear infinite",
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                    Reading the memo&hellip;
                  </span>
                  <span style={{ display: "block", fontSize: 12, lineHeight: 1.4, color: "var(--agent-text-secondary)" }}>
                    Pulling out the buyer, the agreed price, and their solicitor.
                  </span>
                </span>
              </div>
            )}
            {memoState === "done" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                {memoFilled.length > 0 ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <CheckCircle size={16} weight="fill" color="var(--agent-success)" style={{ flexShrink: 0 }} />
                    <Pill tone="success" glass>Filled from Memorandum of Sale</Pill>
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <WarningCircle size={16} weight="fill" color="var(--agent-warning)" style={{ flexShrink: 0 }} />
                    <Pill tone="warning" glass>No buyer details found</Pill>
                  </span>
                )}
                <MemoRelinkButton onClick={() => memoInputRef.current?.click()} disabled={isPending} label="Upload a different memo" />
              </div>
            )}
            {memoState === "error" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <WarningCircle size={16} weight="fill" color="var(--agent-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>
                    {memoError ?? "Couldn't read that memo."} Fill the details in below.
                  </span>
                </span>
                <MemoRelinkButton onClick={() => memoInputRef.current?.click()} disabled={isPending} label="Try another file" />
              </div>
            )}
            {/* Reassurance: the outgoing buyer's earned broker referral is kept. */}
            {priorReferral && (
              <div
                style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  padding: "12px 14px", borderRadius: 12,
                  background: "var(--agent-surface-glass)",
                  border: "0.5px solid var(--agent-border-default)",
                }}
              >
                <span
                  style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(var(--agent-coral-rgb), 0.12)", color: "var(--agent-coral-deep)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <CurrencyGbp size={18} weight="regular" />
                </span>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>
                  {priorReferral.amountPence != null ? (
                    <>A <strong style={{ color: "var(--agent-text-primary)" }}>{formatPence(priorReferral.amountPence)}</strong> broker referral was already earned on {priorReferral.buyerName}&rsquo;s sale. It stays on record against that sale and won&rsquo;t be affected by adding a new buyer.</>
                  ) : (
                    <>A broker referral was already earned on {priorReferral.buyerName}&rsquo;s sale. It stays on record against that sale and won&rsquo;t be affected by adding a new buyer.</>
                  )}
                </p>
              </div>
            )}
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
                className="w-full glass-input text-sm rounded-lg px-3 py-2"
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
                  onBlur={(e) => setBuyerEmail(e.target.value.trim().toLowerCase())}
                  disabled={isPending}
                  placeholder="sarah@example.com"
                  maxLength={120}
                  className="w-full glass-input text-sm rounded-lg px-3 py-2"
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
                  className="w-full glass-input text-sm rounded-lg px-3 py-2"
                  />
              </div>
            </div>

            {/* New price — canonical PriceInput (same control as the new-sale
              * hero): £ prefix, thousand separators, value in pence. */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                Agreed price
              </label>
              <PriceInput
                value={pricePence}
                onChange={setPricePence}
                disabled={isPending}
                placeholder={poundsPlaceholder(previousPurchasePrice)}
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
              {/* Canonical option-select treatment (mirrors EmailSignatureCard):
                  solid coral gradient + tick on the chosen one, clean outline
                  that lifts on hover otherwise. Replaces the old faded tint. */}
              <style>{`.relist-pt-opt{transition:background 160ms,border-color 150ms,box-shadow 220ms,transform 160ms;} .relist-pt-opt:not(.on):hover{border-color:var(--agent-coral);transform:translateY(-1px);}`}</style>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {([
                  { value: "mortgage",           label: "Mortgage",            note: "All mortgage steps apply" },
                  { value: "cash_buyer",         label: "Cash",                note: "Mortgage steps not required" },
                  { value: "cash_from_proceeds", label: "Cash from Proceeds",  note: "Mortgage + deposit not required" },
                ] as const).map((opt) => {
                  const active = purchaseType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPurchaseType(opt.value)}
                      disabled={isPending}
                      className={`relist-pt-opt${active ? " on" : ""}`}
                      style={{
                        textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "12px 14px",
                        border: active ? "1.5px solid transparent" : "1.5px solid var(--agent-border-default)",
                        background: active ? "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))" : "var(--agent-surface-glass)",
                        boxShadow: active ? "0 4px 13px -2px rgba(var(--agent-coral-rgb), 0.45), inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
                        display: "flex", alignItems: "flex-start", gap: 10,
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: active ? "var(--agent-text-on-coral, #fff)" : "var(--agent-text-primary)" }}>{opt.label}</span>
                        <span style={{ display: "block", fontSize: 12, marginTop: 1, color: active ? "rgba(255,255,255,0.88)" : "var(--agent-text-muted)" }}>{opt.note}</span>
                      </span>
                      {active && <CheckCircle size={19} weight="fill" color="var(--agent-text-on-coral, #fff)" style={{ flexShrink: 0, marginTop: 1 }} />}
                    </button>
                  );
                })}
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
                  Buyer&apos;s related sale <span style={{ color: "var(--agent-danger, #C73E3E)" }}>*</span>
                </label>
                <div className="space-y-1.5">
                  {([
                    { value: "none",     label: "No, first-time buyer or cash buyer", helper: "Chain ends below us. Nothing to attach." },
                    { value: "internal", label: "Yes, managed by another Sales Progressor agent", helper: "We'll send them a chain invite by email." },
                    { value: "external", label: "Yes, managed by an external agency", helper: "We'll send a stub invite to their agent." },
                    { value: "unknown",  label: "Don't know yet", helper: "We'll keep a reminder on your hub until it's set up." },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOnwardKind(opt.value)}
                      disabled={isPending}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        onwardKind === opt.value
                          ? "border-[var(--agent-coral-deep,#E5502E)] bg-[rgba(255,107,74,0.06)] font-medium"
                          : "border-[var(--agent-border-default)] hover:border-[var(--agent-coral)] agent-hover-row"
                      }`}
                    >
                      <div className="text-sm font-medium" style={{ color: onwardKind === opt.value ? "var(--agent-coral-deep, #E5502E)" : "var(--agent-text-primary)" }}>{opt.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: onwardKind === opt.value ? "rgba(229,80,46,0.85)" : "var(--agent-text-muted)" }}>
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
                      className="w-full glass-input text-sm rounded-lg px-3 py-2"
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
                        className="w-full glass-input text-sm rounded-lg px-3 py-2"
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
                        className="w-full glass-input text-sm rounded-lg px-3 py-2"
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
                        className="w-full glass-input text-sm rounded-lg px-3 py-2"
                              />
                    </div>
                  </div>
                )}
              </div>
            )}

            {catchUpdates && (catchUpdates.safeUpdates.length > 0 || catchUpdates.conflicts.tenure || catchUpdates.conflicts.seller || catchUpdates.conflicts.onward) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 2 }}>
                {catchUpdates.safeUpdates.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-secondary)", marginBottom: 8 }}>We&rsquo;ll update the file</div>
                    <div style={{ borderRadius: 12, border: "0.5px solid var(--agent-border-default)", padding: "2px 14px" }}>
                      {catchUpdates.safeUpdates.map((u, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                          <CheckCircle size={15} weight="fill" color="var(--agent-success, #1F8A4A)" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>{u.label}</span>
                          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textAlign: "right" }}>{u.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(catchUpdates.conflicts.tenure || catchUpdates.conflicts.seller || catchUpdates.conflicts.onward) && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-secondary)", marginBottom: 8 }}>Needs your confirmation</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {catchUpdates.conflicts.tenure && (
                        <ConflictRow title="Tenure differs" file={catchUpdates.conflicts.tenure.file} entered={catchUpdates.conflicts.tenure.entered} keepLabel="Keep file's" replaceLabel="Use what you entered" value={tenureRes} onChange={setTenureRes} note="Changing tenure reshuffles the legal steps on the file, so we never flip it without you." />
                      )}
                      {catchUpdates.conflicts.seller && (
                        <ConflictRow title="Seller differs" file={catchUpdates.conflicts.seller.file} entered={catchUpdates.conflicts.seller.entered} keepLabel="Keep file's" replaceLabel="Replace" value={sellerRes} onChange={setSellerRes} note="The seller rarely changes when only the buyer does, so we keep the file's unless you say otherwise." />
                      )}
                      {catchUpdates.conflicts.onward && (
                        <ConflictRow title="Seller's onward purchase differs" file={catchUpdates.conflicts.onward.file} entered={catchUpdates.conflicts.onward.entered} keepLabel="Keep file's" replaceLabel="Set up fresh" value={onwardRes} onChange={setOnwardRes} note="We won't merge two chains automatically. Replace flags the file so you set the chain up fresh." />
                      )}
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
            memoUploaded={memoState === "done"}
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
                className="agent-btn agent-btn-neutral agent-btn-sm"
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
  memoUploaded,
  error,
}: {
  buyerName: string;
  newPrice: number | null;
  previousPrice: number | null;
  memoUploaded: boolean;
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

      {memoUploaded && (
        <div
          className="rounded-lg px-4 py-3 text-xs"
          style={{
            background: "rgba(52, 168, 83, 0.08)",
            border: "0.5px solid rgba(52, 168, 83, 0.25)",
            color: "var(--agent-text-secondary, #4b5563)",
          }}
        >
          You've uploaded the new memo, so the "Memorandum of sale received" step will be ticked for {buyerName}, and the memo is filed against the sale.
        </div>
      )}

      <div
        className="rounded-lg px-4 py-3 text-xs"
        style={{
          background: "rgba(255, 173, 51, 0.10)",
          border: "0.5px solid rgba(255, 173, 51, 0.25)",
          color: "var(--agent-text-secondary, #4b5563)",
        }}
      >

        The previous buyer's portal link will land on a "this link is no longer active" page. Their progress is kept in the file's history but has no effect on the new sale.
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--agent-danger, #C73E3E)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
