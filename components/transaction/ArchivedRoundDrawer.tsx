"use client";

// Phase 1 commit 8 — archived-round drawer (read-only).
//
// Visual + UX upgrade pass (2026-06-04). Functionally identical to the
// previous version; presentation upgraded to match the rest of the app:
//
// REUSED COMPONENTS / TOKENS (audited, not invented):
//
//   - Drawer chrome from components/milestones/ReconciliationDrawer:
//     fixed full-height right slide, agent-backdrop-overlay backdrop,
//     agent-drawer-in / agent-drawer-out keyframes (240/200ms),
//     surface var(--agent-surface-elevated), 56px header, agent-icon-btn
//     close. Width 560px.
//
//   - Step rows from components/milestones/MilestoneRow:
//     .ms-dot + .ms-dot-done / .ms-dot-locked / .ms-dot-avail state
//     classes, 12px name font, var(--agent-text-primary) /
//     var(--agent-text-muted) state colours, the same row layout
//     (dot + name + meta).
//
//   - Initials chip from components/contacts/ContactsSection:
//     .agent-avatar / .agent-avatar-md class + the SAME getInitials()
//     algorithm (split on whitespace, handle titles, fall back to
//     first letter). Algorithm copied verbatim — no behaviour drift.
//
//   - Section headers: .agent-card-hdr-strip rendered as plain
//     consistent eyebrow rows (12px, weight 600, secondary colour) so
//     the drawer doesn't collide with the file detail's bigger card
//     hierarchy — same tone as the Steps tab's section dividers.
//
//   - Price format: copy of PropertyHero's formatPrice (pence → £...
//     with en-GB grouping, no decimals).
//
//   - Status pills: same coloured-chip pattern the file-detail uses
//     for chips (StatusBadge isn't reused directly because its scope
//     is TransactionStatus — but the colour language matches: emerald
//     for complete, blue for available, slate for locked, slate-strike
//     for not_required).
//
//   - Motion: agent-drawer-in / -out for the panel; agent-reveal-in
//     for the section staggered entrance; all of these have
//     prefers-reduced-motion overrides at the CSS level (no inline
//     useReducedMotion needed — see docs/ANIMATION_STANDARDS.md).
//
// LOCKED COPY (terminology sweep, 2026-06-04 — "round" banned as a
// user-facing noun; "closed"/"withdrew" become "fell through" for a
// fall-through event):
//   - HEADER:   "Sale {n}: {buyerName}'s record"
//   - SUMMARY:  "{n} of 27 buyer steps were complete when this sale fell through."
//   - HEADER SUBLINE: "Fell through {date}"
//   - Section labels + empty states updated to use "sale" / "fell through"
//     per the audit table approved by Ellis 2026-06-04. No paraphrasing.

import { useEffect, useRef, useState } from "react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Drawer } from "@/components/ui/Drawer";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { ContactAvatar } from "@/components/ui/Avatar";
import { getCommBadge, AuthorPill } from "@/lib/agent/comms-display";

type Props = {
  open: boolean;
  transactionId: string;
  archivedRounds: Array<{ id: string; roundNumber: number }>;
  onClose: () => void;
};

// Mirrors the shape returned by /api/transactions/[id]/rounds/[roundId].
// Updated 2026-06-04: vendorMilestoneSnapshot rows now carry name +
// orderIndex (server-side enrichment), and pmCompletions rows likewise.
type SnapshotRow = {
  code: string;
  name: string;
  orderIndex: number;
  state: string;
  completedAt: string | null;
  eventDate: string | null;
  summaryText: string | null;
};

// Chain snapshot shape (closed-loop arc 2026-06-05). Mirrors the JSON
// written by buildChainSnapshotForWithdrawal in app/actions/transactions.ts.
type ChainSnapshot = {
  chainId: string;
  ourLinkId: string;
  ourPosition: number;
  withdrawalReason: string | null;
  capturedAt: string;
  neighbours: Array<{
    linkId: string;
    position: number;
    withdrawalStatus: string | null;
    claimedByUserId: string | null;
    claimedAgentName: string | null;
    claimedAgencyName: string | null;
    claimedTransactionId: string | null;
    claimedAddress: string | null;
    stubAddress: string | null;
    stubAgencyName: string | null;
    stubAgentName: string | null;
  }>;
  detachedSegment: { chainId: string; splitAt: string; notifiedRecipientLinkId: string | null } | null;
};

type ArchivedRoundPayload = {
  round: {
    id: string;
    roundNumber: number;
    status: string;
    archivedAt: string | null;
    fallThroughReason: string | null;
    createdAt: string;
    purchasePrice: number | null;
    purchaserSolicitorFirm: { id: string; name: string } | null;
    purchaserSolicitorContact: { id: string; name: string; phone: string | null; email: string | null } | null;
    brokerFirm: { id: string; name: string } | null;
    brokerContact: { id: string; name: string; phone: string | null; email: string | null } | null;
    vendorMilestoneSnapshot: SnapshotRow[] | null;
    // Closed-loop chain arc (2026-06-05). JSON shape:
    // { chainId, ourLinkId, ourPosition, withdrawalReason, capturedAt,
    //   neighbours[], detachedSegment | null }
    chainSnapshot: ChainSnapshot | null;
    chainNotifications: Array<{
      id: string;
      type: string;
      direction: string;
      recipientLinkId: string;
      recipientEmail: string;
      response: string | null;
      respondedAt: string | null;
      emailSentAt: string | null;
      createdAt: string;
    }>;
  };
  buyerContacts: Array<{ id: string; name: string; email: string | null; phone: string | null; roleType: string }>;
  pmCompletions: Array<{
    code: string; name: string; orderIndex: number; state: string;
    completedAt: string | null; completedByName: string | null;
    eventDate: string | null; summaryText: string | null; confirmedByPortal: boolean;
  }>;
  comms: Array<{ id: string; type: string; method: string | null; content: string; createdAt: string; createdByName: string | null; senderLabel: string | null; visibleToClient: boolean; isAutomated: boolean }>;
  fileDocuments: Array<{ id: string; filename: string; mimeType: string | null; fileSize: number; source: string | null; createdAt: string; signedUrl: string | null }>;
};

// ─── Helpers (verbatim from the audited components) ──────────────────

// formatPrice — copied from components/transaction/PropertyHero.tsx so
// the agreed price renders identically (£475,000, no decimals).
function formatPrice(pence: number | null): string | null {
  if (pence === null || pence === undefined) return null;
  return "£" + (pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fmtShortDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// File-size formatter — copy of components/transaction/DocumentsSection.tsx's
// fmtSize so the drawer renders document weights identically to the file
// detail's documents pane.
function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Status pill ─────────────────────────────────────────────────────

type PillTone = "complete" | "available" | "locked" | "not_required";

const PILL_COLOURS: Record<PillTone, { bg: string; fg: string; border: string }> = {
  complete:     { bg: "rgba(16,185,129,0.10)", fg: "var(--agent-success)", border: "rgba(16,185,129,0.30)" },
  available:    { bg: "rgba(59,130,246,0.10)", fg: "var(--agent-info)", border: "rgba(59,130,246,0.30)" },
  locked:       { bg: "rgba(100,116,139,0.10)", fg: "var(--agent-text-secondary)", border: "rgba(100,116,139,0.25)" },
  not_required: { bg: "rgba(100,116,139,0.06)", fg: "var(--agent-text-muted)", border: "rgba(100,116,139,0.20)" },
};

const PILL_LABELS: Record<PillTone, string> = {
  complete:     "Complete",
  available:    "Available",
  locked:       "Locked",
  not_required: "Not required",
};

function toneFromState(state: string): PillTone {
  if (state === "complete")     return "complete";
  if (state === "not_required") return "not_required";
  if (state === "available")    return "available";
  return "locked";
}

function StatusPill({ state }: { state: string }) {
  const tone = toneFromState(state);
  const c = PILL_COLOURS[tone];
  return (
    <span
      className="inline-flex items-center"
      style={{
        fontSize: 10, fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: c.bg, color: c.fg,
        border: `0.5px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {PILL_LABELS[tone]}
    </span>
  );
}

// ─── Step row (mirrors components/milestones/MilestoneRow row anatomy) ──

function StepRow({ row, dimmed = false }: { row: { code: string; name: string; state: string; completedAt: string | null; completedByName?: string | null }; dimmed?: boolean }) {
  const isDone     = row.state === "complete";
  const isNR       = row.state === "not_required";
  const isLocked   = row.state === "locked";
  const dotClass   = isDone ? "ms-dot ms-dot-done" : isNR ? "ms-dot ms-dot-nr" : isLocked ? "ms-dot ms-dot-locked" : "ms-dot ms-dot-avail";
  const nameColour = (isDone || isLocked || dimmed) ? "var(--agent-text-muted)" : "var(--agent-text-primary)";
  const nameWeight = isLocked ? 400 : 600;

  return (
    <div
      className="flex gap-3 px-4 border-b last:border-0"
      style={{ paddingTop: 8, paddingBottom: 8, borderColor: "var(--agent-border-default)", alignItems: "center" }}
    >
      <div className={`flex-shrink-0 ${dotClass}`} style={{ marginTop: 0 }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 12, fontWeight: nameWeight, color: nameColour, textDecoration: isNR ? "line-through" : "none" }}>
          {row.name}
        </p>
        {row.completedAt && (
          <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 2 }}>
            Confirmed {fmtDate(row.completedAt)}{row.completedByName ? ` by ${row.completedByName}` : ""}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <StatusPill state={row.state} />
      </div>
    </div>
  );
}

// ─── Section header (eyebrow style — matches file-detail dividers) ──

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: "12px 16px 6px 16px" }}>
      <p style={{
        margin: 0,
        fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--agent-text-muted)",
      }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="px-4 py-3" style={{ fontSize: 12, fontStyle: "italic", color: "var(--agent-text-muted)" }}>
      {text}
    </p>
  );
}

// ─── Drawer ─────────────────────────────────────────────────────────

export function ArchivedRoundDrawer({ open, transactionId, archivedRounds, onClose }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [data, setData] = useState<ArchivedRoundPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to the most recent archived round.
  useEffect(() => {
    if (open && !selectedRoundId && archivedRounds.length > 0) {
      setSelectedRoundId(archivedRounds[0].id);
    }
  }, [open, archivedRounds, selectedRoundId]);

  // Reset state when the drawer closes.
  useEffect(() => {
    if (!open) {
      setSelectedRoundId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedRoundId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/transactions/${transactionId}/rounds/${selectedRoundId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load this sale."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, selectedRoundId, transactionId]);

  // Canonical-shift: the pre-canonical implementation ran a 200ms slide-out
  // animation before unmounting via setClosing(true) + setTimeout. The Drawer
  // primitive closes instantly on Escape/X/backdrop. Accepted alignment with
  // the canonical drawer chrome (the slide-in animation is preserved by the
  // primitive's agent-drawer-in class).

  const buyer = data?.buyerContacts.find((c) => c.roleType === "purchaser") ?? null;
  // Locked header copy. Use a colon (not the previous em dash) so the
  // voice rule is held.
  const buyerName = buyer?.name ?? "buyer";
  const header = data ? `Sale ${data.round.roundNumber}: ${buyerName}'s record` : "Loading…";

  // Buyer-steps summary line (locked, 27 PMs total).
  const completedPMs = data ? data.pmCompletions.filter((p) => p.state === "complete").length : 0;
  const summaryLine = `${completedPMs} of 27 buyer steps were complete when this sale fell through.`;

  // Snapshot rows (already sorted server-side by orderIndex).
  const snapshotRows = data?.round.vendorMilestoneSnapshot ?? [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      ariaLabel={data ? header : "Previous sale record"}
      size="xl"
      zLayer="escalated"
      closeTone="onDark"
    >
      <div
        data-theme={theme}
        data-night={isNight ? "" : undefined}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Drawer.Header style={SHEET_BAND_STYLE}>
          <SheetBandHeader
            kicker="Previous sale"
            title={header}
            subtitle={data?.round.archivedAt ? `Fell through ${fmtShortDate(data.round.archivedAt)}` : undefined}
          />
        </Drawer.Header>

        {/* Sale-switcher pill group. Only renders when there's more than
            one archived sale; mirrors the channel-selector pattern in
            components/activity/CommsEntry.tsx (coral-tint background on
            the current pill, transparent + muted on the others).
            Newest on the left — matches the most-recent-first sort the
            chip uses to choose the default. Overflows-x scroll on the
            rare 3+ fall-through case. */}
        {archivedRounds.length > 1 && data && (
          <div
            role="group"
            aria-label="Switch between previous sales"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderBottom: "0.5px solid var(--agent-border-default)",
              overflowX: "auto",
              flexShrink: 0,
            }}
          >
            {archivedRounds.map((r) => {
              const isCurrent = r.id === selectedRoundId;
              return (
                <button
                  key={r.id}
                  type="button"
                  className="agent-sale-pill"
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`Show Sale ${r.roundNumber}`}
                  onClick={() => { if (!isCurrent) setSelectedRoundId(r.id); }}
                >
                  Sale {r.roundNumber}
                </button>
              );
            })}
          </div>
        )}

        {/* Body — content uses its own section padding so we override the
            primitive's default 20px 24px with 0. */}
        <Drawer.Body style={{ padding: 0 }}>
          {loading && (
            <div className="px-5 py-6">
              <p className="text-xs" style={{ color: "var(--agent-text-muted)" }}>Loading…</p>
            </div>
          )}
          {error && !loading && (
            <div className="px-5 py-6">
              <p className="text-xs" style={{ color: "var(--agent-danger, #C73E3E)" }}>
                Could not load this sale: {error}
              </p>
            </div>
          )}
          {data && !loading && (
            <>
              {/* Buyer block — initials chip + name prominent */}
              <StaggerSection delayMs={0}>
                <div style={{ padding: "16px 16px 12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  {buyer ? (
                    <>
                      <ContactAvatar contact={{ name: buyer.name, roleType: buyer.roleType }} size={40} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                          {buyer.name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {buyer.email && <span>{buyer.email}</span>}
                          {buyer.phone && <span>{buyer.phone}</span>}
                          {!buyer.email && !buyer.phone && <span style={{ fontStyle: "italic" }}>No contact details on file</span>}
                        </p>
                      </div>
                    </>
                  ) : (
                    <Empty text="Not recorded for this sale." />
                  )}
                </div>
              </StaggerSection>

              {/* Agreed price — prominent */}
              <StaggerSection delayMs={40}>
                <div style={{ padding: "0 16px 12px 16px" }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
                    Agreed price
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 600, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    {formatPrice(data.round.purchasePrice) ?? <span style={{ fontSize: 12, fontWeight: 500, fontStyle: "italic", color: "var(--agent-text-muted)" }}>Not recorded for this sale.</span>}
                  </p>
                </div>
              </StaggerSection>

              {/* Buyer's solicitor */}
              <StaggerSection delayMs={80}>
                <SectionHeader title="Buyer's solicitor" />
                {data.round.purchaserSolicitorFirm || data.round.purchaserSolicitorContact ? (
                  <div style={{ padding: "4px 16px 14px 16px" }}>
                    {data.round.purchaserSolicitorFirm && (
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                        {data.round.purchaserSolicitorFirm.name}
                      </p>
                    )}
                    {data.round.purchaserSolicitorContact && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span>{data.round.purchaserSolicitorContact.name}</span>
                        {data.round.purchaserSolicitorContact.email && <span>{data.round.purchaserSolicitorContact.email}</span>}
                        {data.round.purchaserSolicitorContact.phone && <span>{data.round.purchaserSolicitorContact.phone}</span>}
                      </p>
                    )}
                  </div>
                ) : (
                  <Empty text="Not recorded for this sale." />
                )}
              </StaggerSection>

              {/* Buyer's broker */}
              <StaggerSection delayMs={120}>
                <SectionHeader title="Buyer's broker" />
                {data.round.brokerFirm || data.round.brokerContact ? (
                  <div style={{ padding: "4px 16px 14px 16px" }}>
                    {data.round.brokerFirm && (
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                        {data.round.brokerFirm.name}
                      </p>
                    )}
                    {data.round.brokerContact && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)" }}>
                        {data.round.brokerContact.name}
                      </p>
                    )}
                  </div>
                ) : (
                  <Empty text="Not recorded for this sale." />
                )}
              </StaggerSection>

              {/* Steps progress on this round */}
              <StaggerSection delayMs={160}>
                <SectionHeader title="Steps progress on this sale" subtitle={summaryLine} />
                {data.pmCompletions.length === 0 ? (
                  <Empty text="Nothing recorded for this sale." />
                ) : (
                  <div>
                    {[...data.pmCompletions]
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((p) => (
                        <StepRow
                          key={p.code}
                          row={{ code: p.code, name: p.name, state: p.state, completedAt: p.completedAt, completedByName: p.completedByName }}
                        />
                      ))}
                  </div>
                )}
              </StaggerSection>

              {/* Seller-side progress at the moment this round closed */}
              <StaggerSection delayMs={200}>
                <SectionHeader title="Seller-side progress at the moment this sale fell through" />
                {snapshotRows.length === 0 ? (
                  <Empty text="No snapshot recorded for this sale." />
                ) : (
                  <div>
                    {snapshotRows.map((v) => (
                      <StepRow
                        key={v.code}
                        row={{ code: v.code, name: v.name, state: v.state, completedAt: v.completedAt }}
                        dimmed
                      />
                    ))}
                  </div>
                )}
              </StaggerSection>

              {/* Communications during this round */}
              <StaggerSection delayMs={240}>
                <SectionHeader title="Communications during this sale" />
                {data.comms.length === 0 ? (
                  <Empty text="Nothing recorded for this sale." />
                ) : (
                  <div style={{ padding: "4px 16px 14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.comms.map((c) => {
                      const badge = getCommBadge({ type: c.type, method: c.method, isAutomated: c.isAutomated, senderLabel: c.senderLabel });
                      return (
                        <div
                          key={c.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "var(--agent-surface-glass)",
                            border: "0.5px solid var(--agent-border-default)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 10, fontWeight: 600,
                              padding: "2px 8px", borderRadius: 999,
                              background: badge.bg, color: badge.color,
                            }}>
                              <span aria-hidden="true">{badge.icon}</span>
                              {badge.label}
                            </span>
                            <AuthorPill name={c.senderLabel ?? c.createdByName} />
                            <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>
                              {fmtDate(c.createdAt)}
                            </span>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--agent-text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                            {c.content.length > 600 ? `${c.content.slice(0, 600)}…` : c.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </StaggerSection>

              {/* Why this round closed */}
              <StaggerSection delayMs={280}>
                <SectionHeader title="Why this sale fell through" />
                {data.round.fallThroughReason || data.round.archivedAt ? (
                  <div style={{ padding: "4px 16px 14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {data.round.fallThroughReason && (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-primary)" }}>
                        {data.round.fallThroughReason}
                      </p>
                    )}
                    {data.round.archivedAt && (
                      <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
                        Fell through on {fmtDate(data.round.archivedAt)}
                      </p>
                    )}
                  </div>
                ) : (
                  <Empty text="No reason recorded." />
                )}
              </StaggerSection>

              {/* Chain at withdrawal — closed-loop chain arc (2026-06-05).
                * Only rendered when a chainSnapshot was captured (file was
                * in a chain at the moment of withdraw). Mirrors the glass-
                * card / SectionHeader / agent-acc accordion pattern used
                * by the rest of the drawer. */}
              {data.round.chainSnapshot && (
                <StaggerSection delayMs={300}>
                  <ChainAtWithdrawalSection
                    snapshot={data.round.chainSnapshot}
                    notifications={data.round.chainNotifications}
                  />
                </StaggerSection>
              )}

              {/* Documents during this sale */}
              <StaggerSection delayMs={320}>
                <SectionHeader title="Documents during this sale" />
                <p className="px-4" style={{ margin: 0, marginBottom: 8, fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                  {/* Phase-2 PR 2 voice-pass: the drawer's documents pane now
                      combines file-level shared docs (MoS, agent uploads)
                      with THIS round's purchaser uploads only — so opening
                      Sale 1's drawer no longer surfaces Sale 2's docs. The
                      previous copy ("not tied to a specific sale...") was
                      written when this fetcher returned every doc on the
                      file; it has been replaced for this PR. FLAGGED FOR
                      VOICE-PASS — Ellis may revise wording. */}
                  Documents shared across all sales (Memorandum of Sale, agent uploads) plus what {buyerName} uploaded during this sale.
                </p>
                {data.fileDocuments.length === 0 ? (
                  <Empty text="No documents on this file." />
                ) : (
                  <ul className="px-4" style={{ margin: 0, marginBottom: 16, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.fileDocuments.map((d) => (
                      <li
                        key={d.id}
                        className="agent-hover-row"
                        style={{
                          fontSize: 12, color: "var(--agent-text-secondary)",
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "var(--agent-surface-glass)",
                          border: "0.5px solid var(--agent-border-default)",
                          display: "flex", alignItems: "center", gap: 10,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d.filename}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>
                            {fmtSize(d.fileSize)} · {fmtShortDate(d.createdAt)}
                            {d.source && <> · {d.source}</>}
                          </span>
                        </div>
                        {d.signedUrl ? (
                          <a
                            href={d.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="agent-link-primary"
                            style={{ flexShrink: 0, fontSize: 11, fontWeight: 600 }}
                          >
                            Download
                          </a>
                        ) : (
                          <span style={{ flexShrink: 0, fontSize: 11, color: "var(--agent-text-muted)", opacity: 0.6 }}>
                            Unavailable
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </StaggerSection>
            </>
          )}
        </Drawer.Body>
      </div>
    </Drawer>
  );
}

// ─── Staggered section reveal ───────────────────────────────────────
// Each section's children apply .agent-reveal-in 150ms after its own
// configured delay. The class itself has a prefers-reduced-motion
// override in agent-system.css (animations become instant), so no
// per-component useReducedMotion is needed.
function StaggerSection({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.animationDelay = `${delayMs}ms`;
  }, [delayMs]);
  return (
    <div ref={ref} className="agent-reveal-in">
      {children}
    </div>
  );
}

// ── Chain at withdrawal (closed-loop chain arc 2026-06-05) ────────────────
//
// Renders the chain shape captured at withdraw time + the cascade
// notifications that fired from this file's link. Three sub-blocks:
//   1. Header card: reason, chainId, our position, capturedAt
//   2. Neighbours table: every claimed link at the moment of withdraw
//      (position, agency, agent, claimed address, withdrawalStatus)
//   3. Notifications outcomes: per-row recipient + type + response if any
//   4. Detached segment banner (if a split fired)

const WITHDRAWAL_REASON_LABELS: Record<string, string> = {
  BUYER_WITHDREW:       "Our buyer pulled out",
  SELLER_WITHDREW:      "Our seller pulled out",
  CHAIN_COLLAPSE_ABOVE: "Chain collapsed above us",
  OTHER:                "Other / mutual",
};

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  LOST_BUYER:     "Lost their buyer",
  LOST_PURCHASE:  "Lost their purchase",
  ASKED_TO_WAIT:  "Asked to wait",
  BUYER_FOUND:    "Buyer found",
  CHAIN_DETACHED: "Chain detached",
};

const RESPONSE_LABELS: Record<string, string> = {
  WITHDRAWN:   "Withdrew",
  REMARKETING: "Remarketing",
  WAITING:     "Waiting",
  BREAK_CHAIN: "Broke the chain",
};

function ChainAtWithdrawalSection({
  snapshot,
  notifications,
}: {
  snapshot: ChainSnapshot;
  notifications: ArchivedRoundPayload["round"]["chainNotifications"];
}) {
  const { isNight } = usePortalTheme();
  // Order neighbours by position descending so the chain renders top-down
  // (highest position = top of chain). Highlight ourPosition.
  const sorted = [...snapshot.neighbours].sort((a, b) => b.position - a.position);

  // Index notifications by recipientLinkId so we can render them inline
  // with each neighbour row instead of a separate table.
  const notifByLink = new Map<string, typeof notifications>();
  for (const n of notifications) {
    const list = notifByLink.get(n.recipientLinkId) ?? [];
    list.push(n);
    notifByLink.set(n.recipientLinkId, list);
  }

  return (
    <>
      <SectionHeader title="Chain at withdrawal" />
      <div style={{ padding: "4px 16px 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Header card — reason + capture time */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--agent-surface-glass)",
            border: "0.5px solid var(--agent-border-default)",
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              {snapshot.withdrawalReason ? WITHDRAWAL_REASON_LABELS[snapshot.withdrawalReason] ?? snapshot.withdrawalReason : "Reason unknown"}
            </div>
            <div style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
              Recorded {fmtDate(snapshot.capturedAt)} · position {snapshot.ourPosition}
            </div>
          </div>
          {snapshot.detachedSegment && (
            <div
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 8,
                background: "rgba(245,158,11,0.10)",
                border: "0.5px solid rgba(245,158,11,0.25)",
                fontSize: 11,
                color: "var(--agent-warning)",
              }}
            >
              <strong>Chain split.</strong> The sales below were separated on {fmtDate(snapshot.detachedSegment.splitAt)} and now stand as their own chain.
            </div>
          )}
        </div>

        {/* Neighbours table — one card per claimed link, ordered top-down */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((n) => {
            const isUs = n.position === snapshot.ourPosition;
            const claimed = Boolean(n.claimedByUserId);
            const label = n.claimedAddress ?? n.stubAddress ?? "(unknown address)";
            const agencyOrStub = n.claimedAgencyName ?? n.stubAgencyName ?? null;
            const agentOrStub = n.claimedAgentName ?? n.stubAgentName ?? null;
            const linkNotifs = notifByLink.get(n.linkId) ?? [];
            return (
              <div
                key={n.linkId}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: isUs ? (isNight ? "rgba(255,122,94,0.12)" : "rgba(229,80,46,0.06)") : "var(--agent-surface-glass)",
                  border: isUs ? "0.5px solid rgba(229,80,46,0.25)" : "0.5px solid var(--agent-border-default)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)" }}>#{n.position}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{label}</span>
                    {isUs && <span style={{ fontSize: 10, fontWeight: 600, color: "rgb(229,80,46)" }}>(this file)</span>}
                  </div>
                  {n.withdrawalStatus && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(239,68,68,0.12)",
                        color: "rgb(185,28,28)",
                      }}
                    >
                      {RESPONSE_LABELS[n.withdrawalStatus] ?? n.withdrawalStatus}
                    </span>
                  )}
                </div>
                {(agencyOrStub || agentOrStub) && (
                  <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 4 }}>
                    {agencyOrStub}{agencyOrStub && agentOrStub ? " · " : ""}{agentOrStub}{!claimed && " (unclaimed)"}
                  </div>
                )}
                {linkNotifs.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    {linkNotifs.map((notif) => (
                      <div
                        key={notif.id}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          background: isNight ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
                          fontSize: 11,
                          color: "var(--agent-text-secondary)",
                          display: "flex",
                          gap: 8,
                          alignItems: "baseline",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>
                          {NOTIFICATION_TYPE_LABELS[notif.type] ?? notif.type}
                        </span>
                        <span>→ {notif.recipientEmail}</span>
                        <span style={{ marginLeft: "auto" }}>
                          {notif.response ? (
                            <span style={{ color: "rgb(185,28,28)", fontWeight: 600 }}>
                              {RESPONSE_LABELS[notif.response] ?? notif.response} {notif.respondedAt && `· ${fmtDate(notif.respondedAt)}`}
                            </span>
                          ) : notif.emailSentAt ? (
                            <span style={{ color: "var(--agent-text-muted)" }}>Sent {fmtDate(notif.emailSentAt)} · awaiting response</span>
                          ) : (
                            <span style={{ color: "var(--agent-text-muted)" }}>Queued</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
