"use client";

import Link from "next/link";
import { useState, Fragment, type CSSProperties } from "react";
import { getChainLinkStatus, chainLinkStatusLabel } from "@/lib/chain/status";
import { displayChainPosition } from "@/lib/chain/positions";
import { formatPredictedBandShort } from "@/lib/utils/format-predicted-band";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";
import { formatChainPriceFull } from "@/lib/chain/summary";
import type { ChainLinkV2, ChainNodeIntel } from "@/lib/services/chains";
import type { ChainNodeIntelInput } from "@/lib/chain/intel";

function relativeTime(date: Date | string | null): string {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  return `${days}d ago`;
}

// Status pill styled with agent tokens (theme-aware across every agent theme).
// Colour follows the same semantics as the mock: your file = coral, claimed =
// success, invited = warning, declined/bounced = danger, unclaimed = neutral.
function statusPillStyle(kind: ReturnType<typeof getChainLinkStatus>["kind"]): {
  color: string;
  background: string;
} {
  switch (kind) {
    case "claimed_own":
    case "your_transaction":
      return { color: "var(--agent-coral-darker)", background: "var(--agent-coral-bg-tint)" };
    case "claimed_other":
      return { color: "var(--agent-success)", background: "var(--agent-success-bg)" };
    case "invited":
      return { color: "var(--agent-warning)", background: "var(--agent-warning-bg)" };
    case "bounced":
    case "declined":
      return { color: "var(--agent-danger)", background: "var(--agent-danger-bg)" };
    default:
      return { color: "var(--agent-text-muted)", background: "var(--agent-border-subtle)" };
  }
}

function ChainStatusBadge({
  status,
  label,
}: {
  status: ReturnType<typeof getChainLinkStatus>;
  label: string;
}) {
  const s = statusPillStyle(status.kind);
  return (
    <span
      className="chain-status-pill"
      style={{ color: s.color, background: s.background }}
    >
      {status.kind === "bounced" && <span aria-hidden>⚠ </span>}
      {label}
      <span className="sr-only">Status: {label}</span>
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <span
      className="chain-bar"
      aria-label={`${clamped}% complete`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: `${clamped}%` }} />
    </span>
  );
}

type DirectionalState = {
  upward: string | null;   // ChainWithdrawalStatus value or null
  downward: string | null;
};

type LinkCardProps = {
  link: ChainLinkV2;
  totalLinks: number;
  currentUserId: string;
  isYourFile: boolean;
  /** Which end of the chain this link sits at, for the "· top / · bottom"
   *  position tag. Omitted for interior links and by the demo pages. */
  edge?: "top" | "bottom";
  onResendInvite?: (linkId: string) => void;
  onEditStub?: (link: ChainLinkV2) => void;
  onDeleteStub?: (linkId: string) => void;
  /** Save this node's private chain intel. Present only where the viewer may
   *  edit; the card also gates on link.canEditIntel. */
  onSaveIntel?: (linkId: string, input: ChainNodeIntelInput) => Promise<void>;
  /** Per-direction response state for cascade-aware badge rendering.
   *  Computed at /api/chains and passed down. Omitted → falls back to the
   *  single denormalised link.withdrawalStatus for backwards safety. */
  directional?: DirectionalState;
};

const BADGE_STYLE = {
  REMARKETING: { color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)", label: "Going back to market" },
  WAITING:     { color: "#0369a1", bg: "rgba(3,105,161,0.08)",  border: "rgba(3,105,161,0.2)",  label: "Waiting for chain to reform" },
  BREAK_CHAIN: { color: "#b45309", bg: "rgba(180,83,9,0.08)",   border: "rgba(180,83,9,0.2)",   label: "Proceeding without onward purchase" },
  WITHDRAWN:   { color: "#525252", bg: "rgba(82,82,82,0.10)",   border: "rgba(82,82,82,0.25)",  label: "Withdrawn" },
} as const;

type BadgeKind = keyof typeof BADGE_STYLE;

function Badge({ kind, arrow }: { kind: BadgeKind; arrow?: "↑" | "↓" }) {
  const s = BADGE_STYLE[kind];
  return (
    <span style={{
      display: "inline-block",
      marginTop: 6,
      marginRight: 6,
      fontSize: 10,
      fontWeight: 600,
      color: s.color,
      background: s.bg,
      border: `0.5px solid ${s.border}`,
      borderRadius: 4,
      padding: "2px 6px",
    }}>
      {arrow ? `${arrow} ` : ""}{s.label}
    </span>
  );
}

// ── Chain-node intel (own-side private) ──────────────────────────────────────
// Expands inside the card. Read-only for viewers who may see but not edit; an
// inline form for those who may. Rendered only when there is something to show
// or the viewer may add. Trust boundary is enforced server-side (getChainV2 nulls
// intel for anyone not allowed to see it), so this component never leaks.

const STANCE_OPTIONS: {
  value: NonNullable<ChainNodeIntelInput["breakChainStance"]>;
  label: string;
  short: string;
}[] = [
  { value: "PREPARED", label: "Prepared to break the chain", short: "Will break" },
  { value: "IF_REQUIRED", label: "Would break if required", short: "May break" },
  { value: "UNWILLING", label: "Not willing to break the chain", short: "Won't break" },
];

function stanceLabel(v: string | null): string | null {
  return STANCE_OPTIONS.find((o) => o.value === v)?.label ?? null;
}
function stanceShort(v: string | null): string | null {
  return STANCE_OPTIONS.find((o) => o.value === v)?.short ?? null;
}
function formatCheckDate(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const intelLabelStyle: CSSProperties = { display: "grid", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--agent-text-muted)" };
const intelInputStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  padding: "6px 8px",
  borderRadius: 6,
  border: "0.5px solid var(--agent-border-subtle)",
  background: "var(--agent-surface)",
  color: "var(--agent-text)",
  width: "100%",
  fontFamily: "inherit",
};

function intelToForm(intel: ChainNodeIntel | null): ChainNodeIntelInput {
  return {
    breakChainStance: (intel?.breakChainStance as ChainNodeIntelInput["breakChainStance"]) ?? null,
    breakChainConditions: intel?.breakChainConditions ?? null,
    expectedTimescale: intel?.expectedTimescale ?? null,
    chainNotes: intel?.chainNotes ?? null,
    lastChainCheckAt: toDateInput(intel?.lastChainCheckAt ?? null) || null,
  };
}

function IntelReadRows({ intel }: { intel: ChainNodeIntel }) {
  const rows: { label: string; value: string }[] = [];
  const sl = stanceLabel(intel.breakChainStance);
  if (sl) rows.push({ label: "Breaking the chain", value: sl });
  if (intel.breakChainConditions) rows.push({ label: "Conditions", value: intel.breakChainConditions });
  if (intel.expectedTimescale) rows.push({ label: "Timescale", value: intel.expectedTimescale });
  if (intel.chainNotes) rows.push({ label: "Notes", value: intel.chainNotes });
  if (intel.lastChainCheckAt) rows.push({ label: "Last checked", value: formatCheckDate(intel.lastChainCheckAt) });
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", margin: 0, fontSize: 12 }}>
      {rows.map((r) => (
        <Fragment key={r.label}>
          <dt style={{ color: "var(--agent-text-muted)", fontWeight: 600 }}>{r.label}</dt>
          <dd style={{ margin: 0, color: "var(--agent-text)", whiteSpace: "pre-wrap" }}>{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function ChainIntelPanel({
  link,
  onSaveIntel,
}: {
  link: ChainLinkV2;
  onSaveIntel?: (linkId: string, input: ChainNodeIntelInput) => Promise<void>;
}) {
  const intel = link.intel ?? null;
  const canEdit = (link.canEditIntel ?? false) && !!onSaveIntel;
  const hasAny = Boolean(
    intel &&
      (intel.breakChainStance ||
        intel.breakChainConditions ||
        intel.expectedTimescale ||
        intel.chainNotes ||
        intel.lastChainCheckAt),
  );

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ChainNodeIntelInput>(() => intelToForm(intel));

  // Nothing recorded and can't add → don't render the affordance at all.
  if (!canEdit && !hasAny) return null;

  const summaryBits: string[] = [];
  const ss = stanceShort(intel?.breakChainStance ?? null);
  if (ss) summaryBits.push(ss);
  if (intel?.lastChainCheckAt) summaryBits.push(`checked ${formatCheckDate(intel.lastChainCheckAt)}`);
  const summary = summaryBits.join(" · ");

  function startEditing() {
    setForm(intelToForm(intel));
    setError(null);
    setEditing(true);
    setExpanded(true);
  }

  async function save() {
    if (!onSaveIntel) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveIntel(link.id, form);
      setEditing(false);
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="chain-intel"
      style={{ marginTop: 8, borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 8 }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="chain-act-link"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--agent-text-muted)" }}
      >
        <span aria-hidden style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
          ▸
        </span>
        Chain details
        {!expanded && summary && <span style={{ fontWeight: 400 }}>· {summary}</span>}
      </button>

      {expanded && (
        <div style={{ marginTop: 8 }}>
          {editing ? (
            <div style={{ display: "grid", gap: 10 }}>
              <label style={intelLabelStyle}>
                Breaking the chain
                <select
                  value={form.breakChainStance ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, breakChainStance: (e.target.value || null) as ChainNodeIntelInput["breakChainStance"] }))
                  }
                  style={intelInputStyle}
                  disabled={saving}
                >
                  <option value="">Not established</option>
                  {STANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={intelLabelStyle}>
                Conditions around breaking
                <textarea
                  value={form.breakChainConditions ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, breakChainConditions: e.target.value }))}
                  rows={2}
                  style={intelInputStyle}
                  disabled={saving}
                />
              </label>

              <label style={intelLabelStyle}>
                Expected timescale / delays
                <input
                  value={form.expectedTimescale ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, expectedTimescale: e.target.value }))}
                  style={intelInputStyle}
                  disabled={saving}
                />
              </label>

              <label style={intelLabelStyle}>
                Chain notes
                <textarea
                  value={form.chainNotes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, chainNotes: e.target.value }))}
                  rows={3}
                  style={intelInputStyle}
                  disabled={saving}
                />
              </label>

              <label style={intelLabelStyle}>
                Last chain check
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="date"
                    value={form.lastChainCheckAt ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, lastChainCheckAt: e.target.value || null }))}
                    style={{ ...intelInputStyle, flex: 1 }}
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, lastChainCheckAt: new Date().toISOString().slice(0, 10) }))}
                    className="chain-act-link"
                    disabled={saving}
                  >
                    Today
                  </button>
                </div>
              </label>

              {error && (
                <p role="alert" style={{ color: "var(--agent-danger)", fontSize: 12, margin: 0 }}>
                  {error}
                </p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void save()}
                  className="chain-act-link chain-act-primary"
                  disabled={saving}
                  style={{ fontWeight: 600 }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  className="chain-act-link"
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {hasAny && intel ? (
                <IntelReadRows intel={intel} />
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>No chain details recorded yet.</p>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="chain-act-link chain-act-primary"
                  style={{ marginTop: 6, fontWeight: 600 }}
                >
                  {hasAny ? "Edit details" : "Add details"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function LinkCard({
  link,
  totalLinks,
  currentUserId,
  isYourFile,
  edge,
  onResendInvite,
  onEditStub,
  onDeleteStub,
  onSaveIntel,
  directional,
}: LinkCardProps) {
  const status = getChainLinkStatus(
    {
      transactionId: link.transactionId,
      claimedByUserId: link.claimedByUserId,
      stubAgentEmail: link.stubAgentEmail,
      inviteStatus: link.inviteStatus,
    },
    currentUserId,
    {
      claimerName: link.claimedBy?.name,
      claimerAgency: link.claimedBy?.firmName,
    },
  );

  const label = chainLinkStatusLabel(status);
  const isOriginator = link.createdByUserId === currentUserId;
  const isUnclaimed = link.transactionId === null;

  const addressRaw = link.transaction?.propertyAddress ?? link.stubPropertyAddress ?? "";
  const agencyName = link.claimedBy?.firmName ?? link.stubAgencyName ?? "";
  const addressParts = addressRaw.split(",");
  const address1 = addressParts[0].trim() || "Sale to be added";
  const address2 = addressParts.slice(1).join(",").trim();

  // Real weighted progress (pooled vendor + purchaser, applicable-only) computed
  // server-side in getChainV2. Falls back to 0 only when there's no claimed
  // transaction; the % + bar only render when a transaction exists.
  const progressPercent = link.progressPercent ?? 0;

  // Position tag — "· your file" wins, else the chain-end tag.
  const positionTag = isYourFile ? "your file" : edge ?? null;

  // Photo — real signed URL on claimed links, else the house illustration.
  const photoUrl = link.transaction?.photoUrl ?? null;

  // Price is private to each agent: only ever shown on the viewer's OWN file
  // (the server strips purchasePrice from every other link). On your own file
  // it's the figure, or "Price TBC" until one is set; on any other card there's
  // no price line at all — the status pill carries it.
  const price = link.transaction?.purchasePrice ?? null;
  const priceLabel = isYourFile ? (price != null ? formatChainPriceFull(price) : "Price TBC") : null;

  // Meta descriptor for the bottom bar (left side).
  let meta = "";
  if (status.kind === "invited") meta = `Invite sent · ${relativeTime(link.inviteSentAt)}`;
  else if (status.kind === "bounced") meta = "Email bounced";
  else if (status.kind === "declined") meta = `Agent declined · ${relativeTime(link.inviteDeclinedAt)}`;
  else if (status.kind === "unclaimed_no_email") meta = "Email needed";
  else if (status.kind === "claimed_other") meta = link.claimedBy?.name ? `Claimed by ${link.claimedBy.name}` : "Claimed";
  else if (status.kind === "claimed_own" || status.kind === "your_transaction") meta = "Your file";

  return (
    <div className={`chain-card${isYourFile ? " chain-card-you" : ""}`}>
      {/* Property photo / illustration */}
      <div className={`chain-photo${photoUrl ? "" : " chain-photo-illus"}`}>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" loading="lazy" />
        )}
      </div>

      <div className="chain-body">
        <div className="chain-body-top">
          <div className="chain-cmain">
            <div className="chain-cpos">
              Position {displayChainPosition(link.position, totalLinks)} of {totalLinks}
              {positionTag && <span className="chain-cpos-tag"> · {positionTag}</span>}
            </div>
            <p className="chain-caddr">{address1}</p>
            {(address2 || agencyName) && (
              <p className="chain-cag">
                {address2}
                {address2 && agencyName && " · "}
                {agencyName && <b>{agencyName}</b>}
              </p>
            )}

            {link.transaction && (
              <div className="chain-cprog">
                <span className="chain-pct">{progressPercent}%</span>
                <ProgressBar percent={progressPercent} />
              </div>
            )}

            {/* Predicted exchange band — only when we have a prediction, aren't
             * in early-estimate phase, AND medians are real (MEDIANS_READY). */}
            {MEDIANS_READY && link.transaction && link.predictedExchangeDate && !link.isEarlyEstimate && (
              <p className="chain-band">Exchange {formatPredictedBandShort(link.predictedExchangeDate)}</p>
            )}

            {/* Withdrawn (canonical transaction.status) + cascade directional
             *  badges — carried over unchanged from the prior card. */}
            <div className="chain-badges">
              {link.transaction?.status === "withdrawn" && (
                <span style={{
                  display: "inline-block",
                  marginTop: 6,
                  marginRight: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--agent-danger)",
                  background: "var(--agent-danger-bg)",
                  border: "0.5px solid var(--agent-danger-border)",
                  borderRadius: 4,
                  padding: "2px 6px",
                }}>
                  Withdrawn
                </span>
              )}

              {link.withdrawalStatus === "WITHDRAWN" && link.transaction?.status !== "withdrawn" ? (
                <Badge kind="WITHDRAWN" />
              ) : directional ? (
                <>
                  {directional.upward && BADGE_STYLE[directional.upward as BadgeKind] && (
                    <Badge kind={directional.upward as BadgeKind} arrow="↑" />
                  )}
                  {directional.downward && BADGE_STYLE[directional.downward as BadgeKind] && (
                    <Badge kind={directional.downward as BadgeKind} arrow="↓" />
                  )}
                </>
              ) : (
                link.withdrawalStatus && BADGE_STYLE[link.withdrawalStatus as BadgeKind] && (
                  <Badge kind={link.withdrawalStatus as BadgeKind} />
                )
              )}
            </div>
          </div>

          <div className="chain-cright">
            {priceLabel && (
              <div className={`chain-price${price == null ? " chain-price-tbc" : ""}`}>{priceLabel}</div>
            )}
            <ChainStatusBadge status={status} label={label} />
          </div>
        </div>

        {/* Bottom action bar — meta on the left, action links on the right.
         *  Every action + its gating condition is carried over unchanged. */}
        <div className="chain-acts">
          {meta && <span className="chain-acts-meta">{meta}</span>}

          {isYourFile && link.transaction && (
            <Link
              href={`/agent/transactions/${link.transaction.id}`}
              className="chain-act-link chain-act-primary"
            >
              Open file →
            </Link>
          )}

          {isOriginator && isUnclaimed && (
            <>
              {status.kind === "unclaimed_no_email" && onEditStub && (
                <button onClick={() => onEditStub(link)} className="chain-act-link chain-act-primary">
                  Add email &amp; invite
                </button>
              )}
              {status.kind === "unclaimed_unsent" && onResendInvite && (
                <button onClick={() => onResendInvite(link.id)} className="chain-act-link chain-act-primary">
                  Send invite
                </button>
              )}
              {status.kind === "invited" && onResendInvite && (
                <button onClick={() => onResendInvite(link.id)} className="chain-act-link">
                  Resend invite
                </button>
              )}
              {status.kind === "bounced" && onEditStub && (
                <button onClick={() => onEditStub(link)} className="chain-act-link chain-act-warn">
                  Update email &amp; resend
                </button>
              )}
              {status.kind === "declined" && onResendInvite && (
                <button onClick={() => onResendInvite(link.id)} className="chain-act-link chain-act-primary">
                  Resend
                </button>
              )}
              {onEditStub && status.kind !== "unclaimed_no_email" && (
                <button onClick={() => onEditStub(link)} className="chain-act-link">
                  Edit
                </button>
              )}
              {onDeleteStub && (
                <button onClick={() => onDeleteStub(link.id)} className="chain-act-link chain-act-danger">
                  Remove
                </button>
              )}
            </>
          )}
        </div>

        {/* Private own-side chain intel — expands inside the card. */}
        <ChainIntelPanel link={link} onSaveIntel={onSaveIntel} />
      </div>
    </div>
  );
}

// Connector visual between chain cards
export function ChainConnector() {
  return <div className="chain-connector" aria-hidden />;
}
