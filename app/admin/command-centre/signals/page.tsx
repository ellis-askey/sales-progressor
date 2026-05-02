import { prisma } from "@/lib/prisma";
import { AcknowledgeButton } from "@/components/admin/command-centre/AcknowledgeButton";
import type { SignalSeverity } from "@prisma/client";

const SEVERITY_BADGE: Record<string, string> = {
  critical:    "bg-red-500/20 text-red-300 border-red-500/30",
  leak:        "bg-amber-500/20 text-amber-300 border-amber-500/30",
  opportunity: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  info:        "bg-white/10 text-white/50 border-white/10",
};

const CONF_COLOR = (c: number): string =>
  c >= 0.8 ? "text-white" : c >= 0.5 ? "text-white/70" : "text-white/40";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
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
          <dt className="text-[10px] text-white/30 shrink-0">{k}</dt>
          <dd className="text-[10px] text-white/60 truncate">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ sev?: string; ack?: string }>;
}) {
  const sp = await searchParams;
  const sevFilter = sp.sev as SignalSeverity | undefined;
  const showAcked = sp.ack === "1";

  const [unacknowledged, acknowledged] = await Promise.all([
    prisma.signal.findMany({
      where: {
        acknowledged: false,
        ...(sevFilter ? { severity: sevFilter } : {}),
      },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }, { detectedAt: "desc" }],
      take: 100,
    }),
    showAcked
      ? prisma.signal.findMany({
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
    return `/admin/command-centre/signals${p.toString() ? `?${p}` : ""}`;
  }

  function ackToggle(): string {
    const p = new URLSearchParams();
    if (sevFilter) p.set("sev", sevFilter);
    if (!showAcked) p.set("ack", "1");
    return `/admin/command-centre/signals${p.toString() ? `?${p}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">Severity</span>
        {sevOptions.map((o) => (
          <a
            key={o.value}
            href={sevLink(o.value)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              (sevFilter ?? "") === o.value
                ? "bg-white/20 text-white"
                : "bg-white/8 text-white/50 hover:text-white/80 hover:bg-white/12"
            }`}
          >
            {o.label}
          </a>
        ))}
        <span className="ml-auto">
          <a href={ackToggle()} className="text-xs text-white/40 hover:text-white/70 transition-colors">
            {showAcked ? "Hide acknowledged" : "Show acknowledged"}
          </a>
        </span>
      </div>

      {/* Unacknowledged */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
          Unacknowledged · {unacknowledged.length}
        </h2>
        {unacknowledged.length === 0 ? (
          <p className="text-sm text-white/30">All signals acknowledged.</p>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/8">
            {unacknowledged.map((s) => (
              <div key={s.id} className="px-4 py-3.5 flex items-start gap-3">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                  {s.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-white/80">{s.detectorName.replace(/_/g, " ")}</p>
                    <span className={`text-xs tabular-nums ${CONF_COLOR(s.confidence)}`}>
                      {Math.round(s.confidence * 100)}%
                    </span>
                    <span className="text-xs text-white/30">
                      {fmtWindow(s.windowStart, s.windowEnd)}
                    </span>
                  </div>
                  <PayloadSummary payload={s.payload as Record<string, unknown>} />
                  <p className="text-[10px] text-white/25 mt-1">{fmtDate(s.detectedAt)}</p>
                </div>
                <AcknowledgeButton signalId={s.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Acknowledged */}
      {showAcked && acknowledged.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wide mb-3">
            Acknowledged · {acknowledged.length}
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5 opacity-60">
            {acknowledged.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                  {s.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/60">{s.detectorName.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-white/30">
                    {Math.round(s.confidence * 100)}% · {fmtWindow(s.windowStart, s.windowEnd)} · acked {fmtDate(s.acknowledgedAt!)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
