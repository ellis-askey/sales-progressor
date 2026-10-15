// Shown on the hub to an AGENCY DIRECTOR who has pending connection requests from
// progression businesses (the multi-progressor consent handshake). Returns null
// for everyone else. Mirrors CardNudgeBanner's self-contained server pattern.

import { requireSession } from "@/lib/session";
import { listIncomingConnectionRequests } from "@/lib/services/progression-clients";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
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
          />
        ))}
      </div>
      <style>{`
        /* Top margin clears the sticky nav; the page header below carries its own
           24px top padding, so the banner adds no bottom margin (avoids the big
           floating gap above the greeting). */
        .crb-wrap { max-width: 1120px; margin: 16px auto 0; padding: 0 clamp(16px, 4vw, 32px); }
        .crb { border-radius: 16px; overflow: hidden;
          background: var(--agent-surface, rgba(255,255,255,0.82)); -webkit-backdrop-filter: blur(14px) saturate(115%); backdrop-filter: blur(14px) saturate(115%);
          border: 0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.08)); box-shadow: 0 1px 2px rgba(20,14,10,0.04), 0 6px 22px rgba(20,14,10,0.06); }
        .crb-eyebrow { margin: 0; padding: 12px 17px 2px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--agent-text-muted); }
      `}</style>
    </div>
  );
}
