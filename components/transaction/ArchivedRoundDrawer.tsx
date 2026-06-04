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
// LOCKED COPY:
//   - HEADER:   "Round {n}: {buyerName}'s record"
//   - SUMMARY:  "{n} of 27 buyer steps were complete when this round closed."
//   - Section labels + empty states stay verbatim from the previous
//     voice pass (Ellis, 2026-06-04). No paraphrasing.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/dist/ssr";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

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
  };
  buyerContacts: Array<{ id: string; name: string; email: string | null; phone: string | null; roleType: string }>;
  pmCompletions: Array<{
    code: string; name: string; orderIndex: number; state: string;
    completedAt: string | null; completedByName: string | null;
    eventDate: string | null; summaryText: string | null; confirmedByPortal: boolean;
  }>;
  comms: Array<{ id: string; type: string; method: string | null; content: string; createdAt: string; createdByName: string | null; visibleToClient: boolean }>;
  fileDocuments: Array<{ id: string; filename: string; mimeType: string | null; source: string | null; createdAt: string }>;
};

// ─── Helpers (verbatim from the audited components) ──────────────────

// getInitials — copied from components/contacts/ContactsSection.tsx so
// the drawer's initials chip behaves identically to the file detail's
// contacts list (handles titles, multi-word names, single names).
const TITLE_RE = /^(dr|mr|mrs|miss|ms|prof|rev|sir|lady|lord|mx)\.?\s+/i;
function getInitials(name: string): string {
  const trimmed = name.trim();
  const titleMatch = trimmed.match(TITLE_RE);
  const withoutTitle = trimmed.replace(TITLE_RE, "").trim();
  const parts = withoutTitle.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1 && titleMatch) return (titleMatch[0].trim()[0] + parts[0][0]).toUpperCase();
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return trimmed[0]?.toUpperCase() ?? "?";
}

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

// ─── Status pill ─────────────────────────────────────────────────────

type PillTone = "complete" | "available" | "locked" | "not_required";

const PILL_COLOURS: Record<PillTone, { bg: string; fg: string; border: string }> = {
  complete:     { bg: "rgba(16,185,129,0.10)", fg: "#047857", border: "rgba(16,185,129,0.30)" },
  available:    { bg: "rgba(59,130,246,0.10)", fg: "#1d4ed8", border: "rgba(59,130,246,0.30)" },
  locked:       { bg: "rgba(100,116,139,0.10)", fg: "#475569", border: "rgba(100,116,139,0.25)" },
  not_required: { bg: "rgba(100,116,139,0.06)", fg: "#64748b", border: "rgba(100,116,139,0.20)" },
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
  const [closing, setClosing] = useState(false);

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
      setClosing(false);
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
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load this round."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, selectedRoundId, transactionId]);

  // Two-step exit: apply agent-drawer-out for 200ms, then unmount.
  function doClose() {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 200);
  }

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") doClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const buyer = data?.buyerContacts.find((c) => c.roleType === "purchaser") ?? null;
  // Locked header copy. Use a colon (not the previous em dash) so the
  // voice rule is held.
  const buyerName = buyer?.name ?? "buyer";
  const header = data ? `Round ${data.round.roundNumber}: ${buyerName}'s record` : "Loading…";

  // Buyer-steps summary line (locked, 27 PMs total).
  const completedPMs = data ? data.pmCompletions.filter((p) => p.state === "complete").length : 0;
  const summaryLine = `${completedPMs} of 27 buyer steps were complete when this round closed.`;

  // Snapshot rows (already sorted server-side by orderIndex).
  const snapshotRows = data?.round.vendorMilestoneSnapshot ?? [];

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", justifyContent: "flex-end" }}
    >
      {/* Backdrop — click to dismiss (drawer is read-only, no in-progress data) */}
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={doClose} />

      {/* Panel */}
      <div
        style={{
          position: "relative", zIndex: 1, height: "100%", width: 560, maxWidth: "100vw",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing
            ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
            : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              {header}
            </p>
            {data?.round.archivedAt && (
              <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-secondary)" }}>
                Closed {fmtShortDate(data.round.archivedAt)}
              </p>
            )}
          </div>
          {archivedRounds.length > 1 && data && (
            <select
              value={selectedRoundId ?? ""}
              onChange={(e) => setSelectedRoundId(e.target.value)}
              className="text-xs"
              style={{
                padding: "4px 8px", borderRadius: 8,
                background: "var(--agent-surface-glass)",
                border: "0.5px solid var(--agent-border-default)",
                color: "var(--agent-text-primary)",
              }}
            >
              {archivedRounds.map((r) => (
                <option key={r.id} value={r.id}>Round {r.roundNumber}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={doClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm">
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div className="px-5 py-6">
              <p className="text-xs" style={{ color: "var(--agent-text-muted)" }}>Loading…</p>
            </div>
          )}
          {error && !loading && (
            <div className="px-5 py-6">
              <p className="text-xs" style={{ color: "var(--agent-danger, #C73E3E)" }}>
                Could not load this round: {error}
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
                      <div className="agent-avatar agent-avatar-md">{getInitials(buyer.name)}</div>
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
                    <Empty text="Not recorded for this round." />
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
                    {formatPrice(data.round.purchasePrice) ?? <span style={{ fontSize: 12, fontWeight: 500, fontStyle: "italic", color: "var(--agent-text-muted)" }}>Not recorded for this round.</span>}
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
                  <Empty text="Not recorded for this round." />
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
                  <Empty text="Not recorded for this round." />
                )}
              </StaggerSection>

              {/* Steps progress on this round */}
              <StaggerSection delayMs={160}>
                <SectionHeader title="Steps progress on this round" subtitle={summaryLine} />
                {data.pmCompletions.length === 0 ? (
                  <Empty text="Nothing recorded for this round." />
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
                <SectionHeader title="Seller-side progress at the moment this round closed" />
                {snapshotRows.length === 0 ? (
                  <Empty text="No snapshot recorded for this round." />
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
                <SectionHeader title="Communications during this round" />
                {data.comms.length === 0 ? (
                  <Empty text="Nothing recorded for this round." />
                ) : (
                  <div style={{ padding: "4px 16px 14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.comms.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "var(--agent-surface-glass)",
                          border: "0.5px solid var(--agent-border-default)",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--agent-text-secondary)" }}>
                          {c.type}{c.method ? ` · ${c.method}` : ""}{c.createdByName ? ` · ${c.createdByName}` : ""} · {fmtDate(c.createdAt)}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                          {c.content.length > 600 ? `${c.content.slice(0, 600)}…` : c.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </StaggerSection>

              {/* Why this round closed */}
              <StaggerSection delayMs={280}>
                <SectionHeader title="Why this round closed" />
                {data.round.fallThroughReason || data.round.archivedAt ? (
                  <div style={{ padding: "4px 16px 14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {data.round.fallThroughReason && (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-primary)" }}>
                        {data.round.fallThroughReason}
                      </p>
                    )}
                    {data.round.archivedAt && (
                      <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
                        Closed on {fmtDate(data.round.archivedAt)}
                      </p>
                    )}
                  </div>
                ) : (
                  <Empty text="No reason recorded." />
                )}
              </StaggerSection>

              {/* Documents on this file */}
              <StaggerSection delayMs={320}>
                <SectionHeader title="Documents on this file" />
                <p className="px-4" style={{ margin: 0, marginBottom: 8, fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                  Documents on this file are not tied to a specific round. The memorandum of sale and any agent uploads are shared across rounds; the list below is everything attached to the file.
                </p>
                {data.fileDocuments.length === 0 ? (
                  <Empty text="No documents on this file." />
                ) : (
                  <ul className="px-4" style={{ margin: 0, marginBottom: 16, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.fileDocuments.map((d) => (
                      <li
                        key={d.id}
                        style={{
                          fontSize: 12, color: "var(--agent-text-secondary)",
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "var(--agent-surface-glass)",
                          border: "0.5px solid var(--agent-border-default)",
                          display: "flex", alignItems: "center", gap: 10,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--agent-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.filename}</span>
                        {d.source && <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>{d.source}</span>}
                        <span style={{ fontSize: 10, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>{fmtShortDate(d.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </StaggerSection>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
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
