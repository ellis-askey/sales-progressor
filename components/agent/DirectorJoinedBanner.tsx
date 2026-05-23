"use client";

import { useState, useTransition } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { dismissDirectorJoined } from "@/app/actions/dismiss-director-joined";
import { AgentBanner } from "@/components/ui/AgentBanner";

interface Props {
  directorName: string;
  agencyName: string;
}

export function DirectorJoinedBanner({ directorName, agencyName }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  if (dismissed) return null;

  function handleDismiss() {
    startTransition(async () => {
      await dismissDirectorJoined();
      setDismissed(true);
    });
  }

  return (
    <AgentBanner
      kind="success"
      icon={<CheckCircle size={18} weight="fill" />}
      title={`${directorName} has joined ${agencyName}`}
      body="They can now see all your active sales."
      dismissible={{ onDismiss: handleDismiss }}
    />
  );
}
