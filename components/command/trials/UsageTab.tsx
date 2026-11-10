import type { TrialUsage } from "@/lib/command/trial-cockpit";
import { Section, CardEmpty, fmtInt } from "@/components/command/ui/primitives";
import { fmtHoursShort } from "@/lib/command/format";

// Trial cockpit → Usage tab. How deep the habit runs: daily logins and active
// staff across the trial, real engaged hours week by week, mobile vs desktop,
// and the team's working rhythm (weekday + hour of day). Server component;
// data from getTrialUsage. Command-only (Law 8).

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// A bar per day with a hover tooltip. Shared by the two daily charts.
function DayBars({ days, pick, unit }: {
  days: TrialUsage["days"];
  pick: (d: TrialUsage["days"][number]) => number;
  unit: string;
}) {
  const shown = days.slice(-42);
  const max = Math.max(1, ...shown.map(pick));
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
      <div className="flex items-end gap-[3px] h-20">
        {shown.map((d) => {
          const v = pick(d);
          return (
            <div key={d.date} className="flex-1 flex flex-col justify-end group relative">
              <div
                className="w-full rounded-sm bg-blue-600/50 border-t border-blue-500/60 transition-colors group-hover:bg-blue-500/70"
                style={{ height: `${Math.max(v > 0 ? 6 : 2, Math.round((v / max) * 100))}%`, opacity: v > 0 ? 1 : 0.25 }}
              />
              <div className="absolute bottom-full mb-1.5 hidden group-hover:block z-10 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[10px] text-neutral-300 shadow-lg left-1/2 -translate-x-1/2">
                {fmtDay(d.date)} · {v} {unit}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-neutral-600 tabular-nums">
        <span>{fmtDay(shown[0].date)}</span>
        <span>{fmtDay(shown[shown.length - 1].date)}</span>
      </div>
    </div>
  );
}

function LabelledBars({ items, fmt }: { items: Array<{ label: string; value: number }>; fmt: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
      <div className="flex items-end gap-2 h-28">
        {items.map((it, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
            <span className="text-[10px] text-neutral-400 tabular-nums">{it.value > 0 ? fmt(it.value) : ""}</span>
            <div
              className="w-full rounded-sm bg-blue-600/50 border-t border-blue-500/60"
              style={{ height: `${Math.max(it.value > 0 ? 5 : 2, Math.round((it.value / max) * 82))}%`, opacity: it.value > 0 ? 1 : 0.25 }}
            />
            <span className="text-[9px] text-neutral-600 truncate max-w-full">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function UsageTab({ usage }: { usage: TrialUsage }) {
  const totalDevice = usage.deviceMobile + usage.deviceDesktop;
  const mobilePct = totalDevice > 0 ? Math.round((usage.deviceMobile / totalDevice) * 100) : 0;
  const hasSessions = usage.weeklyHours.some((w) => w.seconds > 0);
  const hasRhythm = usage.weekday.some((v) => v > 0);

  // Hour profile trimmed to the working span (first/last non-zero hour, padded),
  // so the chart isn't dominated by 24 mostly-empty slots.
  const firstHr = usage.hourOfDay.findIndex((v) => v > 0);
  const lastHr = 23 - [...usage.hourOfDay].reverse().findIndex((v) => v > 0);
  const hourItems =
    firstHr === -1
      ? []
      : usage.hourOfDay
          .map((value, h) => ({ label: `${h}:00`, value, h }))
          .slice(Math.max(0, firstHr - 1), Math.min(24, lastHr + 2));

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Logins per day" tip="Sign-ins across the whole team, from the nightly rollups plus a live count for today.">
          {usage.days.length === 0 ? <CardEmpty>The trial starts today.</CardEmpty> : <DayBars days={usage.days} pick={(d) => d.logins} unit="logins" />}
        </Section>
        <Section title="Active staff per day" tip="Distinct staff members with any activity that day.">
          {usage.days.length === 0 ? <CardEmpty>The trial starts today.</CardEmpty> : <DayBars days={usage.days} pick={(d) => d.activeUsers} unit="active" />}
        </Section>
      </div>

      <Section
        title="Hours in the app, week by week"
        subtitle="Real focused time on files across the whole team. Last 12 weeks."
        tip="Engaged seconds from file-viewing sessions: tab open in the background does not count."
      >
        {!hasSessions ? (
          <CardEmpty>No measured file time yet.</CardEmpty>
        ) : (
          <LabelledBars items={usage.weeklyHours.map((w) => ({ label: w.label, value: w.seconds }))} fmt={fmtHoursShort} />
        )}
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Device split" tip="File sessions by device over the last 12 weeks. iPads in desktop mode count as desktop.">
          {totalDevice === 0 ? (
            <CardEmpty>No sessions to classify yet.</CardEmpty>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
              <div className="h-3 w-full rounded-full bg-neutral-800 overflow-hidden flex">
                <div className="h-full bg-emerald-600/70" style={{ width: `${mobilePct}%` }} />
                <div className="h-full bg-blue-600/70" style={{ width: `${100 - mobilePct}%` }} />
              </div>
              <div className="flex justify-between mt-2.5 text-[11px] tabular-nums">
                <span className="text-emerald-400">Mobile {mobilePct}% · {fmtInt(usage.deviceMobile)} sessions</span>
                <span className="text-blue-300">Desktop {100 - mobilePct}% · {fmtInt(usage.deviceDesktop)} sessions</span>
              </div>
            </div>
          )}
        </Section>

        <Section title="Day of the week" tip="File sessions by weekday over the last 8 weeks. Daily habit or a Monday check-in?">
          {!hasRhythm ? (
            <CardEmpty>No sessions yet.</CardEmpty>
          ) : (
            <LabelledBars items={usage.weekday.map((value, i) => ({ label: WEEKDAY_LABELS[i], value }))} fmt={fmtInt} />
          )}
        </Section>
      </div>

      <Section title="Hour of the day" tip="When sessions start, over the last 8 weeks. Trimmed to their working span.">
        {hourItems.length === 0 ? (
          <CardEmpty>No sessions yet.</CardEmpty>
        ) : (
          <LabelledBars items={hourItems.map(({ label, value }) => ({ label, value }))} fmt={fmtInt} />
        )}
      </Section>
    </div>
  );
}
