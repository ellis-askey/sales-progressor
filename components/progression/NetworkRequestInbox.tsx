"use client";

// The progression-business owner's inbox of INCOMING network connection requests
// (an agency found them in the Progressor Network and asked to connect). Shown on
// the Clients surface. Accept links the agency as a client (source "network") and
// it then appears under "Your agencies"; decline removes the request. Each sale is
// still assigned per-sale — accepting is a connection, not a commitment.
//
// Reuses the real handshake action respondToNetworkRequestAction (owner-gated).
// Renders nothing when there are no pending requests.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Info } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Button } from "@/components/ui/Button";
import { AgencyMeshMark } from "./AgencyMeshMark";
import { respondToNetworkRequestAction } from "@/app/actions/progressor-network";
import type { IncomingNetworkRequest } from "@/lib/services/progression-clients";

function relTime(value: Date | string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NetworkRequestInbox({ requests }: { requests: IncomingNetworkRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <section className="nri" aria-label="Connection requests">
      <p className="nri-label">
        Connection requests
        <span className="nri-count">{requests.length}</span>
      </p>
      <div className="nri-list">
        {requests.map((r) => (
          <NetworkRequestRow key={r.id} req={r} />
        ))}
      </div>
      <style>{`
        .nri-label { margin: 0 0 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--agent-text-muted); display: flex; align-items: center; gap: 8px; }
        .nri-count { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--agent-coral); color: #fff; font-size: 10.5px; font-weight: 700; letter-spacing: 0; }
        .nri-list { display: flex; flex-direction: column; gap: 10px; }
      `}</style>
    </section>
  );
}

function NetworkRequestRow({ req }: { req: IncomingNetworkRequest }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [pending, start] = useTransition();
  const [acting, setActing] = useState<null | "accept" | "decline">(null);

  function respond(accept: boolean) {
    if (pending) return;
    setActing(accept ? "accept" : "decline");
    start(async () => {
      const res = await respondToNetworkRequestAction({ requestId: req.id, accept });
      if (res.ok) {
        if (accept) toast.success(`${req.agencyName} connected`, { description: "They're now one of your client agencies." });
        else toast.info("Request declined");
        router.refresh();
      } else {
        toast.error("Couldn't respond to the request", { description: res.error });
        setActing(null);
      }
    });
  }

  return (
    <div className="nri-card agent-glass">
      <div className="nri-top">
        <span className="nri-eyebrow">Wants to connect</span>
        <span className="nri-time">{relTime(req.createdAt)}</span>
      </div>

      <div className="nri-id">
        <span className="nri-mark" aria-hidden>
          <AgencyMeshMark name={req.agencyName} size={46} />
        </span>
        <div className="nri-idmain">
          <p className="nri-name">{req.agencyName}</p>
          <p className="nri-say">would like to establish a working relationship with your business.</p>
        </div>
      </div>

      {req.message && req.message.trim() !== "" && (
        <div className="nri-note">
          <p className="nri-note-l">Introduction</p>
          <p className="nri-note-b">{req.message}</p>
        </div>
      )}

      <p className="nri-info">
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        Accepting establishes a connection, not a commitment to take on any sales. You choose which sales they progress.
      </p>

      <div className="nri-acts">
        <Button variant="secondary" size="md" onClick={() => respond(false)} disabled={pending} loading={pending && acting === "decline"}>
          Decline
        </Button>
        <Button variant="primary" size="md" className="nri-accept" onClick={() => respond(true)} disabled={pending} loading={pending && acting === "accept"}>
          <Check size={15} weight="bold" /> Accept
        </Button>
      </div>

      <style>{`
        .nri-card { border-radius: var(--agent-radius-xl); padding: 18px 20px; }
        .nri-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .nri-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--agent-coral-deep); }
        .nri-time { font-size: 12px; color: var(--agent-text-muted); }
        .nri-id { display: flex; gap: 13px; align-items: center; }
        .nri-mark { width: 46px; height: 46px; border-radius: var(--agent-radius-md); overflow: hidden; flex-shrink: 0; border: 0.5px solid var(--agent-border-subtle); }
        .nri-idmain { min-width: 0; flex: 1; }
        .nri-name { margin: 0; font-size: 15.5px; font-weight: 750; letter-spacing: -0.01em; color: var(--agent-text-primary); }
        .nri-say { margin: 2px 0 0; font-size: 13px; color: var(--agent-text-secondary); line-height: 1.45; }
        .nri-note { margin: 14px 0 0; padding: 12px 14px; background: var(--agent-surface-sunken, rgba(0,0,0,0.035)); border-radius: var(--agent-radius-md); border: 1px solid var(--agent-border-subtle); }
        .nri-note-l { margin: 0 0 5px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--agent-text-muted); }
        .nri-note-b { margin: 0; font-size: 13.5px; color: var(--agent-text-secondary); line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
        .nri-info { margin: 14px 0 0; display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.5; }
        .nri-acts { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--agent-border-subtle); }
        .nri-accept { gap: 7px;
          background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); }
        .nri-accept:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .nri-accept:active:not(:disabled) { transform: scale(0.98); }
      `}</style>
    </div>
  );
}
