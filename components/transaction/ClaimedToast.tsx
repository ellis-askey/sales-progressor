"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function ClaimedToast({ address }: { address: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useAgentToast();
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current && params.get("claimed") === "1" && params.get("newUser") !== "1") {
      fired.current = true;
      toast.success("You're in the chain", {
        description: "Open the chain panel to see how the other sales are progressing.",
        duration: 5000,
      });
      router.replace(pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
