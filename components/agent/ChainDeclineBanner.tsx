"use client";

import { useState, useTransition } from "react";
import { XCircle } from "@phosphor-icons/react";
import { dismissChainDecline } from "@/app/actions/dismiss-chain-decline";
import { AgentBanner } from "@/components/ui/AgentBanner";

interface Props {
  address: string;
}

export function ChainDeclineBanner({ address }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  if (dismissed) return null;

  function handleDismiss() {
    startTransition(async () => {
      await dismissChainDecline();
      setDismissed(true);
    });
  }

  return (
    <AgentBanner
      kind="danger"
      icon={<XCircle size={18} weight="fill" />}
      title="A chain invite was declined"
      body={`An agent declined your invite for ${address}. Open their file to resend or update the contact.`}
      dismissible={{ onDismiss: handleDismiss }}
    />
  );
}
