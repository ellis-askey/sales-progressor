"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, House } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { switchServiceTypeAction } from "@/app/actions/transactions";
import type { HandoverableSale } from "@/lib/services/progressor-network-relationship";

// "Assign a sale" — hand one of the agency's active, self-managed sales to a
// connected progression business. Reuses the real hand-over action
// (switchServiceTypeAction with the chosen business), which enforces the
// readiness + fee gates server-side; we surface its message verbatim if a sale
// isn't ready. On success the sale leaves the self-managed list (router.refresh).

export function AssignSaleModal({
  open,
  onClose,
  businessId,
  businessName,
  sales,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  sales: HandoverableSale[];
}) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);

  function assign() {
    if (!picked || pending) return;
    const sale = sales.find((s) => s.id === picked);
    start(async () => {
      const res = await switchServiceTypeAction(picked, "outsourced", businessId);
      if (res.ok) {
        toast.success("Sale handed over", { description: `${sale?.address ?? "The sale"} is now with ${businessName}.` });
        router.refresh();
        onClose();
      } else {
        toast.error("Couldn't hand this sale over", { description: res.error });
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel={`Assign a sale to ${businessName}`} size="md" dismissOnBackdrop={!pending}>
      <Modal.Header>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--agent-text-primary)" }}>Assign a sale to {businessName}</h2>
      </Modal.Header>
      <Modal.Body>
        {sales.length === 0 ? (
          <div style={{ padding: "22px 4px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>No sales ready to hand over</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
              Only your own active sales that aren&apos;t already with a progressor can be handed over. Create or take back a sale first.
            </p>
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
              Choose a sale to hand to {businessName}. They&apos;ll pick it up and progress it from here. You can hand over more at any time.
            </p>
            <div role="radiogroup" aria-label="Choose a sale" className="asm-list">
              {sales.map((s) => {
                const on = picked === s.id;
                return (
                  <button key={s.id} type="button" role="radio" aria-checked={on} className={"asm-row" + (on ? " on" : "")} onClick={() => setPicked(s.id)} disabled={pending}>
                    <span className="asm-ico"><House size={16} weight={on ? "fill" : "regular"} /></span>
                    <span className="asm-addr">{s.address}</span>
                    {on && <Check size={16} weight="bold" className="asm-check" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose} disabled={pending}>
          {sales.length === 0 ? "Close" : "Cancel"}
        </Button>
        {sales.length > 0 && (
          <Button variant="primary" size="md" onClick={assign} disabled={!picked} loading={pending}>
            Assign sale
          </Button>
        )}
      </Modal.Footer>

      <style>{`
        .asm-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
        .asm-row { display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; padding: 12px 14px; border-radius: var(--agent-radius-md); cursor: pointer;
          border: 1px solid var(--agent-border-default); background: var(--agent-surface); transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
        .asm-row:hover:not(:disabled) { border-color: var(--agent-coral); }
        .asm-row.on { border-color: var(--agent-coral-deep); box-shadow: 0 0 0 3px rgba(var(--agent-coral-rgb),0.12); }
        .asm-row:disabled { opacity: 0.6; cursor: default; }
        .asm-ico { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; background: var(--agent-surface-sunken, rgba(0,0,0,0.04)); color: var(--agent-text-muted); }
        .asm-row.on .asm-ico { background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep); }
        .asm-addr { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--agent-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .asm-check { color: var(--agent-coral-deep); flex-shrink: 0; }
      `}</style>
    </Modal>
  );
}
