"use client";

import { useState, useTransition } from "react";
import type { AssignedChat } from "@/lib/command/whatsapp";
import {
  reassignWhatsAppChatAction,
  unassignWhatsAppChatAction,
  searchWhatsAppTargetsAction,
} from "@/app/actions/command-whatsapp";

type Side = "BUYER" | "SELLER";

// One assigned conversation, with controls to fix a mistake: reassign it (moves
// the chat and its messages to another file) or unassign it (stop capturing;
// future messages return to the queue).
function AssignedRow({ chat }: { chat: AssignedChat }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "moved" | "stopped">("idle");
  const [showMove, setShowMove] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; address: string; status: string }[]>([]);
  const [searching, startSearch] = useTransition();

  function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => setResults(await searchWhatsAppTargetsAction(q)));
  }

  function reassign(transactionId: string, side: Side) {
    startTransition(async () => {
      await reassignWhatsAppChatAction(chat.waChatId, transactionId, side);
      setState("moved");
    });
  }

  function unassign() {
    startTransition(async () => {
      await unassignWhatsAppChatAction(chat.waChatId);
      setState("stopped");
    });
  }

  if (state === "moved") {
    return (
      <div className="bg-neutral-900 border border-[#2c5a3f] rounded-xl px-4 py-3 text-[13px] text-[#6ee7b7]">
        Moved this chat and its messages to the new file.
      </div>
    );
  }
  if (state === "stopped") {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-[13px] text-neutral-500">
        Stopped capturing. Future messages will return to the queue; existing ones stay on the file.
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-neutral-200 truncate">{chat.address}</div>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            {chat.side === "SELLER" ? "Seller" : "Buyer"} side · {chat.matchMethod === "manual" ? "assigned by hand" : "auto-matched"}
          </p>
        </div>
        <span className="text-[11px] text-neutral-600 shrink-0 tabular-nums">
          {chat.messageCount} msg{chat.messageCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowMove((v) => !v)}
          className="text-[12px] px-2.5 py-1 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800/60 transition-colors"
        >
          Move to another file
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={unassign}
          className="text-[12px] text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
        >
          Stop capturing
        </button>
      </div>

      {showMove && (
        <div className="mt-3">
          <input
            type="text"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search the correct property…"
            className="w-full px-2.5 py-1.5 text-[12px] rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
          {searching && <p className="mt-1 text-[11px] text-neutral-600">Searching…</p>}
          {results.map((r) => (
            <div key={r.id} className="mt-1.5 flex items-center gap-2">
              <span className="flex-1 text-[12px] text-neutral-300 truncate">
                {r.address} <span className="text-neutral-600">({r.status})</span>
              </span>
              <button type="button" disabled={pending} onClick={() => reassign(r.id, "SELLER")}
                className="text-[11px] px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800/60 disabled:opacity-50">
                Seller
              </button>
              <button type="button" disabled={pending} onClick={() => reassign(r.id, "BUYER")}
                className="text-[11px] px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800/60 disabled:opacity-50">
                Buyer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WhatsAppAssignedList({ chats }: { chats: AssignedChat[] }) {
  if (chats.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-6 text-center text-[13px] text-neutral-500">
        No chats assigned yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {chats.map((c) => (
        <AssignedRow key={c.waChatId} chat={c} />
      ))}
    </div>
  );
}
