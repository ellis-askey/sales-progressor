// Renders a variant's email sequence the way it will actually send: one card per
// step, labelled, with the subject line and the body shown with real line breaks
// (not a raw JSON blob). Used in the AI Outreach experiment view.

type RawStep = {
  stepIndex?: number | string;
  gapDays?: number | string;
  subject?: string;
  body?: string;
  label?: string;
  templateKey?: string;
};

type Step = { index: number; gapDays: number; subject: string; body: string; label: string };

const DEFAULT_LABELS = ["Intro", "Follow-up", "Final nudge", "Step 4", "Step 5"];

function parseSteps(emails: unknown): Step[] {
  let arr: RawStep[] = [];
  if (Array.isArray(emails)) arr = emails as RawStep[];
  else if (typeof emails === "string") {
    try {
      const parsed = JSON.parse(emails);
      if (Array.isArray(parsed)) arr = parsed as RawStep[];
    } catch {
      return [];
    }
  }
  return arr
    .map((s, i) => ({
      index: Number(s.stepIndex ?? i),
      gapDays: Number(s.gapDays ?? 0),
      subject: String(s.subject ?? ""),
      body: String(s.body ?? ""),
      label: (s.label && String(s.label)) || DEFAULT_LABELS[i] || `Step ${i + 1}`,
    }))
    .sort((a, b) => a.index - b.index);
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

// Outreach only sends Mon-Fri, so a projected date must never land on a weekend.
// Roll Sat/Sun forward to the next weekday (Europe/London).
function rollToBusinessDay(d: Date): Date {
  const r = new Date(d);
  for (let i = 0; i < 3; i++) {
    const wd = r.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/London" });
    if (wd !== "Sat" && wd !== "Sun") break;
    r.setDate(r.getDate() + 1);
  }
  return r;
}

// When each step sends, projected from a base date (launch date if running, else
// "if launched today"). Cumulative because gapDays is relative to the previous
// email. Rolled off weekends and shown as a date (business-hours batching means
// the exact time varies).
function timing(cumulativeDays: number, first: boolean, base: Date): string {
  const d = rollToBusinessDay(new Date(base.getTime() + cumulativeDays * 86_400_000));
  const when = fmtDay(d);
  if (first || cumulativeDays === 0) return `Sends ${when}`;
  return `${when} (+${cumulativeDays}d)`;
}

export function EmailSequence({ emails, baseDate }: { emails: unknown; baseDate?: Date }) {
  const steps = parseSteps(emails);
  if (steps.length === 0) {
    return <p className="text-[12px] text-neutral-600">No email copy on this variant.</p>;
  }
  const base = baseDate ?? new Date();
  let cumulative = 0;
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        cumulative += i === 0 ? 0 : s.gapDays;
        return (
        <div key={s.index} className="rounded-lg border border-neutral-800 bg-neutral-950/50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-neutral-800 bg-neutral-900/40">
            <span className="text-[11px] font-semibold text-neutral-200">
              Email {i + 1} <span className="text-neutral-500 font-normal">· {s.label}</span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wide text-neutral-500 whitespace-nowrap">
              {timing(cumulative, i === 0, base)}
            </span>
          </div>
          <div className="px-3.5 py-3 space-y-2">
            <p className="text-[12px]">
              <span className="text-neutral-500">Subject: </span>
              <span className="text-neutral-200 font-medium">{s.subject || "(no subject)"}</span>
            </p>
            <p className="text-[12.5px] leading-relaxed text-neutral-300 whitespace-pre-line">{s.body}</p>
          </div>
        </div>
        );
      })}
    </div>
  );
}
