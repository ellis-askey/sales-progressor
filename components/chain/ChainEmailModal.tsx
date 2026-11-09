"use client";

// "Email the chain" — the shared modal used by both the chain tab/drawer
// (ChainView) and the Chains check-ins list. Opens the normal composer in chain
// mode: the chain's agents live in the To/Cc/Bcc dropdown, a no-email agent
// opens the chain edit drawer (via onOpenAddNode) and auto-places once saved.
// Optionally pre-addresses one agent into To (e.g. a check-in row's "Email X").

import { useEffect, useState } from "react";
import { ComposeEmailModal, type ComposePrefill, type ComposeSaleHint } from "@/components/compose/ComposeEmailModal";
import { buildChainEmailDraft, composeChainQuestionsEmail, type ChainEmailAgent, type ChainEmailDraft } from "@/app/actions/chain-email";
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
  elevated = false,
  onCloseStart,
  initialDraft = null,
  initialSaleHint = null,
}: {
  open: boolean;
  transactionId: string;
  // Pre-address a specific agent into To (optional).
  initialToEmail?: string | null;
  onClose: () => void;
  onOpenAddNode?: OpenAddNode;
  refreshKey?: number;
  // Prefetched draft (warmed on the button's hover/focus) so the composer seeds
  // instantly on open instead of waiting on the build round-trip. Only used for
  // the full-chain email (no single pre-addressed agent).
  initialDraft?: ChainEmailDraft | null;
  // The anchor property (address + photo) the drawer already has — lets the
  // composer paint the sale card + a form skeleton immediately rather than
  // flashing the empty "search your sales" box while the context loads.
  initialSaleHint?: ComposeSaleHint | null;
  // Launched from the chain drawer: layer above it (z-2000) and dock as a bottom
  // sheet on narrow screens. Off (default) for the page-level check-ins launch,
  // which opens over the page and keeps the standard centred-modal level.
  elevated?: boolean;
  // Fired the instant the composer begins closing (backdrop / X / Escape / after a
  // successful send) — lets the drawer start its un-park before we fully unmount.
  onCloseStart?: () => void;
}) {
  const { toast } = useAgentToast();
  const [agents, setAgents] = useState<ChainEmailAgent[]>([]);
  const [prefill, setPrefill] = useState<ComposePrefill | null>(null);
  const [shareHtml, setShareHtml] = useState<string | null>(null);
  const [canFullChain, setCanFullChain] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ linkId: string; field: Field } | null>(null);
  const [autoPlace, setAutoPlace] = useState<{ email: string; name: string; field: Field } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Seed the agents + prefill from a resolved draft (shared by the prefetch and
  // the fetch paths).
  function applyDraft(draft: ChainEmailDraft) {
    setAgents(draft.agents);
    setChainId(draft.chainId);
    setShareHtml(draft.shareSummaryHtml);
    setCanFullChain(draft.canComposeFullChain);
    const pre = initialToEmail
      ? draft.agents.filter((a) => a.email && a.email.toLowerCase() === initialToEmail.toLowerCase())
      : [];
    setPrefill({
      transactionId: draft.anchorTransactionId,
      to: pre.map((a) => ({ email: a.email as string, name: a.name })),
      subject: draft.subject,
      bodyHtml: "<p>Hi all,</p><p><br></p>",
    });
  }

  // Load the draft once per open (keyed by sale + the pre-addressed agent).
  useEffect(() => {
    if (!open) { setLoadedFor(null); return; }
    const key = `${transactionId}|${initialToEmail ?? ""}`;
    if (loadedFor === key) return;
    // Prefetched on the button's hover/focus: seed synchronously, no round-trip.
    // Only the full-chain email (a single pre-addressed agent still fetches, as
    // the prefetch doesn't carry that filter).
    if (initialDraft && !initialToEmail) { applyDraft(initialDraft); setLoadedFor(key); return; }
    let cancelled = false;
    void buildChainEmailDraft(transactionId).then((res) => {
      if (cancelled) return;
      if (!res.ok) { toast.error(res.error); onClose(); return; }
      applyDraft(res.draft);
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
      onCloseStart={onCloseStart}
      elevated={elevated}
      initialSaleHint={initialSaleHint}
      shareSummaryHtml={shareHtml}
      onComposeFullChain={
        canFullChain
          ? (recipientEmails) =>
              composeChainQuestionsEmail({ transactionId, recipientEmails }).then((r) => (r.ok ? r.html : null))
          : undefined
      }
      prefill={prefill}
      chainAgents={agents.map((a) => ({ linkId: a.linkId, name: a.name, email: a.email, image: a.image, address: a.address }))}
      onNeedAgentEmail={handleNeedAgentEmail}
      autoPlace={autoPlace}
    />
  );
}
