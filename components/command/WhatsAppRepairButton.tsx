"use client";

import { useState, useTransition } from "react";
import { repairWhatsAppBridgeAction } from "@/app/actions/command-whatsapp";

// Forces the bridge to re-pair: clears its credentials and restarts pairing so a
// fresh QR appears at the pairing page. Recovers a logged-out / stuck bridge
// without touching the Railway host.
export function WhatsAppRepairButton({ pairUrl }: { pairUrl: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function repair() {
    start(async () => {
      const res = await repairWhatsAppBridgeAction();
      setMsg(res.ok ? "Re-pairing. Open the pairing page to scan the new code." : res.error ?? "Couldn't re-pair.");
    });
  }

  return (
    <div className="flex items-center gap-3">
      {pairUrl && (
        <a
          href={pairUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] px-2.5 py-1 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800/60 transition-colors"
        >
          Pair / scan QR
        </a>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={repair}
        className="text-[12px] px-2.5 py-1 rounded-lg border border-[#5a2c2c] text-[#f8a4a4] hover:bg-[#2c1414]/60 transition-colors disabled:opacity-50"
      >
        {pending ? "Re-pairing…" : "Force re-pair"}
      </button>
      {msg && <span className="text-[11px] text-neutral-500">{msg}</span>}
    </div>
  );
}
