import Link from "next/link";
import { getChainInviteReport, type ChainFunnel, type ChainInviteFollowUp } from "@/lib/command/chain-invites";

// Command Centre → Chain invites. The agent-to-agent invite funnel: how far
// invited agencies get from "email sent" to "joined", plus a call-list of the
// agents who looked but haven't joined. See docs/active/chain-invite-conversion.

export const dynamic = "force-dynamic";

const RANGES: { label: string; days: number | null; key: string }[] = [
  { label: "30 days", days: 30, key: "30" },
  { label: "90 days", days: 90, key: "90" },
  { label: "All time", days: null, key: "all" },
];

export default async function ChainInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const active = RANGES.find((r) => r.key === range) ?? RANGES[1]; // default 90 days
  const report = await getChainInviteReport(active.days);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Chain invites</h1>
          <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
            When an agent invites the agency above or below them into a chain, this is how far
            that invite gets. The drop between two steps is where we&apos;re losing them.
          </p>
        </div>
        <div className="flex gap-0.5 bg-[#1a1a1a] rounded-md p-0.5">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/command/chain-invites?range=${r.key}`}
              className={`text-[12px] px-3 py-1 rounded font-semibold transition-all ${
                r.key === active.key ? "bg-[#2563eb] text-white" : "text-[#525252] hover:text-[#a3a3a3]"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <Funnel funnel={report.funnel} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Awaiting" value={report.awaitingView} sub="sent, no sign they've opened it" />
        <Stat label="Declined" value={report.declined} sub="said it isn't their sale" />
        <Stat label="Bounced" value={report.bounced} sub="email couldn't be delivered" warn={report.bounced > 0} />
        <Stat label="Expired" value={report.expired} sub="link lapsed before they joined" warn={report.expired > 0} />
      </div>

      <FollowUps rows={report.followUps} />

      <p className="text-[12px] text-neutral-600 leading-relaxed">
        &ldquo;Viewed&rdquo; means they clicked through from the email and saw the chain.
        &ldquo;Started&rdquo; means they clicked &ldquo;Claim this sale&rdquo; and reached the
        sign-up. Email open-rate isn&apos;t tracked yet (see the phase notes), so the funnel
        begins at the click-through.
      </p>
    </div>
  );
}

// Funnel: each stage as a horizontal bar scaled to its share of invites sent,
// with the count, that share, and the drop-off from the stage above.
function Funnel({ funnel }: { funnel: ChainFunnel }) {
  const total = funnel.sent;
  const stages: { label: string; value: number; hint: string }[] = [
    { label: "Sent", value: funnel.sent, hint: "invite emailed" },
    { label: "Viewed", value: funnel.viewed, hint: "opened the chain page" },
    { label: "Started", value: funnel.started, hint: "clicked Claim this sale" },
    { label: "Joined", value: funnel.joined, hint: "account created, file linked" },
  ];
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">Invite funnel</p>
      <div className="mt-3 space-y-2">
        {stages.map((s, i) => {
          const share = total === 0 ? 0 : Math.round((s.value / total) * 100);
          const prev = i === 0 ? null : stages[i - 1].value;
          const dropped = prev != null ? prev - s.value : 0;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0">
                <span className="text-[12px] text-neutral-300 block leading-tight">{s.label}</span>
                <span className="text-[10px] text-neutral-600 block leading-tight">{s.hint}</span>
              </span>
              <div className="flex-1 h-6 rounded bg-neutral-800/60 overflow-hidden">
                <div className="h-full bg-[#2563eb]/70 rounded" style={{ width: `${share}%` }} aria-hidden />
              </div>
              <span className="w-16 shrink-0 text-right text-[13px] text-neutral-200 tabular-nums">
                {s.value}
                <span className="text-neutral-600"> ({share}%)</span>
              </span>
              <span className="w-20 shrink-0 text-right text-[11px] text-neutral-600 tabular-nums">
                {prev != null && dropped > 0 ? `-${dropped} lost` : ""}
              </span>
            </div>
          );
        })}
      </div>
      {total === 0 && (
        <p className="mt-3 text-[13px] text-neutral-600">
          No invites sent in this window yet. As agents send chain invites, the funnel fills in here.
        </p>
      )}
    </div>
  );
}

// The call-list. Agents who opened the invite but haven't joined or declined —
// the warmest leads for a personal nudge.
function FollowUps({ rows }: { rows: ChainInviteFollowUp[] }) {
  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "-";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800">
        <p className="text-[13px] font-semibold text-neutral-200">Looked but haven&apos;t joined</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          They opened the invite and saw the chain, but haven&apos;t joined. A personal nudge is worth it.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-neutral-600">
          Nobody in this state right now. Anyone who opens an invite but stalls before joining will show here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-neutral-500 text-left">
                <th className="font-medium px-4 py-2">Invited agent</th>
                <th className="font-medium px-4 py-2">Their sale</th>
                <th className="font-medium px-4 py-2">Invited by</th>
                <th className="font-medium px-4 py-2 text-right">Sent</th>
                <th className="font-medium px-4 py-2 text-right">Viewed</th>
                <th className="font-medium px-4 py-2 text-right">Got to sign-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.linkId} className="border-t border-neutral-800/70">
                  <td className="px-4 py-2.5">
                    <span className="text-neutral-200 block">{r.invitedName ?? r.invitedAgency ?? "Unknown agent"}</span>
                    {r.invitedEmail && <span className="text-neutral-600 block text-[11px]">{r.invitedEmail}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400">{r.address}</td>
                  <td className="px-4 py-2.5 text-neutral-400">
                    {r.invitingAgent ?? "-"}
                    {r.invitingAgency ? <span className="text-neutral-600"> · {r.invitingAgency}</span> : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500 tabular-nums">{fmt(r.sentAt)}</td>
                  <td className="px-4 py-2.5 text-right text-neutral-300 tabular-nums">{fmt(r.viewedAt)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.startedAt ? (
                      <span className="text-[#6ee7b7]">{fmt(r.startedAt)}</span>
                    ) : (
                      <span className="text-neutral-600">not yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div className={`bg-neutral-900 border rounded-xl px-4 py-3 ${warn ? "border-[#5a3f2c]" : "border-neutral-800"}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? "text-[#f6b17a]" : "text-neutral-100"}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-600 mt-0.5">{sub}</p>}
    </div>
  );
}
