"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Warning } from "@phosphor-icons/react";
import { AgentBanner } from "@/components/ui/AgentBanner";

export function ChainSetupFailedBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current && params.get("chainSetupFailed") === "1") {
      fired.current = true;
      setVisible(true);
      router.replace(pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <AgentBanner
      kind="warning"
      icon={<Warning size={18} weight="fill" />}
      title="Chain setup failed"
      body="Your file was saved, but the chain wasn't linked."
      action={{
        label: "Go to chain panel →",
        onClick: () => {
          document.getElementById("chain-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
          setVisible(false);
        },
      }}
      dismissible={{ onDismiss: () => setVisible(false) }}
      className="mb-1"
    />
  );
}
