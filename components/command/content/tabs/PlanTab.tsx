import { getPipeline } from "@/lib/command/content/calendar";
import { getContentSettings } from "@/lib/command/content/settings";
import { getPublishingStatus } from "@/lib/command/content/publishing";
import { CalendarBoard } from "@/components/command/content/CalendarBoard";
import { WeeklyPlanPanel } from "@/components/command/content/WeeklyPlanPanel";
import { AutopilotSettings } from "@/components/command/content/AutopilotSettings";
import { Section, TrackingDisabled } from "@/components/command/ui/primitives";
import { aiEnabled } from "@/lib/ai/enabled";

// Content workspace → Plan tab. The calendar: pipeline ready→published, the AI
// weekly plan, autopilot level, and publishing connections. Extracted verbatim
// from /content/calendar (shell provides the heading + tab strip); scheduling,
// status changes, autopilot and publishing workflows are unchanged. The AI
// "Proposed week" section keeps its aiEnabled gate.

export async function PlanTab() {
  const [pipeline, settings] = await Promise.all([getPipeline(), getContentSettings()]);
  const publishing = getPublishingStatus();
  const aiOn = await aiEnabled(); // AI master switch (#291): hide the AI "Proposed week" section when off

  return (
    <div className="space-y-8">
      <p className="max-w-xl text-[13px] text-neutral-500">
        Your posts from ready to published. Scheduling prepares a post and reminds you when it&rsquo;s due. It won&rsquo;t
        publish on its own until a platform is connected.
      </p>

      {aiOn && (
        <Section title="Proposed week" subtitle="A short, varied week from your brand, inbox and recent balance.">
          <WeeklyPlanPanel
            plan={settings.weeklyPlan}
            generatedAt={settings.weeklyPlanAt ? settings.weeklyPlanAt.toISOString() : null}
          />
        </Section>
      )}

      <Section title="Pipeline" subtitle="Ready to published. Schedule by date; scheduling reminds you when a post is due.">
        <CalendarBoard pipeline={pipeline} />
      </Section>

      <Section title="Autopilot" subtitle="How much the system prepares for you. It never publishes on its own yet.">
        <AutopilotSettings level={settings.autopilotLevel} />
      </Section>

      <Section title="Publishing" subtitle="Where posts can go live from.">
        {publishing.connected ? (
          <div className="flex flex-wrap gap-2">
            {publishing.providers.map((p) => (
              <span
                key={p.id}
                className={`rounded-lg border px-3 py-1.5 text-[12px] ${p.connected ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-300" : "border-neutral-800 text-neutral-500"}`}
              >
                {p.label}: {p.connected ? "connected" : "not connected"}
              </span>
            ))}
          </div>
        ) : (
          <TrackingDisabled
            what="Publishing"
            why="No platform is connected, so posts are prepared here and you publish them by hand. Connect LinkedIn or Meta (or a broker like Ayrshare) to publish and schedule for real. Setup steps are in ELLIS_MANUAL_TODO."
          />
        )}
      </Section>
    </div>
  );
}
