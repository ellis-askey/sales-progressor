// /dev/onward-people-matcher — preview of the Phase 2 "is this the same person?"
// matcher (docs/active/onward-portal-mirror.md). Two mock scenarios against the
// real agent tokens: the Achillea pair (auto-matched, just confirm) and an
// ambiguous pair (nothing pre-matched, the real reason this UI exists).
//
// Dev-only: blocked in production.

"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { OnwardPeopleMatcher, type MatchContact } from "@/components/chain/OnwardPeopleMatcher";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--agent-surface, #fff)",
        border: "0.5px solid var(--agent-border-default)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 10px 30px -18px rgba(15,23,42,0.4)",
        maxWidth: 560,
      }}
    >
      <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-coral-deep)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Scenario 1: the Achilleas — auto-matched by name, agent just checks ──
const ACHILLEA_OURS: MatchContact[] = [
  { id: "a1", name: "Mr Mario Achillea", email: "marioachillea@gmail.com", roleLabel: "Seller" },
  { id: "a2", name: "Mrs Koula Achillea", email: "koulashakeruk@yahoo.co.uk", roleLabel: "Seller" },
];
const ACHILLEA_THEIRS: MatchContact[] = [
  { id: "b1", name: "Mario Achillea", email: "marioachillea@gmail.com", roleLabel: "Buyer" },
  { id: "b2", name: "Koula Achillea", email: "koulashakeruk@yahoo.co.uk", roleLabel: "Buyer" },
  { id: "b3", name: "Alice King", email: "alice.king@engagepartners.co.uk", roleLabel: "Seller" },
];

// ── Scenario 2: ambiguous — different names, no emails. Nothing auto-matches;
// the agent has to say who's who (the whole reason this UI exists). ──
const AMBIG_OURS: MatchContact[] = [
  { id: "c1", name: "Robert Smith", email: null, roleLabel: "Seller" },
  { id: "c2", name: "Patricia Smith", email: null, roleLabel: "Seller" },
];
const AMBIG_THEIRS: MatchContact[] = [
  { id: "d1", name: "Bob Smith", email: null, roleLabel: "Buyer" },
  { id: "d2", name: "Pat Smith", email: null, roleLabel: "Buyer" },
  { id: "d3", name: "Helen Carter", email: null, roleLabel: "Seller" },
];

export default function OnwardPeopleMatcherDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 80px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>
          Match the people
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
          Phase 2 of the onward portal mirror. Shown twice: the easy case we mostly hit (auto-matched,
          just confirm) and the ambiguous case this exists for (agent decides who&rsquo;s who).
        </p>
        {saved && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--agent-success)", fontWeight: 600 }}>
            Saved: {saved}
          </p>
        )}
      </div>

      <Card title="Scenario 1 — auto-matched (the Achilleas)">
        <OnwardPeopleMatcher
          ourAddress="15 Emperor Close"
          neighbourAddress="Long Meadow"
          ourContacts={ACHILLEA_OURS}
          theirContacts={ACHILLEA_THEIRS}
          initial={{ a1: "b1", a2: "b2" }}
          autoMatched={new Set(["a1", "a2"])}
          onSave={(p) => setSaved(JSON.stringify(p))}
        />
      </Card>

      <Card title="Scenario 2 — ambiguous (why this UI exists)">
        <OnwardPeopleMatcher
          ourAddress="8 Rosewood Avenue"
          neighbourAddress="12 Oak Lane"
          ourContacts={AMBIG_OURS}
          theirContacts={AMBIG_THEIRS}
          initial={{ c1: null, c2: null }}
          autoMatched={new Set()}
          onSave={(p) => setSaved(JSON.stringify(p))}
        />
      </Card>
    </div>
  );
}
