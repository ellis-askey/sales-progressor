import { commandDb } from "@/lib/command/prisma";
import { claimVariantFor, type ClaimVariant } from "@/lib/chain/claim-experiment";
import InfoTip from "@/components/command/shared/InfoTip";

export const dynamic = "force-dynamic";

// Command Centre → Claim card test. Live readout of the /claim landing-page A/B
// experiment (lib/chain/claim-experiment.ts). Variant A = the original coral
// hero card; Variant B = the illustrated card with avatar + photos + pills.
// Assignment is a frozen deterministic split by ChainLink id, so we recompute
// each invite's arm here rather than storing a column. Only invites that were
// actually opened (inviteFirstViewedAt set) count as "shown".

interface Arm {
  key: ClaimVariant;
  label: string;
  shown: number;
  clicked: number; // reached a claim step (claimStartedAt)
  claimed: number; // joined the chain (claimedAt)
  declined: number;
  ttc: number[]; // time-to-click samples, ms
}

function pct(n: number, d: number): string {
  if (!d) return "-";
  return `${Math.round((n / d) * 100)}%`;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "-";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const rs = sec % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h ${rm}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

export default async function ClaimExperimentPage() {
  const links = await commandDb.chainLink.findMany({
    where: { inviteFirstViewedAt: { not: null } },
    select: {
      id: true,
      inviteFirstViewedAt: true,
      claimStartedAt: true,
      claimedAt: true,
      inviteDeclinedAt: true,
    },
  });

  const arms: Record<ClaimVariant, Arm> = {
    A: { key: "A", label: "A · Coral card (control)", shown: 0, clicked: 0, claimed: 0, declined: 0, ttc: [] },
    B: { key: "B", label: "B · Illustrated card", shown: 0, clicked: 0, claimed: 0, declined: 0, ttc: [] },
  };

  for (const l of links) {
    const arm = arms[claimVariantFor(l.id)];
    arm.shown += 1;
    if (l.claimStartedAt) {
      arm.clicked += 1;
      if (l.inviteFirstViewedAt) {
        arm.ttc.push(l.claimStartedAt.getTime() - l.inviteFirstViewedAt.getTime());
      }
    }
    if (l.claimedAt) arm.claimed += 1;
    if (l.inviteDeclinedAt) arm.declined += 1;
  }

  const A = arms.A;
  const B = arms.B;
  const totalShown = A.shown + B.shown;

  // Which arm has the higher click-through rate (needs data on both sides).
  const ctrA = A.shown ? A.clicked / A.shown : 0;
  const ctrB = B.shown ? B.clicked / B.shown : 0;
  const leader = A.shown && B.shown ? (ctrA === ctrB ? "tie" : ctrA > ctrB ? "A" : "B") : null;

  const rows: { label: string; hint?: string; a: string; b: string; highlight?: "A" | "B" | null }[] = [
    { label: "Shown", hint: "Invites opened on this variant", a: String(A.shown), b: String(B.shown) },
    { label: "Clicked the CTA", hint: "Reached a claim step", a: String(A.clicked), b: String(B.clicked) },
    {
      label: "Click-through rate",
      hint: "Clicked as a share of shown, the headline number",
      a: pct(A.clicked, A.shown),
      b: pct(B.clicked, B.shown),
      highlight: leader === "tie" ? null : (leader as "A" | "B" | null),
    },
    { label: "Joined the chain", hint: "Completed the claim", a: String(A.claimed), b: String(B.claimed) },
    { label: "Claim rate", hint: "Joined ÷ shown", a: pct(A.claimed, A.shown), b: pct(B.claimed, B.shown) },
    { label: "Declined", a: String(A.declined), b: String(B.declined) },
    { label: "Median time to click", hint: "From opening to clicking the CTA", a: fmtDuration(median(A.ttc)), b: fmtDuration(median(B.ttc)) },
    {
      label: "Average time to click",
      a: fmtDuration(A.ttc.length ? A.ttc.reduce((s, n) => s + n, 0) / A.ttc.length : null),
      b: fmtDuration(B.ttc.length ? B.ttc.reduce((s, n) => s + n, 0) / B.ttc.length : null),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500 font-mono">Experiment</div>
      <h1 className="text-2xl font-semibold text-neutral-100">Claim card test</h1>
      <p className="mt-2 text-sm text-neutral-400 max-w-2xl leading-relaxed">
        Two designs for the chain-invite landing page, split 50/50 by invite. We measure how many opened it, how many
        clicked through to claim, how many actually joined, and how long they took to click. Assignment is fixed per
        invite, so the same agent always sees the same card.
      </p>

      {totalShown === 0 ? (
        <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-300 font-medium">No opened invites yet.</p>
          <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
            Numbers appear here as invited agents open their claim link. To preview either card yourself without
            affecting the data, append <code className="text-neutral-300">?variant=a</code> or{" "}
            <code className="text-neutral-300">?variant=b</code> to any <code className="text-neutral-300">/claim</code>{" "}
            link.
          </p>
        </div>
      ) : (
        <>
          {leader && leader !== "tie" && (
            <div className="mt-6 rounded-xl border border-blue-600/40 bg-blue-600/10 px-4 py-3 text-sm text-blue-200">
              Variant <strong>{leader}</strong> is leading on click-through ({pct(leader === "A" ? A.clicked : B.clicked, leader === "A" ? A.shown : B.shown)} vs{" "}
              {pct(leader === "A" ? B.clicked : A.clicked, leader === "A" ? B.shown : A.shown)}).
              {totalShown < 30 && <span className="text-blue-300/70"> Sample is still small — treat as directional.</span>}
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-900 text-neutral-400 text-left">
                  <th className="px-4 py-3 font-medium">Metric</th>
                  <th className="px-4 py-3 font-medium text-right">{A.label}</th>
                  <th className="px-4 py-3 font-medium text-right">{B.label}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {rows.map((r) => (
                  <tr key={r.label} className="bg-neutral-950">
                    <td className="px-4 py-3 text-neutral-300">
                      <span className="inline-flex items-center gap-1.5">
                        {r.label}
                        {r.hint && <InfoTip label={r.label}>{r.hint}</InfoTip>}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        r.highlight === "A" ? "text-emerald-300 font-semibold" : "text-neutral-200"
                      }`}
                    >
                      {r.a}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        r.highlight === "B" ? "text-emerald-300 font-semibold" : "text-neutral-200"
                      }`}
                    >
                      {r.b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-neutral-500 leading-relaxed">
            {totalShown} opened invite{totalShown === 1 ? "" : "s"} in the experiment so far. Preview either card with{" "}
            <code className="text-neutral-400">?variant=a</code> / <code className="text-neutral-400">?variant=b</code>{" "}
            (previews are not recorded).
          </p>
        </>
      )}
    </div>
  );
}
