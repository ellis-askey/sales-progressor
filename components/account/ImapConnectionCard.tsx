"use client";

// components/account/ImapConnectionCard.tsx
//
// Agent Account > Connections. The "any other email" path: a director or
// negotiator connects a mailbox over IMAP with an app-password, so inbound
// replies that relate to their sales are matched to the file — and, for
// providers we recognise, sends their emails from that address too via the
// provider's own SMTP server (the route for domains that can never be
// DNS-verified, e.g. eXp UK).
//
// Provider-first flow (2026-09-17 redesign): pick a tile (real brand marks,
// components/account/provider-logos.tsx), get that provider's exact
// app-password steps with a direct link, then two fields. The send option
// only renders where it's true (sendState from the status API — Law 13):
// it must be the agent's SIGN-IN address, and a DNS-verified domain already
// outranks a mailbox. Light Account chrome (Law 9); animation via the shared
// pbtn utilities + portal-fade-in (docs/reference/HOVER_STATES.md).

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { EnvelopeSimple, CheckCircle, ArrowClockwise, Warning, Info, PaperPlaneTilt } from "@phosphor-icons/react";
import { presetForEmail, type ImapProviderPreset } from "@/lib/integrations/imap/config";
import { GmailLogo, YahooLogo, ICloudLogo, ZohoLogo, ExpLogo, GenericMailLogo, ProviderLogo } from "./provider-logos";

type SendState = "sends" | "offer" | "domain_covered" | "not_sign_in" | "unavailable";
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
  sendState: SendState;
};
type SendsFrom = { address: string; via: "domain" | "mailbox" | "platform" };
type Status = {
  configured: boolean;
  connections: Connection[];
  userEmail: string | null;
  userDomainVerified: boolean;
  sendsFrom: SendsFrom;
};

const CORAL = "var(--agent-coral, #FF6B4A)";

function providerLabel(p: string, email?: string): string {
  if (email?.toLowerCase().endsWith("@expuk.com")) return "eXp UK";
  const map: Record<string, string> = { gmail: "Gmail", outlook: "Outlook.com", yahoo: "Yahoo", icloud: "iCloud", aol: "AOL", zoho: "Zoho Mail", imap: "Email" };
  return map[p] ?? "Email";
}

// ── Provider tiles ──────────────────────────────────────────────────────────
// Each tile carries a sample domain so the shared preset table stays the one
// source of provider truth; the guide copy is UI-only. Outlook has its own
// one-click card above this one, so it isn't a tile here.

type TileKey = "gmail" | "yahoo" | "icloud" | "zoho" | "exp" | "other";

type TileDef = {
  key: TileKey;
  label: string;
  sampleDomain: string | null; // null → manual server details
  placeholder: string;
  logo: (size: number) => ReactNode;
};

const TILES: TileDef[] = [
  { key: "gmail", label: "Gmail", sampleDomain: "gmail.com", placeholder: "you@gmail.com", logo: (s) => <GmailLogo size={s} /> },
  { key: "yahoo", label: "Yahoo", sampleDomain: "yahoo.com", placeholder: "you@yahoo.com", logo: (s) => <YahooLogo size={s} /> },
  { key: "icloud", label: "iCloud", sampleDomain: "icloud.com", placeholder: "you@icloud.com", logo: (s) => <ICloudLogo size={s} /> },
  { key: "zoho", label: "Zoho Mail", sampleDomain: "zoho.com", placeholder: "you@yourdomain.com", logo: (s) => <ZohoLogo size={s} /> },
  { key: "exp", label: "eXp UK", sampleDomain: "expuk.com", placeholder: "you@expuk.com", logo: (s) => <ExpLogo size={s} /> },
  { key: "other", label: "Other", sampleDomain: null, placeholder: "you@youragency.co.uk", logo: (s) => <GenericMailLogo size={s} /> },
];

// The tile a typed address belongs to, so typing auto-selects it.
function tileForEmail(email: string): TileKey | null {
  if (email.toLowerCase().endsWith("@expuk.com")) return "exp";
  const preset = presetForEmail(email);
  if (!preset) return null;
  if (preset.provider === "gmail") return "gmail";
  if (preset.provider === "yahoo") return "yahoo";
  if (preset.provider === "icloud") return "icloud";
  if (preset.provider === "zoho") return "zoho";
  return null; // outlook/aol presets: no tile, but the preset hint still shows
}

// ── Per-provider guide copy ─────────────────────────────────────────────────
// eXp strings approved by the founder 2026-09-17; the rest follow the same
// shape. Step 1's link target is the preset's appPasswordUrl.

type Guide = { title: string; subtitle?: string; steps: ReactNode[]; aside: string };

function guideFor(tile: TileKey, preset: ImapProviderPreset | null): Guide | null {
  const url = preset?.appPasswordUrl;
  const link = (label: string) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: CORAL }}>
        {label}
      </a>
    ) : (
      label
    );
  switch (tile) {
    case "exp":
      return {
        title: "Connect your eXp email",
        subtitle: "No eXp sign-off needed",
        steps: [
          <>Open your {link("Zoho security settings")} and sign in using your eXp email address.</>,
          <>Under Application-Specific Passwords, select Generate New Password and name it &ldquo;Sales Progressor&rdquo;.</>,
          <>Copy the password Zoho gives you and paste it below. You&rsquo;ll only see this password once.</>,
        ],
        aside:
          "This is the same type of app password used to connect your eXp email to other email apps. We've already filled in the server settings for you.",
      };
    case "gmail":
      return {
        title: "Connect your Gmail",
        steps: [
          <>Turn on 2-Step Verification for your Google account if it isn&rsquo;t already.</>,
          <>Open your {link("Google app passwords page")} and sign in.</>,
          <>Create a password named &ldquo;Sales Progressor&rdquo;, copy it, and paste it below. You&rsquo;ll only see it once.</>,
        ],
        aside: "Use the app password here, not your normal Gmail password. We've already filled in the server settings for you.",
      };
    case "yahoo":
      return {
        title: "Connect your Yahoo Mail",
        steps: [
          <>Open your {link("Yahoo account security page")} and sign in.</>,
          <>Choose Generate app password and name it &ldquo;Sales Progressor&rdquo;.</>,
          <>Copy the password and paste it below. You&rsquo;ll only see it once.</>,
        ],
        aside: "Use the app password here, not your normal Yahoo password. We've already filled in the server settings for you.",
      };
    case "icloud":
      return {
        title: "Connect your iCloud Mail",
        steps: [
          <>Sign in at {link("appleid.apple.com")} and open Sign-In and Security.</>,
          <>Choose App-Specific Passwords and create one named &ldquo;Sales Progressor&rdquo;.</>,
          <>Copy the password and paste it below. You&rsquo;ll only see it once.</>,
        ],
        aside: "Use the app-specific password here, not your Apple ID password. We've already filled in the server settings for you.",
      };
    case "zoho":
      return {
        title: "Connect your Zoho mailbox",
        steps: [
          <>Open your {link("Zoho security settings")} and sign in.</>,
          <>Under Application-Specific Passwords, select Generate New Password and name it &ldquo;Sales Progressor&rdquo;.</>,
          <>Copy the password Zoho gives you and paste it below. You&rsquo;ll only see this password once.</>,
        ],
        aside: "This is the same type of app password used to connect Zoho to other email apps. We've already filled in the server settings for you.",
      };
    case "other":
      return null;
  }
}

export function ImapConnectionCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ id: string; text: string } | null>(null);

  // Connect form
  const [selectedTile, setSelectedTile] = useState<TileKey | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [enableSend, setEnableSend] = useState(true);
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

  // The typed address wins over the tapped tile: typing a Gmail address with
  // the eXp tile selected flips the selection (and the guide) to Gmail. An
  // explicit "Other" choice sticks, so an agent whose org uses custom servers
  // for a recognised domain can still enter them manually.
  function onEmailChange(next: string) {
    setEmail(next);
    if (next.includes("@") && selectedTile !== "other") {
      const tile = tileForEmail(next);
      if (tile) setSelectedTile(tile);
      else if (!presetForEmail(next)) setSelectedTile("other");
    }
  }

  const typedPreset = email.includes("@") ? presetForEmail(email) : null;
  const activeTile = selectedTile ? TILES.find((t) => t.key === selectedTile) ?? null : null;
  // The preset that describes what we're connecting: the typed address's when
  // present, else the selected tile's sample.
  const activePreset = typedPreset ?? (activeTile?.sampleDomain ? presetForEmail(`x@${activeTile.sampleDomain}`) : null);
  const guide = selectedTile ? guideFor(selectedTile, activePreset) : null;

  const unknownTyped = email.includes("@") && !typedPreset;
  const needServerDetails = selectedTile === "other" || unknownTyped;

  // Send-option truth, mirroring the server's guards: known sending server,
  // the typed address IS the sign-in, and no verified domain outranking it.
  const emailTyped = email.includes("@");
  const smtpKnown = !!typedPreset?.smtpHost;
  const isSignIn = !!status?.userEmail && email.trim().toLowerCase() === status.userEmail;
  const offerSend = emailTyped && smtpKnown && isSignIn && !status?.userDomainVerified;
  const showNotSignInLine = emailTyped && smtpKnown && !!status?.userEmail && !isSignIn;
  const showDomainCoveredLine = emailTyped && smtpKnown && isSignIn && !!status?.userDomainVerified;
  const expWording = selectedTile === "exp";

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
          enableSend: offerSend && enableSend,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; sendError?: string };
      if (res.ok && data.ok) {
        setEmail("");
        setPassword("");
        setConsent(false);
        setSelectedTile(null);
        setHost("");
        setPort("993");
        if (data.sendError) {
          setNotice(`Your inbox is connected for receiving, but we couldn't switch on sending. ${data.sendError}`);
        }
        await load();
      } else {
        setError(data.error ?? "We couldn't connect that mailbox. Please try again.");
        if ((data.error ?? "").toLowerCase().includes("mail server")) setSelectedTile("other");
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

  const senderNote = (() => {
    if (!status) return null;
    const s = status.sendsFrom;
    if (s.via === "domain")
      return `Your emails send from ${s.address}. Your sign-in address is on your verified domain, so it takes priority.`;
    if (s.via === "mailbox")
      return `Your emails send from ${s.address} through your connected inbox. Every email appears in its Sent folder, and replies come straight back to you.`;
    return `Your emails currently send from our address, with replies coming to you${status.userEmail ? ` at ${status.userEmail}` : ""}. Connect your sign-in inbox below to send as yourself.`;
  })();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
          <EnvelopeSimple size={20} weight="bold" style={{ color: CORAL }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Every other provider</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                Pick your provider and connect with an app-password. For providers we recognise, we can send your emails from
                this address too.
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
                          <div className="flex min-w-0 items-center gap-2.5">
                            <ProviderLogo provider={c.provider} email={c.email} size={28} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-sm text-gray-800">
                                {c.email}
                                <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                                  {providerLabel(c.provider, c.email)}
                                </span>
                                {(c.sendState === "sends" || c.sendState === "domain_covered") ? (
                                  <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    Sends
                                  </span>
                                ) : (
                                  <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                                    Reads only
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
                              {c.sendState === "not_sign_in" && c.sendAvailable && status?.userEmail && (
                                <p className="mt-0.5 text-[12px] text-gray-500">
                                  Your emails send from {status.userEmail}, your sign-in address. To send from this inbox instead,
                                  it needs to become your sign-in email. Contact us and we&rsquo;ll switch it.
                                </p>
                              )}
                              {c.sendState === "domain_covered" && (
                                <p className="mt-0.5 text-[12px] text-gray-500">
                                  Your emails already send from this address through your verified domain.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {(c.sendState === "offer" || c.sendState === "sends") && (
                              <button
                                onClick={() => toggleSend(c.id, c.sendState === "offer")}
                                disabled={sendTogglingId === c.id}
                                className="pbtn pbtn-press inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <PaperPlaneTilt size={14} weight="bold" className={sendTogglingId === c.id ? "pbtn-spin" : ""} />
                                {sendTogglingId === c.id ? "Updating…" : c.sendState === "sends" ? "Turn off sending" : "Turn on sending"}
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

                {/* Where outgoing email comes from right now — same logic the send path uses */}
                {senderNote && count > 0 && (
                  <p
                    className="rounded-r-lg border-l-[3px] bg-[#fff7f4] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-gray-600"
                    style={{ borderLeftColor: CORAL }}
                  >
                    {senderNote}
                  </p>
                )}

                {/* Connect form */}
                <div className="space-y-3.5 rounded-lg border border-gray-200 bg-gray-50 p-3.5">
                  {/* Provider tiles */}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {TILES.map((t) => {
                      const sel = selectedTile === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            setSelectedTile(t.key);
                            setError(null);
                          }}
                          aria-pressed={sel}
                          className={`pbtn pbtn-press relative flex flex-col items-center gap-1.5 rounded-lg border bg-white px-2 pb-2 pt-3 transition-all duration-150 motion-safe:hover:-translate-y-0.5 hover:shadow-sm ${
                            sel ? "border-[color:var(--agent-coral,#FF6B4A)] shadow-[0_0_0_2px_rgba(255,107,74,0.18)]" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {sel && (
                            <span
                              className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white"
                              style={{ background: CORAL }}
                            >
                              ✓
                            </span>
                          )}
                          {t.logo(30)}
                          <span className="text-[11px] font-medium text-gray-700">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Per-provider steps */}
                  {guide && (
                    <div key={selectedTile} className="portal-fade-in rounded-lg border border-[#ffe0d6] bg-[#fff7f4] px-4 py-3.5">
                      <p className="text-[12.5px] font-semibold text-gray-900">
                        {guide.title}
                        {guide.subtitle && <span className="ml-2 font-medium text-gray-500">{guide.subtitle}</span>}
                      </p>
                      <ol className="mt-2 list-decimal space-y-1.5 text-[12.5px] leading-relaxed text-gray-700" style={{ paddingLeft: 18 }}>
                        {guide.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      <p className="mt-2.5 text-[11.5px] leading-relaxed text-gray-500">{guide.aside}</p>
                    </div>
                  )}
                  {selectedTile === "other" && (
                    <p key="other-note" className="portal-fade-in text-[12px] leading-relaxed text-gray-600">
                      Add your provider&rsquo;s IMAP server details below. Your email host or IT can confirm these, and most use
                      port 993. You&rsquo;ll need an app-password if your provider supports them.
                    </p>
                  )}

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-medium text-gray-600">Email address</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => onEmailChange(e.target.value.trim())}
                        placeholder={activeTile?.placeholder ?? "you@youragency.co.uk"}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors duration-150 focus:border-[color:var(--agent-coral,#FF6B4A)]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-medium text-gray-600">App password</span>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="app password (not your normal password)"
                        autoComplete="off"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors duration-150 focus:border-[color:var(--agent-coral,#FF6B4A)]"
                      />
                    </label>
                  </div>

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
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors duration-150 focus:border-[color:var(--agent-coral,#FF6B4A)]"
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
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 outline-none transition-colors duration-150 focus:border-[color:var(--agent-coral,#FF6B4A)]"
                        />
                      </label>
                    </div>
                  )}

                  {/* Send option — only where it's true */}
                  {offerSend && (
                    <label className="flex w-full cursor-pointer items-start gap-2.5 pt-0.5">
                      <input
                        type="checkbox"
                        checked={enableSend}
                        onChange={(e) => setEnableSend(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--agent-coral,#FF6B4A)]"
                      />
                      <span className="w-full text-[12.5px] leading-relaxed text-gray-600">
                        <span className="font-semibold text-gray-800">Send my emails from this address too.</span> Emails sent
                        from Sales Progressor on your files will go through your {expWording ? "eXp mailbox" : "mailbox"} and
                        appear in your Sent folder. Any replies will come straight back to your{" "}
                        {expWording ? "eXp inbox" : "inbox"}.
                      </span>
                    </label>
                  )}
                  {showNotSignInLine && (
                    <p className="flex w-full items-start gap-1.5 text-[12px] leading-relaxed text-gray-500">
                      <Info size={14} weight="fill" className="mt-0.5 shrink-0 text-gray-400" />
                      <span>
                        Your emails send from {status?.userEmail}, your sign-in address, so this inbox will connect for
                        receiving. To send from it instead, it needs to become your sign-in email. Contact us and we&rsquo;ll
                        switch it.
                      </span>
                    </p>
                  )}
                  {showDomainCoveredLine && (
                    <p className="flex w-full items-start gap-1.5 text-[12px] leading-relaxed text-gray-500">
                      <Info size={14} weight="fill" className="mt-0.5 shrink-0 text-gray-400" />
                      <span>Your emails already send from this address through your verified domain, so there&rsquo;s nothing to switch on.</span>
                    </p>
                  )}

                  <label className="flex w-full cursor-pointer items-start gap-2.5 pt-0.5">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--agent-coral,#FF6B4A)]"
                    />
                    <span className="w-full text-[12.5px] leading-relaxed text-gray-600">
                      I agree that Sales Progressor can access emails relating to my sales, as explained in the{" "}
                      <Link href="/privacy" className="underline" style={{ color: CORAL }}>
                        Privacy Policy
                      </Link>
                      . I can disconnect my email at any time.
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
                  We only save emails that match one of your sales. Nothing else in your inbox is stored, and disconnecting
                  stops all access.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
