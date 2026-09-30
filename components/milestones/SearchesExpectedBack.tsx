"use client";

// Critique #23: agent/SP inline control on the searches-results step (PM13).
// Sets/edits/clears "searches expected back" — the date that re-anchors the
// PM13 chase and shows on both clients' portals. Sits as a sub-line under the
// step name, mirroring the row's other persistent sub-lines.

import { useState, useTransition } from "react";
import { DateField } from "@/components/ui/DateField";
import { setSearchesExpectedBackAction } from "@/app/actions/milestones";

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function SearchesExpectedBack({
  transactionId,
  milestoneDefinitionId,
  expectedDate,
}: {
  transactionId: string;
  milestoneDefinitionId: string;
  expectedDate: string | null;
}) {
  const [current, setCurrent] = useState<string | null>(expectedDate);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(toInputDate(expectedDate));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(next: string | null) {
    setError(null);
    start(async () => {
      try {
        const res = await setSearchesExpectedBackAction({ transactionId, milestoneDefinitionId, expectedDate: next });
        if (res.ok) {
          setCurrent(next);
          setEditing(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save that date.");
      }
    });
  }

  const muted = "var(--agent-text-muted, #6b7280)";
  const coral = "var(--agent-coral-deep, #E5533A)";

  if (!editing) {
    return (
      <div style={{ marginTop: 4, fontSize: 12 }}>
        {current ? (
          <span style={{ color: muted }}>
            <span style={{ fontWeight: 600, color: coral }}>Searches expected back approx {fmt(current)}</span>
            {" · "}
            <button
              type="button"
              onClick={() => { setValue(toInputDate(current)); setEditing(true); }}
              className="pbtn-press underline"
              style={{ color: muted, background: "transparent", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
            >
              Edit
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => { setValue(""); setEditing(true); }}
            className="pbtn-press underline"
            style={{ color: muted, background: "transparent", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
          >
            + Set when searches are expected back
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <DateField
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
        className="glass-input px-2 py-1.5 text-sm"
        wrapperStyle={{ display: "inline-block" }}
      />
      <button
        type="button"
        disabled={pending || !value}
        onClick={() => save(value)}
        className="pbtn-press"
        style={{ background: coral, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: pending || !value ? "default" : "pointer", opacity: pending || !value ? 0.5 : 1 }}
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {current && (
        <button
          type="button"
          disabled={pending}
          onClick={() => save(null)}
          className="pbtn-press underline"
          style={{ color: muted, background: "transparent", border: "none", cursor: "pointer", fontSize: 12 }}
        >
          Clear
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => { setEditing(false); setError(null); }}
        className="pbtn-press"
        style={{ color: muted, background: "transparent", border: "none", cursor: "pointer", fontSize: 12 }}
      >
        Cancel
      </button>
      {error && <span style={{ color: "#dc2626", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
