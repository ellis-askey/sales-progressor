"use client";

import { useState } from "react";
import { MissingFeeRow } from "./MissingFeeRow";

type MissingFile = {
  id: string;
  propertyAddress: string;
  ownerLine: string | null;
  awaitingAssignment: boolean;
};

const LIMIT = 3;

export function MissingFeesList({ files, txBasePath }: { files: MissingFile[]; txBasePath: string }) {
  const [expanded, setExpanded] = useState(false);

  if (files.length === 0) {
    return (
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--agent-success)", fontSize: 15, fontWeight: 700, lineHeight: 1 }}>✓</span>
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>All files have fees set.</p>
      </div>
    );
  }

  const visible = expanded ? files : files.slice(0, LIMIT);
  const hasMore = files.length > LIMIT;

  return (
    <>
      {visible.map((f, i) => (
        <div key={f.id} style={{ borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}>
          <MissingFeeRow
            id={f.id}
            propertyAddress={f.propertyAddress}
            ownerLine={f.ownerLine}
            awaitingAssignment={f.awaitingAssignment}
            txBasePath={txBasePath}
          />
        </div>
      ))}
      {hasMore && (
        <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", padding: "10px 20px" }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontSize: 12, fontWeight: 600,
              color: "var(--agent-coral-deep)",
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            {expanded ? "Show less" : `Show all (${files.length})`}
          </button>
        </div>
      )}
    </>
  );
}
