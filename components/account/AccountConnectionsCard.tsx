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
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { EnvelopeSimple, CheckCircle, ArrowClockwise } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Button } from "@/components/arc/button/button";

type Connection = { id: string; email: string; displayName: string | null };
type Status = { configured: boolean; connections: Connection[] };

const REASON_COPY: Record<string, string> = {
  not_configured: "Email connections aren't available yet. Please check back soon.",
  state: "We couldn't verify the connection. Please try again.",
  no_refresh_token: "Microsoft didn't give us the permissions we need. Please try again.",
  no_identity: "We couldn't access your Microsoft account details. Please try again.",
  exchange: "We couldn't finish connecting your Microsoft account. Please try again.",
  access_denied: "The connection was cancelled.",
};

const CORAL = "var(--agent-coral, #FF6B4A)";
const coralPrimary = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

export function AccountConnectionsCard() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
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
      router.replace(pathname);
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
      <InlineAlert kind="success">Your inbox is connected.</InlineAlert>
    ) : outcome === "error" ? (
      <InlineAlert kind="danger">{REASON_COPY[reason] ?? "Something went wrong while connecting your inbox. Please try again."}</InlineAlert>
    ) : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5 pr-8">
            <p className="text-sm font-semibold text-gray-900">Microsoft Outlook</p>
            {!loading && status && (
              <Badge tone={count > 0 ? "success" : "neutral"} caps={false}>
                {count > 0 ? `${count} connected` : "Not connected"}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">
            Connect Outlook to automatically save emails from solicitors and clients to the correct sale.
            Emails you send through Sales Progressor will come directly from your Outlook account and appear
            in your Sent Items.
          </p>

          {banner && <div className="mt-3">{banner}</div>}

          <div className="mt-4">
            {loading ? (
              <p className="text-[13px] text-gray-500">Checking…</p>
            ) : !status?.configured ? (
              <p className="text-[13px] text-gray-500">
                Email connections aren&rsquo;t available yet. Please check back soon.
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
                            <Button variant="secondary" size="sm" onClick={() => syncNow(c.id)} loading={syncingId === c.id}>
                              <ArrowClockwise size={14} weight="bold" />
                              Check now
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => disconnect(c.id)} loading={removingId === c.id}>
                              Disconnect
                            </Button>
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
                      I agree to Sales Progressor reading emails related to my sales and sending emails on my
                      behalf, as explained in the <Link href="/privacy" className="underline" style={{ color: CORAL }}>Privacy Policy</Link>. I can disconnect at any time.
                    </span>
                  </label>
                  <div className="mt-3">
                    <Button
                      variant="primary"
                      size="md"
                      style={coralPrimary}
                      onClick={() => { window.location.href = "/api/integrations/outlook/connect"; }}
                      disabled={!consent}
                    >
                      <EnvelopeSimple size={16} weight="bold" />
                      {count > 0 ? "Connect another inbox" : "Connect my inbox"}
                    </Button>
                  </div>
                </div>

                <p className="text-[11.5px] leading-relaxed text-gray-400">
                  We only save emails that match your sales. Other inbox messages aren&rsquo;t stored, and
                  disconnecting stops further access.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
