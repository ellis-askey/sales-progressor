"use client";

// The line that sits above the self-progress form (aligned with the right
// column's tab strip). While a required core field is still missing it nudges
// the next one ("Choose a tenure to continue"); once they're all set it
// cross-fades to the reassuring "Add what you have now" line.

import { useState, useEffect } from "react";

function nextLabel(field: string): string {
  if (field === "address") return "Add the address to save this sale";
  if (field === "tenure") return "Choose a tenure to save this sale";
  return "Choose a purchase type to save this sale";
}

export function RequiredPrompt({ streetAddress, tenure, purchaseType }: {
  streetAddress: string;
  tenure: string;
  purchaseType: string;
}) {
  const missing: string[] = [];
  if (streetAddress.trim().length < 3) missing.push("address");
  if (!tenure) missing.push("tenure");
  if (!purchaseType) missing.push("purchase type");

  const complete = missing.length === 0;
  const next = missing[0];

  // Hold the last prompt so the outgoing line keeps its text while it fades,
  // instead of blanking the instant everything's complete.
  const [prompt, setPrompt] = useState(() => nextLabel(next ?? "purchase type"));
  useEffect(() => { if (next) setPrompt(nextLabel(next)); }, [next]);

  const base: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    margin: 0,
    fontSize: 12,
    color: "var(--nv2-text-muted)",
    fontStyle: "italic",
    transition: "opacity 260ms ease",
  };

  return (
    <div style={{ position: "relative", minHeight: 30 }} aria-live="polite">
      <p style={{ ...base, opacity: complete ? 0 : 1 }}>{prompt}</p>
      <p style={{ ...base, opacity: complete ? 1 : 0 }}>
        Add what you have now. You can fill in the rest later.
      </p>
    </div>
  );
}
