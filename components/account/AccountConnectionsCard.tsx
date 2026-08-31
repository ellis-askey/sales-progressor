"use client";

// components/account/AccountConnectionsCard.tsx
//
// Agent Account > Connections. A director or negotiator connects their own
// email inbox (Microsoft Outlook) so replies from solicitors and clients that
// relate to their sales are matched to the file. Light Account-area chrome (not
// the Command Centre dark card, per Law 9). Reuses the same
// status/connect/sync/disconnect APIs; the connect + callback routes now return
// agency users here rather than to the superadmin page. A consent tick gates the
// connect action: editing the Privacy Policy does not re-prompt existing users,
// so this is where affirmative consent for mailbox reading is captured.

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { EnvelopeSimple, CheckCircle, ArrowClockwise, Warning } from "@phosphor-icons/react";

type Connection = { id: string; email: string; displayName: string | null };
type Status = { configured: boolean; connections: Connection[] };

const REASON_COPY: Record<string, string> = {
  not_configured: "Email connection isn't switched on yet. Please check back soon.",
  state: "We couldn't verify the connection. Please try again.",
  no_refresh_token: "Microsoft didn't grant the permissions we need. Please try again.",
  no_identity: "We couldn't read your Microsoft account details. Please try again.",
  exchange: "We couldn't finish connecting with Microsoft. Please try again.",
  access_denied: "The connection was cancelled.",
};

const CORAL = "var(--agent-coral, #FF6B4A)";

export function AccountConnectionsCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncedId, setSyncedId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const outcome = params.get("outlook");
  const reason = params.get("reason") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/outlook/status");
      if (res.ok) setStatus((await res.json()) as Status);
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
      router.replace("/agent/account/connections");
      await load();
    } finally {
      setRemovingId(null);
    }
  }

  async function syncNow(id: string) {
    setSyncingId(id);
    setSyncedId(null);
    try {
      const res = await fetch("/api/integrations/outlook/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });
      if (res.ok) setSyncedId(id);
    } finally {
      setSyncingId(null);
    }
  }

  const connections = status?.connections ?? [];
  const count = connections.length;

  const banner =
    outcome === "connected" ? (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
        <CheckCircle size={16} weight="fill" className="shrink-0" />
        Your inbox is connected.
      </div>
    ) : outcome === "error" ? (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
        <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
        <span>{REASON_COPY[reason] ?? "Something went wrong connecting your inbox. Please try again."}</span>
      </div>
    ) : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
          <EnvelopeSimple size={20} weight="bold" style={{ color: CORAL }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Microsoft Outlook</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                Connect the inbox where solicitors and clients email you, so their replies are saved to the
                right sale.
              </p>
            </div>
            {!loading && status && (
              <span
                className={
                  count > 0
                    ? "shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
                    : "shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500"
                }
              >
                {count > 0 ? `${count} connected` : "Not connected"}
              </span>
            )}
          </div>

          {banner && <div className="mt-3">{banner}</div>}

          <div className="mt-4">
            {loading ? (
              <p className="text-[13px] text-gray-500">Checking…</p>
            ) : !status?.configured ? (
              <p className="text-[13px] text-gray-500">
                Email connection isn&rsquo;t switched on yet. Please check back soon.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Connected inboxes */}
                {count > 0 && (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {connections.map((c) => (
                      <li key={c.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm text-gray-800">
                              <CheckCircle size={15} weight="fill" className="shrink-0 text-emerald-500" />
                              {c.email}
                            </p>
                            {c.displayName && (
                              <p className="truncate text-[12px] text-gray-500">{c.displayName}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => syncNow(c.id)}
                              disabled={syncingId === c.id}
                              className="pbtn pbtn-press inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <ArrowClockwise
                                size={14}
                                weight="bold"
                                className={syncingId === c.id ? "pbtn-spin" : ""}
                              />
                              {syncingId === c.id ? "Checking…" : "Check now"}
                            </button>
                            <button
                              onClick={() => disconnect(c.id)}
                              disabled={removingId === c.id}
                              className="pbtn pbtn-press rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {removingId === c.id ? "Removing…" : "Disconnect"}
                            </button>
                          </div>
                        </div>
                        {syncedId === c.id && (
                          <p className="mt-2 text-[12px] text-emerald-700">
                            Inbox checked. Any matching emails have been saved to their files.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Consent + connect */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--agent-coral,#FF6B4A)]"
                    />
                    <span className="text-[12.5px] leading-relaxed text-gray-600">
                      I agree that Sales Progressor can read emails relating to my sales and send emails on my
                      behalf, as set out in the <Link href="/privacy" className="underline" style={{ color: CORAL }}>Privacy Policy</Link>. I can disconnect at any time.
                    </span>
                  </label>
                  <button
                    onClick={() => { window.location.href = "/api/integrations/outlook/connect"; }}
                    disabled={!consent}
                    className="pbtn pbtn-press pbtn-primary mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-45"
                    style={{ background: CORAL }}
                  >
                    <EnvelopeSimple size={16} weight="bold" />
                    {count > 0 ? "Connect another inbox" : "Connect my inbox"}
                  </button>
                </div>

                <p className="text-[11.5px] leading-relaxed text-gray-400">
                  We only save emails that match one of your sales. Nothing else in your inbox is stored, and
                  disconnecting stops all access.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
