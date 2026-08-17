import { notFound } from "next/navigation";
import { getPortalData, getPortalTimeline } from "@/lib/services/portal";
import type { TimelineEntry } from "@/lib/services/portal";
import { portalConfirmationSentence } from "@/lib/updates-copy";
import { getMilestoneUpdateSubtext, getMilestoneUpdateSubtextOther } from "@/lib/portal-copy";
import { getUpdateOverrideMap } from "@/lib/services/milestone-update-overrides";
import { P, PortalPill, type PortalPillTone } from "@/components/portal/portal-ui";
import { stripCommsLinksSilent } from "@/lib/utils/strip-comms-links";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
import { UserAvatar } from "@/components/ui/Avatar";
import { UserCircle, FileText } from "@phosphor-icons/react/dist/ssr";

// Method → the standard PortalPill tone + label (was a bespoke flat pill).
const METHOD_META: Record<string, { label: string; tone: PortalPillTone }> = {
  email:     { label: "Email",      tone: "blue" },
  phone:     { label: "Phone call", tone: "green" },
  sms:       { label: "SMS",        tone: "amber" },
  voicemail: { label: "Voicemail",  tone: "grey" },
  whatsapp:  { label: "WhatsApp",   tone: "green" },
  post:      { label: "Post",       tone: "grey" },
};

// Split "Property Information Form.pdf" → base + "PDF" so the extension can sit
// quietly next to the pill instead of trailing the link text.
function splitFileName(name: string): { base: string; ext: string | null } {
  const i = name.lastIndexOf(".");
  if (i > 0 && i < name.length - 1) return { base: name.slice(0, i), ext: name.slice(i + 1).toUpperCase() };
  return { base: name, ext: null };
}

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
  const updateOverrides = await getUpdateOverrideMap();

  // "New since your last visit" markers (null on a first visit → nothing flagged).
  const lastVisit = contact.lastVisitedPortalAt ?? null;
  const isNew = (e: TimelineEntry) => !!lastVisit && !!e.createdAt && new Date(e.createdAt) > new Date(lastVisit);
  const newCount = timeline.filter(isNew).length;

  return (
    <div className="space-y-5">
      {newCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="w-2 h-2 rounded-full" style={{ background: P.primary }} />
          <p className="text-[13px] font-semibold" style={{ color: P.textPrimary }}>
            {newCount} new since your last visit
          </p>
        </div>
      )}
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
                const el = (() => {

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
                            coreOverride: updateOverrides.get(entry.code)?.core ?? null,
                          })}
                        </p>
                        {(() => {
                          // Own side: first-person "your solicitor" subtext. Other
                          // side: third-person "the seller/buyer" subtext. Command
                          // Centre override wins over the hardcoded default.
                          const ov = updateOverrides.get(entry.code);
                          const sub = entry.side === side
                            ? (ov?.subtextOwn ?? getMilestoneUpdateSubtext(entry.code))
                            : (ov?.subtextOther ?? getMilestoneUpdateSubtextOther(entry.code));
                          return sub ? (
                            <p className="text-[13px] leading-relaxed mt-1" style={{ color: P.textSecondary }}>{sub}</p>
                          ) : null;
                        })()}
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
                  const { base, ext } = splitFileName(entry.filename ?? "");
                  return (
                    <PortalGlassCard
                      key={entry.id}
                      glassId="updates-card"
                      label="Update card"
                      defaultVariant="v26"
                      className="flex items-start gap-3.5 px-5 py-4"
                    >
                      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: P.accentBg }}>
                        <FileText size={17} weight="regular" style={{ color: P.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {entry.url ? (
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[14px] font-semibold"
                            style={{ color: P.accent, textDecoration: "underline", textUnderlineOffset: 2, wordBreak: "break-word" }}
                          >
                            {base}
                          </a>
                        ) : (
                          <p className="text-[14px] font-semibold" style={{ color: P.textPrimary, wordBreak: "break-word" }}>
                            {base}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-1.5">
                          <span className="text-[12px]" style={{ color: P.textMuted }}>
                            {fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
                          </span>
                          <span className="sm:ml-auto flex-shrink-0 flex items-center gap-2">
                            <PortalPill tone="blue">Document</PortalPill>
                            {ext && <span className="text-[11px] font-semibold" style={{ color: P.textMuted }}>{ext}</span>}
                          </span>
                        </div>
                      </div>
                    </PortalGlassCard>
                  );
                }

                /* ── Agent update (email / phone / etc.) ── */
                const method = entry.method ? METHOD_META[entry.method] : null;
                return (
                  <PortalGlassCard
                    key={entry.id}
                    glassId="updates-card"
                    label="Update card"
                    defaultVariant="v26"
                    className="flex items-start gap-3.5 px-5 py-4"
                  >
                    <UserCircle size={32} weight="fill" className="flex-shrink-0 mt-0.5" style={{ color: P.primary }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: P.textPrimary }}>
                        {stripCommsLinksSilent(entry.content)}
                      </p>
                      <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-1.5">
                        <span className="text-[12px]" style={{ color: P.textMuted }}>
                          {fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
                        </span>
                        {method && (
                          <span className="sm:ml-auto flex-shrink-0">
                            <PortalPill tone={method.tone}>{method.label}</PortalPill>
                          </span>
                        )}
                      </div>
                    </div>
                  </PortalGlassCard>
                );
                })();
                return isNew(entry) ? (
                  <div key={entry.id} className="relative">
                    {el}
                    <span className="absolute top-2.5 right-3">
                      <PortalPill tone="coral">New</PortalPill>
                    </span>
                  </div>
                ) : el;
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
