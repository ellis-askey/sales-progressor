"use client";

// components/command/integrations/OutlookConnectionCard.tsx
//
// Command Centre → Settings → Connections. Microsoft Outlook mailboxes (dark
// register). A user can connect several mailboxes (one per agency domain).
// Reads the list from /api/integrations/outlook/status on mount and reflects
// the ?outlook=connected|error flag the callback sets. Connect/Add is a
// full-page navigation into the OAuth redirect flow.

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, CheckCircle2, AlertTriangle, Loader2, Plus } from "lucide-react";

type Connection = {
  id: string;
  email: string;
  displayName: string | null;
};

type Status = {
  configured: boolean;
  connections: Connection[];
};

const REASON_COPY: Record<string, string> = {
  not_configured:
    "Outlook isn't configured yet. Add the Microsoft environment variables in Vercel and redeploy.",
  state: "The connection couldn't be verified. Please try again.",
  no_refresh_token: "Microsoft didn't grant the expected permissions. Please try again.",
  no_identity: "We couldn't read your Microsoft account details. Please try again.",
  exchange: "We couldn't complete the connection with Microsoft. Please try again.",
  access_denied: "The connection was cancelled.",
};

export function OutlookConnectionCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const outcome = params.get("outlook"); // "connected" | "error" | null
  const reason = params.get("reason") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/outlook/status");
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function disconnect(id: string) {
    setRemovingId(id);
    try {
      await fetch("/api/integrations/outlook/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.replace("/command/settings/connections");
      await load();
    } finally {
      setRemovingId(null);
    }
  }

  const connections = status?.connections ?? [];
  const count = connections.length;

  const banner =
    outcome === "connected" ? (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-[13px] text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Mailbox connected.
      </div>
    ) : outcome === "error" ? (
      <div className="flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[13px] text-red-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{REASON_COPY[reason] ?? "Something went wrong connecting Outlook. Please try again."}</span>
      </div>
    ) : null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950">
          <Mail className="h-5 w-5 text-blue-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-100">Microsoft Outlook</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500">
                Connect a mailbox so its emails can be linked to the right property file. Add one
                per agency address.
              </p>
            </div>

            {!loading && status && (
              <span
                className={
                  count > 0
                    ? "shrink-0 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300"
                    : "shrink-0 rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400"
                }
              >
                {count > 0 ? `${count} connected` : "Not connected"}
              </span>
            )}
          </div>

          {banner && <div className="mt-3">{banner}</div>}

          <div className="mt-4">
            {loading ? (
              <div className="flex items-center gap-2 text-[13px] text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking…
              </div>
            ) : !status?.configured ? (
              <p className="text-[13px] text-neutral-500">
                Not configured yet. Add the Microsoft environment variables in Vercel, then reload
                this page.
              </p>
            ) : count === 0 ? (
              <a
                href="/api/integrations/outlook/connect"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500"
              >
                <Mail className="h-4 w-4" />
                Connect Outlook
              </a>
            ) : (
              <div className="space-y-2">
                {/* Connected mailboxes */}
                <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
                  {connections.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-neutral-200">{c.email}</p>
                        {c.displayName && (
                          <p className="truncate text-[12px] text-neutral-500">{c.displayName}</p>
                        )}
                      </div>
                      <button
                        onClick={() => disconnect(c.id)}
                        disabled={removingId === c.id}
                        className="shrink-0 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-[12.5px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-700 disabled:opacity-50"
                      >
                        {removingId === c.id ? "Removing…" : "Disconnect"}
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Add another mailbox */}
                <a
                  href="/api/integrations/outlook/connect"
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-[13px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-700"
                >
                  <Plus className="h-4 w-4" />
                  Add mailbox
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
