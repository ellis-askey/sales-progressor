import Link from "next/link";
import { getPipeline } from "@/lib/command/content/calendar";
import { getContentSettings } from "@/lib/command/content/settings";
import { CalendarBoard } from "@/components/command/content/CalendarBoard";
import { WeeklyPlanPanel } from "@/components/command/content/WeeklyPlanPanel";
import { AutopilotSettings } from "@/components/command/content/AutopilotSettings";
import { Section } from "@/components/command/ui/primitives";

// Content calendar (docs/active/content-brand/SPEC.md, Phase 5.1). The pipeline
// from ready to published, with easy scheduling. Superadmin gating handled by
// the (protected) layout.

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [pipeline, settings] = await Promise.all([getPipeline(), getContentSettings()]);

  return (
    <div className="space-y-8">
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

      <Section title="Proposed week" subtitle="A short, varied week from your brand, inbox and recent balance.">
        <WeeklyPlanPanel
          plan={settings.weeklyPlan}
          generatedAt={settings.weeklyPlanAt ? settings.weeklyPlanAt.toISOString() : null}
        />
      </Section>

      <Section title="Pipeline" subtitle="Ready to published. Schedule by date; scheduling reminds you when a post is due.">
        <CalendarBoard pipeline={pipeline} />
      </Section>

      <Section title="Autopilot" subtitle="How much the system prepares for you. It never publishes on its own yet.">
        <AutopilotSettings level={settings.autopilotLevel} />
      </Section>
    </div>
  );
}
