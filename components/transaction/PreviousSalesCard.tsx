"use client";

// Sidebar "Previous sales" card (critique #12). The home for fallen-through
// buyers — replaces the tiny hero round-chip. Each prior sale shows the
// buyer(s) as colour-coded avatars (overlapping when it was a joint purchase),
// their names joined with "&" (no titles), and when/why it fell through.
// Clicking a row opens the existing read-only ArchivedRoundDrawer.

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/glass/GlassCard";
import { ContactAvatar } from "@/components/ui/Avatar";
import { nameWithoutTitle } from "@/lib/contacts/displayName";
import { ArchivedRoundDrawer } from "./ArchivedRoundDrawer";
import type { PreviousSale } from "@/lib/services/previous-sales";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PreviousSalesCard({ transactionId, sales }: { transactionId: string; sales: PreviousSale[] }) {
  const [open, setOpen] = useState<{ id: string; roundNumber: number } | null>(null);

  // Deep link from global search: ?round=<id> on a previous buyer's result opens
  // straight into that sale's archived drawer. One-shot so a manual close sticks.
  const searchParams = useSearchParams();
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current) return;
    const roundParam = searchParams.get("round");
    if (!roundParam) return;
    const match = sales.find((s) => s.roundId === roundParam);
    if (match) {
      setOpen({ id: match.roundId, roundNumber: match.roundNumber });
      autoOpened.current = true;
    }
  }, [searchParams, sales]);

  if (sales.length === 0) return null;

  return (
    <GlassCard glassId="sidebar-previous-sales" label="Sidebar · Previous sales" defaultVariant="v06" style={{ padding: "14px 16px", borderRadius: 10 }}>
      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>
        {sales.length === 1 ? "Previous sale" : "Previous sales"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {sales.map((s) => {
          const names = s.buyers.map((b) => nameWithoutTitle(b.name)).filter(Boolean);
          const label = names.length ? names.join(" & ") : "Buyer";
          const avatars = s.buyers.length ? s.buyers : [{ name: "Buyer", image: null }];
          const sub = `Sale ${s.roundNumber} · fell through${s.fellThroughAt ? ` ${fmtDate(s.fellThroughAt)}` : ""}${s.reason ? ` · ${s.reason}` : ""}`;
          return (
            <button
              key={s.roundId}
              type="button"
              onClick={() => setOpen({ id: s.roundId, roundNumber: s.roundNumber })}
              className="agent-hover-row"
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                background: "var(--agent-surface-overlay)", border: "0.5px solid var(--agent-border-subtle)",
                borderRadius: 10, padding: "8px 10px", cursor: "pointer", font: "inherit",
              }}
            >
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                {avatars.map((b, i) => (
                  <span
                    key={i}
                    style={{ marginLeft: i === 0 ? 0 : -9, borderRadius: "50%", boxShadow: "0 0 0 2px var(--agent-surface-elevated)", display: "inline-flex" }}
                  >
                    <ContactAvatar contact={{ name: b.name, roleType: "purchaser" }} image={b.image} size={26} />
                  </span>
                ))}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {label}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sub}
                </span>
              </span>
              <span aria-hidden style={{ color: "var(--agent-text-muted)", fontSize: 13, flexShrink: 0 }}>→</span>
            </button>
          );
        })}
      </div>

      {open && (
        <ArchivedRoundDrawer
          open
          transactionId={transactionId}
          archivedRounds={[open]}
          onClose={() => setOpen(null)}
        />
      )}
    </GlassCard>
  );
}
