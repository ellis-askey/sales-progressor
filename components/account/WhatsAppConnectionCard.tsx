"use client";

// components/account/WhatsAppConnectionCard.tsx
//
// Agent Account > Connections. A director or negotiator links their own WhatsApp
// so their "Sale of …" / "Purchase of …" property group chats are matched to the
// file. Light Account-area chrome (not the Command Centre dark card, per Law 9),
// mirroring AccountConnectionsCard. Talks only to the agent-scoped
// /api/agent/whatsapp/* routes; the bridge secret stays server-side. A consent
// tick (founder-approved copy) gates linking and is recorded server-side.

import { useCallback, useEffect, useState } from "react";
import { WhatsappLogo, CheckCircle, Warning } from "@phosphor-icons/react";

type Connection = {
  id: string;
  status: string; // pending_qr | connected
  phoneNumber: string | null;
  lastMessageAt: string | null;
  hasQr: boolean;
  qr: string | null;
  reachable: boolean;
};
type Status = { configured: boolean; connection: Connection | null };

const CORAL = "var(--agent-coral, #FF6B4A)";

export function WhatsAppConnectionCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/agent/whatsapp/status");
      if (res.ok) setStatus((await res.json()) as Status);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connection = status?.connection ?? null;
  const pending = connection?.status === "pending_qr";

  // While waiting for a scan, poll so the QR (and then the connected state) update
  // without a manual refresh.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void load({ silent: true }), 3000);
    return () => clearInterval(t);
  }, [pending, load]);

  async function startPairing() {
    setPairing(true);
    try {
      const res = await fetch("/api/agent/whatsapp/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      if (res.ok) await load({ silent: true });
    } finally {
      setPairing(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/agent/whatsapp/disconnect", { method: "POST" });
      setConsent(false);
      await load();
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = connection?.status === "connected";
  const pill = connected
    ? { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Connected" }
    : pending
      ? { cls: "border-amber-200 bg-amber-50 text-amber-700", label: "Waiting to scan" }
      : { cls: "border-gray-200 bg-gray-50 text-gray-500", label: "Not connected" };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
          <WhatsappLogo size={20} weight="fill" style={{ color: CORAL }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">WhatsApp</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                Link your WhatsApp so your property group chats are saved to the right sale.
              </p>
            </div>
            {!loading && status && (
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${pill.cls}`}>
                {pill.label}
              </span>
            )}
          </div>

          <div className="mt-4">
            {loading ? (
              <p className="text-[13px] text-gray-500">Checking&hellip;</p>
            ) : !status?.configured ? (
              <p className="text-[13px] text-gray-500">
                WhatsApp linking isn&rsquo;t switched on yet. Please check back soon.
              </p>
            ) : connected ? (
              <ConnectedView connection={connection!} disconnect={disconnect} disconnecting={disconnecting} />
            ) : pending ? (
              <PairingView connection={connection!} disconnect={disconnect} disconnecting={disconnecting} />
            ) : (
              <ConsentView
                consent={consent}
                setConsent={setConsent}
                pairing={pairing}
                startPairing={startPairing}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Connected: show the linked number and a disconnect control.
function ConnectedView({
  connection,
  disconnect,
  disconnecting,
}: {
  connection: Connection;
  disconnect: () => void;
  disconnecting: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <p className="flex items-center gap-1.5 truncate text-sm text-gray-800">
            <CheckCircle size={15} weight="fill" className="shrink-0 text-emerald-500" />
            {connection.phoneNumber ?? "Linked"}
          </p>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="pbtn pbtn-press shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {disconnecting ? "Removing…" : "Disconnect"}
          </button>
        </div>
      </div>
      <p className="text-[11.5px] leading-relaxed text-gray-400">
        Messages from your &ldquo;Sale of &hellip;&rdquo; and &ldquo;Purchase of &hellip;&rdquo; groups will appear on the matching
        sale. Your one-to-one chats and other groups are never read. Disconnecting stops all access.
      </p>
    </div>
  );
}

// Waiting for the scan: show the QR (once the bridge produces it) and how to scan.
function PairingView({
  connection,
  disconnect,
  disconnecting,
}: {
  connection: Connection;
  disconnect: () => void;
  disconnecting: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        {connection.qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={connection.qr} width={220} height={220} alt="WhatsApp QR code" className="rounded-md bg-white p-2" />
        ) : (
          <div className="flex h-[220px] w-[220px] items-center justify-center text-[13px] text-gray-500">
            {connection.reachable ? "Preparing your QR code…" : "Getting things ready…"}
          </div>
        )}
        <div className="text-[12.5px] leading-relaxed text-gray-600">
          <p className="font-medium text-gray-800">Scan this in WhatsApp to link</p>
          <p className="mt-1">
            On your phone: WhatsApp &rarr; Settings &rarr; Linked Devices &rarr; Link a device, then scan.
          </p>
          <p className="mt-1 text-gray-400">This updates on its own once you&rsquo;ve scanned.</p>
        </div>
      </div>
      <button
        onClick={disconnect}
        disabled={disconnecting}
        className="pbtn pbtn-press rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {disconnecting ? "Cancelling…" : "Cancel"}
      </button>
    </div>
  );
}

// Not linked yet: the founder-approved consent, gating the connect action.
function ConsentView({
  consent,
  setConsent,
  pairing,
  startPairing,
}: {
  consent: boolean;
  setConsent: (v: boolean) => void;
  pairing: boolean;
  startPairing: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3.5 text-[12.5px] leading-relaxed text-gray-600">
        <p>Link your WhatsApp so your property group chats appear on the right sale, with nothing to copy across.</p>
        <p>
          <strong className="font-semibold text-gray-800">What appears on your files:</strong> Only group chats
          named &ldquo;Sale of [address]&rdquo; or &ldquo;Purchase of [address]&rdquo; that match one of your live
          sales. Messages from those groups will appear on the property&rsquo;s timeline.
        </p>
        <p>
          <strong className="font-semibold text-gray-800">What we never see:</strong> Your one-to-one chats or
          any groups that aren&rsquo;t property groups. We don&rsquo;t read, store or have access to them.
        </p>
        <p>
          <strong className="font-semibold text-gray-800">How the link works:</strong> Your WhatsApp is
          connected as a linked device, in the same way as WhatsApp Web. This is an unofficial connection, so
          there is a small risk to your number. We only ever read messages and never send them, which helps
          keep that risk low. You can disconnect at any time from this screen.
        </p>
        <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--agent-coral,#FF6B4A)]"
          />
          <span className="text-gray-700">I understand and want to link my WhatsApp.</span>
        </label>
      </div>
      <button
        onClick={startPairing}
        disabled={!consent || pairing}
        className="pbtn pbtn-press pbtn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-45"
        style={{ background: CORAL }}
      >
        <WhatsappLogo size={16} weight="fill" />
        {pairing ? "Getting your code…" : "Show my QR code"}
      </button>
    </div>
  );
}
