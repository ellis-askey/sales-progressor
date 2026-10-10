// Item 9 — the "add a card" nudge banner on a progression owner's hub.
//
// Server component: resolves the owner + the escalation state, and renders the right
// banner (prompt / warn / blocked) or nothing. Owner-only; invisible when a card is on
// file, billing is dark, or there's nothing owed. Matches the approved artifact — the
// gloss gradient button (.eb-next family), frosted card, amber/coral semantic states.

import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { getBusinessCardNudge } from "@/lib/progression/card-nudge";

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(d);
}

export async function CardNudgeBanner() {
  const session = await requireSession().catch(() => null);
  if (!session) return null;
  const owner = await resolveBusinessOwner(session).catch(() => null);
  if (!owner) return null;

  const nudge = await getBusinessCardNudge(owner.businessId).catch(() => null);
  if (!nudge || nudge.stage === "none") return null;

  const tone = nudge.stage === "blocked" ? "block" : nudge.stage === "warn" ? "warn" : "prompt";
  const owedLabel = `${nudge.owedCount} sale${nudge.owedCount === 1 ? "" : "s"}`;
  const waitLabel = `${nudge.waitingCount} sale${nudge.waitingCount === 1 ? "" : "s"} waiting`;

  const icon =
    nudge.stage === "blocked" ? (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></svg>
    ) : nudge.stage === "warn" ? (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></svg>
    ) : (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M6 14.5h4" /></svg>
    );

  return (
    <div className="cnb-wrap">
      <div className={`cnb ${tone}`}>
        <span className="cnb-ico" aria-hidden="true">{icon}</span>
        <div className="cnb-main">
          {nudge.stage === "prompt" && (
            <>
              <p className="cnb-title">Add a payment card to keep adding sales</p>
              <p className="cnb-body">You&rsquo;ve taken on <b>{owedLabel}</b>, so it&rsquo;s time to add a payment card. We bill on the <b>1st of each month</b> for sales added the previous month (£5 each), plus your £59 subscription for the month ahead and £39 per additional team member.</p>
              <div className="cnb-foot">
                <p className="cnb-body cnb-foot-text">There&rsquo;s nothing to pay today, and your existing sales won&rsquo;t be affected.</p>
                <Link href="/agent/settings/billing" className="cnb-btn">Add a card <span className="cnb-arr">→</span></Link>
              </div>
            </>
          )}
          {nudge.stage === "warn" && (
            <>
              <p className="cnb-title">Add a payment card to avoid a pause on new sales</p>
              <p className="cnb-body">It&rsquo;s been {nudge.daysSince} days since you took on your first sale. Please add a payment card by <b>{nudge.deadline ? fmtDate(nudge.deadline) : "the deadline"}</b> to keep adding new sales.</p>
              <p className="cnb-body">You won&rsquo;t be charged until the 1st of the month, and any sales you&rsquo;re already progressing will continue as normal.</p>
              <div className="cnb-foot">
                <span className="cnb-chip amber">Action needed</span>
                <Link href="/agent/settings/billing" className="cnb-btn">Add a card <span className="cnb-arr">→</span></Link>
              </div>
            </>
          )}
          {nudge.stage === "blocked" && (
            <>
              <p className="cnb-title">New sales are paused until you add a card</p>
              <p className="cnb-body">You can continue progressing all your existing sales as normal, but you won&rsquo;t be able to add or accept new ones until you&rsquo;ve added a payment card.</p>
              <p className="cnb-body">Any sales sent to you will be held safely and made available as soon as your card is added.</p>
              <div className="cnb-foot">
                {nudge.waitingCount > 0 && <span className="cnb-chip coral">{waitLabel}</span>}
                <Link href="/agent/settings/billing" className="cnb-btn">Add a card <span className="cnb-arr">→</span></Link>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .cnb-wrap { max-width: 1120px; margin: 0 auto 18px; padding: 0 clamp(16px, 4vw, 32px); }
        .cnb { display: flex; gap: 15px; align-items: flex-start; border-radius: 16px; padding: 18px 20px;
          background: var(--agent-surface, rgba(255,255,255,0.82)); -webkit-backdrop-filter: blur(14px) saturate(115%); backdrop-filter: blur(14px) saturate(115%);
          border: 0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.08)); box-shadow: 0 1px 2px rgba(20,14,10,0.04), 0 6px 22px rgba(20,14,10,0.06); }
        .cnb.warn { background: linear-gradient(0deg, rgba(181,117,26,0.09), rgba(181,117,26,0.09)), var(--agent-surface, rgba(255,255,255,0.82)); border-color: rgba(181,117,26,0.2); }
        .cnb.block { background: linear-gradient(0deg, rgba(226,69,42,0.08), rgba(226,69,42,0.08)), var(--agent-surface, rgba(255,255,255,0.82)); border-color: rgba(226,69,42,0.22); }
        .cnb-ico { flex: none; margin-top: 2px; color: var(--agent-coral-deep, #E2452A); }
        .cnb.warn .cnb-ico { color: #B5751A; }
        .cnb-main { flex: 1; min-width: 0; }
        .cnb-title { font-size: 15.5px; font-weight: 750; letter-spacing: -.01em; margin: 0 0 5px; line-height: 1.3; color: var(--agent-text-primary, #211D1B); }
        .cnb-body { font-size: 13.5px; color: var(--agent-text-secondary, #5C544E); line-height: 1.6; margin: 0; }
        .cnb-body + .cnb-body { margin-top: 10px; }
        .cnb-body b { color: var(--agent-text-primary, #211D1B); font-weight: 650; }
        .cnb-foot { display: flex; align-items: center; gap: 16px; margin-top: 14px; flex-wrap: wrap; }
        .cnb-foot .cnb-btn { flex: none; margin-left: auto; }
        .cnb-foot-text { flex: 1; min-width: 180px; margin: 0; }
        .cnb-chip { display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; padding: 4px 11px; border-radius: 999px; flex: none;
          border: 0.5px solid var(--agent-border-strong, rgba(0,0,0,0.16)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(20,14,10,0.1); }
        .cnb-chip.amber { background: linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0)), rgba(181,117,26,0.1); color: #B5751A; }
        .cnb-chip.coral { background: linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0)), rgba(226,69,42,0.1); color: var(--agent-coral-deep, #E2452A); }
        .cnb-btn { text-decoration: none; font-size: 13px; font-weight: 700; color: #fff; border-radius: 10px; padding: 11px 18px;
          background: linear-gradient(180deg, #FF7A5C, #E2452A); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 14px -5px rgba(255,107,74,0.5);
          display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; transition: transform .12s, box-shadow .15s, filter .15s; }
        .cnb-btn:hover { filter: brightness(1.04); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 7px 18px -6px rgba(255,107,74,0.6); }
        .cnb-arr { display: inline-block; transition: transform .18s cubic-bezier(.22,1,.36,1); }
        .cnb-btn:hover .cnb-arr { transform: translateX(3px); }
      `}</style>
    </div>
  );
}
