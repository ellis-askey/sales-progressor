"use client";

// Phase 1 commit 8 — archived-round drawer (read-only).
//
// 2026-09-10 rebuild: the read-only dump became a TABBED layout to the approved
// mock. A coral header (buyer name + fell-through date), a three-up stats strip
// (agreed price / buyer steps / sale duration), a polished coral-gradient
// "why this sale fell through" callout, then the canonical .agent-tab bar
// (components/transaction/PropertyFileTabs + lib/agent/use-tab-indicator — same
// sliding underline + hover-preview underline) across Overview / Progress /
// Comms / Chain / Documents. Content swaps with a back-out overshoot animation.
//
// REUSED (audited, not invented): the Drawer primitive chrome; SheetBandHeader;
// ContactAvatar (buyer person art, purchaser green); the .agent-tab system +
// useTabIndicator; StepRow / StatusPill / SectionHeader step anatomy; getCommBadge
// / AuthorPill for comms; formatPrice (PropertyHero) + fmtSize (DocumentsSection).
//
// LOCKED COPY (terminology sweep, 2026-06-04 — "round" banned as a user-facing
// noun; "closed"/"withdrew" become "fell through"): SUMMARY "{n} of 27 buyer
// steps were complete when this sale fell through."; header subline "Fell
// through {date}"; section labels use "sale" / "fell through".

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WarningCircle, CurrencyGbp } from "@phosphor-icons/react";
import { formatTimestamp } from "@/lib/utils";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Drawer } from "@/components/ui/Drawer";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { ContactAvatar, ActorAvatar, type ActorRole } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";
import { getCommBadge } from "@/lib/agent/comms-display";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { getArchivedDocumentUrl } from "@/app/actions/archived-round";

type Props = {
  open: boolean;
  transactionId: string;
  archivedRounds: Array<{ id: string; roundNumber: number }>;
  onClose: () => void;
  // Inspection harness (/dev/sheets): a payload per round id. When provided the
  // drawer renders from it and skips the network fetch, so its full state is
  // visible without a backend. Unused in the app.
  seedByRoundId?: Record<string, ArchivedRoundPayload>;
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
    // Resolved server-side from the claimed transaction's current photo; null
    // when unclaimed or photo-less (drawer shows the chain fallback image).
    photoUrl?: string | null;
  }>;
  detachedSegment: { chainId: string; splitAt: string; notifiedRecipientLinkId: string | null } | null;
};

export type ArchivedRoundPayload = {
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

// Overshoot easing for the tab underline + content panel — travels a touch past
// the target then settles (the "goes a bit too far" feel Ellis asked for).
const OVERSHOOT = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ─── Drawer ─────────────────────────────────────────────────────────

export function ArchivedRoundDrawer({ open, transactionId, archivedRounds, onClose, seedByRoundId }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [data, setData] = useState<ArchivedRoundPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

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
      setActiveTab("overview");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedRoundId) return;
    // Seeded (/dev/sheets): render from the injected payload, skip the network.
    if (seedByRoundId) {
      const seeded = seedByRoundId[selectedRoundId] ?? null;
      setData(seeded);
      setError(seeded ? null : "No seeded data for this sale.");
      setLoading(false);
      return;
    }
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
  }, [open, selectedRoundId, transactionId, seedByRoundId]);

  // All purchasers on this sale (joint buyers show every name, not just the
  // first). `buyer` is kept for the avatar + aria label.
  const buyers = data?.buyerContacts.filter((c) => c.roleType === "purchaser") ?? [];
  const buyer = buyers[0] ?? null;
  const buyerName = buyers.length ? buyers.map((b) => b.name).join(" & ") : "Buyer";
  const header = data ? buyerName : "Loading…";

  const completedPMs = data ? data.pmCompletions.filter((p) => p.state === "complete").length : 0;
  // Denominator is the number of buyer steps actually recorded for this sale,
  // not a hard-coded 27 — stays correct if the milestone set ever changes.
  const totalPMs = data?.pmCompletions.length ?? 0;
  const stepsSummary = totalPMs
    ? `${completedPMs} of ${totalPMs} buyer steps were complete when this sale fell through.`
    : "No buyer steps were recorded for this sale.";
  const snapshotRows = data?.round.vendorMilestoneSnapshot ?? [];

  // Sale duration in whole days (agreed → fell through).
  const durationDays =
    data && data.round.createdAt && data.round.archivedAt
      ? Math.max(1, Math.round((new Date(data.round.archivedAt).getTime() - new Date(data.round.createdAt).getTime()) / 86_400_000))
      : null;

  // Tabs — canonical .agent-tab bar + sliding underline (hover-preview built in).
  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "progress", label: "Progress" },
    { key: "comms", label: "Comms" },
    { key: "chain", label: "Chain" },
    { key: "documents", label: "Documents" },
  ];
  const activeIdx = Math.max(0, TABS.findIndex((t) => t.key === activeTab));
  // Pass `!!data` so the underline re-measures once the tabs mount (the content
  // renders after the async/seed load), giving Overview its underline on open.
  const { btnRefs, ind } = useTabIndicator(activeIdx, !!data);
  const rm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Direction the panel flies in from, based on travel between tabs.
  const prevIdxRef = useRef(0);
  const dir = activeIdx >= prevIdxRef.current ? 1 : -1;
  useEffect(() => { prevIdxRef.current = activeIdx; }, [activeIdx]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      ariaLabel={data ? `Previous sale: ${buyerName}` : "Previous sale record"}
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
            subtitle={data?.round.archivedAt ? `Fell through · ${fmtShortDate(data.round.archivedAt)}` : undefined}
          />
        </Drawer.Header>

        {loading && (
          <div style={{ flexShrink: 0, padding: "22px 24px" }}>
            <p style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Loading…</p>
          </div>
        )}
        {error && !loading && (
          <div style={{ flexShrink: 0, padding: "22px 24px" }}>
            <p style={{ fontSize: 12, color: "var(--agent-danger, #C73E3E)" }}>Could not load this sale: {error}</p>
          </div>
        )}
        {(loading || (error && !loading)) && <div style={{ flex: 1 }} />}

        {data && !loading && (
          <>
            {/* Sale switcher — only when there's more than one previous sale.
                Newest on the left (matches the default-selection sort). */}
            {archivedRounds.length > 1 && (
              <div
                role="group"
                aria-label="Switch between previous sales"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderBottom: "0.5px solid var(--agent-border-default)", overflowX: "auto", flexShrink: 0 }}
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

            {/* Stats strip */}
            <div style={{ flexShrink: 0, display: "flex", padding: "18px 24px" }}>
              <StatCell value={formatPrice(data.round.purchasePrice) ?? "Not recorded"} label="Agreed price" />
              <StatCell value={totalPMs ? `${completedPMs} of ${totalPMs}` : "—"} label="Buyer steps completed" divider />
              <StatCell value={durationDays ? `${durationDays} days` : "—"} label="Sale duration" divider />
            </div>

            {/* Why this sale fell through — polished coral-gradient callout */}
            {data.round.fallThroughReason && (
              <div style={{ flexShrink: 0, padding: "0 20px 14px" }}>
                <div className="arch-why">
                  <span className="arch-why-icon"><WarningCircle size={26} weight="fill" /></span>
                  <div style={{ minWidth: 0 }}>
                    <p className="arch-why-label">Why this sale fell through</p>
                    <p className="arch-why-text">{data.round.fallThroughReason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div style={{ flexShrink: 0, padding: "0 20px" }}>
              <div className="agent-tab-bar" style={{ borderBottom: "1px solid var(--agent-border-default)" }}>
                {ind && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute", bottom: 0, left: ind.left, width: ind.width, height: 2,
                      background: "var(--agent-coral)", borderRadius: "1px 1px 0 0",
                      transition: rm ? "none" : `left 240ms ${OVERSHOOT}, width 240ms ${OVERSHOOT}`,
                      pointerEvents: "none",
                    }}
                  />
                )}
                {TABS.map((t, i) => (
                  <button
                    key={t.key}
                    ref={(el) => { btnRefs.current[i] = el; }}
                    className="agent-tab flex-shrink-0"
                    aria-selected={t.key === activeTab}
                    onClick={() => setActiveTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content — remounts per tab so the overshoot animation replays */}
            <Drawer.Body style={{ padding: 0 }}>
              <div
                key={activeTab}
                className={rm ? undefined : "arch-tab-panel"}
                style={rm ? undefined : ({ "--arch-dir": dir } as React.CSSProperties)}
              >
                {activeTab === "overview" && (
                  <div style={{ padding: "16px 20px" }}>
                    <p className="arch-panel-title">People involved</p>
                    <div>
                      <PersonRow
                        icon={<ContactAvatar contact={{ name: buyer?.name ?? "Buyer", roleType: "purchaser" }} size={40} />}
                        label={buyers.length > 1 ? "Buyers" : "Buyer"}
                        lines={
                          buyers.length === 0
                            ? ["Not recorded for this sale."]
                            : buyers.length === 1
                              ? [[buyer!.email, buyer!.phone].filter(Boolean).join("   ·   ") || "No contact details on file"]
                              : buyers.map((b) => {
                                  const contact = [b.email, b.phone].filter(Boolean).join(" · ");
                                  return contact ? `${b.name} · ${contact}` : b.name;
                                })
                        }
                      />
                      <PersonRow
                        icon={<ContactAvatar contact={{ name: data.round.purchaserSolicitorContact?.name ?? data.round.purchaserSolicitorFirm?.name ?? "Solicitor", roleType: "solicitor" }} size={40} />}
                        label="Buyer's solicitor"
                        lines={solicitorLines(data.round)}
                      />
                      <PersonRow
                        icon={<IconChip bg="#F1EFE8" color="#5A5750"><CurrencyGbp size={20} weight="regular" /></IconChip>}
                        label="Mortgage broker"
                        lines={brokerLines(data.round)}
                        last
                      />
                    </div>
                  </div>
                )}

                {activeTab === "progress" && (
                  <>
                    <SectionHeader title="Steps progress on this sale" subtitle={stepsSummary} />
                    {data.pmCompletions.length === 0 ? (
                      <Empty text="Nothing recorded for this sale." />
                    ) : (
                      <div>
                        {[...data.pmCompletions]
                          .sort((a, b) => a.orderIndex - b.orderIndex)
                          .map((p) => (
                            <StepRow key={p.code} row={{ code: p.code, name: p.name, state: p.state, completedAt: p.completedAt, completedByName: p.completedByName }} />
                          ))}
                      </div>
                    )}
                    <SectionHeader title="Seller-side progress at the moment this sale fell through" />
                    {snapshotRows.length === 0 ? (
                      <Empty text="No snapshot recorded for this sale." />
                    ) : (
                      <div>
                        {snapshotRows.map((v) => (
                          <StepRow key={v.code} row={{ code: v.code, name: v.name, state: v.state, completedAt: v.completedAt }} dimmed />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "comms" && (
                  <>
                    <SectionHeader title="Communications during this sale" />
                    {data.comms.length === 0 ? (
                      <Empty text="Nothing recorded for this sale." />
                    ) : (
                      <CommTimeline comms={data.comms} />
                    )}
                  </>
                )}

                {activeTab === "chain" && (
                  data.round.chainSnapshot ? (
                    <ChainAtWithdrawalSection snapshot={data.round.chainSnapshot} notifications={data.round.chainNotifications} />
                  ) : (
                    <Empty text="This sale wasn't part of a chain." />
                  )
                )}

                {activeTab === "documents" && (
                  <div style={{ padding: "12px 20px 18px" }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
                      Documents during this sale
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                      Documents shared across all sales (Memorandum of Sale, agent uploads) plus what {buyerName} uploaded during this sale.
                    </p>
                    {data.fileDocuments.length === 0 ? (
                      <Empty text="No documents on this file." />
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                        {data.fileDocuments.map((d) => (
                          <li
                            key={d.id}
                            className="agent-hover-row"
                            style={{ fontSize: 12, color: "var(--agent-text-secondary)", padding: "8px 12px", borderRadius: 8, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", gap: 10 }}
                          >
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {d.filename}
                              </span>
                              <span style={{ fontSize: 10, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>
                                {fmtSize(d.fileSize)} · {fmtShortDate(d.createdAt)}{d.source && <> · {d.source}</>}
                              </span>
                            </div>
                            {d.signedUrl ? (
                              <DocDownloadButton transactionId={transactionId} docId={d.id} fallbackUrl={d.signedUrl} />
                            ) : (
                              <span style={{ flexShrink: 0, fontSize: 11, color: "var(--agent-text-muted)", opacity: 0.6 }}>
                                Unavailable
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </Drawer.Body>
          </>
        )}

        <Drawer.Footer>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8 }}>
            <Link href={`/agent/transactions/${transactionId}`} className="agent-link agent-link-muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
              View file <LinkArrow />
            </Link>
            <button type="button" onClick={onClose} className="arch-close-btn">Close</button>
          </div>
        </Drawer.Footer>
      </div>

      <style>{`
        /* Ghost outline (Ellis's pick, 2026-09-10): no fill — a confident coral
           border + coral icon. Lightest-ink, most restrained. */
        .arch-why {
          display: flex; gap: 13px; align-items: flex-start;
          padding: 14px 16px; border-radius: 14px;
          background: transparent;
          border: 1.5px solid rgba(var(--agent-coral-rgb), 0.5);
        }
        .arch-why-icon { flex-shrink: 0; color: var(--agent-coral-deep); margin-top: 1px; line-height: 0; }
        .arch-why-label { margin: 1px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--agent-coral-deep); }
        .arch-why-text { margin: 5px 0 0; font-size: 14px; line-height: 1.5; color: var(--agent-text-secondary); }
        .arch-panel-title { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--agent-text-primary); }
        .arch-close-btn {
          padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
          border: 0.5px solid var(--agent-border-strong); background: var(--agent-surface-elevated);
          color: var(--agent-text-primary); cursor: pointer; transition: background 150ms ease, border-color 150ms ease;
        }
        .arch-close-btn:hover { background: var(--agent-surface-glass); border-color: var(--agent-text-muted); }
        .arch-tab-panel { animation: arch-panel-in 300ms ${OVERSHOOT} both; }
        @keyframes arch-panel-in {
          from { opacity: 0; transform: translateX(calc(var(--arch-dir, 1) * 22px)); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) { .arch-tab-panel { animation: none; } }
      `}</style>
    </Drawer>
  );
}

// ─── People-involved building blocks ────────────────────────────────

// A soft-tinted circle housing a glyph, sized to sit alongside the buyer's
// ContactAvatar. Used for the solicitor (briefcase) + broker (money) icons.
function IconChip({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{ width: 40, height: 40, borderRadius: "50%", background: bg, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {children}
    </span>
  );
}

function PersonRow({ icon, label, lines, last }: { icon: React.ReactNode; label: string; lines: React.ReactNode[]; last?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 0", borderBottom: last ? "none" : "1px solid var(--agent-border-default)" }}>
      <div style={{ width: 44, flexShrink: 0, display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>{label}</p>
        {lines.map((ln, i) => (
          <p key={i} style={{ margin: "3px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", wordBreak: "break-word" }}>{ln}</p>
        ))}
      </div>
    </div>
  );
}

function StatCell({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, paddingLeft: divider ? 20 : 0, borderLeft: divider ? "1px solid var(--agent-border-default)" : "none" }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>{label}</p>
    </div>
  );
}

function solicitorLines(round: ArchivedRoundPayload["round"]): React.ReactNode[] {
  const firm = round.purchaserSolicitorFirm?.name;
  const c = round.purchaserSolicitorContact;
  const contact = c ? [c.name, c.email, c.phone].filter(Boolean).join("   ·   ") : "";
  const lines = [firm, contact].filter(Boolean) as string[];
  return lines.length ? lines : ["Not recorded for this sale."];
}

function brokerLines(round: ArchivedRoundPayload["round"]): React.ReactNode[] {
  const firm = round.brokerFirm?.name;
  const c = round.brokerContact;
  const contact = c ? [c.name, c.email, c.phone].filter(Boolean).join("   ·   ") : "";
  const lines = [firm, contact].filter(Boolean) as string[];
  return lines.length ? lines : ["Not recorded for this sale."];
}

// Long text with an inline Show more / Show less toggle, so a lengthy note or
// email in the read-only record can be read in full without bloating the list.
function ReadMore({ text, limit = 320 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > limit;
  const shown = open || !long ? text : `${text.slice(0, limit).trimEnd()}…`;
  return (
    <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-primary)", lineHeight: 1.45, whiteSpace: "pre-line" }}>
      {shown}
      {long && (
        <>
          {" "}
          <button type="button" onClick={() => setOpen((o) => !o)} className="agent-link" style={{ fontSize: 11, fontWeight: 600 }}>
            {open ? "Show less" : "Show more"}
          </button>
        </>
      )}
    </p>
  );
}

// Download that mints a fresh signed URL on click (the one from load can expire
// while the drawer sits open). Falls back to the load-time URL if the refresh
// fails; surfaces a toast only on a genuine failure.
function DocDownloadButton({ transactionId, docId, fallbackUrl }: { transactionId: string; docId: string; fallbackUrl: string | null }) {
  const { toast } = useAgentToast();
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const res = await getArchivedDocumentUrl(transactionId, docId);
      if (res.ok) { window.open(res.url, "_blank", "noopener,noreferrer"); return; }
      if (fallbackUrl && fallbackUrl !== "#") { window.open(fallbackUrl, "_blank", "noopener,noreferrer"); return; }
      if (fallbackUrl === "#") return; // inspection harness seed — no real file
      toast.error(res.error);
    } catch {
      if (fallbackUrl && fallbackUrl !== "#") window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      else if (fallbackUrl !== "#") toast.error("Couldn't open this document. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="agent-link-primary"
      style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, background: "none", border: "none", cursor: busy ? "default" : "pointer" }}
    >
      {busy ? "Opening…" : "Download"}
    </button>
  );
}

// ─── Comms timeline (read-only mirror of the file's activity log) ────────────
// Same visual language as components/activity/ActivityTimeline's comm rows —
// vertical spine + coloured dot + surface card with the actor at the top, the
// channel badge Pill, and the content — but frozen: no filters, edit or delete.

type ArchComm = ArchivedRoundPayload["comms"][number];

function commDotColor(c: ArchComm): string {
  if (c.isAutomated) return "#6366f1";
  if (c.type === "internal_note") return "#d97706";
  if (c.type === "outbound") return "var(--agent-coral)";
  if (c.type === "inbound") return "#10b981";
  return "rgba(100,116,139,0.5)";
}

function CommTimeline({ comms }: { comms: ArchComm[] }) {
  return (
    <div style={{ position: "relative", padding: "6px 16px 18px 18px" }}>
      <div aria-hidden style={{ position: "absolute", top: 12, bottom: 16, left: 21, width: 1, background: "var(--agent-border-default)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {comms.map((c) => {
          const badge = getCommBadge({ type: c.type, method: c.method, isAutomated: c.isAutomated, senderLabel: c.senderLabel });
          const role: ActorRole = c.isAutomated ? "system" : "agent";
          const name = c.senderLabel ?? c.createdByName ?? (c.isAutomated ? "TSP" : "You");
          return (
            <div key={c.id} style={{ position: "relative", display: "flex", gap: 12 }}>
              <div style={{ flexShrink: 0, zIndex: 1, marginTop: 12 }}>
                <span style={{ display: "block", width: 8, height: 8, borderRadius: 999, background: commDotColor(c) }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    {c.isAutomated ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/brand-icon.png" alt="" width={22} height={22} style={{ display: "block", width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
                    ) : (
                      <ActorAvatar name={name} role={role} size={22} />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--agent-text-muted)", flexShrink: 0 }}>{formatTimestamp(new Date(c.createdAt))}</span>
                </div>
                <ReadMore text={c.content} />
                <div style={{ marginTop: 8 }}>
                  <Pill glass tone={badge.tone} size="sm">
                    <span aria-hidden>{badge.icon}</span> {badge.label}
                  </Pill>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
  // Order neighbours by position descending so the chain renders top-down
  // (highest position = top of chain), matching the chain drawer's spine.
  const sorted = [...snapshot.neighbours].sort((a, b) => b.position - a.position);
  const total = snapshot.neighbours.length;

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

        {/* Chain spine — one link card per position, top-down, matching the
            chain drawer's LinkCard look (read-only: no photo upload / edit). */}
        <div>
          {sorted.map((n, i) => {
            const isUs = n.position === snapshot.ourPosition;
            const claimed = Boolean(n.claimedByUserId);
            const address = n.claimedAddress ?? n.stubAddress ?? "(address not captured)";
            const agency = n.claimedAgencyName ?? n.stubAgencyName ?? null;
            const agent = n.claimedAgentName ?? n.stubAgentName ?? null;
            const linkNotifs = notifByLink.get(n.linkId) ?? [];
            const statusTone: "danger" | "warning" | "success" | "muted" | "brand" =
              isUs ? "brand" : n.withdrawalStatus ? (n.withdrawalStatus === "WITHDRAWN" ? "danger" : "warning") : claimed ? "success" : "muted";
            const statusLabel = isUs
              ? "This file"
              : n.withdrawalStatus ? (RESPONSE_LABELS[n.withdrawalStatus] ?? n.withdrawalStatus) : claimed ? "In the chain" : "Unclaimed";
            return (
              <div key={n.linkId}>
                {i > 0 && <div className="chain-connector" aria-hidden />}
                <div className={`chain-card${isUs ? " chain-card-you" : ""}`} style={{ cursor: "default" }}>
                  <div className="chain-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.photoUrl ?? "/chain-empty-photo.png"} alt="" loading="lazy" />
                  </div>
                  <div className="chain-body">
                    <div className="chain-body-top">
                      <div className="chain-cmain">
                        <div className="chain-cpos">
                          Position {n.position} of {total}
                          {isUs && <span className="chain-cpos-tag"> · this file</span>}
                        </div>
                        <p className="chain-caddr">{address}</p>
                        {(agency || agent) && (
                          <p className="chain-cag">
                            {agent}
                            {agent && agency ? " · " : ""}
                            {agency && <b>{agency}</b>}
                            {!claimed && !isUs ? " (unclaimed)" : ""}
                          </p>
                        )}
                      </div>
                      <div className="chain-cright">
                        <Pill tone={statusTone} size="sm" glass={statusTone !== "muted"}>{statusLabel}</Pill>
                      </div>
                    </div>
                    {linkNotifs.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {linkNotifs.map((notif) => (
                          <div
                            key={notif.id}
                            style={{ padding: "6px 10px", borderRadius: 8, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)", fontSize: 11, color: "var(--agent-text-secondary)", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}
                          >
                            <span style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>{NOTIFICATION_TYPE_LABELS[notif.type] ?? notif.type}</span>
                            <span>→ {notif.recipientEmail}</span>
                            <span style={{ marginLeft: "auto" }}>
                              {notif.response ? (
                                <span style={{ color: "var(--agent-danger)", fontWeight: 600 }}>{RESPONSE_LABELS[notif.response] ?? notif.response} {notif.respondedAt && `· ${fmtDate(notif.respondedAt)}`}</span>
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
