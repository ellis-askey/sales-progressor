"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function ChainClaimedNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useAgentToast();
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current && params.get("claimed") === "1") {
      fired.current = true;
      toast.success("You've claimed your position in this chain.", {
        description: "Open the chain panel to see other agents.",
      });
      router.replace(pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
