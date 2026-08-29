import Link from "next/link";
import type { OptedOutRow, OptedOutReason } from "@/lib/command/opted-out";

const REASON_STYLE: Record<OptedOutReason, string> = {
  unsubscribed: "bg-red-950/40 text-red-300 border-red-900/60",
  agent_paused: "bg-amber-950/40 text-amber-300 border-amber-900/60",
  chases_paused: "bg-neutral-800 text-neutral-300 border-neutral-700",
};

export function OptedOutTable({ rows }: { rows: OptedOutRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-500">
        No clients have opted out or paused chasing on any active file.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
            <th className="px-4 py-2.5 font-medium">Client</th>
            <th className="px-4 py-2.5 font-medium">Property</th>
            <th className="px-4 py-2.5 font-medium">Agency</th>
            <th className="px-4 py-2.5 font-medium">Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-neutral-800/70 last:border-0 hover:bg-neutral-900/50 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/transactions/${r.transactionId}`} className="text-neutral-100 hover:text-blue-300">
                  {r.clientName}
                </Link>
                <span className="ml-1.5 text-[11px] text-neutral-500">{r.role === "vendor" ? "seller" : "buyer"}</span>
              </td>
              <td className="px-4 py-3 text-neutral-300 truncate max-w-[240px]">{r.address}</td>
              <td className="px-4 py-3 text-neutral-400">{r.agencyName}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-md border px-2 py-0.5 text-[11.5px] ${REASON_STYLE[r.reason]}`}>
                  {r.detail}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
