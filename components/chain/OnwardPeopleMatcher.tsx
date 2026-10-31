"use client";

// Onward portal mirror — the agent "is this the same person?" matcher
// (docs/active/onward-portal-mirror.md, Phase 2). An EXCEPTION HANDLER, not a
// routine step: when a client sells and buys through us, we auto-tie the same
// people across the two files by email/name at self-link time. This surfaces
// ONLY for the people auto-match couldn't resolve, so the agent can say who's
// who by hand. Writing a match stamps a shared Contact.personGroupId, which lets
// that person confirm their onward file's steps from their sale portal.
//
// All colour routes through --agent-* tokens so it renders correctly in light
// and dark (the host sets data-night on the portal root). Presentational +
// interactive only — the caller passes the UNMATCHED contacts on this file, the
// candidates on the neighbour, and an onSave that persists them.

import { useState } from "react";
import { CaretDown, LinkSimple } from "@phosphor-icons/react";

export type MatchContact = { id: string; name: string; email: string | null; roleLabel: string };

const UNMATCHED = "__none__";

// Address → a big first line (the street) + the rest (town, postcode) beneath.
function splitAddr(a: string): { line1: string; rest: string } {
  const parts = a.split(",").map((s) => s.trim()).filter(Boolean);
  return { line1: parts[0] ?? a, rest: parts.slice(1).join(", ") };
}

function AddrBlock({ addr, align }: { addr: string; align: "left" | "right" }) {
  const { line1, rest } = splitAddr(addr);
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, textAlign: align }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line1}</p>
      {rest && (
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rest}</p>
      )}
    </div>
  );
}

export function OnwardPeopleMatcher({
  neighbourAddress,
  ourAddress,
  ourContacts,
  theirContacts,
  onSave,
  onSkip,
  saving = false,
  hideHeader = false,
}: {
  neighbourAddress: string;
  ourAddress: string;
  // The people on this file auto-match couldn't resolve (the only ones shown).
  ourContacts: MatchContact[];
  theirContacts: MatchContact[];
  onSave?: (pairs: Record<string, string | null>) => void;
  onSkip?: () => void;
  saving?: boolean;
  // When the host already shows a title (e.g. a Modal band), skip the inline one.
  hideHeader?: boolean;
}) {
  const [pairs, setPairs] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(ourContacts.map((c) => [c.id, null])),
  );

  const set = (ourId: string, theirId: string | null) =>
    setPairs((p) => ({ ...p, [ourId]: theirId }));

  const takenBy = (theirId: string, exceptOurId: string): boolean =>
    Object.entries(pairs).some(([ourId, tId]) => ourId !== exceptOurId && tId === theirId);

  const matchedCount = Object.values(pairs).filter((v) => v && v !== UNMATCHED).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!hideHeader && (
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            Who&rsquo;s the same person?
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>
            We couldn&rsquo;t match these people automatically. Tell us who they are on the other sale.
          </p>
        </div>
      )}

      {/* The two sales we're matching across — street on top, town/postcode below. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(var(--agent-coral-rgb), 0.06)" }}>
        <AddrBlock addr={ourAddress} align="left" />
        <LinkSimple size={18} weight="bold" aria-hidden style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />
        <AddrBlock addr={neighbourAddress} align="right" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ourContacts.map((c) => {
          const chosen = pairs[c.id] ?? null;
          const clash = !!chosen && chosen !== UNMATCHED && takenBy(chosen, c.id);
          const matched = !!chosen && chosen !== UNMATCHED && !clash;
          const nameColor = matched ? "#fff" : "var(--agent-text-primary)";
          const subColor = matched ? "rgba(255,255,255,0.82)" : "var(--agent-text-muted)";
          return (
            <div
              key={c.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 12,
                border: matched ? "1px solid transparent" : "1px solid var(--agent-border-default)",
                background: matched ? "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))" : "transparent",
                boxShadow: matched ? "inset 0 1px 0 rgba(255,255,255,0.28), 0 3px 10px rgba(var(--agent-coral-rgb), 0.28)" : "none",
                transition: "background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
              }}
            >
              <div style={{ minWidth: 0, flex: "1 1 0" }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: nameColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name}
                </p>
                <p style={{ margin: "1px 0 0", fontSize: 11.5, color: subColor }}>{c.roleLabel}</p>
              </div>

              <CaretDown size={13} weight="bold" aria-hidden style={{ color: subColor, transform: "rotate(-90deg)", flexShrink: 0 }} />

              <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ position: "relative" }}>
                  <select
                    value={chosen ?? UNMATCHED}
                    onChange={(e) => set(c.id, e.target.value === UNMATCHED ? null : e.target.value)}
                    className="glass-input"
                    style={{ width: "100%", appearance: "none", paddingRight: 30, fontSize: 13, cursor: "pointer", ...(matched ? { background: "#fff", color: "var(--agent-text-primary)", border: "1px solid transparent", fontWeight: 600 } : {}) }}
                    aria-label={`Match ${c.name} to a person on ${neighbourAddress}`}
                  >
                    <option value={UNMATCHED}>Not the same person</option>
                    {theirContacts.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <CaretDown size={13} weight="bold" aria-hidden style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }} />
                </div>
                {clash && (
                  <span style={{ fontSize: 11, color: "var(--agent-warning)", fontWeight: 500 }}>
                    Already matched to someone else &mdash; one person can&rsquo;t be two.
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onSkip && (
            <button type="button" onClick={onSkip} disabled={saving} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">
              Skip for now
            </button>
          )}
          <button type="button" onClick={() => onSave?.(pairs)} disabled={saving} className="agent-btn agent-btn-sm agent-btn-primary">
            {saving ? "Saving…" : "Save matches"}
          </button>
        </div>
      </div>
    </div>
  );
}
