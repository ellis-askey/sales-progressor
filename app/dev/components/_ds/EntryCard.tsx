"use client";
// A single canonical component entry. This is ARCHITECTURE, not content: it
// renders whatever a reviewed ComponentEntry carries (live preview, variants,
// states, discovered sources, and the collapsed "Existing Behaviour &
// Exceptions" record). No entries exist yet, so this renders nothing in the
// workspace today — it's the shape waiting to be filled, one component at a
// time, by review.

import { useState } from "react";
import type { ComponentEntry } from "./registry";
import { STATUS_META } from "./registry";

export function StatusBadge({ status }: { status: ComponentEntry["status"] }) {
  const meta = STATUS_META[status];
  return <span className="ds-badge" data-tone={meta.tone}>{meta.label}</span>;
}

function ExceptionsSection({ entry }: { entry: ComponentEntry }) {
  const [open, setOpen] = useState(false);
  const items = entry.exceptions ?? [];
  if (items.length === 0) return null;
  return (
    <div className="ds-exceptions" data-open={open}>
      <button type="button" className="ds-exceptions-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="ds-chevron" aria-hidden="true">›</span>
        Existing behaviour &amp; exceptions
        <span className="ds-exceptions-count">{items.length}</span>
      </button>
      {open && (
        <ul className="ds-exceptions-body">
          {items.map((ex, i) => (
            <li key={i}>
              <div className="ds-exceptions-title">
                {ex.title}
                {ex.scope && <span className="ds-exceptions-scope" data-scope={ex.scope}>{ex.scope}</span>}
              </div>
              <p className="ds-exceptions-detail">{ex.detail}</p>
              {ex.source && <code className="ds-exceptions-source">{ex.source}</code>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EntryCard({ entry, theme }: { entry: ComponentEntry; theme: "light" | "dark" }) {
  return (
    <article className="ds-entry">
      <header className="ds-entry-head">
        <div className="ds-entry-id">
          <h3>{entry.name}</h3>
          <StatusBadge status={entry.status} />
        </div>
        {entry.summary && <p className="ds-entry-summary">{entry.summary}</p>}
      </header>

      <div className="ds-entry-preview">
        {entry.render ? entry.render({ theme }) : <span className="ds-preview-pending">Canonical preview added on approval</span>}
      </div>

      {(entry.variants?.length || entry.states?.length) ? (
        <div className="ds-entry-meta">
          {entry.variants?.length ? (
            <div className="ds-chipline"><span className="ds-chipline-label">Variants</span>{entry.variants.map((v) => <span key={v.id} className="ds-chip">{v.label}</span>)}</div>
          ) : null}
          {entry.states?.length ? (
            <div className="ds-chipline"><span className="ds-chipline-label">States</span>{entry.states.map((s) => <span key={s.id} className="ds-chip">{s.label}</span>)}</div>
          ) : null}
        </div>
      ) : null}

      {entry.sources?.length ? (
        <div className="ds-entry-sources">
          <span className="ds-chipline-label">Found in</span>
          <ul>{entry.sources.map((s, i) => <li key={i}><code>{s.path}</code>{s.note && <span> — {s.note}</span>}</li>)}</ul>
        </div>
      ) : null}

      <ExceptionsSection entry={entry} />
    </article>
  );
}
