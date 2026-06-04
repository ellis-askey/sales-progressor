"use client";

// Phase 1 commit 8 — archived-round drawer (read-only).
//
// Renders an archived round's full record for an agent who wants to see
// what the previous buyer was doing. Sections (locked spec):
//   - Buyer
//   - Buyer's solicitor
//   - Buyer's broker
//   - Agreed price
//   - Steps progress on this round  (the per-round PM rows)
//   - Seller-side progress at the moment this round closed  (VM JSON snapshot)
//   - Communications during this round  (OutboundMessage with buyerRoundId = this round)
//   - Why this round closed  (fallThroughReason + archivedAt)
//   - Documents on this file are not tied to a specific round. [caveat]
//
// All copy voice-passed by Ellis 2026-06-04. Do not paraphrase. The
// "Carries over / starts fresh" mental model from the relist modal
// applies here too: the source of truth for "did this round happen"
// is the BuyerRound row + its snapshots; documents pane MUST show
// file-level only with the caveat.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/dist/ssr";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type Props = {
  open: boolean;
  transactionId: string;
  archivedRounds: Array<{ id: string; roundNumber: number }>;
  onClose: () => void;
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
    vendorMilestoneSnapshot: Array<{ code: string; state: string; completedAt: string | null; eventDate: string | null; summaryText: string | null }> | null;
  };
  buyerContacts: Array<{ id: string; name: string; email: string | null; phone: string | null; roleType: string }>;
  pmCompletions: Array<{ code: string; state: string; completedAt: string | null; completedByName: string | null; eventDate: string | null; summaryText: string | null; confirmedByPortal: boolean }>;
  comms: Array<{ id: string; type: string; method: string | null; content: string; createdAt: string; createdByName: string | null; visibleToClient: boolean }>;
  fileDocuments: Array<{ id: string; filename: string; mimeType: string | null; source: string | null; createdAt: string }>;
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtPrice(p: number | null): string {
  if (p === null) return "Not recorded for this round.";
  return `£${(Math.floor(p / 100)).toLocaleString("en-GB")}`;
}

export function ArchivedRoundDrawer({ open, transactionId, archivedRounds, onClose }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [data, setData] = useState<ArchivedRoundPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to the most recent archived round (passed sorted descending).
  useEffect(() => {
    if (open && !selectedRoundId && archivedRounds.length > 0) {
      setSelectedRoundId(archivedRounds[0].id);
    }
  }, [open, archivedRounds, selectedRoundId]);

  // Reset selection on close so re-opening defaults to most-recent again.
  useEffect(() => {
    if (!open) setSelectedRoundId(null);
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
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load this round.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, selectedRoundId, transactionId]);

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const buyer = data?.buyerContacts.find((c) => c.roleType === "purchaser") ?? null;
  const header = data ? `Round ${data.round.roundNumber} — ${buyer?.name ?? "buyer"}'s record` : "Loading…";

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      className="nv2-night fixed inset-0 flex justify-end"
      style={{ zIndex: 1500 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white h-full w-full max-w-[560px] overflow-y-auto"
        style={{
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
          animation: "agent-drawer-in 220ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 bg-white flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-slate-900">{header}</p>
            {archivedRounds.length > 1 && (
              <select
                value={selectedRoundId ?? ""}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="text-xs rounded-lg border px-2 py-1 bg-white"
                style={{ borderColor: "rgba(0,0,0,0.12)" }}
              >
                {archivedRounds.map((r) => (
                  <option key={r.id} value={r.id}>Round {r.roundNumber}</option>
                ))}
              </select>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 8, background: "transparent",
              border: "none", cursor: "pointer", color: "var(--agent-text-muted, #6b7280)",
            }}
            className="hover:bg-black/[0.05]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div className="px-5 py-6">
            <p className="text-xs" style={{ color: "var(--agent-text-muted, #6b7280)" }}>Loading…</p>
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
          <div className="px-5 py-5 space-y-5">
            <Section title="Buyer">
              {buyer ? (
                <>
                  <Row label="Name"  value={buyer.name} />
                  {buyer.email && <Row label="Email" value={buyer.email} />}
                  {buyer.phone && <Row label="Phone" value={buyer.phone} />}
                </>
              ) : (
                <Empty text="Not recorded for this round." />
              )}
            </Section>

            <Section title="Buyer's solicitor">
              {data.round.purchaserSolicitorFirm || data.round.purchaserSolicitorContact ? (
                <>
                  {data.round.purchaserSolicitorFirm && <Row label="Firm" value={data.round.purchaserSolicitorFirm.name} />}
                  {data.round.purchaserSolicitorContact && (
                    <>
                      <Row label="Handler" value={data.round.purchaserSolicitorContact.name} />
                      {data.round.purchaserSolicitorContact.email && <Row label="Email" value={data.round.purchaserSolicitorContact.email} />}
                      {data.round.purchaserSolicitorContact.phone && <Row label="Phone" value={data.round.purchaserSolicitorContact.phone} />}
                    </>
                  )}
                </>
              ) : (
                <Empty text="Not recorded for this round." />
              )}
            </Section>

            <Section title="Buyer's broker">
              {data.round.brokerFirm || data.round.brokerContact ? (
                <>
                  {data.round.brokerFirm && <Row label="Firm" value={data.round.brokerFirm.name} />}
                  {data.round.brokerContact && <Row label="Contact" value={data.round.brokerContact.name} />}
                </>
              ) : (
                <Empty text="Not recorded for this round." />
              )}
            </Section>

            <Section title="Agreed price">
              <Row label="" value={fmtPrice(data.round.purchasePrice)} />
            </Section>

            <Section title="Steps progress on this round">
              <SnapshotTable
                rows={data.pmCompletions.map((p) => ({
                  code: p.code, state: p.state,
                  detail: p.completedAt ? `Confirmed ${fmtDate(p.completedAt)}${p.completedByName ? ` by ${p.completedByName}` : ""}` : "",
                }))}
              />
            </Section>

            <Section title="Seller-side progress at the moment this round closed">
              {data.round.vendorMilestoneSnapshot && data.round.vendorMilestoneSnapshot.length > 0 ? (
                <SnapshotTable
                  rows={data.round.vendorMilestoneSnapshot.map((v) => ({
                    code: v.code, state: v.state,
                    detail: v.completedAt ? `at ${fmtDate(v.completedAt)}` : "",
                  }))}
                />
              ) : (
                <Empty text="No snapshot recorded for this round." />
              )}
            </Section>

            <Section title="Communications during this round">
              {data.comms.length === 0 ? (
                <Empty text="Nothing recorded for this round." />
              ) : (
                <div className="space-y-2">
                  {data.comms.map((c) => (
                    <div key={c.id} className="text-xs px-3 py-2 rounded-md" style={{ background: "rgba(0,0,0,0.03)" }}>
                      <p className="font-semibold" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                        {c.type}{c.method ? ` · ${c.method}` : ""}{c.createdByName ? ` · ${c.createdByName}` : ""} · {fmtDate(c.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap" style={{ color: "var(--agent-text-primary, #1a1d29)" }}>
                        {c.content.slice(0, 600)}{c.content.length > 600 ? "…" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Why this round closed">
              {data.round.fallThroughReason ? (
                <>
                  <Row label="Reason"   value={data.round.fallThroughReason} />
                  {data.round.archivedAt && <Row label="Closed on" value={fmtDate(data.round.archivedAt)} />}
                </>
              ) : (
                <Empty text="No reason recorded." />
              )}
            </Section>

            <Section title="Documents on this file">
              <p className="text-xs mb-2" style={{ color: "var(--agent-text-muted, #6b7280)" }}>
                Documents on this file are not tied to a specific round. The memorandum of sale and any agent uploads are shared across rounds; the list below is everything attached to the file.
              </p>
              {data.fileDocuments.length === 0 ? (
                <Empty text="No documents on this file." />
              ) : (
                <ul className="text-xs space-y-1" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>
                  {data.fileDocuments.map((d) => (
                    <li key={d.id}>
                      <span className="font-semibold">{d.filename}</span>
                      {d.source ? ` · ${d.source}` : ""}
                      {` · ${fmtDate(d.createdAt)}`}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--agent-text-muted, #6b7280)" }}>
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      {label && <span className="font-medium min-w-[70px]" style={{ color: "var(--agent-text-muted, #6b7280)" }}>{label}</span>}
      <span style={{ color: "var(--agent-text-primary, #1a1d29)" }}>{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs italic" style={{ color: "var(--agent-text-muted, #6b7280)" }}>{text}</p>;
}

function SnapshotTable({ rows }: { rows: Array<{ code: string; state: string; detail: string }> }) {
  if (rows.length === 0) return <Empty text="Nothing recorded for this round." />;
  return (
    <div className="overflow-hidden rounded-md" style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}>
      {rows.map((r, i) => (
        <div
          key={`${r.code}-${i}`}
          className="flex items-baseline px-3 py-1.5 text-xs"
          style={{
            background: i % 2 ? "rgba(0,0,0,0.02)" : "white",
            color: "var(--agent-text-primary, #1a1d29)",
          }}
        >
          <span className="font-mono w-12 text-[10px] font-semibold" style={{ color: "var(--agent-text-muted, #6b7280)" }}>{r.code}</span>
          <span className="min-w-[80px] font-medium">{r.state}</span>
          {r.detail && <span className="ml-3 text-[11px]" style={{ color: "var(--agent-text-secondary, #4b5563)" }}>{r.detail}</span>}
        </div>
      ))}
    </div>
  );
}
