"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/services/comms";
import { deleteCommAction } from "@/app/actions/comms";
import { extractFirstName } from "@/lib/contacts/displayName";
import { TimelineIcon, resolveEntryType } from "@/components/ui/TimelineIcon";
import { ContactAvatar } from "@/components/ui/Avatar";

type Props = {
  entries: ActivityEntry[];
  transactionId: string;
  mosDocUrl?: string | null;
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
  { value: "milestones", label: "Milestones" },
  { value: "comms", label: "Comms" },
  { value: "automated", label: "Automated" },
  { value: "notes", label: "Notes" },
];

function isPortalView(entry: { kind: string; content?: string }) {
  return entry.kind === "comm" && typeof entry.content === "string" && entry.content.includes("viewed their client portal");
}

function CommPill({ entry }: { entry: Extract<ActivityEntry, { kind: "comm" }> }) {
  if (entry.isAutomated) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100/80 text-indigo-700">
        System email
      </span>
    );
  }
  const styles = {
    internal_note: "bg-amber-100/80 text-amber-700",
    outbound: "bg-blue-100/80 text-blue-700",
    inbound: "bg-emerald-100/80 text-emerald-700",
  } as Record<string, string>;
  const labels = {
    internal_note: "Internal",
    outbound: "→ Outbound",
    inbound: "← Inbound",
  } as Record<string, string>;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[entry.type] ?? "bg-white/30 text-slate-900/60"}`}>
      {labels[entry.type] ?? entry.type}
    </span>
  );
}

export function ActivityTimeline({ entries, transactionId, mosDocUrl }: Props) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [showPortalVisits, setShowPortalVisits] = useState(false);

  const portalViewCount = entries.filter(isPortalView).length;

  function handleFilter(f: FilterKind) {
    setFilter(f);
    setShowAll(false);
  }

  function handleSearch(q: string) {
    setSearch(q);
    setShowAll(false);
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
    setDeletingId(id);
    startTransition(async () => {
      try { await deleteCommAction(id, transactionId); }
      finally { setDeletingId(null); }
    });
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-900/40">
        No activity yet — milestone confirmations and communications will appear here.
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === f.value
                ? "bg-slate-900/15 text-slate-900/80"
                : "bg-white/40 text-slate-900/40 hover:text-slate-900/70 hover:bg-white/60"
            }`}
          >
            {f.label}
          </button>
        ))}
        {portalViewCount > 0 && (
          <button
            onClick={() => { setShowPortalVisits((v) => !v); setShowAll(false); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              showPortalVisits
                ? "bg-violet-100 text-violet-700"
                : "bg-white/30 text-slate-900/35 hover:text-slate-900/60 hover:bg-white/50"
            }`}
          >
            Portal visits {showPortalVisits ? "" : `(${portalViewCount} hidden)`}
          </button>
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search…"
          className="glass-input ml-auto px-3 py-1.5 rounded-lg text-slate-900/70 focus:ring-1 focus:ring-blue-300/50 w-36"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-900/40">
          No entries match.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-white/30" />

          <div className="space-y-0">
            {visible.map((entry) => (
              <div key={entry.id} className="relative flex gap-4 pb-4">
                {/* Timeline icon */}
                <div className="flex-shrink-0 relative z-10 mt-1">
                  <TimelineIcon type={resolveEntryType(entry)} size={38} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  {entry.kind === "milestone" ? (
                    <div className="glass-card px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold mb-1 ${
                            entry.isNotRequired ? "text-slate-900/40" :
                            entry.confirmedByClient ? "text-emerald-600" : "text-blue-600"
                          }`}>
                            {entry.isNotRequired
                              ? "Marked not required"
                              : entry.confirmedByClient
                              ? "Confirmed by client"
                              : "Milestone confirmed"}
                          </p>
                          {entry.summaryText ? (
                            <p className="text-sm text-slate-900/80 leading-snug">{entry.summaryText}</p>
                          ) : (
                            <p className="text-sm text-slate-900/70">{entry.milestoneName}</p>
                          )}
                        </div>
                        {mosDocUrl && MOS_CODES.has(entry.milestoneCode) && !entry.isNotRequired && (
                          <a
                            href={mosDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors whitespace-nowrap"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View Memo
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-slate-900/40 mt-2">
                        {entry.confirmedByClient && entry.confirmerName
                          ? `${entry.confirmerName} via portal · ${formatDate(entry.at)}`
                          : entry.confirmedByClient
                          ? `Client via portal · ${formatDate(entry.at)}`
                          : `${entry.completedByName ? extractFirstName(entry.completedByName) : "System"} · ${formatDate(entry.at)}`}
                      </p>
                    </div>
                  ) : (
                    <div className="glass-card px-4 py-3 group">
                      {/* Badges */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CommPill entry={entry} />
                        {entry.method && !entry.isAutomated && (
                          <span className="text-xs text-slate-900/50 font-medium">
                            {METHOD_LABELS[entry.method] ?? entry.method}
                          </span>
                        )}
                        {entry.contactNames.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 text-xs bg-white/30 text-slate-900/60 pl-0.5 pr-2 py-0.5 rounded-full">
                            <ContactAvatar contact={{ name }} size={16} />
                            {extractFirstName(name)}
                          </span>
                        ))}
                        <button
                          onClick={() => deleteComm(entry.id)}
                          disabled={deletingId === entry.id || isPending}
                          className="ml-auto text-xs text-slate-900/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          {deletingId === entry.id ? "…" : "Delete"}
                        </button>
                      </div>
                      {/* Content */}
                      <p className="text-sm text-slate-900/80 leading-relaxed whitespace-pre-line">
                        {entry.content}
                      </p>
                      <p className="text-xs text-slate-900/40 mt-2">
                        {entry.createdByName ? extractFirstName(entry.createdByName) : "System"} · {formatDate(entry.at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="pl-[54px] mt-1">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
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
