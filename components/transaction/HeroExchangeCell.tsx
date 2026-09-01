"use client";

// The hero's "Expected exchange" stat, made editable. Click it to set a manual
// override date (a calendar); clearing it falls back to the predicted date.
// Saves via saveOverrideDateAction (logged server-side). Styled to match the
// other hero stat cells exactly.

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank, PencilSimple } from "@phosphor-icons/react";
import { saveOverrideDateAction } from "@/app/actions/transactions";

// No background — bare icon in an unchanged 32×32 footprint (matches
// HeroSaleFields so the editable + static hero cells stay identical).
const ICON_CHIP: CSSProperties = {
  width: 32, height: 32,
  color: "var(--agent-coral-deep)",
  display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const VALUE_STYLE: CSSProperties = {
  display: "block", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)",
  letterSpacing: "-0.01em", lineHeight: 1.25, fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const LABEL_STYLE: CSSProperties = { display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 };

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–";
}

export function HeroExchangeCell({
  transactionId,
  predictedDate,
  overrideDate,
}: {
  transactionId: string;
  predictedDate: Date | null;
  overrideDate: Date | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(overrideDate ? new Date(overrideDate).toISOString().split("T")[0] : "");
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = overrideDate ?? predictedDate;

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function save(value: string | null) {
    setSaving(true);
    try {
      await saveOverrideDateAction(transactionId, value || null);
      setEditing(false);
      router.refresh();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
      <span style={ICON_CHIP}><CalendarBlank size={20} weight="regular" /></span>
      <span style={{ minWidth: 0, flex: 1 }}>
        {editing ? (
          <>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                ref={inputRef}
                type="date"
                value={draft}
                disabled={saving}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save((e.target as HTMLInputElement).value);
                  if (e.key === "Escape") setEditing(false);
                }}
                className="glass-input agent-focus text-sm px-2 py-1 rounded-lg"
                style={{ maxWidth: 150 }}
              />
              <button type="button" onClick={() => save(draft || null)} disabled={saving} className="text-xs agent-link-primary">Save</button>
              {overrideDate && (
                <button type="button" onClick={() => save(null)} disabled={saving} className="text-xs text-slate-900/40 hover:text-red-500 transition-colors">Use prediction</button>
              )}
            </span>
            <span style={LABEL_STYLE}>
              {predictedDate ? `Expected exchange (predicted ${fmt(predictedDate)})` : "Expected exchange"}
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(overrideDate ? new Date(overrideDate).toISOString().split("T")[0] : ""); setEditing(true); }}
            className="group"
            aria-label="Set expected exchange date"
            style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span style={VALUE_STYLE}>{fmt(shown)}</span>
              <PencilSimple size={12} weight="regular" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
            </span>
            <span style={LABEL_STYLE}>Expected exchange{overrideDate ? " (set)" : ""}</span>
          </button>
        )}
      </span>
    </div>
  );
}
