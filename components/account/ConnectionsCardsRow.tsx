"use client";

// components/account/ConnectionsCardsRow.tsx
//
// Agent Account > Connections — the compact 3-card row (Outlook / Email / WhatsApp)
// that sits under the capability matrix (founder direction 2026-11-13). Each card
// is a thin LAUNCHER: it shows the channel, a live status pill and a short summary,
// then opens the REAL, UNCHANGED full card component in a modal for every action.
//
// Why a launcher rather than a restyle: the full cards (AccountConnectionsCard /
// ImapConnectionCard / WhatsAppConnectionCard) carry all the connect, per-inbox
// control, error and consent logic and are shared with the progression Connections
// page. Hosting them verbatim in a modal keeps their behaviour byte-identical
// (nothing to regress) while giving the agent page the compact row. The full cards
// are passed in as props and mounted only while their modal is open.
//
// The status pills here are read-only and derived from the same three status
// endpoints the matrix uses; we refetch when a modal closes so the summary keeps up.
// Light Account chrome (Law 9), matching the surrounding cards.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { EnvelopeSimple, WhatsappLogo, X } from "@phosphor-icons/react";
import { OutlookLogo } from "./provider-logos";

type ChannelKey = "outlook" | "email" | "whatsapp";

type OutlookStatus = { configured?: boolean; connections: { email: string }[] };
type ImapConn = { email: string; lastError: string | null; sendState: "sends" | "offer" | "domain_covered" | "unavailable" };
type ImapStatus = { configured?: boolean; connections: ImapConn[] };
type WaStatus = { configured?: boolean; connection: { status: string; phoneNumber: string | null } | null };

const CORAL = "var(--agent-coral, #FF6B4A)";

const BULLETS: Record<ChannelKey, string[]> = {
  outlook: ["Send and receive emails through Outlook", "Automatically chase outstanding updates", "Save replies to the correct sale", "Keep your sale timeline up to date"],
  email: ["Send emails from your own address", "Automatically chase outstanding updates", "Save replies to the correct sale", "Keep your sale timeline up to date"],
  whatsapp: ["Connect using WhatsApp's linked devices", "Capture conversations from your property groups", "Save messages to the correct sale", "Keep group conversations on your sale timeline"],
};
const CARD_NAME: Record<ChannelKey, string> = { outlook: "Microsoft Outlook", email: "Other email providers", whatsapp: "WhatsApp" };

function ChannelLogo({ k }: { k: ChannelKey }) {
  if (k === "outlook") return <OutlookLogo size={38} />;
  if (k === "whatsapp") return (
    <span className="flex h-[38px] w-[38px] items-center justify-center rounded-lg" style={{ background: "#25D366" }}>
      <WhatsappLogo size={22} weight="fill" color="#fff" />
    </span>
  );
  return (
    <span className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
      <EnvelopeSimple size={20} weight="bold" style={{ color: CORAL }} />
    </span>
  );
}

const PILL: Record<"on" | "warn" | "off", string> = {
  on: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  off: "border-gray-200 bg-gray-50 text-gray-500",
};
const DOT: Record<"on" | "warn" | "off", string> = { on: "bg-emerald-500", warn: "bg-amber-500", off: "bg-gray-300" };

export function ConnectionsCardsRow({ outlook, email, whatsapp }: { outlook: ReactNode; email: ReactNode; whatsapp: ReactNode }) {
  const [o, setO] = useState<OutlookStatus | null>(null);
  const [i, setI] = useState<ImapStatus | null>(null);
  const [w, setW] = useState<WaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ChannelKey | null>(null);

  const load = useCallback(() => {
    Promise.allSettled([
      fetch("/api/integrations/outlook/status").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/integrations/imap/status").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/agent/whatsapp/status").then((r) => (r.ok ? r.json() : null)),
    ]).then(([a, b, c]) => {
      if (a.status === "fulfilled") setO(a.value);
      if (b.status === "fulfilled") setI(b.value);
      if (c.status === "fulfilled") setW(c.value);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  // Deep-link + callback support, so these land exactly as before now the cards
  // live behind a modal:
  //   • #whatsapp (from Focus) opens the WhatsApp connect flow;
  //   • ?outlook=connected|error (the Outlook OAuth callback) opens the Outlook
  //     card so its success/error banner still shows.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#whatsapp") setOpen("whatsapp");
    else if (new URLSearchParams(window.location.search).has("outlook")) setOpen("outlook");
  }, []);

  // Close the modal and refresh the summary pills (the full card may have changed
  // what's connected while it was open).
  const closeModal = useCallback(() => { setOpen(null); setLoading(true); load(); }, [load]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") closeModal(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  const outlookConns = o?.connections ?? [];
  const imapConns = i?.connections ?? [];
  const imapSends = imapConns.some((c) => c.sendState === "sends" || c.sendState === "domain_covered");
  const imapReadIssue = imapConns.some((c) => !!c.lastError);
  const waConn = w?.connection ?? null;

  // Whether the channel is switched on for this user at all. In production all
  // three stay on, so this only ever shows if one is deliberately turned off.
  // Default to available while loading / if a status fetch fails, so we never
  // flash "not available" over a channel that's actually fine.
  const avail: Record<ChannelKey, boolean> = {
    outlook: o === null ? true : o.configured !== false,
    email: i === null ? true : i.configured !== false,
    whatsapp: w === null ? true : w.configured !== false,
  };

  type Meta = { connected: boolean; tone: "on" | "warn" | "off"; label: string; summary: ReactNode };
  const meta: Record<ChannelKey, Meta> = {
    outlook: outlookConns.length > 0
      ? { connected: true, tone: "on", label: `${outlookConns.length} connected`, summary: <span className="truncate">{outlookConns.length === 1 ? outlookConns[0].email : `${outlookConns.length} inboxes connected`}</span> }
      : { connected: false, tone: "off", label: "Not connected", summary: null },
    email: imapConns.length === 0
      ? { connected: false, tone: "off", label: "Not connected", summary: null }
      : {
          connected: true,
          tone: imapReadIssue || !imapSends ? "warn" : "on",
          label: imapReadIssue || !imapSends ? "Needs attention" : "Connected",
          summary: (
            <span className="flex flex-wrap gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${imapSends ? PILL.on : PILL.off}`}>{imapSends ? "Sending on" : "Sending off"}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${imapReadIssue ? PILL.warn : PILL.on}`}>{imapConns.length} inbox{imapConns.length === 1 ? "" : "es"}</span>
            </span>
          ),
        },
    whatsapp: waConn?.status === "connected"
      ? { connected: true, tone: "on", label: "Connected", summary: <span className="truncate">{waConn.phoneNumber ?? "Linked"}</span> }
      : waConn?.status === "pending_qr"
        ? { connected: false, tone: "warn", label: "Waiting to scan", summary: null }
        : { connected: false, tone: "off", label: "Not connected", summary: null },
  };

  const hosted: Record<ChannelKey, ReactNode> = { outlook, email, whatsapp };

  function Card({ k }: { k: ChannelKey }) {
    const m = meta[k];
    const available = avail[k];
    const tone = available ? m.tone : "off";
    const statusLabel = loading ? "Checking…" : !available ? "Not available yet" : m.label;
    return (
      <article className="flex flex-col rounded-xl border border-gray-200 bg-white p-5" style={tone === "on" ? { borderColor: "rgb(167 243 208)" } : tone === "warn" ? { borderColor: "rgb(253 230 138)" } : undefined}>
        <div className="flex items-start gap-3">
          <ChannelLogo k={k} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-tight text-gray-900">{CARD_NAME[k]}</p>
            <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
              <span className={`h-[7px] w-[7px] rounded-full ${DOT[tone]}`} />
              <span className={tone === "on" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : ""}>{statusLabel}</span>
            </span>
          </div>
        </div>

        {!loading && available && m.connected ? (
          <div className="mt-4 text-[12.5px] font-medium text-gray-700">{m.summary}</div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {BULLETS[k].map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-[12.5px] text-gray-500">
                <span className="h-[13px] w-[13px] shrink-0 rounded-full border border-gray-300 opacity-60" />
                {b}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-5">
          {loading ? (
            <span className="inline-block h-[38px] w-[132px] animate-pulse rounded-lg bg-gray-100" />
          ) : !available ? (
            <button disabled className="cursor-default rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-[13px] font-medium text-gray-400">
              Not available yet
            </button>
          ) : m.connected ? (
            <button
              onClick={() => setOpen(k)}
              className="pbtn pbtn-press rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage
            </button>
          ) : (
            <button
              onClick={() => setOpen(k)}
              className="agent-btn agent-btn-md agent-btn-primary"
            >
              {k === "outlook" ? "Connect Outlook" : k === "email" ? "Connect email provider" : "Connect WhatsApp"}
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card k="outlook" />
        <Card k="email" />
        <div id="whatsapp" style={{ scrollMarginTop: 80 }}><Card k="whatsapp" /></div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-4 sm:p-6"
          style={{ background: "rgba(15,15,15,0.45)", backdropFilter: "blur(3px)" }}
          onClick={closeModal}
        >
          <div className="relative my-auto w-full max-w-[600px]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={18} weight="bold" />
            </button>
            {hosted[open]}
          </div>
        </div>
      )}
    </>
  );
}
