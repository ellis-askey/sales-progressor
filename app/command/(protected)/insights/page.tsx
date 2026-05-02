import { commandDb } from "@/lib/command/prisma";
import { AcknowledgeButton } from "@/components/command/AcknowledgeButton";
import { PromoteButton } from "@/components/command/PromoteButton";
import type { SignalSeverity } from "@prisma/client";

const SEVERITY_BADGE: Record<string, string> = {
  critical:    "bg-red-950 text-red-400 border border-red-900",
  leak:        "bg-amber-950 text-amber-400 border border-amber-900",
  opportunity: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  info:        "bg-neutral-800 text-neutral-400",
};

const CONF_COLOR = (c: number): string =>
  c >= 0.8 ? "text-neutral-100" : c >= 0.5 ? "text-neutral-200" : "text-neutral-500";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function fmtDateShort(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    timeZone: "Europe/London",
  });
}

function fmtWindow(start: Date, end: Date): string {
  const s = new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const e = new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${s} – ${e}`;
}

function PayloadSummary({ payload }: { payload: Record<string, unknown> }) {
  const lines = Object.entries(payload)
    .filter(([k]) => !["dedupeKey"].includes(k))
    .slice(0, 6);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
      {lines.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-1 min-w-0">
          <dt className="text-[10px] text-neutral-600 shrink-0">{k}</dt>
          <dd className="text-[10px] text-neutral-400 truncate">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BriefCard({
  title,
  subject,
  content,
  sentAt,
  empty,
}: {
  title: string;
  subject?: string | null;
  content?: string | null;
  sentAt?: Date | null;
  empty: string;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 flex flex-col gap-2 min-h-[160px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">{title}</p>
        {sentAt && (
          <p className="text-[10px] text-neutral-600">{fmtDateShort(sentAt)}</p>
        )}
      </div>
      {subject && (
        <p className="text-xs font-medium text-neutral-200">{subject}</p>
      )}
      {content ? (
        <p className="text-xs text-neutral-400 leading-relaxed line-clamp-8 whitespace-pre-line flex-1">
          {content}
        </p>
      ) : (
        <p className="text-xs text-neutral-600 italic flex-1">{empty}</p>
      )}
    </div>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ sev?: string; ack?: string }>;
}) {
  const sp = await searchParams;
  const sevFilter = sp.sev as SignalSeverity | undefined;
  const showAcked = sp.ack === "1";

  const [latestBrief, latestReview, unacknowledged, acknowledged] = await Promise.all([
    commandDb.outboundMessage.findFirst({
      where: { purpose: "digest", aiModel: { contains: "haiku" } },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.outboundMessage.findFirst({
      where: { purpose: "digest", aiModel: { contains: "opus" } },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.signal.findMany({
      where: {
        acknowledged: false,
        ...(sevFilter ? { severity: sevFilter } : {}),
      },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }, { detectedAt: "desc" }],
      take: 100,
    }),
    showAcked
      ? commandDb.signal.findMany({
          where: {
            acknowledged: true,
            ...(sevFilter ? { severity: sevFilter } : {}),
          },
          orderBy: { acknowledgedAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const sevOptions: Array<{ value: string; label: string }> = [
    { value: "", label: "All" },
    { value: "critical", label: "Critical" },
    { value: "leak", label: "Leak" },
    { value: "opportunity", label: "Opportunity" },
    { value: "info", label: "Info" },
  ];

  function sevLink(sev: string): string {
    const p = new URLSearchParams();
    if (sev) p.set("sev", sev);
    if (showAcked) p.set("ack", "1");
    return `/command/insights${p.toString() ? `?${p}` : ""}`;
  }

  function ackToggle(): string {
    const p = new URLSearchParams();
    if (sevFilter) p.set("sev", sevFilter);
    if (!showAcked) p.set("ack", "1");
    return `/command/insights${p.toString() ? `?${p}` : ""}`;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Insights</h1>

      {/* AI Briefs */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">AI Briefs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BriefCard
            title="Latest daily brief"
            subject={latestBrief?.subject}
            content={latestBrief?.content}
            sentAt={latestBrief?.createdAt ?? null}
            empty="No daily brief sent yet. Runs at 06:00 UTC."
          />
          <BriefCard
            title="Latest weekly review"
            subject={latestReview?.subject}
            content={latestReview?.content}
            sentAt={latestReview?.createdAt ?? null}
            empty="No weekly review sent yet. Runs Monday at 07:00 UTC."
          />
        </div>
      </section>

      {/* Signal feed */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Signal feed</h2>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Severity</span>
          {sevOptions.map((o) => (
            <a
              key={o.value}
              href={sevLink(o.value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                (sevFilter ?? "") === o.value
                  ? "bg-neutral-700 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
              }`}
            >
              {o.label}
            </a>
          ))}
          <span className="ml-auto">
            <a href={ackToggle()} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
              {showAcked ? "Hide acknowledged" : "Show acknowledged"}
            </a>
          </span>
        </div>

        {/* Unacknowledged */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Unacknowledged · {unacknowledged.length}
          </p>
          {unacknowledged.length === 0 ? (
            <p className="text-sm text-neutral-600">All signals acknowledged.</p>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
              {unacknowledged.map((s) => (
                <div key={s.id} className="px-4 py-3.5 flex items-start gap-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                    {s.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium text-neutral-200">{s.detectorName.replace(/_/g, " ")}</p>
                      <span className={`text-xs tabular-nums ${CONF_COLOR(s.confidence)}`}>
                        {Math.round(s.confidence * 100)}%
                      </span>
                      <span className="text-xs text-neutral-600">
                        {fmtWindow(s.windowStart, s.windowEnd)}
                      </span>
                    </div>
                    <PayloadSummary payload={s.payload as Record<string, unknown>} />
                    <p className="text-[10px] text-neutral-600 mt-1">{fmtDate(s.detectedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PromoteButton signalId={s.id} />
                    <AcknowledgeButton signalId={s.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acknowledged */}
        {showAcked && acknowledged.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-3">
              Acknowledged · {acknowledged.length}
            </p>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800 opacity-60">
              {acknowledged.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                    {s.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-300">{s.detectorName.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-neutral-600">
                      {Math.round(s.confidence * 100)}% · {fmtWindow(s.windowStart, s.windowEnd)} · acked {fmtDate(s.acknowledgedAt!)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
