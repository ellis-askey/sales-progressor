import { ClaimCtaButton } from "@/components/claim/ClaimCtaButton";
import { ClaimChainLadder, type LadderRow, type LadderStatus } from "@/components/claim/ClaimChainLadder";

// The chain-invite claim landing card: a light editorial card with the inviter's
// avatar, headline, the shared chain ladder (ClaimChainLadder), CTA and trust
// strip. Pure presentational server component — all data (photo URLs, avatar) is
// resolved by the caller in app/claim/page.tsx. (The coral A/B variant was
// retired 2026-09-09; this is now the only landing.)

// Re-exported so existing importers (app/claim/page.tsx) keep their import path.
export type { LadderRow, LadderStatus };

export interface ClaimInviteCardProps {
  inviterName: string;
  inviterAgency: string | null;
  inviterAvatarUrl: string;
  inviterHasPhoto: boolean;
  invitedDate: string | null;
  yourAddress: string;
  ladder: LadderRow[];
  ghostCount: number;
  claimHref: string;
  ctaMicrocopy: string;
  /** True only for a manually-copied share link (not the email invite). Turns on
   *  per-sale progress + contacts, softens the pending label to "Not joined yet",
   *  and hides the trial/trust strip. */
  shareMode?: boolean;
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m4 10.5 3.5 3.5L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7.3" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.6 16c0-2.6 2.1-4.3 4.7-4.3s4.7 1.7 4.7 4.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.4 5.1a2.6 2.6 0 0 1 0 5M14.3 11.9c2 .3 3.6 1.9 3.6 4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4.5" y="8.75" width="11" height="7.25" rx="1.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.75 8.75V6.5a3.25 3.25 0 0 1 6.5 0v2.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg className="claim-b-cta-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClaimInviteCard({
  inviterName,
  inviterAgency,
  inviterAvatarUrl,
  inviterHasPhoto,
  invitedDate,
  yourAddress,
  ladder,
  ghostCount,
  claimHref,
  ctaMicrocopy,
  shareMode = false,
}: ClaimInviteCardProps) {
  const subLead = inviterAgency ? `${inviterName} at ${inviterAgency}` : inviterName;

  return (
    <div className="claim-b-wrap">
      <div className="claim-b-card">
        {/* Inviter + date */}
        <div className="claim-b-topbar">
          <div className="claim-b-inviter">
            <span className={`claim-b-avatar${inviterHasPhoto ? " claim-b-avatar--photo" : ""}`}>
              <img
                src={inviterAvatarUrl}
                alt=""
                className={inviterHasPhoto ? "claim-b-avatar-img" : "claim-b-avatar-mark"}
              />
            </span>
            <div className="claim-b-inviter-text">
              <span className="claim-b-inviter-name">{inviterName}</span>
              <span className="claim-b-inviter-role">
                {inviterAgency ? `${inviterAgency} invited you to join this chain` : "invited you to join this chain"}
              </span>
            </div>
          </div>
          {invitedDate && (
            <div className="claim-b-invited">
              <span className="claim-b-invited-label">Invited on</span>
              <span className="claim-b-invited-date">{invitedDate}</span>
            </div>
          )}
        </div>

        {/* Headline */}
        <h1 className="claim-b-headline">
          Your sale is part <span className="claim-b-coral">of a live chain.</span>
        </h1>
        <p className="claim-b-sub">
          {subLead} has linked {yourAddress} to their chain. Join to see how the other sales are progressing.
        </p>

        {/* Chain ladder (shared with the signup panel) */}
        <ClaimChainLadder ladder={ladder} ghostCount={ghostCount} shareMode={shareMode} />

        {/* CTA */}
        <div className="claim-b-cta">
          <ClaimCtaButton href={claimHref}>
            Join this chain
            <IconArrow />
          </ClaimCtaButton>
        </div>
        <p className="claim-b-microcopy">{ctaMicrocopy}</p>

        {!shareMode && (
        <div className="claim-b-trust">
          <span className="claim-b-trust-item">
            <IconCheck /> Free to self-progress
          </span>
          <span className="claim-b-trust-item">
            <IconUsers /> No card required
          </span>
          <span className="claim-b-trust-item">
            <IconLock /> Secure &amp; private
          </span>
        </div>
        )}
      </div>
    </div>
  );
}
