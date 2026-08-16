import { notFound } from "next/navigation";
import { getPortalData, getPortalTimeline } from "@/lib/services/portal";
import type { TimelineEntry } from "@/lib/services/portal";
import { portalConfirmationSentence } from "@/lib/updates-copy";
import { P, PortalPill } from "@/components/portal/portal-ui";
import { stripCommsLinksSilent } from "@/lib/utils/strip-comms-links";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
import { UserAvatar } from "@/components/ui/Avatar";
import { UserCircle } from "@phosphor-icons/react/dist/ssr";

type MethodStyle = { label: string; bg: string; color: string };

const METHOD_STYLES: Record<string, MethodStyle> = {
  email:     { label: "Email",      bg: "rgba(59,130,246,0.10)",  color: "#2563EB" },
  phone:     { label: "Phone call", bg: "rgba(16,185,129,0.10)",  color: "#059669" },
  sms:       { label: "SMS",        bg: "rgba(245,158,11,0.10)",  color: "#D97706" },
  voicemail: { label: "Voicemail",  bg: "rgba(139,92,246,0.10)",  color: "#7C3AED" },
  whatsapp:  { label: "WhatsApp",   bg: "rgba(16,185,129,0.10)",  color: "#059669" },
  post:      { label: "Post",       bg: "rgba(107,114,128,0.10)", color: "#4B5563" },
};

function groupLabel(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return "This week";
  if (diffDays < 14) return "Last week";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function groupTimeline(entries: TimelineEntry[]): { label: string; items: TimelineEntry[] }[] {
  const groups: { label: string; items: TimelineEntry[] }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const label = groupLabel(e.createdAt ?? new Date());
    if (!seen.has(label)) { seen.add(label); groups.push({ label, items: [] }); }
    groups[groups.length - 1].items.push(e);
  }
  return groups;
}

function fmtTime(d: Date) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function fmtDateFull(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDayMonth(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function PortalUpdatesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPortalData(token);
  if (!result || result.kind === "deadRound") notFound();
  const data = result.data;

  const { contact, transaction } = data;
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";

  const timeline = await getPortalTimeline(transaction.id, side, contact.id, { buyerRoundId: contact.buyerRoundId, activeBuyerRoundId: transaction.activeBuyerRoundId });
  const groups   = groupTimeline(timeline);

  return (
    <div className="space-y-5">
      {timeline.length === 0 ? (
        <PortalGlassCard
          glassId="updates-empty"
          label="Updates: empty state"
          className="px-5 py-10 text-center"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: P.accentBg }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p className="text-[16px] font-semibold mb-1" style={{ color: P.textPrimary }}>
            Nothing yet
          </p>
          <p className="text-[14px]" style={{ color: P.textSecondary }}>
            Key milestones and updates from your team will appear here.
          </p>
        </PortalGlassCard>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1"
              style={{ color: P.textMuted }}
            >
              {group.label}
            </p>

            <div className="space-y-2">
              {group.items.map((entry) => {

                /* ── Key milestone event ── */
                if (entry.type === "milestone") {
                  const isOwnSide = entry.side === side;
                  const sideBadgeText = isOwnSide
                    ? (side === "vendor" ? "Sale" : "Purchase")
                    : (entry.side === "vendor" ? "Their sale" : "Their purchase");
                  const sidePillTone = isOwnSide ? (side === "vendor" ? "coral" : "blue") : "grey";
                  return (
                    <PortalGlassCard
                      key={entry.id}
                      glassId="updates-card"
                      label="Update card"
                      defaultVariant="v26"
                      className="flex items-start gap-3.5 px-5 py-4"
                    >
                      {/* Avatar. Own side: the client's own photo on steps they
                          confirmed, the team member's photo on steps we
                          confirmed, else our bright orange icon. Other side:
                          always a green icon, never a photo (we don't share the
                          other side's pictures across the deal). */}
                      {(() => {
                        const isOtherSide = entry.side !== side;
                        const photo = isOtherSide
                          ? null
                          : entry.confirmedByClient
                            ? entry.confirmedByContactImage
                            : entry.completedByImage;
                        return photo ? (
                          <div className="flex-shrink-0 mt-0.5">
                            <UserAvatar user={{ name: entry.confirmedByClient ? "You" : (entry.completedByName ?? "Your team"), image: photo }} size={32} />
                          </div>
                        ) : (
                          <UserCircle size={32} weight="fill" className="flex-shrink-0 mt-0.5" style={{ color: isOtherSide ? P.success : P.primary }} />
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        {/* The update spans full width; the meta line carries the
                            orange EVENT date + the muted Confirmed stamp, with the
                            side pill pushed to the far right (it drops below once
                            the line is too tight). */}
                        <p className="text-[14px] font-semibold leading-snug" style={{ color: P.textPrimary }}>
                          {portalConfirmationSentence({
                            code: entry.code,
                            side: entry.side,
                            viewerSide: side,
                            confirmer: entry.confirmedByClient
                              ? { kind: "client" }
                              : entry.confirmedBySolicitorFirmName
                                ? { kind: "solicitor", firm: entry.confirmedBySolicitorFirmName }
                                : { kind: "agent", name: entry.completedByName ?? "Your team" },
                            milestoneName: entry.label,
                          })}
                        </p>
                        <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-1.5">
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0">
                            {entry.eventDate && (
                              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: P.primary }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                {fmtDateFull(entry.eventDate)}
                              </span>
                            )}
                            {entry.eventDate && <span aria-hidden style={{ color: P.border }}>|</span>}
                            <span className="text-[12px]" style={{ color: P.textMuted }}>
                              Confirmed {fmtDayMonth(entry.createdAt ?? new Date())} · {fmtTime(entry.createdAt ?? new Date())}
                            </span>
                          </div>
                          <span className="sm:ml-auto flex-shrink-0">
                            <PortalPill tone={sidePillTone}>{sideBadgeText}</PortalPill>
                          </span>
                        </div>
                      </div>
                    </PortalGlassCard>
                  );
                }

                /* ── Document you uploaded ── */
                if (entry.type === "document") {
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl px-5 py-4"
                      style={{ background: P.cardBg, boxShadow: P.shadowSm, borderLeft: `3px solid ${P.accent}` }}
                    >
                      <span
                        className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full mb-3"
                        style={{ background: P.accentBg, color: P.accent }}
                      >
                        Document
                      </span>
                      {entry.url ? (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[14px] font-semibold"
                          style={{ color: P.accent, textDecoration: "underline", textUnderlineOffset: 2, wordBreak: "break-word" }}
                        >
                          {entry.filename}
                        </a>
                      ) : (
                        <p className="text-[14px] font-semibold" style={{ color: P.textPrimary, wordBreak: "break-word" }}>
                          {entry.filename}
                        </p>
                      )}
                      <p className="text-[12px] mt-2" style={{ color: P.textMuted }}>
                        {fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
                      </p>
                    </div>
                  );
                }

                /* ── Agent update ── */
                const method = entry.method ? METHOD_STYLES[entry.method] : null;
                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl px-5 py-4"
                    style={{ background: P.cardBg, boxShadow: P.shadowSm, borderLeft: `3px solid ${P.accent}` }}
                  >
                    {method && (
                      <span
                        className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full mb-3"
                        style={{ background: method.bg, color: method.color }}
                      >
                        {method.label}
                      </span>
                    )}
                    <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: P.textPrimary }}>
                      {stripCommsLinksSilent(entry.content)}
                    </p>
                    <p className="text-[12px] mt-2" style={{ color: P.textMuted }}>
                      {fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
