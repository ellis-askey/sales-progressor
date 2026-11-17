"use client";

// On the Chain tab the right sidebar shows steps + notes instead of Sale health.
// The file shell renders one persistent sidebar across all tabs, so we swap it
// client-side here: on /chain render ChainSidePanel, on every other tab render
// the normal sidebar (passed as children) completely untouched.

import { usePathname } from "next/navigation";
import { ChainSidePanel } from "@/components/chain/ChainSidePanel";

export function ChainAwareSidebar({ transactionId, children }: { transactionId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.endsWith("/chain")) return <ChainSidePanel transactionId={transactionId} />;
  return <>{children}</>;
}
