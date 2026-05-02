import { prisma } from "@/lib/prisma";

const ENV_BADGE: Record<string, string> = {
  production: "bg-blue-500/20 text-blue-300",
  preview:    "bg-amber-500/20 text-amber-300",
  staging:    "bg-purple-500/20 text-purple-300",
};

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export default async function DeploymentsPage() {
  const deployments = await prisma.deployment.findMany({
    orderBy: { deployedAt: "desc" },
    take: 100,
  });

  if (deployments.length === 0) {
    return (
      <div className="pt-4">
        <p className="text-sm text-white/30">No deployments recorded yet.</p>
        <p className="text-xs text-white/25 mt-2">
          Configure the Vercel webhook at POST /api/webhooks/vercel-deploy to start recording.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">{deployments.length} deployments recorded.</p>
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/15 bg-white/8">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Environment</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Version</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Notes</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Triggered by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {deployments.map((d) => (
              <tr key={d.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-xs text-white/60 whitespace-nowrap tabular-nums">
                  {fmtDate(d.deployedAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ENV_BADGE[d.environment] ?? "bg-white/8 text-white/40"}`}>
                    {d.environment}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-white/50 max-w-[200px] truncate">
                  {d.version}
                </td>
                <td className="px-4 py-3 text-xs text-white/50 max-w-xs">
                  {d.releaseNotes ? (
                    <p className="line-clamp-2 whitespace-pre-line">{d.releaseNotes}</p>
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-white/40">
                  {d.triggeredBy ?? d.triggerType}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
