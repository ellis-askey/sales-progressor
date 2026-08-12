"use client";

// Inline-editable Sale price / Purchase type / Tenure cells for the agent
// hero stat row. They render pixel-identical to the read-only HeroStatCell,
// gaining a faint pencil on hover to signal they're editable.
//
//  - Price: click -> the value becomes a PriceInput in place. Enter or blur
//    saves via savePriceAction (audited + logged server-side). Escape cancels.
//    Editable even after exchange, because a price correction is always valid.
//  - Purchase type / Tenure: click -> a small anchored popover (bottom sheet on
//    mobile) of the options. Picking one loads the milestone impact via
//    getSaleDetailsDelta and opens SaleDetailChangeModal; confirming runs
//    confirmSaleDetailsAction. Locked once the file has exchanged, since the
//    NR cascade can reverse completed post-exchange steps.
//
// Permissions mirror the edit drawer: type/tenure are editable only when both
// values are set (the delta needs a concrete from/to). The caller decides who
// sees this at all.

import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CurrencyGbp, UserCircle, HouseSimple, PencilSimple, Check } from "@phosphor-icons/react";
import type { PurchaseType, Tenure } from "@prisma/client";
import { PriceInput } from "@/components/ui/PriceInput";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { savePriceAction, getSaleDetailsDelta, confirmSaleDetailsAction } from "@/app/actions/transactions";
import type { SaleDetailsDelta } from "@/app/actions/transactions";
import { SaleDetailChangeModal } from "./SaleDetailChangeModal";

const PURCHASE_TYPE_OPTIONS: { value: PurchaseType; label: string }[] = [
  { value: "mortgage", label: "Mortgage" },
  { value: "cash_buyer", label: "Cash buyer" },
  { value: "cash_from_proceeds", label: "Cash from proceeds" },
];
const TENURE_OPTIONS: { value: Tenure; label: string }[] = [
  { value: "freehold", label: "Freehold" },
  { value: "leasehold", label: "Leasehold" },
];

function formatPrice(pence: number | null): string {
  if (!pence) return "–";
  return "£" + (pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}
function purchaseTypeLabel(p: PurchaseType | null): string {
  if (!p) return "–";
  return { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from Proceeds" }[p];
}
function tenureLabel(t: Tenure | null): string {
  if (!t) return "–";
  return t === "leasehold" ? "Leasehold" : "Freehold";
}

// Styles lifted verbatim from HeroStatCell so the editable cells are visually
// indistinguishable from the static "Expected exchange" cell beside them.
const ICON_CHIP: CSSProperties = {
  width: 32, height: 32, borderRadius: 999,
  background: "rgba(var(--agent-coral-rgb), 0.12)", color: "var(--agent-coral-deep)",
  display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const VALUE_STYLE: CSSProperties = {
  display: "block", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)",
  letterSpacing: "-0.01em", lineHeight: 1.25, fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const LABEL_STYLE: CSSProperties = { display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 };

function CellFrame({ Icon, children }: { Icon: typeof CurrencyGbp; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, position: "relative" }}>
      <span style={ICON_CHIP}><Icon size={16} weight="regular" /></span>
      <span style={{ minWidth: 0, flex: 1 }}>{children}</span>
    </div>
  );
}

// A value line that looks exactly like the static cell but is a button with a
// hover pencil. Used for both the price and the option triggers.
function EditTrigger({ value, label, ariaLabel, sensitive, onClick }: {
  value: string; label: string; ariaLabel: string; sensitive?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="group agent-hero-edit"
      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", font: "inherit" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
        <span data-sensitive={sensitive ? "true" : undefined} style={VALUE_STYLE}>{value}</span>
        <PencilSimple
          size={12}
          weight="regular"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--agent-text-muted)", flexShrink: 0 }}
        />
      </span>
      <span style={LABEL_STYLE}>{label}</span>
    </button>
  );
}

function StaticValue({ value, label, sensitive }: { value: string; label: string; sensitive?: boolean }) {
  return (
    <>
      <span data-sensitive={sensitive ? "true" : undefined} style={VALUE_STYLE}>{value}</span>
      <span style={LABEL_STYLE}>{label}</span>
    </>
  );
}

// Anchored option menu: a dropdown under the trigger on desktop, a bottom sheet
// on mobile. Rendered to a body portal so the hero card can't clip it.
function OptionMenu<T extends string>({ anchor, options, current, onPick, onClose }: {
  anchor: DOMRect;
  options: { value: T; label: string }[];
  current: T | null;
  onPick: (v: T) => void;
  onClose: () => void;
}) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const list = (
    <div style={{ padding: 4 }}>
      {options.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            className="agent-hover-row"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8,
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: active ? 600 : 500,
              color: active ? "var(--agent-coral-deep)" : "var(--agent-text-primary)",
            }}
          >
            {o.label}
            {active && <Check size={14} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );

  if (isMobile) {
    return createPortal(
      <>
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(15,23,42,0.28)" }} />
        <div
          className="agent-reveal-in"
          style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60,
            background: "var(--agent-surface-elevated, #fff)",
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.18)", padding: "8px 8px 20px",
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(15,23,42,0.16)", margin: "6px auto 8px" }} />
          {list}
        </div>
      </>,
      document.body,
    );
  }

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div
        className="agent-reveal-in"
        style={{
          position: "fixed",
          top: anchor.bottom + 6,
          left: anchor.left,
          zIndex: 60,
          minWidth: Math.max(180, anchor.width),
          background: "var(--agent-surface-elevated, #fff)",
          border: "0.5px solid var(--agent-border-default, rgba(15,23,42,0.12))",
          borderRadius: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
          overflow: "hidden",
        }}
      >
        {list}
      </div>
    </>,
    document.body,
  );
}

type PendingChange = { newPurchaseType: PurchaseType; newTenure: Tenure; title: string };

export function HeroSaleFields({ transactionId, purchasePrice, purchaseType, tenure, exchanged }: {
  transactionId: string;
  purchasePrice: number | null;
  purchaseType: PurchaseType | null;
  tenure: Tenure | null;
  exchanged: boolean;
}) {
  const router = useRouter();
  const { toast } = useAgentToast();

  // ── Price inline edit ──
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState<number | null>(purchasePrice);
  const [priceSaving, setPriceSaving] = useState(false);
  const priceWrapRef = useRef<HTMLDivElement>(null);
  // Guards Enter/blur/Escape from firing commit twice via stale closures: an
  // edit session is "live" from open until the first commit or cancel.
  const priceEditLive = useRef(false);

  useEffect(() => {
    if (editingPrice) {
      const input = priceWrapRef.current?.querySelector<HTMLInputElement>("input");
      input?.focus();
      input?.select();
    }
  }, [editingPrice]);

  const openPriceEdit = () => { priceEditLive.current = true; setPriceDraft(purchasePrice); setEditingPrice(true); };
  const cancelPriceEdit = () => { priceEditLive.current = false; setPriceDraft(purchasePrice); setEditingPrice(false); };

  async function commitPrice() {
    if (!priceEditLive.current) return;
    priceEditLive.current = false;
    if (priceDraft == null || priceDraft === purchasePrice) { setEditingPrice(false); return; }
    setPriceSaving(true);
    try {
      await savePriceAction(transactionId, priceDraft);
      setEditingPrice(false);
      toast.success(`Purchase price updated to ${formatPrice(priceDraft)}`);
      router.refresh();
    } catch (err) {
      priceEditLive.current = true; // allow a retry
      toast.error(err instanceof Error ? err.message : "Couldn't update the price");
    } finally {
      setPriceSaving(false);
    }
  }

  // ── Type / Tenure popover + confirm ──
  const [openField, setOpenField] = useState<"type" | "tenure" | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const typeBtnRef = useRef<HTMLDivElement>(null);
  const tenureBtnRef = useRef<HTMLDivElement>(null);

  const [pending, setPending] = useState<PendingChange | null>(null);
  const [delta, setDelta] = useState<SaleDetailsDelta | null>(null);
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const typeTenureLocked = exchanged || purchaseType == null || tenure == null;

  function openPopover(field: "type" | "tenure") {
    const ref = field === "type" ? typeBtnRef : tenureBtnRef;
    const rect = ref.current?.getBoundingClientRect() ?? null;
    setAnchorRect(rect);
    setOpenField(field);
  }

  // Close the popover if the page scrolls/resizes — the anchored rect goes stale.
  useEffect(() => {
    if (!openField) return;
    const close = () => setOpenField(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openField]);

  async function pickOption(field: "type" | "tenure", value: string) {
    setOpenField(null);
    if (purchaseType == null || tenure == null) return;
    const next: PendingChange = field === "type"
      ? { newPurchaseType: value as PurchaseType, newTenure: tenure, title: `Change purchase type to ${purchaseTypeLabel(value as PurchaseType)}?` }
      : { newPurchaseType: purchaseType, newTenure: value as Tenure, title: `Change tenure to ${tenureLabel(value as Tenure)}?` };
    if (next.newPurchaseType === purchaseType && next.newTenure === tenure) return; // picked current

    setPending(next);
    setDelta(null);
    setModalError(null);
    setDeltaLoading(true);
    try {
      const d = await getSaleDetailsDelta({ transactionId, newPurchaseType: next.newPurchaseType, newTenure: next.newTenure });
      setDelta(d);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Couldn't load the preview");
    } finally {
      setDeltaLoading(false);
    }
  }

  async function confirmChange() {
    if (!pending || confirming) return;
    setConfirming(true);
    setModalError(null);
    try {
      await confirmSaleDetailsAction({ transactionId, newPurchaseType: pending.newPurchaseType, newTenure: pending.newTenure });
      const label = pending.newTenure !== tenure ? "Tenure" : "Purchase type";
      closeModal();
      toast.success(`${label} updated`);
      router.refresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Couldn't save the change");
    } finally {
      setConfirming(false);
    }
  }

  function closeModal() {
    setPending(null);
    setDelta(null);
    setModalError(null);
    setDeltaLoading(false);
  }

  return (
    <>
      {/* Sale price */}
      <CellFrame Icon={CurrencyGbp}>
        {editingPrice ? (
          <div
            ref={priceWrapRef}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitPrice(); }
              if (e.key === "Escape") { e.preventDefault(); cancelPriceEdit(); }
            }}
          >
            <PriceInput value={priceDraft} onChange={setPriceDraft} onBlur={commitPrice} size="sm" className="w-full" disabled={priceSaving} />
            <span style={LABEL_STYLE}>Sale price</span>
          </div>
        ) : (
          <EditTrigger value={formatPrice(purchasePrice)} label="Sale price" ariaLabel="Edit sale price" sensitive onClick={openPriceEdit} />
        )}
      </CellFrame>

      {/* Purchase type */}
      <CellFrame Icon={UserCircle}>
        <div ref={typeBtnRef}>
          {typeTenureLocked ? (
            <StaticValue value={purchaseTypeLabel(purchaseType)} label="Purchase type" />
          ) : (
            <EditTrigger value={purchaseTypeLabel(purchaseType)} label="Purchase type" ariaLabel="Change purchase type" onClick={() => openPopover("type")} />
          )}
        </div>
      </CellFrame>

      {/* Tenure */}
      <CellFrame Icon={HouseSimple}>
        <div ref={tenureBtnRef}>
          {typeTenureLocked ? (
            <StaticValue value={tenureLabel(tenure)} label="Tenure" />
          ) : (
            <EditTrigger value={tenureLabel(tenure)} label="Tenure" ariaLabel="Change tenure" onClick={() => openPopover("tenure")} />
          )}
        </div>
      </CellFrame>

      {openField === "type" && anchorRect && (
        <OptionMenu
          anchor={anchorRect}
          options={PURCHASE_TYPE_OPTIONS}
          current={purchaseType}
          onPick={(v) => pickOption("type", v)}
          onClose={() => setOpenField(null)}
        />
      )}
      {openField === "tenure" && anchorRect && (
        <OptionMenu
          anchor={anchorRect}
          options={TENURE_OPTIONS}
          current={tenure}
          onPick={(v) => pickOption("tenure", v)}
          onClose={() => setOpenField(null)}
        />
      )}

      <SaleDetailChangeModal
        open={pending !== null}
        onClose={closeModal}
        title={pending?.title ?? ""}
        delta={delta}
        loading={deltaLoading}
        confirming={confirming}
        error={modalError}
        onConfirm={confirmChange}
      />
    </>
  );
}
