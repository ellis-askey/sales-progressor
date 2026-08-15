"use client";

// Inline completion-date editor for the Key dates card. Only interactive after
// exchange (before that the row reads "Awaiting exchange"). Click the value to
// edit it in place; saves via saveCompletionDateAction (logged server-side).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { saveCompletionDateAction } from "@/app/actions/transactions";

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Not set";
}

export function CompletionDateInline({
  transactionId,
  completionDate,
  exchangeConfirmed,
}: {
  transactionId: string;
  completionDate: Date | null;
  exchangeConfirmed: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(completionDate ? new Date(completionDate).toISOString().split("T")[0] : "");

  async function save(value: string) {
    setSaving(true);
    try {
      await saveCompletionDateAction(transactionId, value || null);
      setEditing(false);
      router.refresh();
    } catch {
      setSaving(false);
    }
  }

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Completion</span>
      {children}
    </div>
  );

  if (!exchangeConfirmed) {
    return (
      <Row>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic" }}>Awaiting exchange</span>
      </Row>
    );
  }

  if (editing) {
    return (
      <Row>
        <input
          type="date"
          value={draft}
          autoFocus
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save((e.target as HTMLInputElement).value);
            if (e.key === "Escape") setEditing(false);
          }}
          className="glass-input agent-focus text-xs px-2 py-1 rounded-lg"
          style={{ maxWidth: 150 }}
        />
      </Row>
    );
  }

  return (
    <Row>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: completionDate ? "var(--agent-text-primary)" : "var(--agent-text-muted)" }}>{fmt(completionDate)}</span>
        <PencilSimple size={11} weight="regular" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
      </button>
    </Row>
  );
}
