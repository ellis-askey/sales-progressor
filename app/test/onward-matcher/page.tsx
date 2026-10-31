// /test/onward-matcher?tx=<id> — disposable harness for the Phase 2 "same
// person?" matcher against REAL seeded data. Loads the people that auto-match
// couldn't tie between a file and its same-team chain neighbour, lets the agent
// match them, and persists real Contact.personGroupId ties. Dev-only; auth-gated
// (the action requires a session). Delete after Phase 2 is wired into the chain.

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getOnwardMatchContext } from "@/app/actions/onward-people";
import { OnwardMatcherHarness } from "./Harness";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 80px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ maxWidth: 560, width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>
            Match the people
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
            Live test harness &mdash; real data, real saves. (This will move into the chain self-link flow.)
          </p>
        </div>
        <div
          style={{
            background: "var(--agent-surface, #fff)",
            border: "0.5px solid var(--agent-border-default)",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 10px 30px -18px rgba(15,23,42,0.4)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function OnwardMatcherTestPage({
  searchParams,
}: {
  searchParams: Promise<{ tx?: string; kind?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tx, kind } = await searchParams;
  if (!tx) {
    return <Shell><p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)" }}>Add <code>?tx=&lt;transactionId&gt;</code> to the URL (the seed script prints one).</p></Shell>;
  }

  const k = kind === "related_sale" ? "related_sale" : "onward_purchase";
  const ctx = await getOnwardMatchContext(tx, k);

  if (!ctx.ok) {
    return (
      <Shell>
        <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)" }}>
          {ctx.reason === "no_neighbour"
            ? "This file has no same-team onward/related neighbour, so there's nothing to match."
            : "That file wasn't found, or it isn't yours to see."}
        </p>
      </Shell>
    );
  }

  if (ctx.ourContacts.length === 0) {
    return (
      <Shell>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-success)" }}>
          Everyone here is already matched &mdash; nothing to resolve. ✓
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <OnwardMatcherHarness
        transactionId={tx}
        ourAddress={ctx.ourAddress}
        neighbourAddress={ctx.neighbourAddress}
        ourContacts={ctx.ourContacts}
        theirContacts={ctx.theirContacts}
      />
    </Shell>
  );
}
