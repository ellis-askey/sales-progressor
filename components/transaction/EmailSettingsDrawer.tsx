"use client";

// Email settings drawer + hero trigger button (2026-08-11 file-page
// feedback, item 1). One home for every email/automation control on a
// file, replacing three scattered controls:
//   - the hero "Portal emails on" pill        → Step confirmation emails
//   - the Overview-tail EmailAudienceMenu     → Chase emails, now per
//     CONTACT (each buyer/seller individually, Contact.emailsPausedAt)
//     plus the per-firm switches
//   - the Overview-tail AutomationControls    → Hold this file (reused
//     inside the drawer, unchanged behaviour)
//
// Visibility (enforced by the page): internal staff on every file;
// agency users on self-managed files only. The step-confirmation section
// additionally renders for internal staff only (its server action is
// internal-gated).
//
// Uses the canonical Drawer primitive (docs/reference/MODAL_DRAWER_SYSTEM.md
// §1.1) per Law 14.

import { useCallback, useEffect, useState, useTransition } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { Drawer } from "@/components/ui/Drawer";
import {
  loadEmailSettings,
  setContactEmailsPaused,
  setEmailAudiencePaused,
  type EmailAudience,
  type EmailSettingsState,
} from "@/app/actions/automation";
import { toggleSuppressPortalConfirmEmailsAction } from "@/app/actions/transactions";
import { AutomationControls } from "@/components/transaction/AutomationControls";
import { useAgentToast } from "@/components/agent/AgentToaster";

// ── Shared switch ──────────────────────────────────────────────────────
function Switch({
  on,
  onClick,
  disabled,
  ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        height: 18,
        width: 32,
        borderRadius: 999,
        border: "none",
        padding: 0,
        background: on ? "var(--agent-coral, #FF6B4A)" : "var(--agent-border-strong, rgba(15,23,42,0.25))",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 120ms ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          height: 14,
          width: 14,
          borderRadius: 999,
          background: "white",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          transform: on ? "translateX(14px)" : "translateX(0)",
          transition: "transform 120ms ease",
        }}
      />
    </button>
  );
}

function SettingRow({
  label,
  sublabel,
  on,
  onToggle,
  disabled,
}: {
  label: string;
  sublabel?: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{sublabel}</span>
        )}
      </div>
      <Switch on={on} onClick={onToggle} disabled={disabled} ariaLabel={`${label}: emails ${on ? "on" : "paused"}`} />
    </div>
  );
}

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>{sub}</p>
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────
function EmailSettingsDrawer({
  open,
  onClose,
  transactionId,
  isInternalStaff,
  state,
  onStateChange,
  onReload,
}: {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  isInternalStaff: boolean;
  state: EmailSettingsState | null;
  onStateChange: (next: EmailSettingsState) => void;
  onReload: () => void;
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useAgentToast();

  function toggleConfirmEmails() {
    if (!state || pendingKey) return;
    const nextSuppressed = !state.suppressPortalConfirmEmails;
    setPendingKey("confirm");
    startTransition(async () => {
      try {
        await toggleSuppressPortalConfirmEmailsAction(
          transactionId,
          nextSuppressed,
          `/agent/transactions/${transactionId}`,
        );
        onStateChange({ ...state, suppressPortalConfirmEmails: nextSuppressed });
        toast.success(nextSuppressed ? "Confirmation emails paused" : "Confirmation emails on");
      } catch {
        toast.error("Couldn't update. Try again");
      }
      setPendingKey(null);
    });
  }

  function toggleContact(contactId: string, currentlyPaused: boolean) {
    if (!state || pendingKey) return;
    const nextPaused = !currentlyPaused;
    setPendingKey(`contact:${contactId}`);
    startTransition(async () => {
      const res = await setContactEmailsPaused(transactionId, contactId, nextPaused);
      if (res.ok) {
        onStateChange({
          ...state,
          contacts: state.contacts.map((c) =>
            c.id === contactId ? { ...c, paused: nextPaused } : c,
          ),
        });
        toast.success(nextPaused ? "Chase emails paused" : "Chase emails resumed");
      } else {
        toast.error("Couldn't update. Try again");
      }
      setPendingKey(null);
    });
  }

  function toggleFirm(audience: Extract<EmailAudience, "vendorSolicitor" | "purchaserSolicitor">, currentlyPaused: boolean) {
    if (!state || pendingKey) return;
    const nextPaused = !currentlyPaused;
    setPendingKey(`firm:${audience}`);
    startTransition(async () => {
      const res = await setEmailAudiencePaused(transactionId, audience, nextPaused);
      if (res.ok) {
        onStateChange({
          ...state,
          vendorSolicitor:
            audience === "vendorSolicitor" && state.vendorSolicitor
              ? { ...state.vendorSolicitor, paused: nextPaused }
              : state.vendorSolicitor,
          purchaserSolicitor:
            audience === "purchaserSolicitor" && state.purchaserSolicitor
              ? { ...state.purchaserSolicitor, paused: nextPaused }
              : state.purchaserSolicitor,
        });
        toast.success(nextPaused ? "Chase emails paused" : "Chase emails resumed");
      } else {
        toast.error("Couldn't update. Try again");
      }
      setPendingKey(null);
    });
  }

  const sellers = state?.contacts.filter((c) => c.roleType === "vendor") ?? [];
  const buyers = state?.contacts.filter((c) => c.roleType === "purchaser") ?? [];

  return (
    <Drawer open={open} onClose={onClose} ariaLabel="Email settings for this file" size="md">
      <Drawer.Header>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          This file
        </p>
        <h2 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Email settings
        </h2>
      </Drawer.Header>
      <Drawer.Body>
        {!state ? (
          <p style={{ fontSize: 13, color: "var(--agent-text-muted)", textAlign: "center", padding: "32px 0" }}>
            Loading…
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {isInternalStaff && (
              <section>
                <SectionHeading
                  title="Step confirmation emails"
                  sub="Sent to the buyer and seller when a step is confirmed on this file."
                />
                <SettingRow
                  label="Send confirmation emails"
                  on={!state.suppressPortalConfirmEmails}
                  onToggle={toggleConfirmEmails}
                  disabled={pendingKey !== null}
                />
              </section>
            )}

            <section>
              <SectionHeading
                title="Chase emails"
                sub="Automatic chasing for outstanding steps. Pause anyone individually; everyone else keeps receiving theirs."
              />
              {state.contacts.length === 0 &&
                !state.vendorSolicitor &&
                !state.purchaserSolicitor && (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic" }}>
                    No one to chase yet. Add a contact with an email address first.
                  </p>
                )}
              {sellers.map((c) => (
                <SettingRow
                  key={c.id}
                  label={c.name}
                  sublabel="Seller"
                  on={!c.paused}
                  onToggle={() => toggleContact(c.id, c.paused)}
                  disabled={pendingKey !== null}
                />
              ))}
              {buyers.map((c) => (
                <SettingRow
                  key={c.id}
                  label={c.name}
                  sublabel="Buyer"
                  on={!c.paused}
                  onToggle={() => toggleContact(c.id, c.paused)}
                  disabled={pendingKey !== null}
                />
              ))}
              {state.vendorSolicitor && (
                <SettingRow
                  label={state.vendorSolicitor.name}
                  sublabel="Seller's solicitor"
                  on={!state.vendorSolicitor.paused}
                  onToggle={() => toggleFirm("vendorSolicitor", state.vendorSolicitor!.paused)}
                  disabled={pendingKey !== null}
                />
              )}
              {state.purchaserSolicitor && (
                <SettingRow
                  label={state.purchaserSolicitor.name}
                  sublabel="Buyer's solicitor"
                  on={!state.purchaserSolicitor.paused}
                  onToggle={() => toggleFirm("purchaserSolicitor", state.purchaserSolicitor!.paused)}
                  disabled={pendingKey !== null}
                />
              )}
            </section>

            {(state.status === "active" || state.status === "on_hold") && (
              <section>
                <SectionHeading
                  title="Hold this file"
                  sub="Freezes everything: reminders, chases, and the file's clocks."
                />
                <AutomationControls
                  key={state.status}
                  transactionId={transactionId}
                  initialClientEmailsPaused={state.clientEmailsPaused}
                  status={state.status}
                  variant="row"
                  hideEmailPause
                  onModeChange={onReload}
                />
              </section>
            )}
          </div>
        )}
      </Drawer.Body>
    </Drawer>
  );
}

// ── Hero trigger button ────────────────────────────────────────────────
// Live summary pill: green-ish neutral when everything sends, amber when
// anything is paused or the file is on hold. Clicking opens the drawer.
export function EmailSettingsButton({
  transactionId,
  isInternalStaff,
  hasPhoto = false,
}: {
  transactionId: string;
  isInternalStaff: boolean;
  // When the hero has a property photo behind it, the pill mirrors the
  // "Back to files" control: a dark translucent fill + blur so the label
  // stays legible over imagery. Without a photo it uses the solid overlay
  // surface. Either way it's never transparent (the old resting state was
  // invisible over the warm hero on mobile).
  hasPhoto?: boolean;
}) {
  const [state, setState] = useState<EmailSettingsState | null>(null);
  const [open, setOpen] = useState(false);

  const reload = useCallback(() => {
    loadEmailSettings(transactionId).then((res) => {
      if (res.ok) setState(res.data);
    });
  }, [transactionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const pausedCount = state
    ? state.contacts.filter((c) => c.paused).length +
      (state.vendorSolicitor?.paused ? 1 : 0) +
      (state.purchaserSolicitor?.paused ? 1 : 0) +
      (isInternalStaff && state.suppressPortalConfirmEmails ? 1 : 0)
    : 0;
  const onHold = state?.status === "on_hold";
  const attention = onHold || pausedCount > 0;

  const label = !state
    ? "Email settings"
    : onHold
      ? "On hold"
      : pausedCount > 0
        ? "Some emails paused"
        : "Emails on";

  // Solid fill in every state, matching the "Back to files" pill: dark blur
  // over a photo, overlay surface otherwise. Attention (paused / on hold) is
  // carried by an amber border + amber label, not by the fill — so the pill
  // is always legible instead of a transparent chip that vanishes on mobile.
  const fill = hasPhoto ? "rgba(15,23,42,0.38)" : "var(--agent-surface-overlay)";
  const accent = hasPhoto ? "#fdba74" : "#9a3412";
  const rest = hasPhoto ? "#fff" : "var(--agent-text-secondary, #475569)";
  const tone = attention ? accent : rest;
  const borderColor = attention
    ? (hasPhoto ? "rgba(253,186,116,0.55)" : "rgba(234,88,12,0.45)")
    : (hasPhoto ? "rgba(255,255,255,0.28)" : "var(--agent-border-default, rgba(15,23,42,0.12))");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Email settings for this file"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 12px",
          borderRadius: 999,
          background: fill,
          backdropFilter: hasPhoto ? "blur(8px)" : undefined,
          WebkitBackdropFilter: hasPhoto ? "blur(8px)" : undefined,
          border: `0.5px solid ${borderColor}`,
          cursor: "pointer",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        <EnvelopeSimple size={13} weight="regular" style={{ color: tone }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: tone,
            letterSpacing: 0.02,
          }}
        >
          {label}
        </span>
      </button>
      <EmailSettingsDrawer
        open={open}
        onClose={() => setOpen(false)}
        transactionId={transactionId}
        isInternalStaff={isInternalStaff}
        state={state}
        onStateChange={setState}
        onReload={reload}
      />
    </>
  );
}
