"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/services/comms";
import { deleteCommAction } from "@/app/actions/comms";
import { extractFirstName } from "@/lib/contacts/displayName";

type Props = {
  entries: ActivityEntry[];
  transactionId: string;
  mosDocUrl?: string | null;
  beforeEntries?: React.ReactNode;
  currentUserId?: string;
};

const MOS_CODES = new Set(["VM2", "PM2"]);

const METHOD_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  voicemail: "Voicemail",
  whatsapp: "WhatsApp",
  post: "Post",
};

type FilterKind = "all" | "milestones" | "comms" | "automated" | "notes";

const FILTERS: { value: FilterKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "milestones", label: "Steps" },
  { value: "comms", label: "Comms" },
  { value: "automated", label: "Automated" },
  { value: "notes", label: "Notes" },
];

function isPortalView(entry: { kind: string; content?: string }) {
  return entry.kind === "comm" && typeof entry.content === "string" && entry.content.includes("viewed their client portal");
}

function dotColor(entry: ActivityEntry): string {
  if (entry.kind === "milestone") {
    return entry.isNotRequired ? "rgba(30,45,74,0.22)" : "#10b981";
  }
  if (entry.isAutomated) return "#6366f1";
  const map: Record<string, string> = {
    internal_note: "#d97706",
    outbound: "var(--agent-coral)",
    inbound: "#10b981",
  };
  return map[entry.type] ?? "rgba(30,45,74,0.22)";
}

function CommPill({ entry }: { entry: Extract<ActivityEntry, { kind: "comm" }> }) {
  if (entry.isAutomated) {
    return (
      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "rgba(99,102,241,0.1)", color: "#4f46e5" }}>
        System email
      </span>
    );
  }
  const styleMap: Record<string, { bg: string; color: string }> = {
    internal_note: { bg: "rgba(217,119,6,0.1)",  color: "#d97706" },
    outbound:      { bg: "rgba(255,107,74,0.1)", color: "var(--agent-coral)" },
    inbound:       { bg: "rgba(16,185,129,0.1)", color: "#059669" },
  };
  const labels: Record<string, string> = {
    internal_note: "Internal",
    outbound: "→ Outbound",
    inbound: "← Inbound",
  };
  const s = styleMap[entry.type] ?? { bg: "rgba(30,45,74,0.06)", color: "var(--agent-text-muted)" };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: s.bg, color: s.color }}>
      {labels[entry.type] ?? entry.type}
    </span>
  );
}

export function ActivityTimeline({ entries, transactionId, mosDocUrl, beforeEntries, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [showPortalVisits, setShowPortalVisits] = useState(false);
  const [entriesKey, setEntriesKey] = useState(0);

  const portalViewCount = entries.filter(isPortalView).length;

  function handleFilter(f: FilterKind) {
    setFilter(f);
    setShowAll(false);
    setEntriesKey((k) => k + 1);
  }

  function handleSearch(q: string) {
    setSearch(q);
    setShowAll(false);
    setEntriesKey((k) => k + 1);
  }

  const filtered = entries.filter((entry) => {
    if (!showPortalVisits && isPortalView(entry)) return false;

    if (filter === "milestones" && entry.kind !== "milestone") return false;
    if (filter === "comms" && (entry.kind !== "comm" || entry.type === "internal_note" || entry.isAutomated)) return false;
    if (filter === "automated" && (entry.kind !== "comm" || !entry.isAutomated)) return false;
    if (filter === "notes" && (entry.kind !== "comm" || entry.type !== "internal_note")) return false;

    if (search) {
      const q = search.toLowerCase();
      if (entry.kind === "milestone") {
        return (
          entry.milestoneName?.toLowerCase().includes(q) ||
          (entry.summaryText?.toLowerCase().includes(q) ?? false)
        );
      } else {
        return (
          entry.content?.toLowerCase().includes(q) ||
          entry.contactNames?.some((n) => n.toLowerCase().includes(q))
        );
      }
    }

    return true;
  });

  const visible = showAll ? filtered : filtered.slice(0, 10);
  const hasMore = filtered.length > 10;

  function deleteComm(id: string) {
    setExitingId(id);
    setTimeout(() => {
      setDeletingId(id);
      startTransition(async () => {
        try { await deleteCommAction(id, transactionId); }
        finally { setDeletingId(null); setExitingId(null); }
      });
    }, 150);
  }

  if (entries.length === 0) {
    return (
      <div>
        {beforeEntries && <div className="mb-3">{beforeEntries}</div>}
        <div className="text-center py-8" style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>
          No activity yet — milestone confirmations and communications will appear here.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilter(f.value)}
            className={`agent-segment-pill agent-segment-pill-sm${filter === f.value ? " on" : ""}`}
          >
            {f.label}
          </button>
        ))}
        {portalViewCount > 0 && (
          <button
            onClick={() => { setShowPortalVisits((v) => !v); setShowAll(false); setEntriesKey((k) => k + 1); }}
            className={`agent-segment-pill agent-segment-pill-sm${showPortalVisits ? " on" : ""}`}
          >
            Portal visits {showPortalVisits ? "" : `(${portalViewCount} hidden)`}
          </button>
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search…"
          className="glass-input agent-focus ml-auto px-3 py-1.5 rounded-lg text-slate-900/70 flex-1 min-w-[140px]"
          style={{ fontSize: 12 }}
        />
      </div>

      {beforeEntries && <div className="mb-3">{beforeEntries}</div>}

      {filtered.length === 0 ? (
        <div className="text-center py-8" style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>
          No entries match.
        </div>
      ) : (
        <div key={entriesKey} className="relative agent-reveal-in">
          {/* Vertical line — left: 3 centres on the 8px (w-2) dot */}
          <div className="absolute top-2 bottom-2 w-px" style={{ left: 3, background: "var(--agent-border-default)" }} />

          <div className="space-y-2">
            {visible.map((entry, idx) => (
              <div key={entry.id} className={`relative flex gap-3 ${exitingId === entry.id ? "agent-row-exit" : ""} ${showAll && idx >= 10 ? "agent-reveal-in" : ""}`}>
                {/* 8px coloured dot */}
                <div className="flex-shrink-0 z-10 mt-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: dotColor(entry) }} />
                </div>

                {/* Card */}
                <div className="flex-1 min-w-0">
                  {entry.kind === "milestone" ? (
                    <div style={{ padding: "10px 14px", background: "var(--agent-surface-glass)", borderRadius: 10, border: "0.5px solid var(--agent-border-default)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div className="min-w-0">
                          <div style={{ marginBottom: 4 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                              background: entry.isNotRequired ? "var(--agent-surface-glass)" : "rgba(16,185,129,0.1)",
                              color: entry.isNotRequired ? "var(--agent-text-muted)" : "#059669",
                            }}>
                              {entry.isNotRequired
                                ? "Skipped"
                                : entry.confirmedByClient
                                ? "Confirmed by client"
                                : "Step confirmed"}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.4 }}>
                            {entry.summaryText ?? entry.milestoneName}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 4 }}>
                            {entry.confirmedByClient && entry.confirmerName
                              ? `${entry.confirmerName} via portal · ${formatDate(entry.at)}`
                              : entry.confirmedByClient
                              ? `Client via portal · ${formatDate(entry.at)}`
                              : `${entry.completedByName ? extractFirstName(entry.completedByName) : "Auto-confirmed"} · ${formatDate(entry.at)}`}
                          </p>
                        </div>
                        {mosDocUrl && MOS_CODES.has(entry.milestoneCode) && !entry.isNotRequired && (
                          <a
                            href={mosDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap"
                            style={{ fontSize: 11, fontWeight: 500, color: "#3b82f6" }}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View Memo
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="relative group"
                      style={{ padding: "10px 14px", background: "var(--agent-surface-glass)", borderRadius: 10, border: "0.5px solid var(--agent-border-default)" }}
                    >
                      <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <CommPill entry={entry} />
                        {entry.method && !entry.isAutomated && (
                          <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>
                            {METHOD_LABELS[entry.method] ?? entry.method}
                          </span>
                        )}
                        {entry.contactNames.map((name) => (
                          <span key={name} style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>
                            {extractFirstName(name)}
                          </span>
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--agent-text-primary)", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                        {entry.content}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 4 }}>
                        {entry.createdByName ? extractFirstName(entry.createdByName) : "System"} · {formatDate(entry.at)}
                      </p>
                      {(!currentUserId || entry.createdById === currentUserId) && (
                        <button
                          onClick={() => deleteComm(entry.id)}
                          disabled={deletingId === entry.id || isPending || exitingId === entry.id}
                          className="agent-icon-btn agent-icon-btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ position: "absolute", top: 8, right: 10 }}
                          aria-label="Delete"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="pl-5 mt-2">
              <button
                onClick={() => setShowAll(!showAll)}
                className="agent-link agent-link-muted"
                style={{ fontSize: 11 }}
              >
                {showAll ? "Show less" : `Show ${filtered.length - 10} earlier updates…`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
