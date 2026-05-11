"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { getTransactionReminderCountAction } from "@/app/actions/tasks";

export function RemindersReadyNotice({ transactionId }: { transactionId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useAgentToast();

  useEffect(() => {
    if (params.get("newFile") !== "1") return;

    router.replace(pathname, { scroll: false });

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 8;

    const poll = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const count = await getTransactionReminderCountAction(transactionId);
        if (count > 0) {
          if (!cancelled) {
            toast.success("Reminders are set up", {
              description: "Check the Reminders tab to see what needs following up.",
            });
          }
          return;
        }
      } catch {
        // ignore poll errors
      }
      if (attempts < MAX_ATTEMPTS && !cancelled) {
        setTimeout(poll, 1500);
      }
    };

    setTimeout(poll, 1500);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
