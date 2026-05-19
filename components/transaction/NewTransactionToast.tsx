"use client";

import { useEffect } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function NewTransactionToast() {
  const { toast } = useAgentToast();

  useEffect(() => {
    const address = sessionStorage.getItem("newTransaction");
    if (address) {
      sessionStorage.removeItem("newTransaction");
      toast.success("File created", { description: address });
    }
  }, [toast]);

  return null;
}
