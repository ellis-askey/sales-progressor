"use client";

// Shared add-client form state for the Clients surface. Both the onboarding
// empty state (ClientsEmptyState) and the populated list (ClientsManager) use
// this so there's a single source of truth for the fields, validation, submit,
// toast and refresh (Law 4). Adding a client creates the agent's own agency +
// a pending login (emailed an invite) and the business link; it grants NO
// access to that agency's transactions (see lib/services/progression-clients).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { addClientAgencyAction } from "@/app/actions/progression-clients";

export function useAddClientForm(onDone?: () => void) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!agentName.trim() && !!agentEmail.trim() && !!agencyName.trim();

  function reset() {
    setAgentName("");
    setAgentEmail("");
    setAgencyName("");
    setError(null);
  }

  async function submit() {
    if (!canSubmit || adding) return;
    setAdding(true);
    setError(null);

    const fd = new FormData();
    fd.set("agentName", agentName.trim());
    fd.set("agentEmail", agentEmail.trim());
    fd.set("agencyName", agencyName.trim());

    const res = await addClientAgencyAction(fd);
    setAdding(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Client added", {
      description: `We've emailed ${agentName.trim()} an invite to set up their login.`,
    });
    reset();
    router.refresh();
    onDone?.();
  }

  return {
    agentName, setAgentName,
    agentEmail, setAgentEmail,
    agencyName, setAgencyName,
    adding, error, canSubmit,
    submit, reset,
  };
}
