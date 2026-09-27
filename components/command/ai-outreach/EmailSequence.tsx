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

function timing(gapDays: number, first: boolean): string {
  if (first || gapDays === 0) return "Sends first";
  return `${gapDays} day${gapDays === 1 ? "" : "s"} after the previous email`;
}

export function EmailSequence({ emails }: { emails: unknown }) {
  const steps = parseSteps(emails);
  if (steps.length === 0) {
    return <p className="text-[12px] text-neutral-600">No email copy on this variant.</p>;
  }
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={s.index} className="rounded-lg border border-neutral-800 bg-neutral-950/50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-neutral-800 bg-neutral-900/40">
            <span className="text-[11px] font-semibold text-neutral-200">
              Email {i + 1} <span className="text-neutral-500 font-normal">· {s.label}</span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wide text-neutral-500 whitespace-nowrap">
              {timing(s.gapDays, i === 0)}
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
      ))}
    </div>
  );
}
