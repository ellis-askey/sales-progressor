// Shown on the hub to an AGENCY DIRECTOR who has pending connection requests from
// progression businesses (the multi-progressor consent handshake). Returns null
// for everyone else. Mirrors CardNudgeBanner's self-contained server pattern.

import { requireSession } from "@/lib/session";
import { listIncomingConnectionRequests } from "@/lib/services/progression-clients";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { feeModelSummary } from "@/lib/progression/client-fees";
import { ConnectionRequestCard } from "./ConnectionRequestCard";

export async function ConnectionRequestBanner() {
  if (!progressionBusinessesEnabled()) return null;
  const session = await requireSession().catch(() => null);
  // Only the agency's own director accepts progressors on its behalf.
  if (!session || session.user.role !== "director" || !session.user.agencyId) return null;

  const requests = await listIncomingConnectionRequests(session.user.agencyId).catch(() => []);
  if (requests.length === 0) return null;

  return (
    <div className="crb-wrap">
      <div className="crb">
        <p className="crb-eyebrow">Connection {requests.length === 1 ? "request" : "requests"}</p>
        {requests.map((r) => (
          <ConnectionRequestCard
            key={r.id}
            id={r.id}
            businessName={r.businessName}
            feeLabel={r.feeModel ? feeModelSummary(r.feeModel) : null}
          />
        ))}
      </div>
      <style>{`
        .crb-wrap { max-width: 1120px; margin: 0 auto 18px; padding: 0 clamp(16px, 4vw, 32px); }
        .crb { border-radius: 16px; overflow: hidden;
          background: var(--agent-surface, rgba(255,255,255,0.82)); -webkit-backdrop-filter: blur(14px) saturate(115%); backdrop-filter: blur(14px) saturate(115%);
          border: 0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.08)); box-shadow: 0 1px 2px rgba(20,14,10,0.04), 0 6px 22px rgba(20,14,10,0.06); }
        .crb-eyebrow { margin: 0; padding: 12px 17px 2px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--agent-text-muted); }
      `}</style>
    </div>
  );
}
