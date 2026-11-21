import Link from "next/link";
import { getChasingData, getChaseTabCounts, type ChaseType } from "@/lib/command/chasing";
import { getOptedOutClients, getOptedOutCount } from "@/lib/command/opted-out";
import { ChaseHubTable } from "@/components/command/ChaseHubTable";
import { OptedOutTable } from "@/components/command/OptedOutTable";
import InfoTip from "@/components/command/shared/InfoTip";

// Growth workspace → Experiments → Chasing view ("Is our chasing working?").
// Verbatim from /command/enquiries-chase (consolidation Phase 4): chase
// effectiveness metrics + the four sub-views (enquiries / solicitor / client /
// opted_out). The only functional change is the sub-view selector param: the
// legacy page used ?tab=, which would collide with the workspace top-level ?tab,
// so it moves to ?chase=. The loaders (getChasingData / getChaseTabCounts /
// getOptedOutClients / getOptedOutCount), the ChaseHubTable drawer +
// ChaseRepliedToggle write (setChaseRepliedByEmailAction), and the read-only
// OptedOutTable are unchanged. The former page <h1>/eyebrow + page padding are
// dropped (the shell + Experiments strip label + contain it). Backward-compat
// for old ?tab= links is in lib/growth-chasing-compat.ts, activated in Phase 5A.

// The 4th tab ("Opted out") is the inverse of chasing: clients who can't be
// auto-chased and so need a human nudge. It doesn't go through getChasingData.
type HubTab = ChaseType | "opted_out";

const TABS: { key: HubTab; label: string }[] = [
  { key: "enquiries", label: "Enquiries chase" },
  { key: "solicitor", label: "Solicitor chase" },
  { key: "client", label: "Client chase" },
  { key: "opted_out", label: "Opted out" },
];

function parseChase(raw: string | undefined): HubTab {
  return raw === "solicitor" || raw === "client" || raw === "opted_out" ? raw : "enquiries";
}

export async function ChasingView({ chase }: { chase?: string }) {
  const tab = parseChase(chase);
  const [counts, optedOutCount] = await Promise.all([getChaseTabCounts(), getOptedOutCount()]);
  const allCounts: Record<HubTab, number> = { ...counts, opted_out: optedOutCount };

  return (
    <div>
      <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
        Every automated chase we send, across all three systems, and what came back. Click any row to see exactly what
        was sent. The last tab lists clients who have opted out, so they can be chased by hand.
      </p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mt-5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/command/growth?tab=experiments&view=chasing${t.key === "enquiries" ? "" : `&chase=${t.key}`}`}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
              t.key === tab
                ? "bg-blue-600/20 text-blue-300 border-blue-600/40"
                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] opacity-70 tabular-nums">{allCounts[t.key]}</span>
          </Link>
        ))}
      </div>

      {tab === "opted_out" ? <OptedOutBody /> : <ChaseBody tab={tab} />}
    </div>
  );
}

async function ChaseBody({ tab }: { tab: ChaseType }) {
  const data = await getChasingData(tab);
  const s = data.summary;
  return (
    <>
      {/* Tab intro */}
      <p className="mt-4 text-[13px] text-neutral-400 max-w-2xl leading-relaxed">
        {data.blurb}
        {data.sinceLabel ? ` Tracking since ${data.sinceLabel}.` : ""}
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <Stat label="Chases sent" value={s.sent} sub="in the last 8 weeks" />
        <Stat
          label={s.rateLabel}
          value={`${s.responseRate ?? 0}%`}
          sub={`${s.responded} of ${s.sent} ${s.respondedVerb}`}
          accent
          tip={data.type === "client" ? "Approximate: some mail apps block open-tracking and Apple Mail can inflate it." : undefined}
        />
        <Stat label={s.extraLabel} value={s.extra} sub="" />
        <Stat
          label="Opens tracked"
          value={data.type === "client" ? "Approx" : "Yes"}
          sub={data.type === "client" ? "some blocked, some inflated" : "via the link"}
        />
      </div>

      {/* Table */}
      <div className="mt-8">
        <ChaseHubTable type={data.type} rows={data.rows} />
      </div>
    </>
  );
}

async function OptedOutBody() {
  const rows = await getOptedOutClients();
  return (
    <>
      <p className="mt-4 text-[13px] text-neutral-400 max-w-2xl leading-relaxed">
        Clients on active files who have opted out of emails or paused their chases. Automated chasing skips them, so
        these are the ones to nudge personally.
      </p>
      <div className="mt-8">
        <OptedOutTable rows={rows} />
      </div>
    </>
  );
}

function Stat({ label, value, sub, accent, tip }: { label: string; value: string | number; sub: string; accent?: boolean; tip?: string }) {
  return (
    <div className={`rounded-lg border p-3.5 ${accent ? "border-blue-900/70 bg-blue-950/30" : "border-neutral-800 bg-neutral-900/40"}`}>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
        {tip && <span className="ml-1 normal-case tracking-normal"><InfoTip label={label}>{tip}</InfoTip></span>}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-blue-300" : "text-neutral-100"}`}>{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
