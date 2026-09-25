"use client";

// Today's-diary row. Status-aware: a file that's already exchanged/completed
// reads as done; a "ready" file gets a split button (Confirm + chevron menu);
// one due today but not gate-ready reads as informational, with the same
// chevron menu so it can still be acted on. The menu ties into the existing
// systems — set a new date (ReviseExchangeDateModal / saveCompletionDateAction),
// recalculate (recalibrateExchangeDateAction), snooze for today (a view-only
// per-day dismiss handled by the parent card), and confirm (the canonical
// confirmDiaryEventAction, which gate-checks). Menus portal to the body so they
// never clip or fall behind the card.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CalendarPlus, ArrowsClockwise, Clock } from "@phosphor-icons/react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmDiaryEventAction } from "@/app/actions/milestones";
import { recalibrateExchangeDateAction, saveCompletionDateAction } from "@/app/actions/transactions";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { RowActionMenu, type RowMenuItem } from "@/components/hub/RowActionMenu";
import { ReviseExchangeDateModal } from "@/components/transaction/ReviseExchangeDateModal";
import { DateField } from "@/components/ui/DateField";
import { toUKDateStr } from "@/lib/utils";
import type { DiaryItem } from "@/lib/services/hub";

type Item = DiaryItem & { photoUrl: string | null };

const COPY = {
  exchange: {
    verb: "exchange", doneLabel: "Exchanged", title: "Confirm exchange",
    body: (address: string) => `This marks ${address} as exchanged and lets the buyer and seller know. Ready to confirm?`,
    cta: "Confirm exchange", toast: "Exchange confirmed", accent: "var(--agent-coral-deep)",
  },
  completion: {
    verb: "completion", doneLabel: "Completed", title: "Confirm completion",
    body: (address: string) => `This marks ${address} as completed and lets the buyer and seller know. Ready to confirm?`,
    cta: "Confirm completion", toast: "Completion confirmed", accent: "var(--agent-success)",
  },
} as const;

export function DiaryEventRow({
  item,
  basePath = "/agent/transactions",
  isFirst = false,
  onSnooze,
}: {
  item: Item;
  basePath?: string;
  isFirst?: boolean;
  onSnooze: (transactionId: string) => void;
}) {
  const c = COPY[item.type];
  const router = useRouter();
  const { toast } = useAgentToast();
  const [open, setOpen] = useState(false);          // confirm modal
  const [reviseOpen, setReviseOpen] = useState(false);
  const [compDateOpen, setCompDateOpen] = useState(false);
  const [compDate, setCompDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateMsg, setGateMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const shortAddress = item.address.split(",")[0];
  const [line1, ...rest] = item.address.split(",");
  const town = rest.join(",").trim();
  const todayStr = toUKDateStr(new Date());

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setGateMsg(null);
    try {
      const res = await confirmDiaryEventAction({ transactionId: item.transactionId, kind: item.type });
      if (res && "ok" in res && res.ok === false) {
        const missing = (res.missing ?? []).map((m) => m.name).filter(Boolean).join(", ");
        setGateMsg(missing ? `Not ready yet. Confirm ${missing} first.` : `This file isn't ready yet.`);
        setBusy(false);
        return;
      }
      setOpen(false);
      setBusy(false);
      toast.success(c.toast, { description: shortAddress });
      router.refresh();
    } catch {
      setBusy(false);
      setGateMsg("Something went wrong. Try again from the file.");
    }
  }

  function recalc() {
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await recalibrateExchangeDateAction(item.transactionId);
        if (r.ok) { toast.success("Estimate recalibrated", { description: r.newDate ? `New expected exchange: ${r.newDate}` : "New expected date set from today." }); router.refresh(); }
        else toast.error("Couldn't recalculate.");
      } catch { toast.error("Couldn't recalculate."); }
      finally { setBusy(false); }
    });
  }

  function saveCompDate() {
    if (!compDate) return;
    setBusy(true);
    startTransition(async () => {
      try {
        await saveCompletionDateAction(item.transactionId, compDate);
        toast.success("Completion date updated", { description: shortAddress });
        setCompDateOpen(false);
        router.refresh();
      } catch { toast.error("Couldn't update. Try again."); }
      finally { setBusy(false); }
    });
  }

  // Chevron-menu items, tuned to type + status.
  const menuItems: RowMenuItem[] = [];
  if (item.type === "exchange") {
    menuItems.push({ key: "setdate", icon: <CalendarPlus size={16} weight="bold" />, title: "Set a new date", sub: "Once you've spoken to both parties.", onClick: () => setReviseOpen(true) });
    menuItems.push({ key: "recalc", icon: <ArrowsClockwise size={16} weight="bold" />, title: "Recalculate the date", sub: "Re-estimate from today.", onClick: recalc, disabled: busy });
  } else {
    menuItems.push({ key: "setdate", icon: <CalendarPlus size={16} weight="bold" />, title: "Set a new date", sub: "Change the completion day.", onClick: () => setCompDateOpen(true) });
  }
  menuItems.push({ key: "snooze", icon: <Clock size={16} weight="bold" />, title: "Snooze for today", sub: "Hide it from today's diary.", onClick: () => onSnooze(item.transactionId) });
  // The confirm lives in the menu ONLY for a not-ready EXCHANGE (which shows a
  // "Not ready" button, not a confirm one). Completions always get a real
  // "Confirm completion" button below, so it isn't duplicated in their menu.
  if (item.status === "not_ready" && item.type === "exchange") {
    menuItems.push({ key: "confirm", icon: <Check size={16} weight="bold" />, title: `Confirm ${c.verb}`, sub: "If it's actually done.", onClick: () => { setGateMsg(null); setOpen(true); } });
  }

  const isCompletion = item.type === "completion";
  // Show the primary confirm split-button when the row is genuinely actionable
  // (an exchange with both gates in) AND for every completion — a completion is
  // a "complete it" action, so a passive "Not ready" reads wrong there; the
  // server gate still guards it if the file hasn't exchanged yet. An exchange
  // that isn't gate-ready keeps a "Not ready" button that opens its options.
  const showConfirmButton = item.status === "ready" || (item.status === "not_ready" && isCompletion);
  const rowVars = {
    "--diary-accent": isCompletion ? "var(--agent-success)" : "var(--agent-coral)",
    "--diary-bg": isCompletion ? "var(--agent-success-bg)" : "var(--agent-coral-bg-tint)",
    "--diary-bg-hover": isCompletion ? "rgba(var(--agent-success-rgb), 0.16)" : "rgba(var(--agent-coral-rgb), 0.13)",
    borderTop: !isFirst ? "0.5px solid var(--agent-border-subtle)" : undefined,
  } as React.CSSProperties;

  return (
    <div className="diary-row" style={rowVars}>
      <Link href={`${basePath}/${item.transactionId}`} className="diary-idlink" style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0 }}>
        <PropertyThumb photoUrl={item.photoUrl} size={38} />
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span className="diary-addr-l1">{line1.trim()}</span>
          {town && <span className="diary-addr-town">{town}</span>}
        </span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {item.status === "done" ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-success)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Check size={13} weight="bold" /> {c.doneLabel}
          </span>
        ) : showConfirmButton ? (
          <span style={{ display: "inline-flex", alignItems: "stretch" }}>
            <button
              type="button"
              onClick={() => { setGateMsg(null); setOpen(true); }}
              className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
              style={{ color: c.accent, fontWeight: 700, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            >
              Confirm {c.verb}
            </button>
            <RowActionMenu joined items={menuItems} disabled={busy} />
          </span>
        ) : (
          // Exchange not yet gate-ready: a "Not ready" button (not bare text) that
          // opens the options menu, so the row keeps the button footprint of the
          // actionable rows instead of a lone chevron beside plain text.
          <RowActionMenu label="Not ready" items={menuItems} disabled={busy} />
        )}
      </div>

      {/* Confirm modal */}
      <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} ariaLabel={c.title} size="sm" closeTone="onDark">
        <ModalHeader style={SHEET_BAND_STYLE}>
          <SheetBandHeader kicker={item.type === "completion" ? "Completion" : "Exchange"} title={c.title} />
        </ModalHeader>
        <ModalBody>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>{c.body(shortAddress)}</p>
          {gateMsg && <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 500, color: "var(--agent-warning)" }}>{gateMsg}</p>}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => { if (!busy) setOpen(false); }} disabled={busy} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Cancel</button>
          <button type="button" onClick={confirm} disabled={busy} className="agent-btn agent-btn-sm agent-btn-primary">{busy ? "Confirming…" : c.cta}</button>
        </ModalFooter>
      </Modal>

      {/* Exchange: set a new date (with the "spoken to both parties" gate) */}
      {reviseOpen && (
        <ReviseExchangeDateModal
          transactionId={item.transactionId}
          address={shortAddress}
          onClose={() => setReviseOpen(false)}
          onSaved={() => { setReviseOpen(false); toast.success("New date set", { description: shortAddress }); router.refresh(); }}
        />
      )}

      {/* Completion: set a new completion date */}
      <Modal open={compDateOpen} onClose={() => { if (!busy) setCompDateOpen(false); }} ariaLabel="Set completion date" size="sm" closeTone="onDark">
        <ModalHeader style={SHEET_BAND_STYLE}>
          <SheetBandHeader kicker="Completion" title="Set completion date" />
        </ModalHeader>
        <ModalBody>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>Pick the new completion day for {shortAddress}.</p>
          <DateField value={compDate} min={todayStr} onChange={(e) => setCompDate(e.target.value)} className="agent-input" style={{ marginTop: 12, padding: "8px 10px", fontSize: 14 }} wrapperStyle={{ display: "block" }} autoFocus />
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => { if (!busy) setCompDateOpen(false); }} disabled={busy} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Cancel</button>
          <button type="button" onClick={saveCompDate} disabled={busy || !compDate} className="agent-btn agent-btn-sm agent-btn-primary">{busy ? "Saving…" : "Save date"}</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
