"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { getTransactionReminderCountAction } from "@/app/actions/tasks";

export function RemindersReadyNotice({ transactionId }: { transactionId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useAgentToast();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (params.get("newFile") !== "1") return;

    // Clean the URL immediately so refresh doesn't re-trigger
    router.replace(pathname, { scroll: false });

    const MAX_ATTEMPTS = 8;

    pollingRef.current = setInterval(async () => {
      attemptsRef.current++;
      try {
        const count = await getTransactionReminderCountAction(transactionId);
        if (count > 0) {
          clearInterval(pollingRef.current!);
          toast.success("Chase reminders are active", {
            description: "Check the Reminders tab to see what needs following up.",
          });
        }
      } catch {
        // ignore poll errors
      }
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        clearInterval(pollingRef.current!);
      }
    }, 1500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
