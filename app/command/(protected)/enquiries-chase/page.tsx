import { commandDb } from "@/lib/command/prisma";
import { ChaseRepliedToggle } from "@/components/command/ChaseRepliedToggle";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 56; // ~8 weeks

const RECIPIENT_LABEL: Record<string, string> = {
  seller_solicitor: "Seller's solicitor",
  buyer_solicitor: "Buyer's solicitor",
  buyer: "Buyer",
};
const KIND_LABEL: Record<string, string> = {
  raise: "Raise chase",
  reply_loop: "Reply chase",
};
const RESPONSE_LABEL: Record<string, string> = {
  update: "Left an update",
  date: "Gave a date",
  confirm: "Confirmed",
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function EnquiriesChaseExperimentPage() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const sends = await commandDb.chaseSend.findMany({
    where: { sentAt: { gte: since } },
    orderBy: { sentAt: "desc" },
    select: {
      id: true, kind: true, recipient: true, recipientName: true, sentAt: true,
      openedAt: true, respondedAt: true, responseType: true, repliedByEmailAt: true,
      transaction: { select: { propertyAddress: true } },
    },
  });

  // Solicitor sends are the ones the response rate is measured on (buyer nudges
  // are shown for context but excluded from the rate).
  const solicitor = sends.filter((s) => s.recipient !== "buyer");
  const responded = (s: (typeof sends)[number]) => !!s.respondedAt || !!s.repliedByEmailAt;
  const respondedCount = solicitor.filter(responded).length;
  const viaLink = solicitor.filter((s) => !!s.respondedAt).length;
  const viaEmail = solicitor.filter((s) => !!s.repliedByEmailAt).length;
  const openedNoAction = solicitor.filter((s) => s.openedAt && !responded(s)).length;
  const rate = solicitor.length ? Math.round((respondedCount / solicitor.length) * 100) : 0;

  const firstSentAt = sends.length ? sends[sends.length - 1].sentAt : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500 font-mono">Experiment</div>
      <h1 className="text-2xl font-semibold text-neutral-100">Does the enquiries chase work?</h1>
      <p className="mt-2 text-sm text-neutral-400 max-w-2xl leading-relaxed">
        Every solicitor chase we send, and what came back: did they open the link, act on it, or
        reply by email. Tick the email-reply box on any row where a solicitor replied to you directly.
        {firstSentAt ? ` Tracking since ${fmt(firstSentAt)}.` : " Fills up once chasing is switched on."}
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        <Stat label="Chases sent" value={solicitor.length} sub="to solicitors" />
        <Stat label="Response rate" value={`${rate}%`} sub={`${respondedCount} of ${solicitor.length}`} accent />
        <Stat label="Used the link" value={viaLink} sub="acted online" />
        <Stat label="Replied by email" value={viaEmail} sub="your ticks" />
        <Stat label="Opened, no action" value={openedNoAction} sub="clicked, ignored" />
      </div>

      {/* Table */}
      <div className="mt-8 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-900/60 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Sent</th>
                <th className="px-4 py-2.5 font-medium">File</th>
                <th className="px-4 py-2.5 font-medium">Chased</th>
                <th className="px-4 py-2.5 font-medium">Opened</th>
                <th className="px-4 py-2.5 font-medium">What they did</th>
                <th className="px-4 py-2.5 font-medium">Email reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {sends.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                    No chases sent yet. This board fills up once chasing is switched on in Settings.
                  </td>
                </tr>
              )}
              {sends.map((s) => {
                const did = s.respondedAt
                  ? RESPONSE_LABEL[s.responseType ?? ""] ?? "Responded"
                  : s.repliedByEmailAt
                    ? "Replied by email"
                    : s.openedAt
                      ? "Opened, no action"
                      : "No response yet";
                const didClass = s.respondedAt || s.repliedByEmailAt
                  ? "text-emerald-400"
                  : s.openedAt
                    ? "text-amber-400"
                    : "text-neutral-500";
                return (
                  <tr key={s.id} className="text-neutral-300">
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400 tabular-nums">{fmt(s.sentAt)}</td>
                    <td className="px-4 py-2.5 max-w-[220px] truncate" title={s.transaction.propertyAddress}>
                      {s.transaction.propertyAddress}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-neutral-200">{RECIPIENT_LABEL[s.recipient]}</span>
                      <span className="text-neutral-600"> · {KIND_LABEL[s.kind]}</span>
                      {s.recipientName && <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">{s.recipientName}</div>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400">{s.openedAt ? fmt(s.openedAt) : "—"}</td>
                    <td className={`px-4 py-2.5 whitespace-nowrap font-medium ${didClass}`}>{did}</td>
                    <td className="px-4 py-2.5">
                      {s.recipient !== "buyer" && <ChaseRepliedToggle id={s.id} initial={!!s.repliedByEmailAt} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3.5 ${accent ? "border-blue-900/70 bg-blue-950/30" : "border-neutral-800 bg-neutral-900/40"}`}>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-blue-300" : "text-neutral-100"}`}>{value}</div>
      <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>
    </div>
  );
}
