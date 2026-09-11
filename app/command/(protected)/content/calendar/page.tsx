import Link from "next/link";
import { getPipeline } from "@/lib/command/content/calendar";
import { CalendarBoard } from "@/components/command/content/CalendarBoard";

// Content calendar (docs/active/content-brand/SPEC.md, Phase 5.1). The pipeline
// from ready to published, with easy scheduling. Superadmin gating handled by
// the (protected) layout.

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const pipeline = await getPipeline();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Calendar</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            Your posts from ready to published. Scheduling prepares a post and reminds you when it&rsquo;s due. It
            won&rsquo;t publish on its own until a platform is connected.
          </p>
        </div>
        <Link href="/command/content" className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Content
        </Link>
      </div>

      <CalendarBoard pipeline={pipeline} />
    </div>
  );
}
