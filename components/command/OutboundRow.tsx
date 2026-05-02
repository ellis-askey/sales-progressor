"use client";

import { useState, useTransition } from "react";
import {
  logOutboundMessageViewAction,
  getOutboundMessageBodyAction,
} from "@/app/actions/outbound-log";

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

const CHANNEL_ICON: Record<string, string> = {
  email: "✉",
  sms: "💬",
  linkedin: "in",
  twitter: "𝕏",
  in_app: "⌚",
};

const STATUS_COLOR: Record<string, string> = {
  sent:      "bg-neutral-800 text-neutral-400",
  delivered: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  opened:    "bg-emerald-900 text-emerald-300 border border-emerald-800",
  clicked:   "bg-emerald-900 text-emerald-200 border border-emerald-700",
  bounced:   "bg-red-950 text-red-400 border border-red-900",
  failed:    "bg-red-950 text-red-400 border border-red-900",
  scheduled: "bg-amber-950 text-amber-400 border border-amber-900",
  draft:     "bg-neutral-800 text-neutral-500",
  queued:    "bg-neutral-800 text-neutral-400",
  cancelled: "bg-neutral-800 text-neutral-600",
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
    <div className="border-b border-neutral-800 last:border-0">
      {/* Collapsed row */}
      <button
        onClick={toggle}
        className="w-full text-left px-4 py-3 hover:bg-neutral-800/50 transition-colors flex items-start gap-3"
      >
        {/* Channel icon */}
        <span className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5">
          {CHANNEL_ICON[row.channel] ?? row.channel}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status badge */}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[row.status] ?? "bg-neutral-800 text-neutral-500"}`}>
              {row.status}
            </span>

            {/* AI badge */}
            {row.wasAiGenerated && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-950 text-purple-400 border border-purple-900">✦ AI</span>
            )}

            {/* Approval badges */}
            {row.requiresApproval && row.approvedAt && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900">⌃ approved</span>
            )}
            {needsApproval && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-900">⏳ pending</span>
            )}

            {/* Engagement badges */}
            {row.openedAt && (
              <span className="text-[10px] text-emerald-500">👁 opened</span>
            )}
            {row.clickedAt && (
              <span className="text-[10px] text-emerald-400">🔗 clicked</span>
            )}

            {/* Recipient */}
            <span className="text-xs text-neutral-300 truncate max-w-[200px]">
              {row.recipientName ?? row.recipientEmail ?? row.recipientHandle ?? "—"}
            </span>
          </div>

          {/* Subject */}
          {row.subject && (
            <p className="text-xs text-neutral-500 truncate mt-0.5">{row.subject}</p>
          )}
        </div>

        <span className="text-[10px] text-neutral-600 shrink-0 whitespace-nowrap ml-2">
          {fmtTs(row.sentAt ?? row.createdAt)}
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 bg-neutral-950 border-t border-neutral-800">

          {/* Body */}
          <div>
            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">Content</p>
            {bodyPending ? (
              <p className="text-xs text-neutral-600">Loading…</p>
            ) : body ? (
              body.bodyFormat === "html" ? (
                <iframe
                  srcDoc={`<base target="_blank"><style>body{font-family:sans-serif;font-size:13px;color:#ccc;background:transparent}</style>${body.content.slice(0, 51200)}`}
                  sandbox="allow-same-origin"
                  className="w-full border border-neutral-800 rounded-lg bg-transparent"
                  style={{ minHeight: 200, maxHeight: 400 }}
                  title="Message body"
                />
              ) : (
                <pre className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed bg-neutral-900 rounded-lg p-3 max-h-64 overflow-y-auto border border-neutral-800">
                  {body.content.length > 51200
                    ? body.content.slice(0, 51200) + "\n\n[truncated — message exceeds display limit]"
                    : body.content}
                </pre>
              )
            ) : (
              <p className="text-xs text-neutral-600">No content.</p>
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
                <span className="text-neutral-600">{k} </span>
                <span className="text-neutral-300 truncate">{v}</span>
              </div>
            ) : null)}
          </div>

          {/* AI provenance */}
          {row.wasAiGenerated && (
            <div>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">AI provenance</p>
              <div className="flex items-center gap-4 text-xs text-neutral-400 flex-wrap">
                {row.aiModel && <span>Model: <span className="text-neutral-200 font-mono">{row.aiModel}</span></span>}
                {row.aiTokensInput != null && <span>In: {row.aiTokensInput.toLocaleString()} tok</span>}
                {row.aiTokensOutput != null && <span>Out: {row.aiTokensOutput.toLocaleString()} tok</span>}
                {row.aiCostCents != null && <span>Cost: {fmtCost(row.aiCostCents)}</span>}
              </div>
            </div>
          )}

          {/* Lifecycle timeline */}
          <div>
            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">Lifecycle</p>
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
                <div key={label as string} className={`flex items-center gap-1 pr-3 ${ts ? "text-neutral-300" : "text-neutral-700"}`}>
                  <span>{label as string}:</span>
                  <span>{ts ? fmtTs(ts as Date) : "—"}</span>
                </div>
              ))}
            </div>
            {row.failureReason && (
              <p className="text-[10px] text-red-400 mt-1">Failure: {row.failureReason}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1 border-t border-neutral-800">
            {body && (
              <button
                onClick={() => navigator.clipboard.writeText(body.content)}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Copy body
              </button>
            )}
            {row.transactionId && (
              <a
                href={`/transactions/${row.transactionId}`}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
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
