"use client";

import { useState } from "react";
import { sendAgentSupportEmailAction } from "@/app/actions/agent-support-email";
import { extractFirstName } from "@/lib/contacts/displayName";

// Per-agent "offer help" button in the Command Centre agents view. Two-step so a
// support email can never go out on a stray click: first press asks to confirm,
// second sends. Shows Sent (or an error) after.
export function AgentHelpButton({ userId, name }: { userId: string; name: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const first = extractFirstName(name ?? "") || "this agent";

  async function send() {
    setState("sending");
    setError(null);
    const res = await sendAgentSupportEmailAction(userId);
    if (res.ok) setState("sent");
    else {
      setError(res.error);
      setState("error");
    }
  }

  if (state === "sent") {
    return <span className="text-[11px] font-medium text-emerald-400">Sent ✓</span>;
  }

  if (state === "confirm" || state === "sending") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <button
          type="button"
          disabled={state === "sending"}
          onClick={send}
          className="text-[11px] font-semibold px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {state === "sending" ? "Sending…" : `Email ${first}`}
        </button>
        {state === "confirm" && (
          <button
            type="button"
            onClick={() => setState("idle")}
            className="text-[11px] text-neutral-500 hover:text-neutral-300"
          >
            Cancel
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <button
        type="button"
        onClick={() => setState("confirm")}
        className="text-[11px] font-medium px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors"
      >
        Offer help
      </button>
      {state === "error" && <span className="text-[10.5px] text-red-400">{error}</span>}
    </span>
  );
}
