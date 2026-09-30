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
import { titleCaseKeepAcronyms } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useAddClientForm(onDone?: () => void) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(agentEmail.trim());
  const emailInvalid = agentEmail.trim().length > 0 && !emailValid;
  const canSubmit = !!agentName.trim() && !!agencyName.trim() && emailValid;

  // Tidy on blur: acronym-safe title-case on the name + agency (so "cj oak" ->
  // "CJ Oak", not "Cj Oak"), lowercase + trim the email.
  function blurName() { const v = agentName.trim(); if (v) setAgentName(titleCaseKeepAcronyms(v)); }
  function blurAgency() { const v = agencyName.trim(); if (v) setAgencyName(titleCaseKeepAcronyms(v)); }
  function blurEmail() { const v = agentEmail.trim(); if (v) setAgentEmail(v.toLowerCase()); }

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

    // Normalise once more at submit — covers values changed without a blur.
    const cleanName = titleCaseKeepAcronyms(agentName.trim());
    const cleanEmail = agentEmail.trim().toLowerCase();
    const cleanAgency = titleCaseKeepAcronyms(agencyName.trim());

    const fd = new FormData();
    fd.set("agentName", cleanName);
    fd.set("agentEmail", cleanEmail);
    fd.set("agencyName", cleanAgency);

    const res = await addClientAgencyAction(fd);
    setAdding(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Client added", {
      description: `We've emailed ${cleanName} an invite to set up their login.`,
    });
    reset();
    router.refresh();
    onDone?.();
  }

  return {
    agentName, setAgentName,
    agentEmail, setAgentEmail,
    agencyName, setAgencyName,
    adding, error, canSubmit, emailInvalid,
    blurName, blurAgency, blurEmail,
    submit, reset,
  };
}
