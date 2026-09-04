"use client";

// Email settings drawer + hero trigger button (2026-08-11 file-page
// feedback, item 1). One home for every email/automation control on a
// file, replacing three scattered controls:
//   - the hero "Portal emails on" pill        → Step confirmation emails
//   - the Overview-tail EmailAudienceMenu     → Automatic chasing, now per
//     CONTACT (each buyer/seller individually, Contact.emailsPausedAt)
//     plus the per-firm switches
//   - the Overview-tail AutomationControls    → Pause this sale (reused
//     inside the drawer, "pause" framing — same hold state machine)
//
// Visibility (enforced by the page): internal staff on every file;
// agency users on self-managed files only. The step-confirmation section
// additionally renders for internal staff only (its server action is
// internal-gated).
//
// Visual system (2026-09-03 redesign): section cards with a plain glyph
// (no circle background) per heading, ContactAvatar rows for chase
// recipients (branded side-aware art — same as the contacts + solicitors
// cards), and the canonical Drawer primitive raised above the top nav
// (zLayer="escalated") so it no longer slides in behind it.
//
// Uses the canonical Drawer primitive (docs/reference/MODAL_DRAWER_SYSTEM.md
// §1.1) per Law 14.

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  EnvelopeSimple,
  PaperPlaneTilt,
  UsersThree,
  Pause,
  Info,
  CaretDown,
} from "@phosphor-icons/react";
import { Drawer } from "@/components/ui/Drawer";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { ContactAvatar } from "@/components/ui/Avatar";
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
// Dimensions match AutomationControls' toggle so every switch in the
// drawer reads as one control family.
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
        height: 24,
        width: 42,
        borderRadius: 999,
        border: "none",
        padding: 0,
        background: on ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 120ms ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: 3,
          height: 18,
          width: 18,
          borderRadius: 999,
          background: "white",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          transform: on ? "translateX(18px)" : "translateX(0)",
          transition: "transform 120ms ease",
        }}
      />
    </button>
  );
}

// ── Section card ───────────────────────────────────────────────────────
// One bordered card per section. The heading glyph is a plain coral icon
// with NO circle background (2026-09-03 feedback). A card is either static
// (right-aligned `control`) or collapsible (clickable header + caret that
// reveals `children`).
function SectionCard({
  icon,
  title,
  subtitle,
  control,
  children,
  tinted = false,
  collapsible = false,
  expanded = false,
  onToggleExpand,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  control?: React.ReactNode;
  children?: React.ReactNode;
  tinted?: boolean;
  collapsible?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const headerContent = (
    <>
      <span style={{ color: "var(--agent-coral, #FF6B4A)", flexShrink: 0, marginTop: 1, display: "inline-flex" }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</p>
        {subtitle && (
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>{subtitle}</p>
        )}
      </div>
      {collapsible ? (
        <CaretDown
          size={16}
          weight="bold"
          style={{ color: "var(--agent-text-muted)", flexShrink: 0, marginTop: 3, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}
        />
      ) : control ? (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", paddingTop: 1 }}>{control}</div>
      ) : null}
    </>
  );

  const headerStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", width: "100%" };

  return (
    <div
      style={{
        border: `0.5px solid ${tinted ? "rgba(255,107,74,0.22)" : "var(--agent-border-default)"}`,
        background: tinted ? "rgba(255,107,74,0.05)" : "var(--agent-surface-elevated)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          style={{ ...headerStyle, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
        >
          {headerContent}
        </button>
      ) : (
        <div style={headerStyle}>{headerContent}</div>
      )}
      {children}
    </div>
  );
}

// ── Group sub-label (CLIENTS / SOLICITORS) ─────────────────────────────
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, padding: "10px 16px 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
      {children}
    </p>
  );
}

// ── Chase recipient row (avatar + identity + switch) ───────────────────
function PersonRow({
  avatar,
  name,
  side,
  on,
  onToggle,
  disabled,
}: {
  avatar: React.ReactNode;
  name: string;
  side: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 16px" }}>
      {avatar}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p data-sensitive="true" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{side}</p>
      </div>
      <Switch on={on} onClick={onToggle} disabled={disabled} ariaLabel={`${name}: emails ${on ? "on" : "paused"}`} />
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────
function EmailSettingsDrawer({
  open,
  onClose,
  transactionId,
  state,
  onStateChange,
  onReload,
}: {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  state: EmailSettingsState | null;
  onStateChange: (next: EmailSettingsState) => void;
  onReload: () => void;
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useAgentToast();
  // Automatic-chasing list is collapsible; open by default so the agent
  // sees who's being chased without an extra tap.
  const [chasingOpen, setChasingOpen] = useState(true);

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
  const hasClients = sellers.length > 0 || buyers.length > 0;
  const hasSolicitors = !!state?.vendorSolicitor || !!state?.purchaserSolicitor;
  const noOneToChase = !hasClients && !hasSolicitors;

  const pauseSubtitle =
    state?.status === "on_hold"
      ? "Paused. Nothing will send until you resume this sale."
      : "Temporarily stop reminders, automatic chases and the file's timers. Nothing will be sent until you resume it.";

  return (
    <Drawer open={open} onClose={onClose} ariaLabel="Email settings for this file" size="md" zLayer="escalated" closeTone="onDark">
      <Drawer.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader
          kicker="Auto emails"
          icon={<EnvelopeSimple size={20} weight="regular" />}
          title="Email settings"
          subtitle="Control the emails and automatic chasing for this sale."
        />
      </Drawer.Header>
      <Drawer.Body>
        {!state ? (
          <p style={{ fontSize: 13, color: "var(--agent-text-muted)", textAlign: "center", padding: "32px 0" }}>
            Loading…
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Available to whoever controls this file's emails — internal staff
                and self-managed agencies (the button only opens for those). */}
            <SectionCard
              icon={<PaperPlaneTilt size={20} weight="regular" />}
              title="Step confirmation emails"
              subtitle="Send buyers and sellers an update when a step is confirmed."
              control={
                <Switch
                  on={!state.suppressPortalConfirmEmails}
                  onClick={toggleConfirmEmails}
                  disabled={pendingKey !== null}
                  ariaLabel={`Step confirmation emails: ${state.suppressPortalConfirmEmails ? "paused" : "on"}`}
                />
              }
            />

            <SectionCard
              icon={<UsersThree size={20} weight="regular" />}
              title="Automatic chasing"
              subtitle="Choose who we can chase when something is outstanding."
              collapsible
              expanded={chasingOpen}
              onToggleExpand={() => setChasingOpen((o) => !o)}
            >
              <div className={`agent-acc${chasingOpen ? " open" : ""}`}>
                <div className="agent-acc-in">
                  <div style={{ borderTop: "0.5px solid var(--agent-border-default)", paddingBottom: 6 }}>
                    {noOneToChase ? (
                      <p style={{ margin: "10px 16px", fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic" }}>
                        No one to chase yet. Add a contact with an email address first.
                      </p>
                    ) : (
                      <>
                        {hasClients && <GroupLabel>Clients</GroupLabel>}
                        {sellers.map((c) => (
                          <PersonRow
                            key={c.id}
                            avatar={<ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={36} art />}
                            name={c.name}
                            side="Seller"
                            on={!c.paused}
                            onToggle={() => toggleContact(c.id, c.paused)}
                            disabled={pendingKey !== null}
                          />
                        ))}
                        {buyers.map((c) => (
                          <PersonRow
                            key={c.id}
                            avatar={<ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={36} art />}
                            name={c.name}
                            side="Buyer"
                            on={!c.paused}
                            onToggle={() => toggleContact(c.id, c.paused)}
                            disabled={pendingKey !== null}
                          />
                        ))}

                        {hasSolicitors && <GroupLabel>Solicitors</GroupLabel>}
                        {state.vendorSolicitor && (
                          <PersonRow
                            avatar={<ContactAvatar contact={{ name: state.vendorSolicitor.name, roleType: "solicitor" }} sideTint="vendor" size={36} art />}
                            name={state.vendorSolicitor.name}
                            side="Seller's solicitor"
                            on={!state.vendorSolicitor.paused}
                            onToggle={() => toggleFirm("vendorSolicitor", state.vendorSolicitor!.paused)}
                            disabled={pendingKey !== null}
                          />
                        )}
                        {state.purchaserSolicitor && (
                          <PersonRow
                            avatar={<ContactAvatar contact={{ name: state.purchaserSolicitor.name, roleType: "solicitor" }} sideTint="purchaser" size={36} art />}
                            name={state.purchaserSolicitor.name}
                            side="Buyer's solicitor"
                            on={!state.purchaserSolicitor.paused}
                            onToggle={() => toggleFirm("purchaserSolicitor", state.purchaserSolicitor!.paused)}
                            disabled={pendingKey !== null}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            {(state.status === "active" || state.status === "on_hold") && (
              <SectionCard
                tinted
                icon={<Pause size={20} weight="fill" />}
                title="Pause this sale"
                subtitle={pauseSubtitle}
                control={
                  <AutomationControls
                    key={state.status}
                    transactionId={transactionId}
                    initialClientEmailsPaused={state.clientEmailsPaused}
                    status={state.status}
                    framing="pause"
                    hideEmailPause
                    onModeChange={onReload}
                  />
                }
              />
            )}

            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "0 4px" }}>
              <Info size={15} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                Changes apply to this file only. You can update these settings anytime.
              </p>
            </div>
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
}: {
  transactionId: string;
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
      (state.suppressPortalConfirmEmails ? 1 : 0)
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

  // Theme-aware, not photo-aware: the pill sits on the hero surface (top-
  // right), never over the photo, so it follows light/dark. A clean light chip
  // in light mode; the agent tokens flip the fill + amber for dark mode.
  // Attention (paused / on hold) is carried by the amber label + border, not
  // the fill — so the pill is always legible, never a chip that vanishes.
  const fill = "var(--agent-surface-overlay)";
  const tone = attention
    ? "var(--agent-warning, #C97D1A)"
    : "var(--agent-text-secondary, #475569)";
  const borderColor = attention
    ? "var(--agent-warning-border-strong, rgba(201,125,26,0.50))"
    : "var(--agent-border-default, rgba(15,23,42,0.12))";

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
        state={state}
        onStateChange={setState}
        onReload={reload}
      />
    </>
  );
}
