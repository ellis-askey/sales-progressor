import { ClaimCountUp } from "@/components/claim/ClaimCountUp";

// The white chain ladder (photo thumbnails, numbered circle badges, status
// pills). Shared by the /claim landing card (ClaimInviteCard) and the signup
// page's side panel, so both show the same polished ladder. Signup turns the
// pills off (showPill={false}); contacts + per-sale progress are share-view only
// and stay gated by shareMode. Pure presentational — the caller resolves photo
// URLs. See docs/active/chain-invite-conversion/00-plan.md.

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
  /** Share-link view only: the agent contact we hold on file for this sale. Null
   *  on the email view and on the recipient's own ("you") row. */
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  /** Share view only: this sale's own progress (0-100). */
  progressPercent?: number | null;
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

function IconPhone() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 3.5h2.2l1.1 3-1.5 1.1a9 9 0 0 0 4.6 4.6l1.1-1.5 3 1.1V16c0 .6-.5 1-1.1 1A11.5 11.5 0 0 1 4 5.6C4 5 4.4 3.5 5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4 6.5 6 4 6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PILL: Record<LadderStatus, { label: string; icon: React.ReactNode }> = {
  you: { label: "Your sale", icon: null },
  joined: { label: "Joined", icon: <IconCheck /> },
  pending: { label: "Invite pending", icon: <IconClock /> },
};

export function ClaimChainLadder({
  ladder,
  ghostCount,
  shareMode = false,
  showPill = true,
}: {
  ladder: LadderRow[];
  ghostCount: number;
  shareMode?: boolean;
  /** Landing shows a status pill per row; the signup panel turns them off. */
  showPill?: boolean;
}) {
  return (
    <div className="claim-b-ladder">
      {ladder.map((row) => {
        // Share view softens the empty-address placeholder and the pending label
        // (there was no email invite on a hand-shared link).
        const pendingFallback = shareMode ? "A sale in the chain" : "Invite pending";
        const { line1, line2 } = splitAddress(row.address || (row.status === "pending" ? pendingFallback : "Your sale"));
        const pill = PILL[row.status];
        const pillLabel = shareMode && row.status === "pending" ? "Not joined yet" : pill.label;
        const subLabel = row.status === "you" ? "Your sale" : row.agency;
        const showContact =
          shareMode && row.status !== "you" && !!(row.contactName || row.contactEmail || row.contactPhone);
        const showProgress = shareMode && row.progressPercent != null;
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
                {showContact && (
                  <span className="claim-b-contact">
                    {row.contactName && <span className="claim-b-contact-name">{row.contactName}</span>}
                    {row.contactPhone && (
                      <a className="claim-b-contact-item" href={`tel:${row.contactPhone}`}>
                        <IconPhone />
                        {row.contactPhone}
                      </a>
                    )}
                    {row.contactEmail && (
                      <a className="claim-b-contact-item" href={`mailto:${row.contactEmail}`}>
                        <IconMail />
                        {row.contactEmail}
                      </a>
                    )}
                  </span>
                )}
              </span>
              {showPill && (
                <span className={`claim-b-pill claim-b-pill--${row.status}`}>
                  {pill.icon}
                  {pillLabel}
                  {showProgress && (
                    <span className="claim-b-pill-pct" aria-label={`${row.progressPercent}% complete`}>
                      <span className="claim-b-pill-sep" aria-hidden="true">·</span>
                      <span aria-hidden="true">
                        <ClaimCountUp value={row.progressPercent ?? 0} />%
                      </span>
                    </span>
                  )}
                </span>
              )}
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
  );
}
