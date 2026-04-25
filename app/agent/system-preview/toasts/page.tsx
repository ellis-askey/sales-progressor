"use client";

import { useAgentToast } from "@/components/agent/AgentToaster";
import { CheckCircle, WarningCircle, Info, Warning, X } from "@phosphor-icons/react";
import Link from "next/link";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <p className="agent-eyebrow" style={{ marginBottom: 6 }}>{title}</p>
      {description && (
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {children}
    </section>
  );
}

function TriggerBtn({
  label,
  variant = "secondary",
  onClick,
}: {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`agent-btn agent-btn-${variant} agent-btn-sm`}
    >
      {label}
    </button>
  );
}

// Static toast preview — shows the visual design without triggering the live system
function StaticToast({
  type,
  message,
  description,
  hasAction,
}: {
  type: "success" | "info" | "warning" | "error";
  message: string;
  description?: string;
  hasAction?: boolean;
}) {
  const ICON_CONFIG = {
    success: { Component: CheckCircle,   color: "var(--agent-success)", bg: "rgba(31,138,74,0.12)"  },
    info:    { Component: Info,          color: "var(--agent-info)",    bg: "rgba(61,122,184,0.12)" },
    warning: { Component: Warning,       color: "var(--agent-warning)", bg: "rgba(201,125,26,0.12)" },
    error:   { Component: WarningCircle, color: "var(--agent-danger)",  bg: "rgba(199,62,62,0.12)"  },
  };
  const ACCENT = {
    success: "var(--agent-success)",
    info:    "var(--agent-info)",
    warning: "var(--agent-warning)",
    error:   "var(--agent-danger)",
  };

  const { Component, color, bg } = ICON_CONFIG[type];

  return (
    <div className={`agent-toast agent-toast-${type}`}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Component weight="fill" style={{ width: 16, height: 16, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>{message}</p>
        {description && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{description}</p>}
      </div>
      {hasAction && (
        <button style={{ padding: "4px 10px", fontSize: 12, fontWeight: 500, color: ACCENT[type], background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>
          Undo
        </button>
      )}
      <button aria-label="Dismiss" style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--agent-text-muted)", cursor: "pointer", borderRadius: 4, flexShrink: 0, padding: 0 }}>
        <X style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

export default function ToastsPreviewPage() {
  const { toast } = useAgentToast();

  return (
    <div style={{ padding: "40px 48px", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <Link href="/agent/system-preview" style={{ fontSize: 12, color: "var(--agent-text-muted)", textDecoration: "none" }}>
          ← Component Library
        </Link>
      </div>
      <div style={{ marginBottom: 48 }}>
        <p className="agent-eyebrow" style={{ marginBottom: 6 }}>Agent Design System</p>
        <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
          Toast Notifications
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: "var(--agent-text-body)", color: "var(--agent-text-secondary)" }}>
          Bottom-right anchored, glass-styled, non-intrusive. Toasts appear live in the corner when you click the triggers below.
        </p>
      </div>

      {/* ── Static previews ─────────────────────────────────────────────────── */}
      <Section
        title="Visual variants"
        description="All four types shown in their resting state. The left accent stripe and icon together communicate type without relying on colour alone."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
          <StaticToast type="success" message="Milestone confirmed" description="Vendor and purchaser notified" />
          <StaticToast type="info"    message="Portal invitation sent" description="Client will receive an email shortly" />
          <StaticToast type="warning" message="Mortgage offer expires in 14 days" />
          <StaticToast type="error"   message="Couldn't save your changes" description="Please try again" />
        </div>
      </Section>

      {/* ── With action ─────────────────────────────────────────────────────── */}
      <Section
        title="With action button"
        description="Used for reversible actions. Minimum 6 seconds duration so users have time to consider."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
          <StaticToast type="success" message="Transaction withdrawn" hasAction />
          <StaticToast type="error"   message="Couldn't send invite" description="Check the email address and try again" hasAction />
        </div>
      </Section>

      {/* ── Live triggers — success ──────────────────────────────────────────── */}
      <Section
        title="Live triggers — Success"
        description="Click to fire real toasts in the bottom-right corner. Hover a toast to pause its timer."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <TriggerBtn label="Milestone confirmed"
            onClick={() => toast.success("Milestone confirmed", { description: "The seller has signed and returned their contract documents" })} />
          <TriggerBtn label="Milestone confirmed (implied)"
            onClick={() => toast.success("Mortgage offer received", { description: "+2 implied milestones also confirmed" })} />
          <TriggerBtn label="File created"
            onClick={() => toast.success("File created", { description: "14 Elmwood Avenue, Bristol" })} />
          <TriggerBtn label="To-do added"
            onClick={() => toast.success("To-do added")} />
          <TriggerBtn label="To-do completed"
            onClick={() => toast.success("To-do completed")} />
          <TriggerBtn label="Note added"
            onClick={() => toast.success("Note added")} />
          <TriggerBtn label="Invite sent"
            onClick={() => toast.success("Invite sent to James Whitmore", { description: "They'll receive an email shortly" })} />
          <TriggerBtn label="Email sent"
            onClick={() => toast.success("Email sent to James Whitmore")} />
          <TriggerBtn label="With Undo action"
            onClick={() => toast.success("To-do removed", {
              action: { label: "Undo", onClick: () => console.log("undo") },
            })} />
          <TriggerBtn label="Milestone undone"
            onClick={() => toast.success("Milestone reversed", { description: "+2 downstream milestones also undone" })} />
          <TriggerBtn label="Transaction withdrawn"
            onClick={() => toast.success("Transaction withdrawn", {
              action: { label: "Undo", onClick: () => console.log("undo withdrawal") },
            })} />
          <TriggerBtn label="Profile updated"
            onClick={() => toast.success("Profile updated")} />
        </div>
      </Section>

      {/* ── Live triggers — Info ─────────────────────────────────────────────── */}
      <Section title="Live triggers — Info">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <TriggerBtn label="Portal invite resent"
            onClick={() => toast.info("Invite resent")} />
          <TriggerBtn label="Draft saved"
            onClick={() => toast.info("Draft saved")} />
          <TriggerBtn label="Preferences saved"
            onClick={() => toast.info("Preferences saved")} />
          <TriggerBtn label="Team invite sent"
            onClick={() => toast.info("Invitation sent to james@agency.co.uk")} />
        </div>
      </Section>

      {/* ── Live triggers — Warning ──────────────────────────────────────────── */}
      <Section title="Live triggers — Warning">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <TriggerBtn label="Mortgage expires"
            onClick={() => toast.warning("Mortgage offer expires in 14 days")} />
          <TriggerBtn label="No recent activity"
            onClick={() => toast.warning("No activity on this file for 9 days")} />
          <TriggerBtn label="Connection unstable"
            onClick={() => toast.warning("Connection unstable", { description: "Changes will sync when you reconnect" })} />
        </div>
      </Section>

      {/* ── Live triggers — Error ────────────────────────────────────────────── */}
      <Section title="Live triggers — Error">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <TriggerBtn label="Couldn't save"
            onClick={() => toast.error("Couldn't save your changes", { description: "Please try again" })} />
          <TriggerBtn label="Couldn't send invite"
            onClick={() => toast.error("Couldn't send invite", { description: "Check the email address and try again" })} />
          <TriggerBtn label="Generic failure"
            onClick={() => toast.error("Something went wrong", { description: "Please try again or refresh the page" })} />
          <TriggerBtn label="Permission denied"
            onClick={() => toast.error("You don't have permission to do that", { description: "Contact your administrator" })} />
        </div>
      </Section>

      {/* ── Stacking test ────────────────────────────────────────────────────── */}
      <Section
        title="Stacking (max 4 visible)"
        description="Fire multiple toasts to test stacking. Only 4 are shown at once; older ones queue."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <TriggerBtn label="Fire 3 at once" variant="primary"
            onClick={() => {
              toast.success("Milestone confirmed");
              toast.info("Portal invitation sent");
              toast.warning("Mortgage offer expires in 14 days");
            }} />
          <TriggerBtn label="Fire 5 at once (max 4 show)"
            onClick={() => {
              toast.success("To-do completed");
              toast.success("Note added");
              toast.info("Draft saved");
              toast.warning("No activity for 9 days");
              toast.error("Something went wrong");
            }} />
          <TriggerBtn label="Persistent (no auto-dismiss)"
            onClick={() => toast.error("Session expired", {
              duration: Infinity,
              action: { label: "Sign in", onClick: () => console.log("sign in") },
            })} />
        </div>
      </Section>

      {/* ── Behaviour notes ──────────────────────────────────────────────────── */}
      <Section title="Behaviour notes">
        <div className="agent-glass" style={{ padding: "20px 24px", borderRadius: 12, maxWidth: 620 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              ["Auto-dismiss durations", "Success/info: 4s — Warning: 6s — Error: 8s — With action: minimum 6s — Persistent: set duration to Infinity"],
              ["Hover to pause", "Moving your mouse over a toast pauses its timer. Leaving resumes from where it paused."],
              ["Max visible", "4 toasts maximum. Additional ones queue and appear as older ones dismiss."],
              ["ID-based deduplication", "Pass { id: 'my-id' } to replace an existing toast with the same id instead of stacking."],
              ["Stack order", "Newest toast appears at the bottom of the stack, older ones above."],
              ["Mobile", "Full-width minus 16px margins, anchored to bottom of screen."],
              ["Accessibility", "Success/info toasts use role='status'. Warning/error use role='alert' with aria-live='assertive'."],
            ].map(([label, desc]) => (
              <div key={label} style={{ display: "flex", gap: 16 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 180, flexShrink: 0 }}>{label}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Trigger inventory status ─────────────────────────────────────────── */}
      <Section
        title="Trigger inventory status"
        description="All triggers from the spec. Ticked = wired in current codebase. Unticked = awaiting morning review and swap-over."
      >
        <div className="agent-glass-strong" style={{ borderRadius: 12, overflow: "hidden" }}>
          <table className="agent-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                {["Trigger", "Type", "Location", "Status"].map(h => <th key={h} className="agent-th">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ["Milestone confirmed",         "success", "MilestoneRow + NextMilestoneWidget", "⚠ Uses old addToast — needs swap"],
                ["Milestone reversed",          "info",    "MilestoneRow",                       "⚠ Uses old addToast — needs swap"],
                ["Milestone N/R",               "success", "MilestoneRow",                       "✗ Not yet triggered"],
                ["File created",                "success", "NewTransactionForm / sessionStorage", "⚠ Old addToast pattern — needs swap"],
                ["To-do added",                 "success", "ManualTaskList",                      "✗ Not yet triggered"],
                ["To-do completed",             "success", "ManualTaskCard",                      "✗ Not yet triggered"],
                ["To-do removed",               "success", "ManualTaskCard",                      "✗ Not yet triggered"],
                ["Portal invite sent",          "success", "ContactsSection",                     "✗ Not yet triggered"],
                ["Note added",                  "success", "TransactionNotes / CommsEntry",       "✗ Not yet triggered"],
                ["Email sent",                  "success", "ComposeEmail",                        "✗ Not yet triggered"],
                ["Couldn't complete milestone", "error",   "NextMilestoneWidget",                 "⚠ Uses old addToast — needs swap"],
                ["Generic API error",           "error",   "Various",                             "✗ Not yet triggered"],
                ["Team member actions",         "info",    "TeamManagement",                      "✗ Not yet triggered"],
                ["Profile / settings saved",    "success", "Settings pages",                      "✗ Not yet triggered"],
              ].map(([trigger, type, location, status]) => (
                <tr key={trigger} className="agent-tr">
                  <td className="agent-td" style={{ fontSize: 12 }}>{trigger}</td>
                  <td className="agent-td">
                    <span className="agent-pill" style={{
                      background: type === "success" ? "var(--agent-success-bg)" : type === "error" ? "var(--agent-danger-bg)" : type === "warning" ? "var(--agent-warning-bg)" : "var(--agent-info-bg)",
                      color: type === "success" ? "var(--agent-success)" : type === "error" ? "var(--agent-danger)" : type === "warning" ? "var(--agent-warning)" : "var(--agent-info)",
                      border: "none",
                    }}>
                      {type}
                    </span>
                  </td>
                  <td className="agent-td" style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{location}</td>
                  <td className="agent-td" style={{ fontSize: 11, color: status.startsWith("✗") ? "var(--agent-text-muted)" : status.startsWith("⚠") ? "var(--agent-warning)" : "var(--agent-success)" }}>
                    {status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

    </div>
  );
}
