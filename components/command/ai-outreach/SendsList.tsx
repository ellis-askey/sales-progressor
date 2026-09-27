"use client";

import { useEffect, useState } from "react";
import { getSendEmailHtmlAction } from "@/app/actions/outreach";

// The Sends results-lab list + the click-to-view email popup. The popup animates
// up from the bottom and loads the email's exact rendered HTML into an isolated
// (scriptless) iframe on a white background — the email as the recipient saw it.
export type SendDisplayRow = {
  key: string;
  emailId: string | null;
  stepId: string | null;
  agencyName: string;
  contactName: string | null;
  toEmail: string | null;
  campaignTitle: string | null;
  stepLabel: string | null;
  subject: string | null;
  status: string;
  whenLabel: string;
  upcoming: boolean;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-neutral-800 text-neutral-300" },
  queued: { label: "Sending soon", cls: "bg-blue-950 text-blue-300 border border-blue-900" },
  sent: { label: "Sent", cls: "bg-neutral-800 text-neutral-300" },
  delivered: { label: "Delivered", cls: "bg-emerald-950 text-emerald-400 border border-emerald-900" },
  opened: { label: "Opened", cls: "bg-emerald-950 text-emerald-300 border border-emerald-900" },
  clicked: { label: "Clicked", cls: "bg-emerald-900 text-emerald-200 border border-emerald-800" },
  bounced: { label: "Bounced", cls: "bg-red-950 text-red-400 border border-red-900" },
  replied: { label: "Replied", cls: "bg-amber-950 text-amber-300 border border-amber-900" },
  skipped: { label: "Skipped", cls: "bg-neutral-800 text-neutral-500" },
  failed: { label: "Failed", cls: "bg-red-950 text-red-400 border border-red-900" },
};

export function SendsList({ rows }: { rows: SendDisplayRow[] }) {
  const [open, setOpen] = useState<SendDisplayRow | null>(null);
  return (
    <>
      <div className="rounded-lg border border-neutral-800 divide-y divide-neutral-800/70 overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-neutral-600">No emails match this filter yet.</p>
        ) : (
          rows.map((r) => {
            const s = STATUS[r.status] ?? STATUS.sent;
            return (
              <button key={r.key} onClick={() => setOpen(r)} className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-neutral-900/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-neutral-200 truncate">
                    {r.agencyName}
                    {r.contactName ? <span className="text-neutral-600"> · {r.contactName}</span> : null}
                  </div>
                  <div className="text-[10.5px] text-neutral-600 truncate">
                    {r.campaignTitle ?? "Manual"}
                    {r.stepLabel ? ` · ${r.stepLabel}` : ""}
                    {r.subject ? ` · ${r.subject}` : ""}
                  </div>
                </div>
                <span className="text-[10.5px] text-neutral-500 whitespace-nowrap tabular-nums">{r.whenLabel}</span>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${s.cls}`}>{s.label}</span>
              </button>
            );
          })
        )}
      </div>
      {open && <EmailModal row={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function EmailModal({ row, onClose }: { row: SendDisplayRow; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(true);
    let live = true;
    getSendEmailHtmlAction({ emailId: row.emailId, stepId: row.stepId }).then((res) => {
      if (!live) return;
      if ("ok" in res && res.ok) setHtml(res.html);
      else setErr("error" in res ? res.error : "Could not load this email.");
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; window.removeEventListener("keydown", onKey); };
  }, [row, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-2xl bg-neutral-950 border border-neutral-800 rounded-t-2xl sm:rounded-2xl shadow-2xl transition-all duration-200 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-800">
          <div className="min-w-0">
            <div className="text-[13px] text-neutral-100 font-medium truncate">{row.subject ?? "(no subject)"}</div>
            <div className="text-[10.5px] text-neutral-600 truncate">
              To {row.toEmail ?? "—"}
              {row.campaignTitle ? ` · ${row.campaignTitle}` : ""}
              {row.stepLabel ? ` · ${row.stepLabel}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 text-[13px] shrink-0">Close</button>
        </div>
        <div className="p-3">
          {err ? (
            <p className="px-2 py-8 text-center text-[12px] text-red-400">{err}</p>
          ) : html === null ? (
            <p className="px-2 py-8 text-center text-[12px] text-neutral-600">Loading the email…</p>
          ) : (
            <iframe title="email" srcDoc={html} sandbox="" className="w-full h-[58vh] bg-white rounded-lg border border-neutral-800" />
          )}
        </div>
      </div>
    </div>
  );
}
