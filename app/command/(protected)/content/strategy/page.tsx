import Link from "next/link";
import { getBalance } from "@/lib/command/content/balance";
import { getBrandProfile } from "@/lib/command/content/brand";
import { getLatestReview } from "@/lib/command/content/strategy-review";
import { ContentBalance } from "@/components/command/content/ContentBalance";
import { QuarterFocusEditor } from "@/components/command/content/QuarterFocusEditor";
import { BrandReviewPanel } from "@/components/command/content/BrandReviewPanel";
import { Section } from "@/components/command/ui/primitives";

// Content strategy (docs/active/content-brand/SPEC.md, Phase 2.2 + 2.3). The
// strategist view: the rolling quarter focus, the balance of what's being
// published, and a periodic AI brand review. Superadmin gating handled by the
// (protected) layout.

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const [balance, profile, review] = await Promise.all([getBalance(), getBrandProfile(), getLatestReview()]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Strategy</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            What you want to be known for, the shape of what you&rsquo;re publishing, and an honest read of where your
            brand stands.
          </p>
        </div>
        <Link href="/command/content" className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Content
        </Link>
      </div>

      <Section
        title="This quarter"
        subtitle="What you want to be known for right now. Steers your review and your opportunities."
      >
        <QuarterFocusEditor initial={profile?.quarterFocus ?? ""} />
      </Section>

      <Section
        title="Balance"
        subtitle="The recent mix across your content pillars. A guide, not a rigid calendar."
      >
        <ContentBalance balance={balance} />
      </Section>

      <Section
        title="Brand review"
        subtitle="A PR consultant's read of where your brand stands and where to lean next."
      >
        <BrandReviewPanel
          initial={
            review
              ? {
                  id: review.id,
                  createdAt: review.createdAt.toISOString(),
                  summary: review.summary,
                  leanInto: review.leanInto,
                  overused: review.overused,
                  breakout: review.breakout,
                  underusedExpertise: review.underusedExpertise,
                }
              : null
          }
        />
      </Section>
    </div>
  );
}
