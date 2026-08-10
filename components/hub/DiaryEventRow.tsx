"use client";

// Today's-diary row. Status-aware (2026-08-10): a file that's already
// exchanged/completed reads as done; one that's due today but not gate-ready
// reads as informational; only a ready file gets an action pill that opens a
// confirm modal and fires the *canonical* exchange/completion via
// confirmDiaryEventAction — so all downstream (billing, party notifications,
// bilateral fan-out, status flip) runs exactly as it would on the file.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "@phosphor-icons/react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmDiaryEventAction } from "@/app/actions/milestones";
import type { DiaryItem } from "@/lib/services/hub";

const COPY = {
  exchange: {
    verb: "exchange",
    doneLabel: "Exchanged",
    title: "Confirm exchange",
    // Voice-passed: no em dash, no exclamation, "we'll" via "lets … know".
    body: (address: string) =>
      `This marks ${address} as exchanged and lets the buyer and seller know. Ready to confirm?`,
    cta: "Confirm exchange",
    toast: "Exchange confirmed",
    accent: "var(--agent-coral-deep)",
    accentBorder: "rgba(var(--agent-coral-rgb), 0.45)",
  },
  completion: {
    verb: "completion",
    doneLabel: "Completed",
    title: "Confirm completion",
    body: (address: string) =>
      `This marks ${address} as completed and lets the buyer and seller know. Ready to confirm?`,
    cta: "Confirm completion",
    toast: "Completion confirmed",
    accent: "var(--agent-success)",
    accentBorder: "rgba(var(--agent-success-rgb), 0.45)",
  },
} as const;

export function DiaryEventRow({
  item,
  basePath = "/agent/transactions",
  isFirst = false,
}: {
  item: DiaryItem;
  basePath?: string;
  isFirst?: boolean;
}) {
  const c = COPY[item.type];
  const router = useRouter();
  const { toast } = useAgentToast();
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gateMsg, setGateMsg] = useState<string | null>(null);

  const shortAddress = item.address.split(",")[0];

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setGateMsg(null);
    try {
      const res = await confirmDiaryEventAction({ transactionId: item.transactionId, kind: item.type });
      if (res && "ok" in res && res.ok === false) {
        const missing = (res.missing ?? []).map((m) => m.name).filter(Boolean).join(", ");
        setGateMsg(
          missing
            ? `Not ready yet. Confirm ${missing} first, then this can ${c.verb}.`
            : `This file isn't ready to ${c.verb} yet.`,
        );
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

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 20px 13px 17px",
    borderLeft: `3px solid ${item.type === "completion" ? "var(--agent-success)" : "var(--agent-coral)"}`,
    background: item.type === "completion" ? "var(--agent-success-bg)" : "var(--agent-coral-bg-tint)",
    borderTop: !isFirst ? "0.5px solid var(--agent-border-subtle)" : undefined,
    gap: 12,
  };

  return (
    <div style={rowStyle}>
      <Link href={`${basePath}/${item.transactionId}`} className="agent-hover-row" style={{ textDecoration: "none", flex: 1, minWidth: 0, borderRadius: 6 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.address}
        </p>
      </Link>

      {item.status === "done" ? (
        <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: "var(--agent-success)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Check size={13} weight="bold" /> {c.doneLabel}
        </span>
      ) : item.status === "ready" ? (
        <button
          type="button"
          onClick={() => { setGateMsg(null); setOpen(true); }}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          style={{
            flexShrink: 0,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            padding: "5px 13px",
            borderRadius: 999,
            color: c.accent,
            background: "var(--agent-surface-elevated)",
            border: `1px solid ${c.accentBorder}`,
            transform: pressed ? "scale(0.93)" : "scale(1)",
            transition: "transform 110ms cubic-bezier(0.16,1,0.3,1), box-shadow 140ms",
            boxShadow: pressed ? "none" : "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          Confirm {c.verb}
        </button>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 500, flexShrink: 0, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>
          Due today · not ready
        </span>
      )}

      <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} ariaLabel={c.title} size="sm">
        <ModalHeader>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--agent-text-primary)" }}>{c.title}</h2>
        </ModalHeader>
        <ModalBody>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>
            {c.body(shortAddress)}
          </p>
          {gateMsg && (
            <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 500, color: "var(--agent-warning)" }}>{gateMsg}</p>
          )}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => { if (!busy) setOpen(false); }} disabled={busy} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={busy} className="agent-btn agent-btn-sm agent-btn-primary">
            {busy ? "Confirming…" : c.cta}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
