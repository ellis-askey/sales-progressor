"use client";

// "Email the chain" — the shared modal used by both the chain tab/drawer
// (ChainView) and the Chains check-ins list. Opens the normal composer in chain
// mode: the chain's agents live in the To/Cc/Bcc dropdown, a no-email agent
// opens the chain edit drawer (via onOpenAddNode) and auto-places once saved.
// Optionally pre-addresses one agent into To (e.g. a check-in row's "Email X").

import { useEffect, useState } from "react";
import { ComposeEmailModal, type ComposePrefill } from "@/components/compose/ComposeEmailModal";
import { buildChainEmailDraft, type ChainEmailAgent } from "@/app/actions/chain-email";
import type { EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { useAgentToast } from "@/components/agent/AgentToaster";

type Field = "to" | "cc" | "bcc";

type OpenAddNode = (
  direction: "above" | "below",
  chainId: string,
  editingLink?: EditingLinkData,
  forkFromLinkId?: string,
  aboveOfLinkId?: string,
  insertBetween?: { anchorLinkId: string; placement: "above" | "below" },
  focusField?: "agentEmail",
) => void;

export function ChainEmailModal({
  open,
  transactionId,
  initialToEmail = null,
  onClose,
  onOpenAddNode,
  refreshKey = 0,
}: {
  open: boolean;
  transactionId: string;
  // Pre-address a specific agent into To (optional).
  initialToEmail?: string | null;
  onClose: () => void;
  onOpenAddNode?: OpenAddNode;
  refreshKey?: number;
}) {
  const { toast } = useAgentToast();
  const [agents, setAgents] = useState<ChainEmailAgent[]>([]);
  const [prefill, setPrefill] = useState<ComposePrefill | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ linkId: string; field: Field } | null>(null);
  const [autoPlace, setAutoPlace] = useState<{ email: string; name: string; field: Field } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the draft once per open (keyed by sale + the pre-addressed agent).
  useEffect(() => {
    if (!open) { setLoadedFor(null); return; }
    const key = `${transactionId}|${initialToEmail ?? ""}`;
    if (loadedFor === key) return;
    let cancelled = false;
    void buildChainEmailDraft(transactionId).then((res) => {
      if (cancelled) return;
      if (!res.ok) { toast.error(res.error); onClose(); return; }
      setAgents(res.draft.agents);
      setChainId(res.draft.chainId);
      const pre = initialToEmail
        ? res.draft.agents.filter((a) => a.email && a.email.toLowerCase() === initialToEmail.toLowerCase())
        : [];
      setPrefill({
        transactionId: res.draft.anchorTransactionId,
        to: pre.map((a) => ({ email: a.email as string, name: a.name })),
        subject: res.draft.subject,
        bodyHtml: "<p>Hi all,</p><p><br></p>",
      });
      setLoadedFor(key);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactionId, initialToEmail]);

  // A no-email agent → open the chain edit drawer on the agent-email field,
  // remembering which field to drop them into once saved.
  function handleNeedAgentEmail(linkId: string, field: Field) {
    const agent = agents.find((a) => a.linkId === linkId);
    if (!agent?.editing || !onOpenAddNode || !chainId) return;
    setPending({ linkId, field });
    onOpenAddNode("above", chainId, agent.editing, undefined, undefined, undefined, "agentEmail");
  }

  // When the chain refreshes (email saved in the drawer), refetch the agents and
  // auto-place the one we were adding.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void buildChainEmailDraft(transactionId).then((res) => {
      if (cancelled || !res.ok) return;
      setAgents(res.draft.agents);
      setPending((p) => {
        if (!p) return null;
        const a = res.draft.agents.find((x) => x.linkId === p.linkId);
        if (a?.email) { setAutoPlace({ email: a.email, name: a.name, field: p.field }); return null; }
        return p;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <ComposeEmailModal
      open={open}
      onClose={onClose}
      prefill={prefill}
      chainAgents={agents.map((a) => ({ linkId: a.linkId, name: a.name, email: a.email, image: a.image, address: a.address }))}
      onNeedAgentEmail={handleNeedAgentEmail}
      autoPlace={autoPlace}
    />
  );
}
