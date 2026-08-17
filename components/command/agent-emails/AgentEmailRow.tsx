"use client";

// One row in the Command Centre agent-emails list. Collapsed: sent time,
// recipient, kind pill, subject. Click to expand the detail inline (CC
// convention — expanding row, not a modal): the rendered HTML in a sandboxed
// iframe with a plain-text fallback, or a "body not stored" note for redacted
// kinds.

import { useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { kindLabel, groupForKind, GROUP_PILL } from "@/lib/command/agent-emails";

export type AgentEmailRowData = {
  id: string;
  sentAt: string; // ISO
  toEmail: string;
  kind: string;
  subject: string;
  userName: string | null;
  userRole: string | null;
  agencyName: string | null;
  txAddress: string | null;
  text: string | null;
  html: string | null;
  redacted: boolean;
};

function fmtSent(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentEmailRow({ row }: { row: AgentEmailRowData }) {
  const [open, setOpen] = useState(false);
  const pill = GROUP_PILL[groupForKind(row.kind)];

  return (
    <div className="border-b border-neutral-800 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-neutral-800/50 transition-colors"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 flex-shrink-0 text-neutral-600 transition-transform ${open ? "rotate-90" : ""}`}
          strokeWidth={2}
        />

        <span className="text-[11px] text-neutral-500 tabular-nums w-[92px] flex-shrink-0">
          {fmtSent(row.sentAt)}
        </span>

        <span className="w-[150px] flex-shrink-0 min-w-0">
          <span className="block text-[13px] text-neutral-200 truncate">
            {row.userName ?? row.toEmail}
          </span>
          <span className="block text-[10px] text-neutral-600 truncate">
            {[row.userRole, row.agencyName].filter(Boolean).join(" · ") || row.toEmail}
          </span>
        </span>

        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1 ${pill}`}
        >
          {row.redacted && <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />}
          {kindLabel(row.kind)}
        </span>

        <span className="text-[13px] text-neutral-400 truncate flex-1 min-w-0">{row.subject}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-neutral-600">To</dt>
            <dd className="text-neutral-300 break-all">{row.toEmail}</dd>
            {row.userRole && (
              <>
                <dt className="text-neutral-600">Role</dt>
                <dd className="text-neutral-300">{row.userRole}</dd>
              </>
            )}
            {row.agencyName && (
              <>
                <dt className="text-neutral-600">Agency</dt>
                <dd className="text-neutral-300">{row.agencyName}</dd>
              </>
            )}
            {row.txAddress && (
              <>
                <dt className="text-neutral-600">File</dt>
                <dd className="text-neutral-300">{row.txAddress}</dd>
              </>
            )}
            <dt className="text-neutral-600">Subject</dt>
            <dd className="text-neutral-200">{row.subject}</dd>
          </dl>

          {row.redacted ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[12px] text-neutral-500">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
              Body not stored — this email carries a live reset link, so we keep only the recipient
              and subject.
            </div>
          ) : row.html ? (
            <div className="rounded-lg overflow-hidden border border-neutral-800 bg-white">
              <iframe
                title={`Email to ${row.toEmail}`}
                sandbox=""
                srcDoc={row.html}
                className="w-full h-[420px] bg-white"
              />
            </div>
          ) : row.text ? (
            <pre className="rounded-lg bg-neutral-950 border border-neutral-800 p-3 text-[12px] text-neutral-300 whitespace-pre-wrap break-words font-mono">
              {row.text}
            </pre>
          ) : (
            <p className="text-[12px] text-neutral-600">No body recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}
