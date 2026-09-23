"use client";

// The Hub "Needs filing" tray. Emails the sync matched to real people/properties
// but couldn't place on a single file (usually a solicitor who acts on two of
// your sales). Zero-candidate noise never reaches here — it's dropped at ingest —
// so this stays short and action-led. Optimistic: rows leave on tap and return
// if the server rejects.
//
// Threads collapse to ONE card (founder report, 2026-09-23: a 34-email thread
// rendered as 34 identical cards, each needing its own click, and looked like a
// filing bug). Grouping key is the normalised subject (reply/forward prefixes
// stripped) within the agent's own tray; a thread card files or dismisses every
// email in one tap. Single emails render exactly as before.

import { useState, useTransition } from "react";
import { EnvelopeSimple, ArrowDown, ArrowUp, Check, X, Envelope } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  filePendingEmailAction,
  dismissPendingEmailAction,
  filePendingEmailsAction,
  dismissPendingEmailsAction,
} from "@/app/actions/pending-inbound";
import type { PendingInboundRow, PendingCandidate } from "@/lib/services/pending-inbound";

function ago(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// "RE: RE: Fwd: Update - 25 Austin Hluse" → "update - 25 austin hluse"
function threadKey(subject: string): string {
  let s = subject.trim().toLowerCase();
  for (;;) {
    const stripped = s.replace(/^(re|fw|fwd)\s*:\s*/i, "");
    if (stripped === s) break;
    s = stripped;
  }
  return s.replace(/\s+/g, " ") || "(no subject)";
}

type Thread = {
  key: string;
  rows: PendingInboundRow[]; // newest first (input order)
  latest: PendingInboundRow;
  parties: string[]; // distinct display names, newest first
  candidates: PendingCandidate[]; // union across the thread, deduped by tx
  uniformDirection: "inbound" | "outbound" | null;
};

function groupThreads(rows: PendingInboundRow[]): Thread[] {
  const byKey = new Map<string, PendingInboundRow[]>();
  const order: string[] = [];
  for (const r of rows) {
    const k = threadKey(r.subject);
    if (!byKey.has(k)) { byKey.set(k, []); order.push(k); }
    byKey.get(k)!.push(r);
  }
  return order.map((key) => {
    const group = byKey.get(key)!;
    const parties: string[] = [];
    for (const r of group) {
      const name = r.partyName || r.partyEmail;
      if (name && !parties.includes(name)) parties.push(name);
    }
    const candidates: PendingCandidate[] = [];
    for (const r of group) {
      for (const c of r.candidates) {
        if (!candidates.some((x) => x.transactionId === c.transactionId)) candidates.push(c);
      }
    }
    const dirs = new Set(group.map((r) => r.direction));
    return {
      key,
      rows: group,
      latest: group[0],
      parties,
      candidates,
      uniformDirection: dirs.size === 1 ? group[0].direction : null,
    };
  });
}

export function NeedsFilingCard({ rows }: { rows: PendingInboundRow[] }) {
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const visible = rows.filter((r) => !removed.has(r.id));
  if (visible.length === 0) return null;
  const threads = groupThreads(visible);

  // Shared optimistic runner over a set of pending ids. `run` reports which ids
  // failed so exactly those rows come back.
  const act = (
    key: string,
    ids: string[],
    run: () => Promise<{ ok: boolean; failedIds?: string[] }>,
    okMsg: string | null,
    failMsg: string,
  ) => {
    setBusyKey(key);
    setRemoved((prev) => { const n = new Set(prev); ids.forEach((id) => n.add(id)); return n; });
    startTransition(async () => {
      try {
        const res = await run();
        const failed = res.failedIds ?? (res.ok ? [] : ids);
        if (failed.length > 0) {
          setRemoved((prev) => { const n = new Set(prev); failed.forEach((id) => n.delete(id)); return n; });
          toast.error(failMsg);
        } else if (okMsg) {
          toast.success(okMsg);
        }
      } catch {
        setRemoved((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
        toast.error(failMsg);
      } finally {
        setBusyKey((c) => (c === key ? null : c));
      }
    });
  };

  const fileThread = (t: Thread, c: PendingCandidate) => {
    const ids = t.rows.map((r) => r.id);
    if (ids.length === 1) {
      act(t.key, ids, () => filePendingEmailAction({ pendingId: ids[0], transactionId: c.transactionId }),
        `Filed to ${c.address || "the property"}`, "Couldn't file that email");
    } else {
      act(t.key, ids, () => filePendingEmailsAction({ pendingIds: ids, transactionId: c.transactionId }),
        `Filed ${ids.length} emails to ${c.address || "the property"}`, "Some of those emails couldn't be filed");
    }
  };

  const dismissThread = (t: Thread) => {
    const ids = t.rows.map((r) => r.id);
    if (ids.length === 1) {
      act(t.key, ids, () => dismissPendingEmailAction({ pendingId: ids[0] }), null, "Couldn't dismiss that");
    } else {
      act(t.key, ids, () => dismissPendingEmailsAction({ pendingIds: ids }), null, "Couldn't dismiss those");
    }
  };

  return (
    <GlassCard glassId="hub-needs-filing" label="Hub · Needs filing" defaultVariant="v05" style={{ padding: "14px 16px", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <EnvelopeSimple size={16} weight="fill" style={{ color: "var(--agent-coral-deep)" }} />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>Needs filing</h3>
        <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>
          {visible.length} email{visible.length === 1 ? "" : "s"} to place on a file
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {threads.map((t) => {
          const multi = t.rows.length > 1;
          const r = t.latest;
          const sent = t.uniformDirection === "outbound";
          const rowBusy = busyKey === t.key;
          const partyLine = multi
            ? `${t.parties.slice(0, 2).join(", ")}${t.parties.length > 2 ? ` +${t.parties.length - 2} more` : ""}`
            : (r.partyName || r.partyEmail);
          return (
            <div
              key={t.key + r.id}
              style={{
                borderRadius: 10,
                border: "0.5px solid var(--agent-border-subtle)",
                background: "var(--agent-surface-glass)",
                padding: "10px 12px",
                opacity: rowBusy ? 0.6 : 1,
                transition: "opacity 120ms ease",
              }}
            >
              {/* Who + when */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                {multi ? (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                      fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999,
                      color: "var(--agent-coral-deep)", background: "rgba(var(--agent-coral-rgb), 0.10)",
                    }}
                  >
                    <Envelope size={10} weight="bold" />
                    {t.rows.length} emails
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                      fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999,
                      color: sent ? "var(--agent-coral-deep)" : "#0f766e",
                      background: sent ? "rgba(var(--agent-coral-rgb), 0.10)" : "rgba(16,185,129,0.12)",
                    }}
                  >
                    {sent ? <ArrowUp size={10} weight="bold" /> : <ArrowDown size={10} weight="bold" />}
                    {sent ? "Sent" : "Received"}
                  </span>
                )}
                <span style={{ fontSize: 11.5, color: "var(--agent-text-secondary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {multi ? "With " : r.direction === "outbound" ? "To " : "From "}{partyLine}
                </span>
                <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", flexShrink: 0 }}>{ago(r.receivedAt)}</span>
              </div>

              {/* Subject + latest preview */}
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.subject || "(no subject)"}
              </p>
              {r.preview && (
                <p style={{ fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.4, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {multi ? "Latest: " : ""}{r.preview}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                {t.candidates.length > 0 ? (
                  t.candidates.map((c) => (
                    <button
                      key={c.transactionId}
                      type="button"
                      disabled={rowBusy}
                      onClick={() => fileThread(t, c)}
                      className="agent-btn agent-btn-sm agent-btn-primary"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Check size={12} weight="bold" />
                      {multi ? `File all ${t.rows.length} to ${c.address || "this file"}` : `File to ${c.address || "this file"}`}
                    </button>
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "var(--agent-text-tertiary)" }}>
                    Open the sale to file {multi ? "these" : "it"}, or dismiss.
                  </span>
                )}
                <button
                  type="button"
                  disabled={rowBusy}
                  onClick={() => dismissThread(t)}
                  className="agent-link agent-link-muted"
                  style={{ marginLeft: "auto", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 3 }}
                >
                  <X size={12} weight="bold" /> {multi ? `Dismiss all ${t.rows.length}` : "Dismiss"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
