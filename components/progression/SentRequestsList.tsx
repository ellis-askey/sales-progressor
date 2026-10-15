"use client";

// Pending "connect an existing agency" requests a progression-business owner has
// sent, awaiting the target agency director's accept/decline. Shown on the
// Clients surface (both the empty-state hero and the populated workspace) so the
// owner can see what's in flight and withdraw a request before it's answered.
// Nothing is shared with the target agency until they accept.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Clock } from "@phosphor-icons/react";
import { AgencyMeshMark } from "./AgencyMeshMark";
import { withdrawConnectionRequestAction } from "@/app/actions/progression-clients";
import type { OutgoingConnectionRequest } from "@/lib/services/progression-clients";

function SentRow({ req }: { req: OutgoingConnectionRequest }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [pending, start] = useTransition();

  function cancel() {
    start(async () => {
      const res = await withdrawConnectionRequestAction({ requestId: req.id });
      if (res.ok) { toast.success("Request withdrawn"); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="srq-row">
      <span className="srq-logo"><AgencyMeshMark name={req.agencyName} size={44} /></span>
      <div className="srq-main">
        <div className="srq-name">{req.agencyName}</div>
        <div className="srq-meta">
          <span className="srq-line1"><Clock size={12} weight="bold" />Request sent</span>
          <span className="srq-dot" aria-hidden>·</span>
          <span className="srq-m2">Waiting for them to accept</span>
        </div>
      </div>
      <button type="button" className="srq-cancel" onClick={cancel} disabled={pending}>
        {pending ? "Withdrawing…" : "Withdraw"}
      </button>
    </div>
  );
}

export function SentRequestsList({ requests }: { requests: OutgoingConnectionRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <div className="srq">
      <p className="srq-label">Requests sent</p>
      <div className="srq-rows">
        {requests.map((r) => <SentRow key={r.id} req={r} />)}
      </div>
      <style>{`
        .srq-label { margin: 0 0 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-text-muted); }
        .srq-rows { display: flex; flex-direction: column; gap: 8px; }
        .srq-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px;
          background: var(--agent-surface, rgba(255,255,255,0.7)); border: 0.5px solid var(--agent-border-subtle);
          box-shadow: 0 1px 2px rgba(20,14,10,0.04); }
        .srq-logo { width: 44px; height: 44px; border-radius: 11px; overflow: hidden; flex: none; border: 0.5px solid var(--agent-border-subtle); }
        .srq-main { flex: 1; min-width: 0; }
        .srq-name { font-size: 14px; font-weight: 700; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .srq-meta { display: flex; align-items: center; gap: 5px; margin-top: 2px; font-size: 12px; color: var(--agent-text-muted); }
        .srq-line1 { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
        /* When the row is tight, stack the two parts cleanly: hide the dot and
           drop "Waiting…" onto its own line under "Request sent". */
        @media (max-width: 540px) {
          .srq-meta { flex-direction: column; align-items: flex-start; gap: 1px; }
          .srq-dot { display: none; }
        }
        .srq-cancel { flex: none; appearance: none; border: 1px solid var(--agent-border-default); background: var(--agent-surface);
          border-radius: 9px; padding: 7px 13px; font-size: 12.5px; font-weight: 640; color: var(--agent-text-secondary); cursor: pointer;
          transition: border-color .15s, color .15s; }
        .srq-cancel:hover:not(:disabled) { border-color: var(--agent-border-strong); color: var(--agent-text-primary); }
        .srq-cancel:disabled { opacity: 0.55; cursor: default; }
      `}</style>
    </div>
  );
}
