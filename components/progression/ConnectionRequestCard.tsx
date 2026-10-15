"use client";

// The interactive Accept / Decline card for a single progression-business
// connection request, shown on the agency director's hub (via
// ConnectionRequestBanner). Accept connects the business as a progressor for
// this agency; decline dismisses it. Each sale is still assigned per-sale.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { AgencyMeshMark } from "./AgencyMeshMark";
import { respondToConnectionRequestAction } from "@/app/actions/progression-clients";

export function ConnectionRequestCard({ id, businessName }: { id: string; businessName: string }) {
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
      <span className="crc-logo"><AgencyMeshMark name={businessName} size={42} /></span>
      <div className="crc-main">
        <p className="crc-title"><b>{businessName}</b> would like to progress your sales</p>
        <p className="crc-body">They&rsquo;ll only see the sales you assign to them.</p>
      </div>
      <div className="crc-acts">
        <button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" onClick={() => respond(false)} disabled={pending}>Decline</button>
        <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" onClick={() => respond(true)} disabled={pending}>{pending ? "…" : "Accept"}</button>
      </div>
      <style>{`
        .crc { display: flex; align-items: center; gap: 14px; padding: 15px 17px; }
        .crc + .crc { border-top: 1px solid var(--agent-border-subtle, rgba(0,0,0,0.08)); }
        .crc-logo { width: 42px; height: 42px; border-radius: 10px; overflow: hidden; flex: none; border: 0.5px solid var(--agent-border-subtle); }
        .crc-main { flex: 1; min-width: 0; }
        .crc-title { margin: 0; font-size: 14px; color: var(--agent-text-primary, #211D1B); line-height: 1.3; }
        .crc-title b { font-weight: 720; }
        .crc-body { margin: 2px 0 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.45; }
        .crc-acts { display: flex; gap: 8px; flex: none; }
      `}</style>
    </div>
  );
}
