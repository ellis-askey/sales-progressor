"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return (
    <span className="text-[10px] text-neutral-600 tabular-nums">
      auto-refresh {intervalMs / 1000}s
      {lastRefresh && ` · last ${lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
    </span>
  );
}
