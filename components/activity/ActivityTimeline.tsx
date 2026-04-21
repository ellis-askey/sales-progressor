"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/services/comms";

type Props = {
  entries: ActivityEntry[];
  transactionId: string;
};

const METHOD_ICONS: Record<string, string> = {
  email: "✉",
  phone: "📞",
  sms: "💬",
  voicemail: "📱",
  whatsapp: "📲",
  post: "📮",
};

const METHOD_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  voicemail: "Voicemail",
  whatsapp: "WhatsApp",
  post: "Post",
};

export function ActivityTimeline({ entries, transactionId }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? entries : entries.slice(0, 10);
  const hasMore = entries.length > 10;

  async function deleteComm(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/comms?id=${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-900/40">
        No activity yet — milestone confirmations and communications will appear here.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[18px] top-2 bottom-2 w-px bg-white/30" />

      <div className="space-y-0">
        {visible.map((entry) => (
          <div key={entry.id} className="relative flex gap-4 pb-4">
            {/* Timeline dot */}
            <div className="flex-shrink-0 relative z-10 mt-1">
              {entry.kind === "milestone" ? (
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                  entry.isNotRequired
                    ? "bg-white/20 border-white/30"
                    : "bg-blue-50/60 border-blue-200/60"
                }`}>
                  {entry.isNotRequired ? (
                    <span className="text-xs text-slate-900/40">—</span>
                  ) : (
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ) : (
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 text-base ${
                  entry.type === "internal_note"
                    ? "bg-amber-50/60 border-amber-200/60"
                    : entry.type === "outbound"
                    ? "bg-blue-50/60 border-blue-200/60"
                    : "bg-emerald-50/60 border-emerald-200/60"
                }`}>
                  {entry.type === "internal_note" ? "📝" :
                   entry.method ? METHOD_ICONS[entry.method] ?? "💬" : "💬"}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              {entry.kind === "milestone" ? (
                <div className="glass-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-600 mb-1">
                        {entry.isNotRequired ? "Marked not required" : "Milestone confirmed"}
                      </p>
                      {entry.summaryText ? (
                        <p className="text-sm text-slate-900/80 leading-snug">{entry.summaryText}</p>
                      ) : (
                        <p className="text-sm text-slate-900/70">{entry.milestoneName}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-900/40 mt-2">
                    {entry.completedByName?.split(" ")[0] ?? "System"} · {formatDate(entry.at)}
                  </p>
                </div>
              ) : (
                <div className="glass-card px-4 py-3 group">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      entry.type === "internal_note" ? "bg-amber-100/80 text-amber-700" :
                      entry.type === "outbound" ? "bg-blue-100/80 text-blue-700" :
                      "bg-emerald-100/80 text-emerald-700"
                    }`}>
                      {entry.type === "internal_note" ? "Internal" :
                       entry.type === "outbound" ? "→ Outbound" : "← Inbound"}
                    </span>
                    {entry.method && (
                      <span className="text-xs text-slate-900/50 font-medium">
                        {METHOD_ICONS[entry.method]} {METHOD_LABELS[entry.method]}
                      </span>
                    )}
                    {entry.contactNames.map((name) => (
                      <span key={name} className="text-xs bg-white/30 text-slate-900/60 px-2 py-0.5 rounded-full">
                        {name.split(" ")[0]}
                      </span>
                    ))}
                    <button
                      onClick={() => deleteComm(entry.id)}
                      disabled={deletingId === entry.id}
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
                    {entry.createdByName.split(" ")[0]} · {formatDate(entry.at)}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="pl-[52px] mt-1">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            {showAll ? "Show less" : `Show ${entries.length - 10} earlier updates…`}
          </button>
        </div>
      )}
    </div>
  );
}
