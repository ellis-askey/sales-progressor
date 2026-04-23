import { notFound } from "next/navigation";
import { getPortalData, getPortalTimeline } from "@/lib/services/portal";
import type { TimelineEntry } from "@/lib/services/portal";
import { P } from "@/components/portal/portal-ui";

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
    const label = groupLabel(e.createdAt);
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

export default async function PortalUpdatesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();

  const { contact, transaction } = data;
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";

  const timeline = await getPortalTimeline(transaction.id, side, contact.id);
  const groups   = groupTimeline(timeline);

  return (
    <div className="space-y-5">
      {timeline.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-10 text-center"
          style={{ background: P.cardBg, boxShadow: P.shadowSm }}
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
        </div>
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
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3.5 rounded-2xl px-5 py-4"
                      style={{ background: P.cardBg, boxShadow: P.shadowSm }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: P.successBg }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold leading-snug" style={{ color: P.textPrimary }}>
                          {entry.label}
                        </p>
                        {entry.eventDate && (
                          <p className="text-[13px] font-semibold mt-0.5" style={{ color: P.primary }}>
                            {fmtDateFull(entry.eventDate)}
                          </p>
                        )}
                        <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>
                          {entry.confirmedByClient
                            ? "Confirmed by you"
                            : entry.completedByName
                              ? `Confirmed by ${entry.completedByName}`
                              : "Milestone confirmed"}
                          {" · "}{fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
                        </p>
                      </div>
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
                      {entry.content}
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
