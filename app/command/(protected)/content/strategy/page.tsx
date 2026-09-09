import Link from "next/link";
import { getBalance } from "@/lib/command/content/balance";
import { ContentBalance } from "@/components/command/content/ContentBalance";
import { Section } from "@/components/command/ui/primitives";

// Content strategy (docs/active/content-brand/SPEC.md, Phase 2.2). The
// strategist view. Phase 2.2 ships the balance section; Phase 2.3 adds the
// rolling quarter focus + brand review. Superadmin gating handled by the
// (protected) layout.

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const balance = await getBalance();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Strategy</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            The shape of what you&rsquo;re publishing, so the feed stays varied in substance rather than drifting into
            one note.
          </p>
        </div>
        <Link href="/command/content" className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Content
        </Link>
      </div>

      <Section
        title="Balance"
        subtitle="The recent mix across your content pillars. A guide, not a rigid calendar."
      >
        <ContentBalance balance={balance} />
      </Section>
    </div>
  );
}
