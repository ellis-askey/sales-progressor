"use client";

// Command Centre → WhatsApp → Cloud conversation queues (Phase 2).
// Needs-assigning: new conversations the matching ladder wouldn't guess at —
// pick from the candidates (ambiguous sender) or search any sale (unknown
// sender). Assigned: the live mappings, each correctable or dismissible.
// Command Centre visual system (Law 9): dark, hairline, blue accent.

import { useState } from "react";
import {
  assignCloudThreadAction,
  ignoreCloudThreadAction,
  searchWhatsAppTargetsAction,
} from "@/app/actions/command-whatsapp";
import type { CloudThreadRow } from "@/lib/command/whatsapp-cloud";

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

function threadLabel(t: CloudThreadRow): string {
  if (t.displayName) return t.displayName;
  return t.kind === "group" ? "Group" : `+${t.waId}`;
}

const SIDES = ["BUYER", "SELLER"] as const;

function AssignControls({ thread, onDone }: { thread: CloudThreadRow; onDone: () => void }) {
  const [side, setSide] = useState<"BUYER" | "SELLER" | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; address: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(await searchWhatsAppTargetsAction(q));
  }

  async function assign(transactionId: string) {
    setBusy(true);
    setError(null);
    const res = await assignCloudThreadAction(thread.id, transactionId, side);
    setBusy(false);
    if (res.ok) onDone();
    else setError(res.error ?? "Failed.");
  }

  async function dismiss() {
    setBusy(true);
    const res = await ignoreCloudThreadAction(thread.id);
    setBusy(false);
    if (res.ok) onDone();
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-neutral-500 mr-1">Side:</span>
        {SIDES.map((s) => (
          <button
            key={s}
            onClick={() => setSide(side === s ? null : s)}
            className={
              side === s
                ? "text-[11px] font-semibold text-blue-300 border border-blue-800 bg-blue-950/50 rounded-full px-2.5 py-0.5"
                : "text-[11px] text-neutral-400 border border-neutral-700 rounded-full px-2.5 py-0.5 hover:border-neutral-500"
            }
          >
            {s === "BUYER" ? "Buyer" : "Seller"}
          </button>
        ))}
        <span className="text-[10.5px] text-neutral-600">(optional)</span>
      </div>

      {thread.candidates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {thread.candidates.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              onClick={() => assign(c.id)}
              className="text-[12px] text-neutral-200 border border-neutral-700 bg-neutral-800 hover:border-blue-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
            >
              {c.address}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search any sale by address…"
          className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-[12.5px] text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-blue-700 w-64"
        />
        <button onClick={dismiss} disabled={busy} className="text-[11.5px] text-neutral-500 hover:text-neutral-300 disabled:opacity-50">
          Not sales traffic — dismiss
        </button>
      </div>
      {results.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {results.map((r) => (
            <button
              key={r.id}
              disabled={busy}
              onClick={() => assign(r.id)}
              className="text-[12px] text-neutral-200 border border-neutral-700 bg-neutral-800 hover:border-blue-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
            >
              {r.address}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[11.5px] text-red-400">{error}</p>}
    </div>
  );
}

export function WhatsAppCloudThreads({ needsAssigning, assigned }: { needsAssigning: CloudThreadRow[]; assigned: CloudThreadRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [reassignId, setReassignId] = useState<string | null>(null);
  if (needsAssigning.length === 0 && assigned.length === 0) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-neutral-300">
          Cloud conversations — needs assigning <span className="text-neutral-600">({needsAssigning.length})</span>
        </h3>
        {needsAssigning.length === 0 ? (
          <p className="mt-1.5 text-[12px] text-neutral-500">Nothing waiting. New unknown or ambiguous senders appear here instead of being guessed.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {needsAssigning.map((t) => (
              <div key={t.id} className="border border-neutral-800 rounded-lg px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-[13px] font-medium text-neutral-200">{threadLabel(t)}</span>
                    {t.displayName && <span className="ml-2 text-[11px] text-neutral-500">+{t.waId}</span>}
                    {t.candidates.length > 0 && (
                      <span className="ml-2 text-[10.5px] font-semibold uppercase tracking-wide text-amber-400">on {t.candidates.length} sales</span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500">{fmtWhen(t.lastInboundAt)}</span>
                </div>
                {t.lastPreview && <p className="mt-1 text-[12px] text-neutral-400 truncate">{t.lastPreview}</p>}
                {openId === t.id ? (
                  <AssignControls thread={t} onDone={() => setOpenId(null)} />
                ) : (
                  <button onClick={() => setOpenId(t.id)} className="mt-1.5 text-[12px] font-semibold text-blue-400 hover:text-blue-300">
                    Assign to a sale →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {assigned.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-300">
            Mapped conversations <span className="text-neutral-600">({assigned.length})</span>
          </h3>
          <div className="mt-2 space-y-1.5">
            {assigned.map((t) => (
              <div key={t.id} className="border border-neutral-800 rounded-lg px-3 py-2">
                <div className="flex items-baseline justify-between gap-3 flex-wrap text-[12.5px]">
                  <span className="min-w-0 text-neutral-300">
                    {threadLabel(t)} <span className="text-neutral-600">→</span>{" "}
                    <span className="text-neutral-200">{t.transactionAddress ?? "?"}</span>
                    {t.side && <span className="ml-1.5 text-[10.5px] font-semibold uppercase text-neutral-500">{t.side.toLowerCase()}</span>}
                    <span className="ml-1.5 text-[10.5px] text-neutral-600">{t.assignmentState === "auto" ? "auto-matched" : "assigned"}</span>
                  </span>
                  <button onClick={() => setReassignId(reassignId === t.id ? null : t.id)} className="text-[11.5px] text-neutral-500 hover:text-blue-300 shrink-0">
                    {reassignId === t.id ? "Cancel" : "Reassign"}
                  </button>
                </div>
                {reassignId === t.id && <AssignControls thread={t} onDone={() => setReassignId(null)} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
