import { commandDb } from "@/lib/command/prisma";

// Command Centre → Email threading (diagnostic, test period). Lists the most
// recent THREADED sends and the route each one actually took, so the Outlook
// native-reply can be verified live without digging through server logs. Remove
// once email threading is signed off (drop this page, the nav item, and the
// OutboundMessage.threadSendRoute column).

export const dynamic = "force-dynamic";

const ROUTE: Record<string, { label: string; cls: string; note: string }> = {
  outlook_reply: { label: "Native Outlook reply", cls: "bg-[#0f2e1d] text-[#6ee7b7] border-[#14532d]", note: "Threaded into an existing Outlook conversation — Stage 3 working." },
  outlook_new: { label: "New Outlook thread", cls: "bg-[#102236] text-[#93c5fd] border-[#1e3a5f]", note: "First email of a conversation, sent via Outlook." },
  mailbox_smtp: { label: "Own mailbox (SMTP)", cls: "bg-neutral-800 text-neutral-300 border-neutral-700", note: "Sent through the agent's own (non-Outlook) mailbox." },
  standard: { label: "Standard send", cls: "bg-[#3a2a0f] text-[#fcd34d] border-[#854d0e]", note: "Went out via SendGrid — this is also what a Graph fall-back looks like." },
};
function routeInfo(r: string | null) {
  return (r && ROUTE[r]) || { label: r ?? "—", cls: "bg-neutral-800 text-neutral-400 border-neutral-700", note: "" };
}

function fmt(d: Date): string {
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function EmailThreadingDiagnosticPage() {
  const since7 = new Date(Date.now() - 7 * 86_400_000);

  const [rows, byRoute] = await Promise.all([
    commandDb.outboundMessage.findMany({
      where: { threadSendRoute: { not: null } },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        sentAt: true,
        createdAt: true,
        subject: true,
        recipientEmail: true,
        recipientEmails: true,
        threadSendRoute: true,
        conversationId: true,
        transaction: { select: { propertyAddress: true, agency: { select: { name: true } } } },
      },
    }),
    commandDb.outboundMessage.groupBy({
      by: ["threadSendRoute"],
      where: { threadSendRoute: { not: null }, OR: [{ sentAt: { gte: since7 } }, { createdAt: { gte: since7 } }] },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const g of byRoute) if (g.threadSendRoute) counts.set(g.threadSendRoute, g._count._all);
  const order = ["outlook_reply", "outlook_new", "mailbox_smtp", "standard"];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Email threading</h1>
        <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
          Which route each threaded send took, newest first. Use it while testing the Outlook native-reply:
          a <span className="text-[#6ee7b7]">Native Outlook reply</span> means it threaded in Outlook;
          a <span className="text-[#fcd34d]">Standard send</span> on a continued email means it fell back
          and didn&rsquo;t thread in Outlook. Diagnostic only — remove once signed off.
        </p>
      </div>

      {/* Last-7-days counts per route */}
      <div className="flex items-center gap-2 flex-wrap">
        {order.filter((r) => counts.get(r)).map((r) => {
          const info = routeInfo(r);
          return (
            <div key={r} className={`flex items-baseline gap-2 px-3.5 py-2 rounded-xl border ${info.cls}`}>
              <span className="text-xl font-semibold tabular-nums leading-none">{counts.get(r)}</span>
              <span className="text-[11px] opacity-80">{info.label} · 7d</span>
            </div>
          );
        })}
        {counts.size === 0 && (
          <div className="px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-neutral-500">
            No threaded sends in the last 7 days yet.
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-neutral-600">No threaded sends recorded yet.</p>
            <p className="mt-1 text-[11px] text-neutral-700">
              Rows appear here once an agency on the threading allowlist sends an email.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {rows.map((r) => {
              const info = routeInfo(r.threadSendRoute);
              const to = r.recipientEmails.length ? r.recipientEmails.join(", ") : (r.recipientEmail ?? "—");
              const at = r.sentAt ?? r.createdAt;
              return (
                <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`shrink-0 mt-0.5 text-[11px] font-medium px-2 py-1 rounded-md border ${info.cls}`} title={info.note}>
                    {info.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-neutral-200 truncate">{r.subject || "(no subject)"}</p>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {to}
                      {r.transaction?.propertyAddress ? <span className="text-neutral-600"> · {r.transaction.propertyAddress}</span> : null}
                      {r.transaction?.agency?.name ? <span className="text-neutral-600"> · {r.transaction.agency.name}</span> : null}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-neutral-600 tabular-nums whitespace-nowrap">{fmt(at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
