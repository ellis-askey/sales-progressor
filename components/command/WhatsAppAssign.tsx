"use client";

import { useState, useTransition } from "react";
import type { UnmatchedChat } from "@/lib/command/whatsapp";
import { assignWhatsAppChatAction, searchWhatsAppTargetsAction } from "@/app/actions/command-whatsapp";

type Side = "BUYER" | "SELLER";

// One unmatched conversation. Pick a suggested property (or search), choose the
// side, and assign the WHOLE chat — every held message replays onto the file and
// future messages follow automatically.
export function WhatsAppAssign({ chat }: { chat: UnmatchedChat }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; address: string; status: string }[]>([]);
  const [searching, startSearch] = useTransition();

  function assign(transactionId: string, address: string, side: Side) {
    startTransition(async () => {
      await assignWhatsAppChatAction(chat.waChatId, transactionId, side);
      setDone(`${address} · ${side === "SELLER" ? "Seller" : "Buyer"}`);
    });
  }

  function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => setResults(await searchWhatsAppTargetsAction(q)));
  }

  if (done) {
    return (
      <div className="bg-neutral-900 border border-[#2c5a3f] rounded-xl px-4 py-3 text-[13px] text-[#6ee7b7]">
        Assigned <span className="font-medium">{chat.title}</span> → {done}. Its messages are now on the file.
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-neutral-800 text-neutral-400 border-neutral-700">
              {chat.isGroup ? "Group" : "Direct"}
            </span>
            <span className="text-[13px] font-medium text-neutral-200 truncate">{chat.title}</span>
          </div>
          {chat.lastBody && (
            <p className="mt-1 text-[12px] text-neutral-500 truncate">{chat.lastBody}</p>
          )}
        </div>
        <span className="text-[11px] text-neutral-600 shrink-0 tabular-nums">
          {chat.count} msg{chat.count === 1 ? "" : "s"}
        </span>
      </div>

      {/* Suggested matches */}
      {chat.candidates.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {chat.candidates.map((c) => (
            <button
              key={`${c.id}-${c.side}`}
              type="button"
              disabled={pending}
              onClick={() => assign(c.id, c.address, c.side)}
              className="text-left text-[12px] px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800/60 transition-colors disabled:opacity-50"
            >
              Assign to <span className="text-neutral-100">{c.address}</span>{" "}
              <span className="text-neutral-500">· {c.side === "SELLER" ? "Seller" : "Buyer"}</span>
            </button>
          ))}
        </div>
      )}

      {/* Manual search */}
      <div className="mt-3">
        <input
          type="text"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder={chat.candidates.length ? "Or search another property…" : "Search a property to assign…"}
          className="w-full px-2.5 py-1.5 text-[12px] rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
        />
        {searching && <p className="mt-1 text-[11px] text-neutral-600">Searching…</p>}
        {results.map((r) => (
          <div key={r.id} className="mt-1.5 flex items-center gap-2">
            <span className="flex-1 text-[12px] text-neutral-300 truncate">
              {r.address} <span className="text-neutral-600">({r.status})</span>
            </span>
            <button type="button" disabled={pending} onClick={() => assign(r.id, r.address, "SELLER")}
              className="text-[11px] px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800/60 disabled:opacity-50">
              Seller
            </button>
            <button type="button" disabled={pending} onClick={() => assign(r.id, r.address, "BUYER")}
              className="text-[11px] px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800/60 disabled:opacity-50">
              Buyer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
