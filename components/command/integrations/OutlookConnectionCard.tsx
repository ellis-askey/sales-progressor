"use client";

// components/command/integrations/OutlookConnectionCard.tsx
//
// Command Centre → Settings → Connections. Microsoft Outlook mailboxes (dark
// register). Shows a roster of the addresses we send from (each agency's
// sending address + the Sales Progressor mailbox), each with its own
// Connect/Connected state, so it's obvious at a glance which are done. Any
// mailbox connected that isn't on the roster is listed separately, and a
// generic "Add another mailbox" covers anything else.

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, CheckCircle2, AlertTriangle, Loader2, Plus } from "lucide-react";

type Connection = { id: string; email: string; displayName: string | null };
type RosterEntry = { label: string; email: string };

type Status = {
  configured: boolean;
  connections: Connection[];
  roster: RosterEntry[];
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

const connectHref = (email?: string) =>
  email
    ? `/api/integrations/outlook/connect?email=${encodeURIComponent(email)}`
    : "/api/integrations/outlook/connect";

export function OutlookConnectionCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const outcome = params.get("outlook");
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
  const roster = status?.roster ?? [];
  const count = connections.length;

  // email (lowercased) -> connection
  const byEmail = new Map(connections.map((c) => [c.email.toLowerCase(), c]));
  const rosterEmails = new Set(roster.map((r) => r.email.toLowerCase()));
  const extras = connections.filter((c) => !rosterEmails.has(c.email.toLowerCase()));

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

  const disconnectBtn = (id: string) => (
    <button
      onClick={() => disconnect(id)}
      disabled={removingId === id}
      className="shrink-0 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-[12.5px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-700 disabled:opacity-50"
    >
      {removingId === id ? "Removing…" : "Disconnect"}
    </button>
  );

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
                Connect each address we send from, so its emails can be linked to the right property
                file.
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
            ) : (
              <div className="space-y-4">
                {/* Roster: one row per address we send from */}
                {roster.length > 0 && (
                  <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
                    {roster.map((entry) => {
                      const conn = byEmail.get(entry.email.toLowerCase());
                      return (
                        <li
                          key={entry.email}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-neutral-200">{entry.label}</p>
                            <p className="truncate text-[12px] text-neutral-500">{entry.email}</p>
                          </div>
                          {conn ? (
                            <div className="flex shrink-0 items-center gap-2.5">
                              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Connected
                              </span>
                              {disconnectBtn(conn.id)}
                            </div>
                          ) : (
                            <a
                              href={connectHref(entry.email)}
                              className="shrink-0 rounded-lg bg-blue-600 px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-blue-500"
                            >
                              Connect
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Any connected mailbox that isn't on the roster */}
                {extras.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      Other connected mailboxes
                    </p>
                    <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
                      {extras.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-neutral-200">{c.email}</p>
                            {c.displayName && (
                              <p className="truncate text-[12px] text-neutral-500">{c.displayName}</p>
                            )}
                          </div>
                          {disconnectBtn(c.id)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Generic: connect a mailbox not listed above */}
                <a
                  href={connectHref()}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-[13px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-700"
                >
                  <Plus className="h-4 w-4" />
                  Add another mailbox
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
