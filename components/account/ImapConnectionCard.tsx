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
// only renders where it's true (sendState from the status API — Law 13): any
// connected inbox we can send through can be made the sending address (chosen
// self-serve; preferredSenderEmail), and a DNS-verified domain already outranks
// a mailbox. Light Account chrome (Law 9); animation via the shared pbtn
// utilities + portal-fade-in (docs/reference/HOVER_STATES.md).

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { EnvelopeSimple, CheckCircle, ArrowClockwise, Warning, Info, PaperPlaneTilt, ArrowUpRight, ShieldCheck } from "@/components/icons/ph";
import { presetForEmail } from "@/lib/integrations/imap/config";
import { GmailLogo, YahooLogo, ICloudLogo, ZohoLogo, ExpLogo, GenericMailLogo, ProviderLogo } from "./provider-logos";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";

// Coral-filled primary (arc primary fills with --foreground, text is --background).
const coralPrimary = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

type SendState = "sends" | "offer" | "domain_covered" | "unavailable";
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
  replyCaptureOn?: boolean;
};

const CORAL = "var(--agent-coral, #FF6B4A)";

function providerLabel(p: string, email?: string): string {
  if (email?.toLowerCase().endsWith("@expuk.com")) return "eXp UK";
  const map: Record<string, string> = { gmail: "Gmail", outlook: "Outlook.com", yahoo: "Yahoo", icloud: "iCloud", aol: "AOL", zoho: "Zoho Mail", imap: "Email" };
  return map[p] ?? "Email";
}

// Sending and inbox-reading are shown as two separate statuses (Phase 2), so a
// reading hiccup never reads as a sending failure. Rendered as canonical Badges
// (bordered, no fill): success = on, amber = limited, neutral = off.

// Plain-English translation of a raw reading error (Phase 3). A connected-mailbox
// inbox we can't read is usually the provider throttling us, not a real fault —
// so we explain calmly and never tell the agent to "reconnect to fix" a working
// mailbox. Keyed on the substrings providers/imapflow actually emit.
function friendlyReadError(raw: string): string {
  const t = raw.toLowerCase();
  if (/connection not available|connection closed|socket|dropped|unavailable|econnreset/.test(t))
    return "Your provider limited reading just now, which is common with eXp and Zoho. We'll keep trying automatically.";
  if (/timeout|timed out/.test(t)) return "Your mail server didn't respond in time. We'll try again shortly.";
  if (/auth|password|credential|login failed|invalid/.test(t))
    return "We couldn't sign in to read this inbox. Check you used an app password, not your normal one, then reconnect.";
  if (/certificate|tls|ssl/.test(t)) return "The secure connection to your mail server failed. Reconnect to re-check the settings.";
  return "We couldn't read this inbox just now. Use ‘Check reading’ to try again, or reconnect if it continues.";
}

// Plain-English translation of a raw sending error (Phase 3).
function friendlySendError(raw: string): string {
  const t = raw.toLowerCase();
  if (/auth|password|credential|login failed|invalid/.test(t))
    return "Sending stopped working. Your provider rejected the app password, so reconnect with a fresh one to fix it.";
  return "We hit a problem sending from this inbox. Reconnect to re-check it.";
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
// eXp substance approved by the founder 2026-09-17; restructured 2026-11 into
// the canonical provider-card shape (title + subtitle + numbered steps with an
// optional link + a shield footnote) rendered by ProviderGuide below. A step's
// link points at the preset's appPasswordUrl.

type GuideStep = { title: string; body: string; link?: string };
type Guide = { title: string; subtitle: string; steps: GuideStep[]; aside: string };

function guideFor(tile: TileKey): Guide | null {
  switch (tile) {
    case "exp":
      return {
        title: "Connect your eXp email",
        subtitle: "No eXp sign-off needed. You'll create an app password through Zoho, which runs eXp email.",
        steps: [
          { title: "Open your Zoho security settings", body: "Sign in using your eXp email address.", link: "Open security settings" },
          { title: "Generate a new app password", body: "Under Application-Specific Passwords, select Generate New Password and name it 'Sales Progressor'." },
          { title: "Enter your app password", body: "Copy the password Zoho gives you and paste it into the field below. You'll only see it once." },
        ],
        aside: "Use the same type of app password you'd use to connect your eXp email to another email app. We've already filled in the server settings for you.",
      };
    case "gmail":
      return {
        title: "Connect your Gmail account",
        subtitle: "To connect securely, you'll create an app password through your Google Account.",
        steps: [
          { title: "Enable 2-Step Verification", body: "App passwords are only available once 2-Step Verification is on in your Google Account security settings." },
          { title: "Create an app password", body: "Generate one named 'Sales Progressor' on your Google app passwords page.", link: "Create app password" },
          { title: "Enter your app password", body: "Copy the 16-character password and paste it into the field below. You'll only see it once." },
        ],
        aside: "An app password lets you connect securely without sharing your normal Gmail password. We've already filled in the server settings for you.",
      };
    case "yahoo":
      return {
        title: "Connect your Yahoo Mail",
        subtitle: "To connect securely, you'll create an app password through your Yahoo account.",
        steps: [
          { title: "Open your Yahoo account security page", body: "Sign in to your Yahoo account.", link: "Open account security" },
          { title: "Generate an app password", body: "Choose Generate app password and name it 'Sales Progressor'." },
          { title: "Enter your app password", body: "Copy the password and paste it into the field below. You'll only see it once." },
        ],
        aside: "Use the app password here, not your normal Yahoo password. We've already filled in the server settings for you.",
      };
    case "icloud":
      return {
        title: "Connect your iCloud Mail",
        subtitle: "To connect securely, you'll create an app-specific password through your Apple ID.",
        steps: [
          { title: "Sign in to your Apple ID", body: "Open Sign-In and Security at appleid.apple.com.", link: "Open Apple ID" },
          { title: "Create an app-specific password", body: "Choose App-Specific Passwords and create one named 'Sales Progressor'." },
          { title: "Enter your password", body: "Copy the password and paste it into the field below. You'll only see it once." },
        ],
        aside: "Use the app-specific password here, not your Apple ID password. We've already filled in the server settings for you.",
      };
    case "zoho":
      return {
        title: "Connect your Zoho mailbox",
        subtitle: "To connect securely, you'll create an app password through your Zoho account.",
        steps: [
          { title: "Open your Zoho security settings", body: "Sign in to your Zoho account.", link: "Open security settings" },
          { title: "Generate a new app password", body: "Under Application-Specific Passwords, select Generate New Password and name it 'Sales Progressor'." },
          { title: "Enter your app password", body: "Copy the password Zoho gives you and paste it into the field below. You'll only see it once." },
        ],
        aside: "Use the same type of app password you'd use to connect Zoho to another email app. We've already filled in the server settings for you.",
      };
    case "other":
      return null;
  }
}

// ── Provider guide card (group-6 canonical, 2026-11) ─────────────────────────
// Clean light card: heading + subtitle, hairline divider, numbered steps whose
// lead is bold and whose optional link opens the provider's app-password page,
// and a neutral shield footnote. Replaces the coral-washed box + bare <ol>.
const PROVIDER_GUIDE_CSS = `
.pgd { border: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); border-radius: 16px; background: var(--agent-surface-elevated, #fff); padding: 18px 20px; }
.pgd-h { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--agent-text-primary); }
.pgd-sub { margin: 5px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--agent-text-muted); }
.pgd-div { height: 1px; background: var(--agent-border-subtle, rgba(20,16,10,0.08)); margin: 15px 0; }
.pgd-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 15px; }
.pgd-st-h { margin: 0; font-size: 13px; font-weight: 650; color: var(--agent-text-primary); }
.pgd-st-b { margin: 3px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--agent-text-muted); }
.pgd-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 7px; font-size: 12.5px; font-weight: 600; color: var(--agent-coral, #FF6B4A); text-decoration: none; transition: color 0.12s ease; }
.pgd-link:hover { color: var(--agent-coral-deep, #E2452A); }
.pgd-note { display: flex; align-items: flex-start; gap: 9px; margin-top: 16px; padding: 11px 13px; border-radius: 11px; background: var(--agent-surface-subtle, rgba(45,24,16,0.03)); }
.pgd-note span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }
`;

function ProviderGuide({ guide, url }: { guide: Guide; url?: string | null }) {
  return (
    <div className="pgd">
      <style>{PROVIDER_GUIDE_CSS}</style>
      <p className="pgd-h">{guide.title}</p>
      <p className="pgd-sub">{guide.subtitle}</p>
      <div className="pgd-div" />
      <ol className="pgd-steps">
        {guide.steps.map((s, i) => (
          <li key={i}>
            <p className="pgd-st-h">{i + 1}. {s.title}</p>
            <p className="pgd-st-b">{s.body}</p>
            {s.link && url && (
              <a className="pgd-link" href={url} target="_blank" rel="noopener noreferrer">
                {s.link}
                <ArrowUpRight size={13} weight="bold" />
              </a>
            )}
          </li>
        ))}
      </ol>
      <div className="pgd-note">
        <ShieldCheck size={16} weight="regular" style={{ flex: "none", marginTop: 1, color: "var(--agent-text-muted)" }} />
        <span>{guide.aside}</span>
      </div>
    </div>
  );
}

export function ImapConnectionCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ id: string; text: string; isError: boolean } | null>(null);

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
  const guide = selectedTile ? guideFor(selectedTile) : null;

  const unknownTyped = email.includes("@") && !typedPreset;
  const needServerDetails = selectedTile === "other" || unknownTyped;

  // Send-option truth, mirroring the server's guards: a known sending server and
  // no verified domain already covering sending. Sending is self-serve now
  // (Phase 1) — it no longer has to be the sign-in address.
  const emailTyped = email.includes("@");
  const smtpKnown = !!typedPreset?.smtpHost;
  const offerSend = emailTyped && smtpKnown && !status?.userDomainVerified;
  const showDomainCoveredLine = emailTyped && smtpKnown && !!status?.userDomainVerified;
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
          setNotice(`Your inbox is connected for receiving, but we couldn't enable sending. ${data.sendError}`);
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
        setSyncMsg({ id, text: n > 0 ? `Saved ${n} matching email${n === 1 ? "" : "s"} to their files.` : "Checked. No new matching emails.", isError: false });
      } else {
        // Calm, honest failure: the scheduled checks keep running regardless,
        // so we never tell the agent to mash the button.
        setSyncMsg({ id, text: "We couldn't check just now. We'll keep trying automatically.", isError: true });
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
      return `Your emails send from ${s.address}. Your sign-in address is on your verified domain, so we'll use that by default.`;
    if (s.via === "mailbox")
      return status.replyCaptureOn
        ? `Your emails send from ${s.address} through your connected inbox. Replies are captured automatically, filed on the sale, and forwarded to your inbox.`
        : `Your emails send from ${s.address} through your connected inbox. Every email appears in its Sent folder, and replies come straight back to you.`;
    return `Your emails currently send from our address, with replies coming to ${status.userEmail ?? "you"}. Connect an inbox below to send from your own address.`;
  })();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5 pr-8">
            <p className="text-sm font-semibold text-gray-900">Other email providers</p>
            {!loading && status && (
              <Badge tone={count > 0 ? "success" : "neutral"} caps={false}>
                {count > 0 ? `${count} connected` : "Not connected"}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">
            Connect your email using an app password. Supported providers can also send emails directly from
            your address.
          </p>

          <div className="mt-4">
            {loading ? (
              <p className="text-[13px] text-gray-500">Checking…</p>
            ) : (
              <div className="space-y-4">
                {/* Connected inboxes */}
                {count > 0 && (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {connections.map((c) => {
                      // Reply-capture handles replies for this inbox when it's on AND
                      // this connection is the mailbox we send through — a "reading
                      // limited" warning is then moot, so reassure instead of alarm.
                      const captured =
                        !!status?.replyCaptureOn &&
                        status?.sendsFrom.via === "mailbox" &&
                        c.email === status?.sendsFrom.address;
                      return (
                      <li key={c.id} className="px-3 py-2.5">
                        {/* Responsive row (2026-10-12, founder report): two columns only on
                            wide screens; below lg the actions drop under the identity as a
                            wrapped row behind a hairline; below sm the buttons go two-up
                            with Disconnect full-width. The identity column never gets
                            crushed sideways again. */}
                        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-4">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <ProviderLogo provider={c.provider} email={c.email} size={28} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-sm text-gray-800">
                                {c.email}
                                <Badge tone="neutral" caps={false}>{providerLabel(c.provider, c.email)}</Badge>
                              </p>
                              {/* Two separate statuses: a reading hiccup never reads as a sending failure */}
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {c.sendState === "sends" ? (
                                  <Badge tone="success" caps={false}>Sending on</Badge>
                                ) : c.sendState === "domain_covered" ? (
                                  <Badge tone="success" caps={false}>Sends via your domain</Badge>
                                ) : (
                                  <Badge tone="neutral" caps={false}>Sending off</Badge>
                                )}
                                {captured ? (
                                  <Badge tone="success" caps={false}>Replies captured ✓</Badge>
                                ) : c.lastError ? (
                                  <Badge tone="amber" caps={false}>Reading limited</Badge>
                                ) : c.lastSyncedAt ? (
                                  <Badge tone="success" caps={false}>Reading on</Badge>
                                ) : (
                                  <Badge tone="neutral" caps={false}>Reading not checked yet</Badge>
                                )}
                              </div>
                              {/* Reply-capture reassurance takes priority: when it's handling replies, a
                                  "reading limited" warning would only confuse, so we don't show it. */}
                              {captured ? (
                                <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-emerald-700">
                                  <CheckCircle size={13} weight="fill" className="mt-0.5 shrink-0" />
                                  <span>
                                    Replies to your emails are captured automatically and filed on the sale, then forwarded to
                                    your inbox. You don&rsquo;t need to do anything here.
                                  </span>
                                </p>
                              ) : c.lastError ? (
                                <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-amber-700">
                                  <Info size={13} weight="fill" className="mt-0.5 shrink-0" />
                                  <span>
                                    {friendlyReadError(c.lastError)}
                                    {c.sendState === "sends" ? " Your sending isn’t affected." : ""}
                                  </span>
                                </p>
                              ) : c.lastSyncedAt ? (
                                <p className="mt-1 truncate text-[12px] text-gray-500">
                                  Last checked {new Date(c.lastSyncedAt).toLocaleString("en-GB")}
                                </p>
                              ) : null}
                              {/* Sending detail */}
                              {c.smtpLastError && (
                                <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-red-600">
                                  <Warning size={13} weight="fill" className="mt-0.5 shrink-0" />
                                  <span>{friendlySendError(c.smtpLastError)}</span>
                                </p>
                              )}
                              {c.sendState === "domain_covered" && (
                                <p className="mt-1 text-[12px] text-gray-500">
                                  This address already sends through your verified domain.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2.5 lg:mt-0 lg:max-w-[340px] lg:justify-end lg:border-t-0 lg:pt-0">
                            {(c.sendState === "offer" || c.sendState === "sends") && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => toggleSend(c.id, c.sendState === "offer")}
                                loading={sendTogglingId === c.id}
                                className="flex-1 sm:flex-none"
                              >
                                <PaperPlaneTilt size={14} weight="bold" />
                                {c.sendState === "sends" ? "Turn off sending" : "Turn on sending"}
                              </Button>
                            )}
                            {c.sendState === "sends" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => toggleSend(c.id, true)}
                                loading={sendTogglingId === c.id}
                                className="flex-1 sm:flex-none"
                                title="Send a test email from this address to itself"
                              >
                                <PaperPlaneTilt size={14} weight="bold" />
                                Send test
                              </Button>
                            )}
                            {/* Reading is irrelevant when reply-capture handles this inbox:
                                no button that can routinely fail (eXp/Zoho throttle reads)
                                right next to "you don't need to do anything here". */}
                            {!captured && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => syncNow(c.id)}
                                loading={syncingId === c.id}
                                className="flex-1 sm:flex-none"
                              >
                                <ArrowClockwise size={14} weight="bold" />
                                Check reading
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => disconnect(c.id)}
                              loading={removingId === c.id}
                              className="w-full sm:w-auto"
                            >
                              Disconnect
                            </Button>
                          </div>
                        </div>
                        {syncMsg?.id === c.id && (
                          <p className={`mt-2 text-[12px] ${syncMsg.isError ? "text-amber-700" : "text-emerald-700"}`}>{syncMsg.text}</p>
                        )}
                        {sendMsg?.id === c.id && (
                          <p className={`mt-2 text-[12px] ${sendMsg.isError ? "text-red-600" : "text-emerald-700"}`}>{sendMsg.text}</p>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                )}

                {/* Where outgoing email comes from right now: same logic the send path uses */}
                {senderNote && count > 0 && (
                  <p
                    className="rounded-r-lg border-l-[3px] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-gray-600"
                    style={{ borderLeftColor: CORAL, background: "var(--agent-surface-subtle, rgba(45,24,16,0.03))" }}
                  >
                    {senderNote}
                  </p>
                )}

                {/* Connect form */}
                <div className="space-y-3.5 rounded-lg border border-gray-200 bg-gray-50 p-3.5">
                  {/* Two-path guidance (Phase 4): verify a domain, or connect an inbox */}
                  <div className="space-y-1.5 text-[12px] leading-relaxed text-gray-600">
                    <p>There are two ways to send emails from your own address. Verify your domain, or connect your inbox below using an app password.</p>
                    <p>No DNS changes are needed to connect your inbox. We&rsquo;ll guide you through the setup and send a test email to make sure everything works.</p>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Choose your provider</p>
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
                    <div key={selectedTile} className="portal-fade-in">
                      <ProviderGuide guide={guide} url={activePreset?.appPasswordUrl} />
                    </div>
                  )}
                  {selectedTile === "other" && (
                    <p key="other-note" className="portal-fade-in text-[12px] leading-relaxed text-gray-600">
                      Add your provider&rsquo;s IMAP server details below. Your email provider or IT team can confirm these; most use
                      port 993. You&rsquo;ll need an app password if your provider supports them.
                    </p>
                  )}

                  <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
                    <LabelInput
                      field="Email address"
                      label="Email address"
                      size="sm"
                      fullWidth
                      topGap={6}
                      accent="#FF6B4A"
                      value={email}
                      onChange={(e) => onEmailChange(e.target.value.trim())}
                    />
                    <LabelInput
                      field="Password"
                      label="App password"
                      size="sm"
                      fullWidth
                      topGap={6}
                      accent="#FF6B4A"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {/* Manual server details for unrecognised providers */}
                  {needServerDetails && (
                    <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
                      <LabelInput
                        field="IMAP server"
                        label="IMAP server (host)"
                        type="text"
                        size="sm"
                        fullWidth
                        topGap={6}
                        accent="#FF6B4A"
                        value={host}
                        onChange={(e) => setHost(e.target.value.trim())}
                      />
                      <LabelInput
                        field="Port"
                        label="Port"
                        type="text"
                        inputMode="numeric"
                        size="sm"
                        fullWidth
                        topGap={6}
                        accent="#FF6B4A"
                        value={port}
                        onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
                      />
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
                        from Sales Progressor will go through your {expWording ? "eXp mailbox" : "mailbox"}, appear in your
                        Sent folder and receive replies directly in your{" "}
                        {expWording ? "eXp inbox" : "inbox"}.
                      </span>
                    </label>
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
                      I agree to Sales Progressor accessing emails related to my sales, as explained in the{" "}
                      <Link href="/privacy" className="underline" style={{ color: CORAL }}>
                        Privacy Policy
                      </Link>
                      . I can disconnect at any time.
                    </span>
                  </label>

                  {error && <InlineAlert kind="danger">{error}</InlineAlert>}

                  {notice && <InlineAlert kind="warning">{notice}</InlineAlert>}

                  <Button
                    variant="primary"
                    size="md"
                    style={coralPrimary}
                    onClick={connect}
                    disabled={!canConnect && !connecting}
                    loading={connecting}
                  >
                    <EnvelopeSimple size={16} weight="bold" />
                    {count > 0 ? "Connect another inbox" : "Connect my inbox"}
                  </Button>
                </div>

                <p className="text-[11.5px] leading-relaxed text-gray-400">
                  We only save emails that match your sales. Other inbox messages aren&rsquo;t stored, and disconnecting
                  stops further access.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
