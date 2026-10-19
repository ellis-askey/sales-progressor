"use client";

// Sidebar "Property" card — the niche tenure/scheme flags for a file, grouped out
// of the hero (2026-10-19). Three toggles, each shown only where it's meaningful:
//   - Shared ownership (any tenure): the buyer is buying a share of the home from
//     a housing association. Always a leasehold with a landlord pack, so it keeps
//     the management-pack steps (VM8/VM9/PM12) live on ANY tenure — reuses the
//     managed-freehold wiring in confirmSaleDetailsAction.
//   - Managed development (freehold only): a freehold that still issues a pack.
//   - Share of freehold (leasehold only): the leaseholders own the freehold.
// Shared ownership and share of freehold are mutually exclusive (different owners
// of the freehold) — the server enforces it; here we just disable the other.
//
// Turning a pack-driving flag OFF on a freehold reverses VM8/VM9/PM12, so that
// direction asks to confirm first (mirrors the hero's managed-development flow).

import { useState } from "react";
import type { Tenure, PurchaseType } from "@prisma/client";
import { GlassCard } from "@/components/glass/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmSaleDetailsAction, saveIsShareOfFreeholdAction } from "@/app/actions/transactions";

function Toggle({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 34, height: 20, borderRadius: 999, flexShrink: 0, position: "relative",
        background: on ? "var(--agent-coral-deep)" : "var(--agent-border-strong)",
        opacity: disabled ? 0.4 : 1, transition: "background 160ms ease",
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.25)", transition: "left 160ms ease",
        }}
      />
    </span>
  );
}

function FlagRow({
  label, hint, on, disabled, onClick,
}: {
  label: string; hint?: string; on: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 0",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>{hint}</span>}
      </span>
      <Toggle on={on} disabled={disabled} />
    </button>
  );
}

export function PropertyFlagsCard({
  transactionId, tenure, purchaseType, isShareOfFreehold, hasManagementPack, isSharedOwnership, canEdit = false,
}: {
  transactionId: string;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  isShareOfFreehold: boolean;
  hasManagementPack: boolean;
  isSharedOwnership: boolean;
  canEdit?: boolean;
}) {
  const { toast } = useAgentToast();
  const [so, setSo] = useState(isSharedOwnership);
  const [pack, setPack] = useState(hasManagementPack);
  const [share, setShare] = useState(isShareOfFreehold);
  const [saving, setSaving] = useState(false);
  // A pending destructive toggle awaiting confirmation (reverses the pack steps).
  const [confirm, setConfirm] = useState<null | { kind: "pack" | "so" }>(null);

  const isFreehold = tenure === "freehold";
  const isLeasehold = tenure === "leasehold";
  const editable = canEdit && !saving;

  // Apply a shared-ownership or managed-pack change through the cascade action.
  async function applySaleFlag(patch: { newHasManagementPack?: boolean; newIsSharedOwnership?: boolean }, optimistic: () => void) {
    if (!tenure || !purchaseType) { toast.error("Set the tenure and purchase type first."); return; }
    setSaving(true);
    try {
      await confirmSaleDetailsAction({ transactionId, newPurchaseType: purchaseType, newTenure: tenure, ...patch });
      optimistic();
      toast.success("Property details updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the change");
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }

  function onToggleSo() {
    const next = !so;
    // Turning OFF on a freehold reverses the pack steps — confirm first.
    if (!next && isFreehold) { setConfirm({ kind: "so" }); return; }
    void applySaleFlag({ newIsSharedOwnership: next }, () => { setSo(next); if (next) setShare(false); });
  }

  function onTogglePack() {
    const next = !pack;
    if (!next) { setConfirm({ kind: "pack" }); return; } // off reverses the pack steps
    void applySaleFlag({ newHasManagementPack: next }, () => setPack(next));
  }

  async function onToggleShare() {
    const next = !share;
    setSaving(true);
    try {
      await saveIsShareOfFreeholdAction(transactionId, next);
      setShare(next);
      if (next) setSo(false);
      toast.success(next ? "Marked share of freehold" : "Share-of-freehold removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the change");
    } finally {
      setSaving(false);
    }
  }

  // Nothing meaningful to show until the tenure is known.
  if (!tenure) return null;

  return (
    <>
      <GlassCard glassId="sidebar-property" label="Sidebar · Property" defaultVariant="v06" style={{ padding: "14px 16px", borderRadius: 10 }} data-bloom>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-muted)", marginBottom: 4 }}>
          Property
        </div>

        <FlagRow
          label="Shared ownership"
          hint="Own a share of the property and pay rent on the remainder."
          on={so}
          disabled={!editable || share}
          onClick={onToggleSo}
        />

        {isFreehold && (
          <FlagRow
            label="Managed development"
            hint="Freehold property with a management company and management pack."
            on={pack}
            disabled={!editable}
            onClick={onTogglePack}
          />
        )}

        {isLeasehold && (
          <FlagRow
            label="Share of freehold"
            hint={so ? "Not available with shared ownership" : "The leaseholders own the freehold"}
            on={share}
            disabled={!editable || so}
            onClick={onToggleShare}
          />
        )}
      </GlassCard>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} ariaLabel="Confirm change" size="sm" zLayer="deep">
        <Modal.Header>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            {confirm?.kind === "so" ? "Turn off shared ownership?" : "Remove the management pack?"}
          </h2>
        </Modal.Header>
        <Modal.Body>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
            This freehold will stop tracking the management-pack steps (request, received, and the buyer&rsquo;s side).
            Any progress on those steps is reversed. You can switch it back on at any time.
          </p>
        </Modal.Body>
        <Modal.Footer style={{ gap: 10 }}>
          <button type="button" onClick={() => setConfirm(null)} className="agent-btn agent-btn-neutral agent-btn-md" disabled={saving}>Cancel</button>
          <button
            type="button"
            className="agent-btn agent-btn-color-primary agent-btn-md"
            disabled={saving}
            onClick={() => {
              if (confirm?.kind === "so") void applySaleFlag({ newIsSharedOwnership: false }, () => setSo(false));
              else void applySaleFlag({ newHasManagementPack: false }, () => setPack(false));
            }}
          >
            {saving ? "Saving…" : confirm?.kind === "so" ? "Turn off" : "Remove"}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
