"use client";

// components/account/ImapConnectionCard.tsx
//
// Agent Account > Connections. The "any other email" path: a director or
// negotiator connects a Gmail / Yahoo / iCloud / custom-domain mailbox over IMAP
// with an app-password, so inbound replies that relate to their sales are matched
// to the file — the same engine Outlook uses. Light Account chrome (Law 9),
// mirroring AccountConnectionsCard. Talks only to the agent-scoped
// /api/integrations/imap/* routes; the app-password never comes back to the client.
//
// Provider hints (help link + note + whether we need manual server details) come
// from the shared, pure lib/integrations/imap/config, so there's one source of
// truth for provider settings across client and server.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopeSimple, CheckCircle, ArrowClockwise, Warning, Info, PaperPlaneTilt } from "@phosphor-icons/react";
import { presetForEmail } from "@/lib/integrations/imap/config";

type Connection = {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  host: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  sendEnabled: boolean;
  sendAvailable: boolean;
  smtpLastError: string | null;
};
type Status = { configured: boolean; connections: Connection[] };

const CORAL = "var(--agent-coral, #FF6B4A)";

function providerLabel(p: string): string {
  const map: Record<string, string> = { gmail: "Gmail", outlook: "Outlook.com", yahoo: "Yahoo", icloud: "iCloud", aol: "AOL", zoho: "Zoho Mail", imap: "Email" };
  return map[p] ?? "Email";
}

export function ImapConnectionCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ id: string; text: string } | null>(null);

  // Connect form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [enableSend, setEnableSend] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("993");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Per-connection send toggle
  const [sendTogglingId, setSendTogglingId] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<{ id: string; text: string; isError: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/imap/status");
      if (res.ok) setStatus((await res.json()) as Status);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const preset = email.includes("@") ? presetForEmail(email) : null;
  const knownProvider = !!preset;
  const unknownButTyped = email.includes("@") && !preset;
  // For an unrecognised provider we need manual server details.
  const needServerDetails = unknownButTyped || showAdvanced;
  // Sending needs a known SMTP server, so the offer only appears for presets
  // that carry one. Unknown providers connect receive-only.
  const canOfferSend = !!preset?.smtpHost;

  async function connect() {
    setError(null);
    setNotice(null);
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/imap/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          consent,
          host: needServerDetails && host ? host : undefined,
          port: needServerDetails && port ? Number(port) : undefined,
          secure: needServerDetails ? Number(port) === 993 : undefined,
          enableSend: canOfferSend && enableSend,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; sendError?: string };
      if (res.ok && data.ok) {
        setEmail("");
        setPassword("");
        setConsent(false);
        setShowAdvanced(false);
        setHost("");
        setPort("993");
        if (data.sendError) {
          setNotice(`Your inbox is connected for receiving, but we couldn't switch on sending. ${data.sendError}`);
        }
        await load();
      } else {
        setError(data.error ?? "We couldn't connect that mailbox. Please try again.");
        // If the server didn't recognise the provider, reveal the manual fields.
        if ((data.error ?? "").toLowerCase().includes("mail server")) setShowAdvanced(true);
      }
    } catch {
      setError("We couldn't connect that mailbox. Please try again.");
    } finally {
      setConnecting(false);
    }
  }

  async function syncNow(id: string) {
    setSyncingId(id);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/integrations/imap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; summary?: { logged: unknown[]; checked: number } };
      if (res.ok && data.ok && data.summary) {
        const n = data.summary.logged.length;
        setSyncMsg({ id, text: n > 0 ? `Saved ${n} matching email${n === 1 ? "" : "s"} to their files.` : "Checked. No new matching emails." });
      } else {
        setSyncMsg({ id, text: "We couldn't check that inbox just now. Please try again." });
      }
      await load();
    } finally {
      setSyncingId(null);
    }
  }

  async function toggleSend(id: string, enable: boolean) {
    setSendTogglingId(id);
    setSendMsg(null);
    try {
      const res = await fetch("/api/integrations/imap/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enable }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setSendMsg(
          enable
            ? { id, text: "Sending is on. We've emailed this inbox so you can see it working.", isError: false }
            : { id, text: "Sending is off. We still read this inbox as before.", isError: false }
        );
      } else {
        setSendMsg({ id, text: data.error ?? "We couldn't update sending for this inbox. Please try again.", isError: true });
      }
      await load();
    } finally {
      setSendTogglingId(null);
    }
  }

  async function disconnect(id: string) {
    setRemovingId(id);
    try {
      await fetch("/api/integrations/imap/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setRemovingId(null);
    }
  }

  const connections = status?.connections ?? [];
  const count = connections.length;
  const canConnect = consent && email.includes("@") && password.length > 0 && (!needServerDetails || host.length > 0) && !connecting;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
          <EnvelopeSimple size={20} weight="bold" style={{ color: CORAL }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Gmail &amp; other email</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                On Gmail, Yahoo, iCloud, Zoho or your own domain? Connect it here with an app-password. For providers we
                recognise, we can send your emails from this address too.
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

          <div className="mt-4">
            {loading ? (
              <p className="text-[13px] text-gray-500">Checking…</p>
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
                              <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                                {providerLabel(c.provider)}
                              </span>
                              {c.sendEnabled && (
                                <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                  Sends
                                </span>
                              )}
                            </p>
                            {c.lastError ? (
                              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-red-600">
                                <Warning size={13} weight="fill" className="shrink-0" />
                                {c.lastError} Reconnect to fix.
                              </p>
                            ) : (
                              <p className="truncate text-[12px] text-gray-500">
                                {c.lastSyncedAt ? `Last checked ${new Date(c.lastSyncedAt).toLocaleString("en-GB")}` : "Not checked yet"}
                              </p>
                            )}
                            {c.smtpLastError && (
                              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-red-600">
                                <Warning size={13} weight="fill" className="shrink-0" />
                                {c.smtpLastError}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {c.sendAvailable && (
                              <button
                                onClick={() => toggleSend(c.id, !c.sendEnabled)}
                                disabled={sendTogglingId === c.id}
                                className="pbtn pbtn-press inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <PaperPlaneTilt size={14} weight="bold" className={sendTogglingId === c.id ? "pbtn-spin" : ""} />
                                {sendTogglingId === c.id ? "Updating…" : c.sendEnabled ? "Turn off sending" : "Turn on sending"}
                              </button>
                            )}
                            <button
                              onClick={() => syncNow(c.id)}
                              disabled={syncingId === c.id}
                              className="pbtn pbtn-press inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <ArrowClockwise size={14} weight="bold" className={syncingId === c.id ? "pbtn-spin" : ""} />
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
                        {syncMsg?.id === c.id && <p className="mt-2 text-[12px] text-emerald-700">{syncMsg.text}</p>}
                        {sendMsg?.id === c.id && (
                          <p className={`mt-2 text-[12px] ${sendMsg.isError ? "text-red-600" : "text-emerald-700"}`}>{sendMsg.text}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Connect form */}
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3.5">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-medium text-gray-600">Email address</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.trim())}
                        placeholder="you@youragency.co.uk"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[color:var(--agent-coral,#FF6B4A)]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-medium text-gray-600">App-password</span>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="app-password (not your normal password)"
                        autoComplete="off"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[color:var(--agent-coral,#FF6B4A)]"
                      />
                    </label>
                  </div>

                  {/* Provider hint */}
                  {knownProvider && (
                    <p className="flex items-start gap-1.5 text-[12px] text-gray-600">
                      <Info size={14} weight="fill" className="mt-0.5 shrink-0 text-gray-400" />
                      <span>
                        {preset?.note ?? `Detected ${preset?.label}.`}{" "}
                        {preset?.appPasswordUrl && (
                          <a href={preset.appPasswordUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: CORAL }}>
                            Create an app-password
                          </a>
                        )}
                      </span>
                    </p>
                  )}

                  {/* Manual server details for unrecognised providers */}
                  {needServerDetails && (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-medium text-gray-600">IMAP server (host)</span>
                        <input
                          type="text"
                          value={host}
                          onChange={(e) => setHost(e.target.value.trim())}
                          placeholder="imap.youragency.co.uk"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[color:var(--agent-coral,#FF6B4A)]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-medium text-gray-600">Port</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={port}
                          onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="993"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[color:var(--agent-coral,#FF6B4A)]"
                        />
                      </label>
                      {unknownButTyped && (
                        <p className="text-[11.5px] text-gray-500 sm:col-span-2">
                          We don&rsquo;t recognise this provider, so add its IMAP server details. Your email host or IT can confirm these. Most use port 993.
                        </p>
                      )}
                    </div>
                  )}

                  {!needServerDetails && email.includes("@") && (
                    <button type="button" onClick={() => setShowAdvanced(true)} className="text-[11.5px] text-gray-500 underline">
                      Enter server details manually
                    </button>
                  )}

                  {canOfferSend && (
                    <label className="flex items-start gap-2.5 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={enableSend}
                        onChange={(e) => setEnableSend(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--agent-coral,#FF6B4A)]"
                      />
                      <span className="text-[12.5px] leading-relaxed text-gray-600">
                        Also send my emails from this address. Emails we send on your files go out through your own mailbox, sit in
                        its Sent folder, and replies come straight back to you.
                      </span>
                    </label>
                  )}

                  <label className="flex items-start gap-2.5 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--agent-coral,#FF6B4A)]"
                    />
                    <span className="text-[12.5px] leading-relaxed text-gray-600">
                      I agree that Sales Progressor can read emails relating to my sales, as set out in the{" "}
                      <Link href="/privacy" className="underline" style={{ color: CORAL }}>Privacy Policy</Link>. I can disconnect at any time.
                    </span>
                  </label>

                  {error && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
                      <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
                      {error}
                    </p>
                  )}

                  {notice && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
                      <Info size={15} weight="fill" className="mt-0.5 shrink-0" />
                      {notice}
                    </p>
                  )}

                  <button
                    onClick={connect}
                    disabled={!canConnect}
                    className="pbtn pbtn-press pbtn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-45"
                    style={{ background: CORAL }}
                  >
                    <EnvelopeSimple size={16} weight="bold" />
                    {connecting ? "Connecting…" : count > 0 ? "Connect another inbox" : "Connect my inbox"}
                  </button>
                </div>

                <p className="text-[11.5px] leading-relaxed text-gray-400">
                  We only save emails that match one of your sales. Nothing else in your inbox is stored, and disconnecting stops all access.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
