"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function MosConfirmedNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useAgentToast();

  useEffect(() => {
    if (params.get("mosConfirmed") === "1") {
      toast.success("MOS confirmed for both sides", {
        description: "Seller and buyer MOS received milestones auto-confirmed from the uploaded memo.",
      });
      router.replace(pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
