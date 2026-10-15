"use client";

// Shared "connect an agency already on Sales Progressor" form state (the
// multi-progressor consent handshake). Both the onboarding empty state
// (ClientsEmptyState) and the populated list's Add-a-client modal use this, so
// there's a single source of truth for the fields, validation, submit, toast
// and refresh (Law 4). Sending a request creates NOTHING until the target
// agency's director accepts — and even then access is granted per-sale, not by
// the link (see lib/services/progression-clients).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { requestConnectAgencyAction } from "@/app/actions/progression-clients";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useConnectAgencyForm(onDone?: () => void) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  // Flat fee per sale, in pounds (digits only). Empty = not set yet.
  const [feePounds, setFeePounds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, start] = useTransition();

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = emailValid && !sending;

  function blurEmail() { const v = email.trim(); if (v) setEmail(v.toLowerCase()); }

  function reset() {
    setEmail("");
    setFeePounds("");
    setError(null);
  }

  function submit() {
    if (!canSubmit) return;
    setError(null);
    start(async () => {
      const feeDigits = feePounds.replace(/[^0-9]/g, "");
      const res = await requestConnectAgencyAction({
        email: email.trim().toLowerCase(),
        feePence: feeDigits ? parseInt(feeDigits, 10) * 100 : null,
      });
      if (!res.ok) { setError(res.error); return; }
      toast.success("Connection request sent", {
        description: "We've sent their director a request to approve.",
      });
      reset();
      router.refresh();
      onDone?.();
    });
  }

  return {
    email, setEmail,
    feePounds, setFeePounds,
    error, sending, canSubmit, emailValid,
    blurEmail, submit, reset,
  };
}
