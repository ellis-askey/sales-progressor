"use client";

import { useState, useTransition } from "react";
import {
  logOutboundMessageViewAction,
  getOutboundMessageBodyAction,
} from "@/app/actions/outbound-log";

// ── types (plain objects to avoid importing Prisma on client) ──────────────

export interface OutboundRowData {
  id: string;
  channel: string;
  status: string;
  purpose: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientHandle: string | null;
  subject: string | null;
  wasAiGenerated: boolean;
  requiresApproval: boolean;
  approvedAt: Date | null;
  isAutomated: boolean;
  aiModel: string | null;
  aiTokensInput: number | null;
  aiTokensOutput: number | null;
  aiCostCents: number | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  scheduledFor: Date | null;
  createdAt: Date;
  transactionId: string | null;
  agencyId: string | null;
}

// ── badge helpers ──────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<string, string> = {
  email: "✉",
  sms: "💬",
  linkedin: "in",
  twitter: "𝕏",
  in_app: "⌚",
};

const STATUS_COLOR: Record<string, string> = {
  sent:      "bg-white/10 text-white/60",
  delivered: "bg-emerald-500/20 text-emerald-300",
  opened:    "bg-emerald-500/25 text-emerald-200",
  clicked:   "bg-emerald-500/30 text-emerald-100",
  bounced:   "bg-red-500/20 text-red-300",
  failed:    "bg-red-500/20 text-red-300",
  scheduled: "bg-amber-500/20 text-amber-300",
  draft:     "bg-white/8 text-white/40",
  queued:    "bg-white/10 text-white/50",
  cancelled: "bg-white/8 text-white/30",
};

function fmtTs(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function fmtCost(cents: number | null): string {
  if (cents == null) return "—";
  return `£${(cents / 100).toFixed(4)}`;
}

// ── component ──────────────────────────────────────────────────────────────

export function OutboundRow({ row }: { row: OutboundRowData }) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState<{ content: string; bodyFormat: string } | null>(null);
  const [bodyPending, startBodyFetch] = useTransition();

  function toggle() {
    if (!expanded && !body) {
      startBodyFetch(async () => {
        const [result] = await Promise.all([
          getOutboundMessageBodyAction(row.id),
          logOutboundMessageViewAction(row.id),
        ]);
        setBody(result);
      });
    }
    setExpanded((e) => !e);
  }

  const needsApproval = row.requiresApproval && !row.approvedAt && row.status !== "cancelled";

  return (
    <div className="border-b border-white/5 last:border-0">
      {/* Collapsed row */}
      <button
        onClick={toggle}
        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start gap-3"
      >
        {/* Channel icon */}
        <span className="text-xs bg-white/8 text-white/50 px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5">
          {CHANNEL_ICON[row.channel] ?? row.channel}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status badge */}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[row.status] ?? "bg-white/8 text-white/40"}`}>
              {row.status}
            </span>

            {/* AI badge */}
            {row.wasAiGenerated && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">✦ AI</span>
            )}

            {/* Approval badges */}
            {row.requiresApproval && row.approvedAt && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">⌃ approved</span>
            )}
            {needsApproval && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">⏳ pending</span>
            )}

            {/* Engagement badges */}
            {row.openedAt && (
              <span className="text-[10px] text-emerald-400/60">👁 opened</span>
            )}
            {row.clickedAt && (
              <span className="text-[10px] text-emerald-300/70">🔗 clicked</span>
            )}

            {/* Recipient */}
            <span className="text-xs text-white/60 truncate max-w-[200px]">
              {row.recipientName ?? row.recipientEmail ?? row.recipientHandle ?? "—"}
            </span>
          </div>

          {/* Subject */}
          {row.subject && (
            <p className="text-xs text-white/50 truncate mt-0.5">{row.subject}</p>
          )}
        </div>

        <span className="text-[10px] text-white/30 shrink-0 whitespace-nowrap ml-2">
          {fmtTs(row.sentAt ?? row.createdAt)}
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 bg-white/3 border-t border-white/5">

          {/* Body */}
          <div>
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wide mb-2">Content</p>
            {bodyPending ? (
              <p className="text-xs text-white/30">Loading…</p>
            ) : body ? (
              body.bodyFormat === "html" ? (
                <iframe
                  srcDoc={`<base target="_blank"><style>body{font-family:sans-serif;font-size:13px;color:#ccc;background:transparent}</style>${body.content.slice(0, 51200)}`}
                  sandbox="allow-same-origin"
                  className="w-full border border-white/10 rounded-lg bg-transparent"
                  style={{ minHeight: 200, maxHeight: 400 }}
                  title="Message body"
                />
              ) : (
                <pre className="text-xs text-white/60 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {body.content.length > 51200
                    ? body.content.slice(0, 51200) + "\n\n[truncated — message exceeds display limit]"
                    : body.content}
                </pre>
              )
            ) : (
              <p className="text-xs text-white/25">No content.</p>
            )}
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
            {[
              ["Channel", row.channel],
              ["Purpose", row.purpose],
              ["Recipient email", row.recipientEmail],
              ["Recipient handle", row.recipientHandle],
              ["Transaction", row.transactionId ?? "—"],
              ["Agency", row.agencyId ? row.agencyId.slice(-8) : "—"],
            ].map(([k, v]) => v && v !== "—" ? (
              <div key={k}>
                <span className="text-white/30">{k} </span>
                <span className="text-white/60 truncate">{v}</span>
              </div>
            ) : null)}
          </div>

          {/* AI provenance */}
          {row.wasAiGenerated && (
            <div>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wide mb-1.5">AI provenance</p>
              <div className="flex items-center gap-4 text-xs text-white/50 flex-wrap">
                {row.aiModel && <span>Model: <span className="text-white/70 font-mono">{row.aiModel}</span></span>}
                {row.aiTokensInput != null && <span>In: {row.aiTokensInput.toLocaleString()} tok</span>}
                {row.aiTokensOutput != null && <span>Out: {row.aiTokensOutput.toLocaleString()} tok</span>}
                {row.aiCostCents != null && <span>Cost: {fmtCost(row.aiCostCents)}</span>}
              </div>
            </div>
          )}

          {/* Lifecycle timeline */}
          <div>
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wide mb-1.5">Lifecycle</p>
            <div className="flex items-center gap-0 text-[10px] flex-wrap gap-y-1">
              {[
                ["Created", row.createdAt],
                ["Scheduled", row.scheduledFor],
                ["Sent", row.sentAt],
                ["Delivered", row.deliveredAt],
                ["Opened", row.openedAt],
                ["Clicked", row.clickedAt],
                ["Failed", row.failedAt],
              ].map(([label, ts]) => (
                <div key={label as string} className={`flex items-center gap-1 pr-3 ${ts ? "text-white/60" : "text-white/20"}`}>
                  <span>{label as string}:</span>
                  <span>{ts ? fmtTs(ts as Date) : "—"}</span>
                </div>
              ))}
            </div>
            {row.failureReason && (
              <p className="text-[10px] text-red-300/70 mt-1">Failure: {row.failureReason}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1 border-t border-white/8">
            {body && (
              <button
                onClick={() => navigator.clipboard.writeText(body.content)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Copy body
              </button>
            )}
            {row.transactionId && (
              <a
                href={`/transactions/${row.transactionId}`}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                View transaction →
              </a>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
