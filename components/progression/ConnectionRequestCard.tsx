"use client";

// The interactive Accept / Decline card for a single progression-business
// connection request, shown on the agency director's hub (via
// ConnectionRequestBanner). Accept connects the business as a progressor for
// this agency; decline dismisses it. Each sale is still assigned per-sale.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { respondToConnectionRequestAction } from "@/app/actions/progression-clients";

export function ConnectionRequestCard({ id, businessName, feeLabel }: { id: string; businessName: string; feeLabel: string | null }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [pending, start] = useTransition();

  function respond(accept: boolean) {
    start(async () => {
      const res = await respondToConnectionRequestAction({ requestId: id, accept });
      if (res.ok) { toast.success(accept ? `${businessName} connected` : "Request declined"); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="crc">
      <span className="crc-logo" aria-hidden>
        {businessName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
      </span>
      <div className="crc-main">
        <p className="crc-title"><b>{businessName}</b> would like to progress your sales</p>
        <p className="crc-body">They&rsquo;ll only see the sales you assign to them.{feeLabel ? ` Their fee: ${feeLabel}.` : ""}</p>
      </div>
      <div className="crc-acts">
        <button type="button" className="crc-decline" onClick={() => respond(false)} disabled={pending}>Decline</button>
        <button type="button" className="crc-accept" onClick={() => respond(true)} disabled={pending}>{pending ? "…" : "Accept"}</button>
      </div>
      <style>{`
        .crc { display: flex; align-items: center; gap: 14px; padding: 15px 17px; }
        .crc + .crc { border-top: 1px solid var(--agent-border-subtle, rgba(0,0,0,0.08)); }
        .crc-logo { width: 42px; height: 42px; border-radius: 10px; flex: none; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 13px; background: linear-gradient(145deg, #A5B4FC, #4F46E5); }
        .crc-main { flex: 1; min-width: 0; }
        .crc-title { margin: 0; font-size: 14px; color: var(--agent-text-primary, #211D1B); line-height: 1.3; }
        .crc-title b { font-weight: 720; }
        .crc-body { margin: 2px 0 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.45; }
        .crc-acts { display: flex; gap: 8px; flex: none; }
        .crc-decline, .crc-accept { height: 34px; padding: 0 15px; border-radius: 9px; font-size: 13px; font-weight: 650; cursor: pointer; transition: all .15s; }
        .crc-decline { background: var(--agent-surface); border: 1px solid var(--agent-border-default); color: var(--agent-text-secondary); }
        .crc-decline:hover:not(:disabled) { border-color: var(--agent-border-strong); color: var(--agent-text-primary); }
        .crc-accept { border: none; color: #fff; background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 14px -5px rgba(255,107,74,0.5); }
        .crc-accept:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
        .crc-decline:disabled, .crc-accept:disabled { opacity: 0.55; cursor: default; }
      `}</style>
    </div>
  );
}
