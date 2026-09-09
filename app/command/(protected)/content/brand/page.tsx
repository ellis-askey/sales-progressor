import Link from "next/link";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import { BrandPositioning } from "@/components/command/content/BrandPositioning";
import { BrandMemoryManager } from "@/components/command/content/BrandMemoryManager";
import { Section } from "@/components/command/ui/primitives";

// Brand positioning + memory (docs/active/content-brand/SPEC.md, Phase 1.2).
// The never-invent backbone: everything the content engine suggests is checked
// against this. Superadmin gating handled by the (protected) layout.

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const [profile, memory] = await Promise.all([getBrandProfile(), getBrandMemory()]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Your brand</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            Who you are publicly, and the things we know are genuinely true about how you think and speak. The content
            engine never invents any of this. It only works from what&rsquo;s here.
          </p>
        </div>
        <Link href="/command/content" className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Content
        </Link>
      </div>

      <Section title="Positioning" subtitle="A short, honest statement of who you are and what you want to be known for.">
        <BrandPositioning profile={profile} />
      </Section>

      <Section
        title="Brand memory"
        subtitle="Opinions, phrases, expertise and no-go topics. Each is classified so nothing unverified ever reads as fact."
      >
        <BrandMemoryManager
          entries={memory.map((m) => ({
            id: m.id,
            createdAt: m.createdAt.toISOString(),
            kind: m.kind,
            body: m.body,
            claimClass: m.claimClass,
            status: m.status,
            source: m.source,
          }))}
        />
      </Section>
    </div>
  );
}
