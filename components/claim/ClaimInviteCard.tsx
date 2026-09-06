import { ClaimCtaButton } from "@/components/claim/ClaimCtaButton";

// Variant B of the chain-invite claim landing page: a light editorial card with
// the inviter's avatar, property thumbnails, polished numbered badges and status
// pills. Pure presentational server component — all data (photo URLs, avatar) is
// resolved by the caller in app/claim/page.tsx.

export type LadderStatus = "you" | "joined" | "pending";

export interface LadderRow {
  id: string;
  displayNum: number;
  status: LadderStatus;
  address: string;
  /** Agency / firm name shown under the address (null for the invited link). */
  agency: string | null;
  /** Signed photo URL, or null to show the house placeholder. */
  photoUrl: string | null;
}

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
}

// Split "22 Willow Road, Berkhamsted, HP4 2AB" into a bold street line and a
// lighter town/postcode line.
function splitAddress(address: string): { line1: string; line2: string | null } {
  const idx = address.indexOf(",");
  if (idx === -1) return { line1: address, line2: null };
  return { line1: address.slice(0, idx).trim(), line2: address.slice(idx + 1).trim() || null };
}

function HousePlaceholder() {
  return (
    <svg className="claim-b-thumb-house" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 5l8 6.5M6 10v9h12v-9M10 19v-5h4v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m4 10.5 3.5 3.5L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v4.2l2.8 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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

const PILL: Record<LadderStatus, { label: string; icon: React.ReactNode }> = {
  you: { label: "Your sale", icon: null },
  joined: { label: "Joined", icon: <IconCheck /> },
  pending: { label: "Invite pending", icon: <IconClock /> },
};

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

        {/* Chain ladder */}
        <div className="claim-b-ladder">
          {ladder.map((row) => {
            const { line1, line2 } = splitAddress(row.address || (row.status === "pending" ? "Invite pending" : "Your sale"));
            const pill = PILL[row.status];
            const subLabel = row.status === "you" ? "Your sale" : row.agency;
            return (
              <div className="claim-b-row" key={row.id}>
                <span className="claim-b-gutter">
                  <span className={`claim-b-badge${row.status === "you" ? " claim-b-badge--you" : ""}`}>
                    {String(row.displayNum).padStart(2, "0")}
                  </span>
                </span>
                <div className={`claim-b-rowcard${row.status === "you" ? " claim-b-rowcard--you" : ""}`}>
                  <span className="claim-b-thumb">
                    {row.photoUrl ? (
                      <img src={row.photoUrl} alt="" className="claim-b-thumb-img" />
                    ) : (
                      <HousePlaceholder />
                    )}
                  </span>
                  <span className="claim-b-rowmain">
                    <span className="claim-b-addr1">{line1}</span>
                    {line2 && <span className="claim-b-addr2">{line2}</span>}
                    {subLabel && (
                      <span className={`claim-b-addr3${row.status === "you" ? " claim-b-addr3--you" : ""}`}>
                        {subLabel}
                      </span>
                    )}
                  </span>
                  <span className={`claim-b-pill claim-b-pill--${row.status}`}>
                    {pill.icon}
                    {pill.label}
                  </span>
                </div>
              </div>
            );
          })}
          {ghostCount > 0 && (
            <div className="claim-b-row claim-b-row--ghost">
              <span className="claim-b-gutter">
                <span className="claim-b-badge claim-b-badge--ghost">··</span>
              </span>
              <div className="claim-b-rowcard claim-b-rowcard--ghost">and {ghostCount} more</div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="claim-b-cta">
          <ClaimCtaButton href={claimHref}>
            Join this chain
            <IconArrow />
          </ClaimCtaButton>
        </div>
        <p className="claim-b-microcopy">{ctaMicrocopy}</p>

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
      </div>
    </div>
  );
}
