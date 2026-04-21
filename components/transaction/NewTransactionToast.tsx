"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/ToastContext";

export function NewTransactionToast() {
  const { addToast } = useToast();

  useEffect(() => {
    const address = sessionStorage.getItem("newTransaction");
    if (address) {
      sessionStorage.removeItem("newTransaction");
      addToast("File created", "success", address);
    }
  }, [addToast]);

  return null;
}
