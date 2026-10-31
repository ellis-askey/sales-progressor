"use client";

// Onward portal mirror — the agent "is this the same person?" matcher
// (docs/active/onward-portal-mirror.md, Phase 2). When a client sells and buys
// through us, we auto-tie the same people across the two files by email/name.
// For the rare pair auto-match can't resolve, this lets the agent confirm the
// match by hand so that person can confirm their onward file's steps from their
// sale portal. Writing a match stamps a shared Contact.personGroupId.
//
// Presentational + interactive only — the page/drawer passes the two files'
// contacts, the auto-matched starting pairs, and an onSave that persists them.

import { useState } from "react";
import { Check, CaretDown, LinkSimple } from "@phosphor-icons/react";

export type MatchContact = { id: string; name: string; email: string | null; roleLabel: string };

const UNMATCHED = "__none__";

export function OnwardPeopleMatcher({
  neighbourAddress,
  ourAddress,
  ourContacts,
  theirContacts,
  initial,
  autoMatched,
  onSave,
  saving = false,
}: {
  neighbourAddress: string;
  ourAddress: string;
  ourContacts: MatchContact[];
  theirContacts: MatchContact[];
  // ourContactId -> theirContactId (or null for no match).
  initial: Record<string, string | null>;
  // ourContactIds whose match came from auto-match (vs set by hand) — shown with
  // a quiet "auto" tag so the agent knows what they're overriding.
  autoMatched: Set<string>;
  onSave?: (pairs: Record<string, string | null>) => void;
  saving?: boolean;
}) {
  const [pairs, setPairs] = useState<Record<string, string | null>>(() => ({ ...initial }));
  const [dirty, setDirty] = useState(false);

  const set = (ourId: string, theirId: string | null) => {
    setPairs((p) => ({ ...p, [ourId]: theirId }));
    setDirty(true);
  };

  // A their-contact already chosen for a DIFFERENT our-contact — so the dropdown
  // can flag a double-assignment (one person can't be two people).
  const takenBy = (theirId: string, exceptOurId: string): string | null => {
    for (const [ourId, tId] of Object.entries(pairs)) {
      if (ourId !== exceptOurId && tId === theirId) return ourId;
    }
    return null;
  };

  const matchedCount = Object.values(pairs).filter((v) => v && v !== UNMATCHED).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Match the people
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>
          Tell us who&rsquo;s the same person across these two sales, so they can confirm their onward
          steps from either portal. We&rsquo;ve matched the obvious ones &mdash; just check them.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--agent-text-muted)" }}>
        <span style={{ fontWeight: 600, color: "var(--agent-text-secondary)" }}>{ourAddress}</span>
        <LinkSimple size={13} weight="bold" aria-hidden />
        <span style={{ fontWeight: 600, color: "var(--agent-text-secondary)" }}>{neighbourAddress}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ourContacts.map((c) => {
          const chosen = pairs[c.id] ?? null;
          const clash = chosen && chosen !== UNMATCHED ? takenBy(chosen, c.id) : null;
          const isAuto = autoMatched.has(c.id) && !dirty;
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--agent-surface-sunk, rgba(0,0,0,0.02))",
                border: "0.5px solid var(--agent-border-subtle)",
              }}
            >
              <div style={{ minWidth: 0, flex: "1 1 0" }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name}
                </p>
                <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>{c.roleLabel}</p>
              </div>

              <CaretDown size={13} weight="bold" aria-hidden style={{ color: "var(--agent-text-muted)", transform: "rotate(-90deg)", flexShrink: 0 }} />

              <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ position: "relative" }}>
                  <select
                    value={chosen ?? UNMATCHED}
                    onChange={(e) => set(c.id, e.target.value === UNMATCHED ? null : e.target.value)}
                    className="glass-input"
                    style={{ width: "100%", appearance: "none", paddingRight: 30, fontSize: 13, cursor: "pointer" }}
                    aria-label={`Match ${c.name} to a person on ${neighbourAddress}`}
                  >
                    <option value={UNMATCHED}>Not the same person</option>
                    {theirContacts.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} &middot; {t.roleLabel}
                      </option>
                    ))}
                  </select>
                  <CaretDown size={13} weight="bold" aria-hidden style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }} />
                </div>
                {clash && (
                  <span style={{ fontSize: 11, color: "var(--agent-warning)", fontWeight: 500 }}>
                    Already matched to someone else &mdash; one person can&rsquo;t be two.
                  </span>
                )}
                {isAuto && chosen && chosen !== UNMATCHED && !clash && (
                  <span style={{ fontSize: 11, color: "var(--agent-success)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Check size={11} weight="bold" aria-hidden /> Matched automatically
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>
          {matchedCount} {matchedCount === 1 ? "person" : "people"} matched
        </span>
        <button
          type="button"
          onClick={() => onSave?.(pairs)}
          disabled={saving}
          className="agent-btn agent-btn-sm agent-btn-primary"
        >
          {saving ? "Saving…" : "Save matches"}
        </button>
      </div>
    </div>
  );
}
