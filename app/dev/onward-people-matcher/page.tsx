// /dev/onward-people-matcher — preview of the Phase 2 "is this the same person?"
// matcher (docs/active/onward-portal-mirror.md). It's an EXCEPTION HANDLER:
// auto-matched pairs are tied silently at self-link and never shown; the matcher
// surfaces only for the people auto-match couldn't resolve. Shown here against
// the real agent tokens.
//
// Dev-only: blocked in production.

"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { Check } from "@phosphor-icons/react";
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
        width: "100%",
      }}
    >
      <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-coral-deep)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

// The ambiguous case the matcher exists for: different short/long names, no
// emails, so nothing auto-matches and the agent has to say who's who.
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
          Who&rsquo;s the same person?
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
          Phase 2 of the onward portal mirror. An exception handler, not a routine step: matched people
          are tied silently at self-link, and this only appears for the ones we couldn&rsquo;t.
        </p>
        {saved && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--agent-success)", fontWeight: 600 }}>
            Saved: {saved}
          </p>
        )}
      </div>

      <Card title="Auto-matched: never shown">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>
            The Achilleas (Mario &amp; Koula) matched by name across both sales, so they&rsquo;re tied
            the instant you self-link the files. You&rsquo;d never see a screen for this &mdash; it just happens.
          </p>
          {["Mario Achillea", "Koula Achillea"].map((n) => (
            <div key={n} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--agent-success)", fontWeight: 600 }}>
              <Check size={14} weight="bold" aria-hidden /> {n} matched automatically
            </div>
          ))}
        </div>
      </Card>

      <Card title="Ambiguous: the matcher (why it exists)">
        <OnwardPeopleMatcher
          ourAddress="8 Rosewood Avenue"
          neighbourAddress="12 Oak Lane"
          ourContacts={AMBIG_OURS}
          theirContacts={AMBIG_THEIRS}
          onSave={(p) => setSaved(JSON.stringify(p))}
        />
      </Card>
    </div>
  );
}
