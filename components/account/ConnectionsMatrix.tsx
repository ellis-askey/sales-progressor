"use client";

// components/account/ConnectionsMatrix.tsx
//
// Agent Account > Connections — the "what each connection unlocks" capability
// table that sits above the connection cards (founder direction 2026-11-13:
// consolidate the Connections page). Read-only: it fetches the same three status
// endpoints the cards already use and lights a cell up as each channel connects.
//
// Three cell states so a green tick never hides a caveat:
//   • dash    — the channel doesn't provide that capability
//   • outline — the channel provides it, but isn't connected yet
//   • solid   — connected and working (emerald)
//   • amber   — connected but needs a look (e.g. an email inbox with sending off
//               or reading limited), mirroring the card's own warning state
//
// Light Account chrome (Law 9), matching AccountConnectionsCard / ImapConnectionCard
// (white card, gray-200 hairlines, emerald ticks). No new tokens.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { EnvelopeSimple, WhatsappLogo, Check, PaperPlaneTilt, IdentificationBadge, ArrowsClockwise, ChatCircleText, ListChecks } from "@phosphor-icons/react";
import { OutlookLogo } from "./provider-logos";

type ChannelKey = "outlook" | "email" | "whatsapp";
type Cell = "na" | "off" | "partial" | "on";

type OutlookStatus = { configured: boolean; connections: unknown[] };
type ImapConn = { lastError: string | null; sendState: "sends" | "offer" | "domain_covered" | "unavailable" };
type ImapStatus = { configured: boolean; connections: ImapConn[] };
type WaStatus = { configured: boolean; connection: { status: string } | null };

const CAPS: { key: string; title: string; sub: string; Icon: typeof EnvelopeSimple }[] = [
  { key: "send", title: "Send and receive emails", sub: "Manage all your sale emails in one place.", Icon: PaperPlaneTilt },
  { key: "sendown", title: "Send from your own address", sub: "Clients receive emails from your address, not ours.", Icon: IdentificationBadge },
  { key: "chase", title: "Automatic email chasing", sub: "Save time with automated follow-ups.", Icon: ArrowsClockwise },
  { key: "capture", title: "Capture client conversations", sub: "Keep client emails organised against the right sale.", Icon: ChatCircleText },
  { key: "timeline", title: "Complete sale timeline", sub: "Every email, message and note in one place.", Icon: ListChecks },
];
const CHANNELS: { key: ChannelKey; name: string; sub: string }[] = [
  { key: "outlook", name: "Outlook", sub: "Email" },
  { key: "email", name: "Email provider", sub: "Send from your address" },
  { key: "whatsapp", name: "WhatsApp", sub: "Client conversations" },
];
// Progression variant: the member's inbox is about THEIR own emails (to agents /
// solicitors), not the client-facing branded stream, so some rows are reworded.
const PROG_SUB: Record<string, string> = {
  send: "Keep emails with agents and solicitors saved against the right sale.",
  sendown: "Agents receive your emails from your own address.",
  capture: "Save your property WhatsApp group conversations against the right sale.",
  timeline: "Every email, WhatsApp message and note in one place.",
};

function ChannelIcon({ k }: { k: ChannelKey }) {
  if (k === "outlook") return <OutlookLogo size={30} />;
  if (k === "whatsapp") return (
    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg" style={{ background: "#25D366" }}>
      <WhatsappLogo size={18} weight="fill" color="#fff" />
    </span>
  );
  return (
    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
      <EnvelopeSimple size={17} weight="bold" style={{ color: "var(--agent-coral,#FF6B4A)" }} />
    </span>
  );
}

function TickCell({ state }: { state: Cell }) {
  if (state === "na") return <span className="text-gray-300" aria-label="Not applicable">–</span>;
  const base = "inline-flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors";
  if (state === "on") return <span className={`${base} bg-emerald-500 text-white`} aria-label="Working"><Check size={15} weight="bold" /></span>;
  if (state === "partial") return (
    <span className={`relative ${base} bg-amber-500 text-white`} aria-label="Connected, needs attention">
      <Check size={15} weight="bold" />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-[1.5px] border-white bg-amber-500" />
    </span>
  );
  return <span className={`${base} border border-dashed border-gray-300 text-gray-300`} aria-label="Available once connected"><Check size={15} weight="bold" /></span>;
}

// Dev-only: inject fixed connection state so /dev pages can render the real
// matrix byte-for-byte without live endpoints. Never passed in the real app.
export type ConnectionsMatrixDemo = { outlookOn: boolean; imapOn: boolean; imapSends: boolean; imapReadIssue: boolean; waOn: boolean; waPending?: boolean };

export function ConnectionsMatrix({ domainVerified = false, demo, variant = "agent", footer }: { domainVerified?: boolean; demo?: ConnectionsMatrixDemo; variant?: "agent" | "progression"; footer?: ReactNode }) {
  const [outlook, setOutlook] = useState<OutlookStatus | null>(null);
  const [imap, setImap] = useState<ImapStatus | null>(null);
  const [wa, setWa] = useState<WaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.allSettled([
      fetch("/api/integrations/outlook/status").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/integrations/imap/status").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/agent/whatsapp/status").then((r) => (r.ok ? r.json() : null)),
    ]).then(([o, i, w]) => {
      if (o.status === "fulfilled") setOutlook(o.value);
      if (i.status === "fulfilled") setImap(i.value);
      if (w.status === "fulfilled") setWa(w.value);
      setLoading(false);
    });
  }, []);
  // Fetch on mount, and re-fetch when a connection changes in the card row below
  // (it fires "sp:connections-changed" on modal close) so the ticks light up live.
  useEffect(() => {
    if (demo) { setLoading(false); return; }
    load();
    const onChanged = () => load();
    window.addEventListener("sp:connections-changed", onChanged);
    return () => window.removeEventListener("sp:connections-changed", onChanged);
  }, [demo, load]);

  const outlookCount = demo ? (demo.outlookOn ? 1 : 0) : (outlook?.connections?.length ?? 0);
  const outlookOn = demo ? demo.outlookOn : outlookCount > 0;
  const imapOn = demo ? demo.imapOn : (imap?.connections?.length ?? 0) > 0;
  const imapSends = demo ? demo.imapSends : (imap?.connections ?? []).some((c) => c.sendState === "sends" || c.sendState === "domain_covered");
  const imapReadIssue = demo ? demo.imapReadIssue : (imap?.connections ?? []).some((c) => !!c.lastError);
  const waOn = demo ? demo.waOn : wa?.connection?.status === "connected";
  const waPending = demo ? !!demo.waPending : wa?.connection?.status === "pending_qr";
  const waUnreachable = demo ? false : wa?.connection?.status === "unreachable";

  function cell(cap: string, ch: ChannelKey): Cell {
    if (cap === "send") {
      if (ch === "whatsapp") return "na";
      if (ch === "outlook") return outlookOn ? "on" : "off";
      return imapOn ? (imapSends && !imapReadIssue ? "on" : "partial") : "off";
    }
    if (cap === "sendown") {
      if (ch === "whatsapp") return "na";
      if (ch === "outlook") return outlookOn ? "on" : "off";
      // A verified domain lets you send from your own branded address even with
      // no inbox connected, so it lights this row independently.
      if (domainVerified) return "on";
      return imapOn ? (imapSends ? "on" : "partial") : "off";
    }
    if (cap === "chase") {
      if (ch === "whatsapp") return "na";
      if (ch === "outlook") return outlookOn ? "on" : "off";
      return imapOn ? (imapSends ? "on" : "partial") : "off";
    }
    if (cap === "capture") {
      if (ch !== "whatsapp") return "na";
      return waOn ? "on" : waUnreachable ? "partial" : "off";
    }
    if (ch === "outlook") return outlookOn ? "on" : "off";
    if (ch === "email") return imapOn ? "on" : "off";
    return waOn ? "on" : waUnreachable ? "partial" : "off";
  }
  const rowAchieved = (cap: string) => CHANNELS.some((c) => cell(cap, c.key) === "on");

  const headStatus = (ch: ChannelKey): { label: string; tone: "on" | "warn" | "off" } => {
    if (ch === "outlook") return outlookOn ? { label: `${outlookCount} connected`, tone: "on" } : { label: "Not connected", tone: "off" };
    if (ch === "email") return !imapOn ? { label: "Not connected", tone: "off" } : (imapReadIssue || !imapSends) ? { label: "Needs attention", tone: "warn" } : { label: "Connected", tone: "on" };
    return waOn ? { label: "Connected", tone: "on" } : waUnreachable ? { label: "Can't check right now", tone: "warn" } : waPending ? { label: "Waiting to scan", tone: "warn" } : { label: "Not connected", tone: "off" };
  };

  const pillCls = (tone: "on" | "warn" | "off") =>
    tone === "on" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-gray-200 bg-gray-50 text-gray-500";

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header row */}
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,86px)] items-stretch border-b border-gray-200 bg-gray-50/60 sm:grid-cols-[minmax(0,1fr)_repeat(3,132px)]">
        <div className="flex flex-col justify-center px-4 py-4 sm:px-5">
          <span className="text-[14px] font-bold tracking-tight text-gray-900">What you&rsquo;ll unlock</span>
          <span className="mt-1 text-[12px] leading-snug text-gray-500">{variant === "progression" ? "Connect a provider below to enable these features." : "Connect an email provider below to enable these features."}</span>
        </div>
        {CHANNELS.map((c) => {
          const st = headStatus(c.key);
          return (
            <div key={c.key} className="flex flex-col items-center gap-1.5 border-l border-gray-100 px-2 py-3.5 text-center">
              <ChannelIcon k={c.key} />
              <span className="text-[12.5px] font-semibold leading-tight text-gray-800">{c.name}</span>
              <span className="hidden text-[10px] leading-tight text-gray-400 sm:block">{c.sub}</span>
              {!loading && (
                <span className={`hidden whitespace-nowrap rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide sm:inline-block ${pillCls(st.tone)}`}>
                  {st.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Capability rows */}
      {CAPS.filter((cap) => !(variant === "progression" && cap.key === "chase")).map((cap) => (
        <div
          key={cap.key}
          className="grid grid-cols-[minmax(0,1fr)_repeat(3,86px)] items-stretch border-t border-gray-100 sm:grid-cols-[minmax(0,1fr)_repeat(3,132px)]"
          style={!loading && rowAchieved(cap.key) ? { background: "linear-gradient(90deg,rgba(16,185,129,0.06),transparent 60%)" } : undefined}
        >
          <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <cap.Icon size={15} weight="bold" />
            </span>
            <div className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-gray-900">{cap.title}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-gray-500">{variant === "progression" && PROG_SUB[cap.key] ? PROG_SUB[cap.key] : cap.sub}</span>
            </div>
          </div>
          {CHANNELS.map((c) => (
            <div key={c.key} className="grid place-items-center border-l border-gray-100 px-2 py-4">
              {loading ? <span className="h-[26px] w-[26px] animate-pulse rounded-full bg-gray-100" /> : <TickCell state={cell(cap.key, c.key)} />}
            </div>
          ))}
        </div>
      ))}
      {footer}
    </div>
  );
}
