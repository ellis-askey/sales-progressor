import { getFollowupUsage } from "@/lib/command/followup-usage";

// Command Centre → Follow-up usage. Opened vs sent for the client "email your
// conveyancer" follow-up, so we can see who's using it and who opens but bottles.

export const dynamic = "force-dynamic";

function pct(n: number, total: number) {
  if (total === 0) return "—";
  return Math.round((n / total) * 100) + "%";
}
function fmtWhen(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function FollowupUsagePage() {
  const { totalOpens, openers, sentCount, rows } = await getFollowupUsage();
  const gap = openers - sentCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Follow-up usage</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Who opened the &ldquo;email your conveyancer&rdquo; follow-up, and who actually sent one. The gap is people who
          opened it but never sent (or removed our CC).
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total opens" value={String(totalOpens)} />
        <Stat label="People who opened" value={String(openers)} />
        <Stat label="Sent one" value={pct(sentCount, openers)} sub={`${sentCount} of ${openers}`} />
        <Stat label="Opened, not sent" value={String(Math.max(0, gap))} sub="started but no email received" />
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                <Th>Client</Th>
                <Th>Side</Th>
                <Th>Opens</Th>
                <Th>While behind</Th>
                <Th>Last opened</Th>
                <Th>Sent</Th>
                <Th>Last sent</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[13px] text-neutral-500">No follow-ups opened yet.</td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i}>
                    <Td className="text-neutral-200 font-medium">
                      {r.name}
                      <div className="text-[11px] text-neutral-500 font-normal">{r.address}</div>
                    </Td>
                    <Td className="text-neutral-400 text-[12px]">{r.role}</Td>
                    <Td className="text-neutral-300 text-[13px] tabular-nums">{r.opens}</Td>
                    <Td className="text-neutral-400 text-[12px] tabular-nums">{r.behind > 0 ? r.behind : "—"}</Td>
                    <Td className="text-neutral-400 text-[12px]">{fmtWhen(r.lastOpened)}</Td>
                    <Td><YesNo on={r.sent} /></Td>
                    <Td className="text-neutral-400 text-[12px]">{fmtWhen(r.lastSent)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-neutral-600 leading-relaxed">
        &ldquo;Sent&rdquo; means a copy of their email to their conveyancer was filed to the file via the inbox sync
        (they kept us CC&rsquo;d). We can&rsquo;t see it if they strip the CC, so a blank &ldquo;Sent&rdquo; can mean
        either they didn&rsquo;t send, or they removed us from the copy.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-100 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-neutral-600 mt-0.5">{sub}</p>}
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 border-b border-neutral-800/70 text-[13px] ${className}`}>{children}</td>;
}
function YesNo({ on }: { on: boolean }) {
  return on ? (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]">Sent</span>
  ) : (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-neutral-800 text-neutral-600 border-neutral-700">—</span>
  );
}
