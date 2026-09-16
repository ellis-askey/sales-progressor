"use client";

// Phase D3 — the accept/dismiss UI for an inbound email's AI read. Shows the
// one-line summary and each suggestion (confirm a milestone / onward-or-related
// step, or add a to-do) with Confirm + Dismiss. Suggest-only: nothing happens
// until the agent taps. Optimistic — the row disappears on tap and comes back if
// the server rejects it.

import { useState, useTransition } from "react";
import { Sparkle, Check, X } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { applyEmailSuggestionAction, dismissEmailSuggestionAction } from "@/app/actions/email-suggestions";
import type { EmailSuggestion } from "@/lib/services/email-read";

type Sug = EmailSuggestion & { index: number };

function suggestionLabel(s: Sug): string {
  if (s.kind === "todo") return `To-do: ${s.title}`;
  if (s.label) return s.label;
  return s.kind === "milestone" ? `Confirm ${s.code}` : "Confirm step";
}

export function EmailAiSuggestions({
  transactionId,
  messageId,
  aiRead,
}: {
  transactionId: string;
  messageId: string;
  aiRead: { summary: string; suggestions: Sug[] };
}) {
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);

  const visible = aiRead.suggestions.filter((s) => !removed.has(s.index));
  if (!aiRead.summary && visible.length === 0) return null;

  const act = (index: number, apply: boolean) => {
    setBusy(index);
    setRemoved((prev) => new Set(prev).add(index)); // optimistic
    startTransition(async () => {
      try {
        const res = apply
          ? await applyEmailSuggestionAction({ transactionId, messageId, index })
          : await dismissEmailSuggestionAction({ transactionId, messageId, index });
        if (!res.ok) throw new Error("rejected");
        if (apply) toast.success("Confirmed");
      } catch {
        setRemoved((prev) => {
          const n = new Set(prev);
          n.delete(index);
          return n;
        });
        toast.error(apply ? "Couldn't confirm that" : "Couldn't dismiss that");
      } finally {
        setBusy((cur) => (cur === index ? null : cur));
      }
    });
  };

  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 8,
        border: "0.5px solid rgba(var(--agent-coral-rgb), 0.25)",
        background: "rgba(var(--agent-coral-rgb), 0.05)",
        padding: "8px 10px",
      }}
    >
      {aiRead.summary && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: visible.length ? 6 : 0 }}>
          <Sparkle size={13} weight="fill" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: "var(--agent-text-secondary)", lineHeight: 1.4 }}>{aiRead.summary}</span>
        </div>
      )}
      {visible.map((s) => (
        <div key={s.index} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>{suggestionLabel(s)}</p>
            {s.reason && (
              <p style={{ fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.35 }}>{s.reason}</p>
            )}
          </div>
          <button
            type="button"
            disabled={busy === s.index}
            onClick={() => act(s.index, true)}
            className="agent-btn agent-btn-sm agent-btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}
          >
            <Check size={12} weight="bold" /> {s.kind === "todo" ? "Add" : "Confirm"}
          </button>
          <button
            type="button"
            disabled={busy === s.index}
            onClick={() => act(s.index, false)}
            aria-label="Dismiss suggestion"
            title="Dismiss"
            className="agent-icon-btn agent-icon-btn-sm"
            style={{ flexShrink: 0 }}
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      ))}
    </div>
  );
}
