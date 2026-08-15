import { Suspense } from "react";
import Link from "next/link";
import { OutlookConnectionCard } from "@/components/command/integrations/OutlookConnectionCard";

// Command Centre → Settings → Connections. Per-user integrations that link an
// external mailbox to the platform. Phase 1: Microsoft Outlook connect only.

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/command/settings"
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Settings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-100">Connections</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Connect an external mailbox to your account. Each person connects their own.
        </p>
      </div>

      <section className="max-w-2xl">
        <Suspense fallback={null}>
          <OutlookConnectionCard />
        </Suspense>
      </section>
    </div>
  );
}
