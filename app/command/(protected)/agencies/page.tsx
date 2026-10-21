import Link from "next/link";
import { getUsageOverview, type AgentUsage, type AgencyUsage, type UsageStatus } from "@/lib/command/usage";
import { commandDb } from "@/lib/command/prisma";
import { getAgencySetupReadiness } from "@/lib/command/agency-readiness";
import { getAgencyBusinessMap } from "@/lib/command/businesses";
import { parseMode, parseAgencies } from "@/lib/command/scope";
import { AgencyControlsMatrix, type ControlsRow } from "@/components/command/agencies/AgencyControlsMatrix";
import { ReadinessPill } from "@/components/command/agencies/ReadinessDetail";
import { ManagedByTag } from "@/components/command/businesses/ManagedByTag";
import InfoTip from "@/components/command/shared/InfoTip";
import { StatusFilterSelect } from "@/components/command/agencies/StatusFilterSelect";
import { AgentHelpButton } from "@/components/command/agencies/AgentHelpButton";
import type { AgencyModeProfile, ClientType } from "@prisma/client";

// Agencies & agents — the who's-who roster (CC rebuild PR2).
//
// Three tabs. "Agencies" is the directory: one row per agency with who runs its
// progression (Self / TSP / a progression business), team, engagement, setup,
// fee tier and automation at a glance; rows open the Agency File, where
// everything is edited. "Agents" is the per-person usage table. "Controls" is
// the one bulk matrix for every CC-owned automation switch. The five stacked
// admin sections the old page grew are relocated: per-agency editing lives on
// the Agency File, bulk flipping lives on Controls. This page also honours the
// sidebar scope filter (mode + agency), which it previously ignored.

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}
function fmtHoursShort(seconds: number): string {
  const h = seconds / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  const m = Math.round(seconds / 60);
  return m > 0 ? `${m}m` : "0";
}
function fmtRelative(d: Date | null): string {
  if (!d) return "never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days >= 2) return `${days} days ago`;
  if (days === 1) return "yesterday";
  const hrs = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (hrs >= 1) return `${hrs}h ago`;
  return "just now";
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
const AV_COLORS = ["#8b9dff", "#34d399", "#e0a44a", "#f0716f", "#c084fc", "#38bdf8"];
function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

const STATUS_STYLE: Record<UsageStatus, string> = {
  active: "text-emerald-400 bg-emerald-950/50 border-emerald-900",
  quiet: "text-amber-400 bg-amber-950/50 border-amber-900",
  dormant: "text-red-400 bg-red-950/40 border-red-900",
  never: "text-violet-400 bg-violet-950/40 border-violet-900",
};
const STATUS_LABEL: Record<UsageStatus, string> = { active: "Active", quiet: "Quiet", dormant: "Dormant", never: "Never on" };

function StatusPill({ status }: { status: UsageStatus }) {
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function DeviceSplit({ mobile, desktop }: { mobile: number; desktop: number }) {
  const total = mobile + desktop;
  if (total === 0) return <span className="text-neutral-600">—</span>;
  const mobilePct = Math.round((mobile / total) * 100);
  const desktopPct = 100 - mobilePct;
  const primaryMobile = mobile >= desktop;
  const label = primaryMobile ? `${mobilePct}% mobile` : `${desktopPct}% desktop`;
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap"
      title={`Mobile: ${mobile} session${mobile === 1 ? "" : "s"} · Desktop: ${desktop} session${desktop === 1 ? "" : "s"} (last 12 weeks)`}
    >
      <span className="inline-flex h-[6px] w-[52px] rounded-full overflow-hidden bg-neutral-800 shrink-0">
        <i className="h-full bg-teal-400/80" style={{ width: `${mobilePct}%` }} />
        <i className="h-full bg-blue-500/80" style={{ width: `${desktopPct}%` }} />
      </span>
      <span className="text-[11px] text-neutral-400 tabular-nums">{label}</span>
    </span>
  );
}

function Sparkline({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <span className="inline-flex items-end gap-[2px] h-[22px]">
      {weeks.map((w, i) => {
        const zero = w === 0;
        const h = zero ? 2 : Math.max(4, Math.round((w / max) * 22));
        return (
          <i
            key={i}
            className="w-[5px] rounded-[1px]"
            style={{ height: `${h}px`, background: zero ? "#242428" : "#3b82f6", opacity: zero ? 1 : 0.85 }}
          />
        );
      })}
    </span>
  );
}

function FeeChip({ tier, legacyPence }: { tier: ClientType; legacyPence: number | null }) {
  if (tier === "legacy") {
    return (
      <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border text-amber-400 bg-amber-950/50 border-amber-900 whitespace-nowrap">
        Legacy{legacyPence != null ? ` £${Math.round(legacyPence / 100)}` : ""}
      </span>
    );
  }
  if (tier === "free") {
    return (
      <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-950/50 border-emerald-900">
        Free
      </span>
    );
  }
  return (
    <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border text-neutral-400 bg-neutral-800/60 border-neutral-700">
      Sliding
    </span>
  );
}

function progressionLabel(modeProfile: AgencyModeProfile): string {
  if (modeProfile === "self_progressed") return "Self";
  if (modeProfile === "progressor_managed") return "TSP";
  return "Mixed";
}

type Tab = "agencies" | "agents" | "controls";

export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string; q?: string; status?: string; since?: string; setup?: string; mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  // "New signups this week" drill-down from the Today page only makes sense on
  // the roster, so it forces that tab. Legacy ?view= links map onto tabs.
  const sinceFilter = sp.since === "7d";
  const tab: Tab = sinceFilter
    ? "agencies"
    : sp.tab === "agents" || sp.view === "agent"
      ? "agents"
      : sp.tab === "controls"
        ? "controls"
        : "agencies";
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = (["active", "quiet", "dormant", "never", "gonequiet"] as const).find((s) => s === sp.status);
  const onlySetupGaps = sp.setup === "gaps";
  const matchesStatus = (s: UsageStatus): boolean => {
    if (!statusFilter) return true;
    if (statusFilter === "gonequiet") return s === "quiet" || s === "dormant";
    return s === statusFilter;
  };

  // Sidebar scope (mode + agency multi-select) — honoured here since PR2.
  const scopeMode = parseMode(sp.mode);
  const scopeAgencyIds = parseAgencies(sp.agency);

  const [{ agents, agencies }, feeAgencies, setupReadiness, agencyBusinessMap, chaseSettings] = await Promise.all([
    getUsageOverview(),
    commandDb.agency.findMany({
      where: { isInternal: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        modeProfile: true,
        feeTier: true,
        legacyOutsourcedFeePence: true,
        solicitorChaseEnabled: true,
        enquiryReplyChaseEnabled: true,
        enquiryRaiseChaseEnabled: true,
        weeklyClientUpdatesEnabled: true,
        whatsAppCaptureEnabled: true,
        whatsAppTasksEnabled: true,
      },
    }),
    getAgencySetupReadiness(),
    getAgencyBusinessMap(),
    commandDb.solicitorChaseSettings.findUnique({
      where: { id: "singleton" },
      select: { enabledByDefault: true },
    }),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  // Clients the Saturday weekly update would reach, shown on the Controls tab.
  const eligibleThisWeek = await commandDb.contact.count({
    where: {
      roleType: { in: ["purchaser", "vendor"] },
      email: { not: null },
      unsubscribedAt: null,
      portalEligible: true,
      transaction: {
        status: "active",
        agency: { isInternal: false, weeklyClientUpdatesEnabled: true },
        communications: { none: { type: "outbound", createdAt: { gte: sevenDaysAgo } } },
      },
    },
  });

  const modeByAgency = new Map(feeAgencies.map((a) => [a.id, a.modeProfile]));
  const inScope = (agencyId: string): boolean => {
    if (scopeAgencyIds.length > 0) return scopeAgencyIds.includes(agencyId);
    if (scopeMode === "sp") return modeByAgency.get(agencyId) === "self_progressed";
    if (scopeMode === "pm") return modeByAgency.get(agencyId) === "progressor_managed";
    return true;
  };
  const scoped = scopeMode !== "combined" || scopeAgencyIds.length > 0;

  // Tiles reflect the scoped agent set (equal to the global rollup when unscoped).
  const scopedAgents = agents.filter((a) => inScope(a.agencyId));
  const tileSummary = {
    activeAgents7d: scopedAgents.filter((a) => a.status === "active").length,
    hoursSeconds7d: scopedAgents.reduce((s, a) => s + a.seconds7d, 0),
    logins7d: scopedAgents.reduce((s, a) => s + a.logins7d, 0),
    goneQuiet: scopedAgents.filter((a) => a.status === "quiet" || a.status === "dormant").length,
    neverActivated: scopedAgents.filter((a) => a.status === "never").length,
  };

  const agentRows: AgentUsage[] = scopedAgents.filter(
    (a) =>
      matchesStatus(a.status) &&
      (!q || a.name.toLowerCase().includes(q) || a.agencyName.toLowerCase().includes(q)),
  );

  // ── Roster rows: every non-internal agency, joined with usage where present ──
  const usageByAgency = new Map<string, AgencyUsage>(agencies.map((a) => [a.agencyId, a]));
  const setupByAgency = new Map(setupReadiness.rows.map((r) => [r.id, r]));
  const recentAgencyIds = new Set(
    feeAgencies.filter((a) => a.createdAt >= sevenDaysAgo).map((a) => a.id),
  );

  const AUTO_KEYS = [
    "solicitorChaseEnabled",
    "enquiryReplyChaseEnabled",
    "enquiryRaiseChaseEnabled",
    "weeklyClientUpdatesEnabled",
    "whatsAppCaptureEnabled",
    "whatsAppTasksEnabled",
  ] as const;

  const rosterRows = feeAgencies
    .filter((a) => inScope(a.id))
    .map((a) => {
      const u = usageByAgency.get(a.id) ?? null;
      const setup = setupByAgency.get(a.id) ?? null;
      return {
        id: a.id,
        name: a.name,
        managedBy: agencyBusinessMap.get(a.id) ?? null,
        progression: progressionLabel(a.modeProfile),
        status: (u?.status ?? "never") as UsageStatus,
        agentCount: u?.agentCount ?? 0,
        activeCount: u?.activeCount ?? 0,
        logins7d: u?.logins7d ?? 0,
        seconds7d: u?.seconds7d ?? 0,
        filesTouched7d: u?.filesTouched7d ?? 0,
        deviceMobile: u?.deviceMobile ?? 0,
        deviceDesktop: u?.deviceDesktop ?? 0,
        lastActive: u?.lastActive ?? null,
        setup,
        feeTier: a.feeTier,
        legacyPence: a.legacyOutsourcedFeePence,
        autoOn: AUTO_KEYS.filter((k) => a[k]).length,
      };
    })
    .filter(
      (r) =>
        matchesStatus(r.status) &&
        (!q || r.name.toLowerCase().includes(q)) &&
        (!sinceFilter || recentAgencyIds.has(r.id)) &&
        (!onlySetupGaps || (r.setup != null && r.setup.level !== "ready")),
    )
    .sort(
      (a, b) =>
        b.seconds7d - a.seconds7d ||
        (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0) ||
        a.name.localeCompare(b.name),
    );

  const feeCounts = {
    legacy: feeAgencies.filter((a) => a.feeTier === "legacy").length,
    free: feeAgencies.filter((a) => a.feeTier === "free").length,
  };
  const feeStandard = feeAgencies.length - feeCounts.legacy - feeCounts.free;

  const controlsRows: ControlsRow[] = feeAgencies.map((a) => ({
    id: a.id,
    name: a.name,
    solicitorChaseEnabled: a.solicitorChaseEnabled,
    enquiryReplyChaseEnabled: a.enquiryReplyChaseEnabled,
    enquiryRaiseChaseEnabled: a.enquiryRaiseChaseEnabled,
    weeklyClientUpdatesEnabled: a.weeklyClientUpdatesEnabled,
    whatsAppCaptureEnabled: a.whatsAppCaptureEnabled,
    whatsAppTasksEnabled: a.whatsAppTasksEnabled,
  }));

  // URL building — every link preserves the current tab, filters and scope.
  const qsWith = (extra: Record<string, string>) => {
    const p = new URLSearchParams({
      tab,
      ...(sp.q ? { q: sp.q } : {}),
      ...(sp.status ? { status: sp.status } : {}),
      ...(sp.setup ? { setup: sp.setup } : {}),
      ...(sp.mode ? { mode: sp.mode } : {}),
      ...(sp.agency ? { agency: sp.agency } : {}),
      ...extra,
    });
    if (!p.get("status")) p.delete("status");
    if (!p.get("setup")) p.delete("setup");
    if (p.get("tab") === "agencies") p.delete("tab");
    return `/command/agencies?${p.toString()}`;
  };
  const tabHref = (t: Tab) => qsWith({ tab: t });
  const statusHref = (s: string) => qsWith({ status: s });
  const STATUS_FILTERS: Array<{ value: string; label: string }> = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "quiet", label: "Quiet" },
    { value: "dormant", label: "Dormant" },
    { value: "never", label: "Never on" },
  ];

  const showUsageChrome = tab !== "controls";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Agencies &amp; agents</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Who&rsquo;s who, who&rsquo;s actually using the platform, and who&rsquo;s gone quiet. Rows open the Agency File, where everything is edited.
        </p>
      </div>

      {/* summary tiles (agent usage; follow the sidebar scope) */}
      {showUsageChrome && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { k: "Active this week", v: String(tileSummary.activeAgents7d), d: "active in the last 7 days", tone: "", href: statusHref("active"),
              tip: "Agents with any activity (any event or any file viewing) in the last 7 days. Follows the sidebar scope filter." },
            { k: "Hours logged · 7d", v: fmtHoursShort(tileSummary.hoursSeconds7d), d: "real engaged time", tone: "", href: null,
              tip: "Engaged time from completed sessions that started in the last 7 days. Open sessions aren't counted until they close, so this can read low." },
            { k: "Logins · 7d", v: String(tileSummary.logins7d), d: "across all agents", tone: "", href: null,
              tip: "Sign-in events across all agents in the last 7 days." },
            { k: "Gone quiet", v: String(tileSummary.goneQuiet), d: "silent 7+ days", tone: tileSummary.goneQuiet > 0 ? "amber" : "", href: statusHref("gonequiet"),
              tip: "Agents who were active before but have gone 7+ days without activity. Quiet = 7 to 14 days, Dormant = 14+ days. Click to see who." },
            { k: "Never activated", v: String(tileSummary.neverActivated), d: "invited, never logged in", tone: tileSummary.neverActivated > 0 ? "violet" : "", href: statusHref("never"),
              tip: "Invited but no activity ever. These need onboarding, not winning back." },
          ].map((t) => {
            const valColor = t.tone === "amber" ? "text-amber-400" : t.tone === "violet" ? "text-violet-400" : "text-neutral-100";
            const body = (
              <>
                <div className="text-[10.5px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  {t.k}
                  <InfoTip label={`What ${t.k} means`}>{t.tip}</InfoTip>
                </div>
                <div className={`text-2xl font-semibold tracking-tight mt-1 tabular-nums ${valColor}`}>{t.v}</div>
                <div className="text-[11.5px] text-neutral-500 mt-0.5">{t.d}{t.href ? " ›" : ""}</div>
              </>
            );
            return t.href ? (
              <Link key={t.k} href={t.href} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 hover:border-neutral-700 transition-colors">
                {body}
              </Link>
            ) : (
              <div key={t.k} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">{body}</div>
            );
          })}
        </div>
      )}

      {/* search + tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        {showUsageChrome ? (
          <form method="GET" className="flex-1 min-w-[220px] flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
            {tab !== "agencies" && <input type="hidden" name="tab" value={tab} />}
            {sp.mode && <input type="hidden" name="mode" value={sp.mode} />}
            {sp.agency && <input type="hidden" name="agency" value={sp.agency} />}
            <svg className="w-4 h-4 text-neutral-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input name="q" defaultValue={sp.q ?? ""} placeholder={tab === "agents" ? "Search an agent or agency…" : "Search an agency…"} className="flex-1 bg-transparent outline-none text-[13.5px] text-neutral-100 placeholder:text-neutral-600" />
          </form>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-[3px]">
          {(["agencies", "agents", "controls"] as Tab[]).map((t) => (
            <Link
              key={t}
              href={tabHref(t)}
              className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-md capitalize ${tab === t ? "bg-blue-950/50 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.4)]" : "text-neutral-400"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>

      {/* status + setup filters */}
      {showUsageChrome && (
        <div className="flex items-center gap-2 flex-wrap -mt-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mr-1">Status</span>
          <StatusFilterSelect
            current={statusFilter ?? ""}
            options={STATUS_FILTERS.map((f) => ({ ...f, href: statusHref(f.value) }))}
          />
          {tab === "agencies" && (
            <>
              <span className="text-[11px] font-mono text-neutral-600 ml-2">
                {setupReadiness.readyCount}/{setupReadiness.total} fully set up
              </span>
              {setupReadiness.total - setupReadiness.readyCount > 0 && (
                <Link
                  href={qsWith({ setup: onlySetupGaps ? "" : "gaps" })}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                    onlySetupGaps
                      ? "bg-neutral-700 text-white border-neutral-600"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {onlySetupGaps ? "Showing setup gaps" : `Show ${setupReadiness.total - setupReadiness.readyCount} not set up`}
                </Link>
              )}
            </>
          )}
          {(statusFilter || onlySetupGaps) && (
            <span className="text-[11px] text-neutral-600">
              {tab === "agents" ? `${agentRows.length} agent${agentRows.length === 1 ? "" : "s"}` : `${rosterRows.length} agenc${rosterRows.length === 1 ? "y" : "ies"}`}
            </span>
          )}
          {scoped && (
            <span className="text-[11px] text-blue-400/80 ml-auto">Following the sidebar scope filter</span>
          )}
        </div>
      )}

      {/* New-signups drill-down banner (from the Command Centre Today page). */}
      {sinceFilter && (
        <div className="flex items-center justify-between gap-3 bg-blue-950/30 border border-blue-900/60 rounded-lg px-4 py-2.5 text-xs -mt-1">
          <span className="text-blue-200">
            Showing {rosterRows.length} {rosterRows.length === 1 ? "agency" : "agencies"} that signed up in the last 7 days.
          </span>
          <Link href="/command/agencies" className="text-blue-400 hover:text-blue-300 font-medium">
            Show all &rarr;
          </Link>
        </div>
      )}

      {/* ── Agencies roster ── */}
      {tab === "agencies" && (
        <>
          <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
            <table className="w-full border-collapse text-[13px] min-w-[1000px]">
              <thead>
                <tr className="bg-neutral-950/60">
                  {[
                    "Agency", "Progression", "Team", "Use · 7d", "Device", "Last active", "Setup", "Fee", "Auto", "Status",
                  ].map((h, i) => (
                    <th key={h} className={`text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold px-3.5 py-2.5 border-b border-neutral-800 whitespace-nowrap ${i === 2 || i === 3 ? "text-right" : "text-left"}`}>
                      <span className="inline-flex items-center gap-1">
                        {h}
                        {h === "Progression" && <InfoTip label="Who runs progression">Who progresses this agency&rsquo;s sales: Self (the agency itself), TSP (our team, outsourced), Mixed (both), or the progression business managing them.</InfoTip>}
                        {h === "Use · 7d" && <InfoTip label="What Use shows">Engaged hours, sign-ins and distinct files touched across the agency&rsquo;s agents in the last 7 days.</InfoTip>}
                        {h === "Setup" && <InfoTip label="What Setup means">The six scored setup signals: sender, DNS, signature, photo, logo, branding. The full breakdown and every fix-it action is on the Agency File.</InfoTip>}
                        {h === "Auto" && <InfoTip label="What Auto counts">How many of the six automation switches are on: the three chase streams, the weekly client update, and the two WhatsApp switches. Flip them in bulk on the Controls tab, or per agency on its Agency File.</InfoTip>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rosterRows.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-neutral-500">{q || statusFilter || onlySetupGaps || scoped ? "No agencies match this filter." : "No agencies yet."}</td></tr>
                ) : (
                  rosterRows.map((r) => (
                    <tr key={r.id} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-950/40 transition-colors">
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <Link href={`/command/agency/${r.id}`} className="font-semibold text-neutral-100 hover:text-blue-300 transition-colors">
                          {r.name}
                        </Link>
                        <Link href={qsWith({ tab: "agents", q: r.name })} className="ml-2 text-[11px] text-neutral-600 hover:text-blue-300 transition-colors font-normal">
                          agents
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {r.managedBy ? (
                          <ManagedByTag businessName={r.managedBy} />
                        ) : (
                          <span className="text-[11.5px] text-neutral-400">{r.progression}</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200 whitespace-nowrap">
                        {r.agentCount}
                        <span className="text-neutral-600"> · {r.activeCount} active</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200 whitespace-nowrap">
                        {fmtDuration(r.seconds7d)}
                        <span className="text-neutral-600"> · {r.logins7d} logins · {r.filesTouched7d} files</span>
                      </td>
                      <td className="px-3.5 py-2.5"><DeviceSplit mobile={r.deviceMobile} desktop={r.deviceDesktop} /></td>
                      <td className="px-3.5 py-2.5 text-neutral-400 whitespace-nowrap">{fmtRelative(r.lastActive)}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {r.setup ? (
                          <span className="inline-flex items-center gap-1.5">
                            <ReadinessPill level={r.setup.level} />
                            <span className="text-[11px] font-mono text-neutral-600">{r.setup.doneCount}/{r.setup.totalSignals}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5"><FeeChip tier={r.feeTier} legacyPence={r.legacyPence} /></td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className={`text-[11.5px] tabular-nums ${r.autoOn === AUTO_KEYS.length ? "text-emerald-400" : r.autoOn === 0 ? "text-neutral-600" : "text-neutral-300"}`}>
                          {r.autoOn}/{AUTO_KEYS.length} on
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5"><StatusPill status={r.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-neutral-600">
            Active = activity in the last 7 days · Quiet = 7&ndash;14 days · Dormant = 14+ days · Never on = invited but never logged in.
            Fees: {feeStandard} on the sliding scale · {feeCounts.legacy} legacy fixed{feeCounts.free > 0 ? <> · {feeCounts.free} free</> : null}. Fee editing is on each Agency File.
          </p>
        </>
      )}

      {/* ── Agents table ── */}
      {tab === "agents" && (
        <>
          <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
            <table className="w-full border-collapse text-[13px] min-w-[720px]">
              <thead>
                <tr className="bg-neutral-950/60">
                  {["Agent", "Agency", "Last active", "Logins · 7d", "Hours · 7d", "Files", "Activity · 12wk", "Device", "Status", "Help"].map((h, i) => (
                    <th key={h} className={`text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold px-3.5 py-2.5 border-b border-neutral-800 whitespace-nowrap ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}>
                      <span className="inline-flex items-center gap-1">
                        {h}
                        {h === "Activity · 12wk" && <InfoTip label="What the sparkline shows">One bar per week for the last 12 weeks. Bar height is how many sessions that agent had that week.</InfoTip>}
                        {h === "Files" && <InfoTip label="What Files counts">Distinct files the agent touched in the last 7 days.</InfoTip>}
                        {h === "Device" && <InfoTip label="What Device shows">Split of the agent&rsquo;s file sessions by device over the last 12 weeks. Teal is mobile or tablet, blue is desktop. Sessions from before device tracking, or with no signal, aren&rsquo;t counted.</InfoTip>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentRows.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-neutral-500">{q || statusFilter || scoped ? "No agents match this filter." : "No agent activity yet."}</td></tr>
                ) : (
                  agentRows.map((a) => (
                    <tr key={a.userId} className="border-b border-neutral-800 last:border-b-0">
                      <td className="px-3.5 py-2.5">
                        <Link href={`/command/agencies/${a.userId}`} className="flex items-center gap-2.5 group">
                          {a.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.image} alt="" className="w-[26px] h-[26px] rounded-full object-cover shrink-0" style={{ objectPosition: `${a.imageFocusX}% ${a.imageFocusY}%` }} />
                          ) : (
                            <span className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-[10.5px] font-bold text-neutral-950" style={{ background: avColor(a.name) }}>{initials(a.name)}</span>
                          )}
                          <div>
                            <div className="font-semibold text-neutral-100 group-hover:text-blue-300 transition-colors">{a.name}</div>
                            <div className="text-[11px] text-neutral-500 capitalize">{a.role}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <Link href={`/command/agency/${a.agencyId}`} className="text-neutral-400 hover:text-blue-300 transition-colors">
                          {a.agencyName}
                        </Link>
                        {agencyBusinessMap.get(a.agencyId) && (
                          <span className="ml-1.5 inline-block align-middle"><ManagedByTag businessName={agencyBusinessMap.get(a.agencyId)!} /></span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-neutral-400 whitespace-nowrap">{fmtRelative(a.lastActive)}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{a.logins7d}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{fmtDuration(a.seconds7d)}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{a.filesTouched7d}</td>
                      <td className="px-3.5 py-2.5"><Sparkline weeks={a.weeks} /></td>
                      <td className="px-3.5 py-2.5"><DeviceSplit mobile={a.deviceMobile} desktop={a.deviceDesktop} /></td>
                      <td className="px-3.5 py-2.5"><StatusPill status={a.status} /></td>
                      <td className="px-3.5 py-2.5"><AgentHelpButton userId={a.userId} name={a.name} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-neutral-600">
            Active = activity in the last 7 days · Quiet = 7&ndash;14 days · Dormant = 14+ days · Never on = invited but never logged in. Hours and files come from the same engaged-time tracking as the Files tab; logins and last-active from the event log.
          </p>
        </>
      )}

      {/* ── Controls matrix ── */}
      {tab === "controls" && (
        <AgencyControlsMatrix
          agencies={controlsRows}
          chaseMasterOn={chaseSettings?.enabledByDefault ?? false}
          weeklyEligibleThisWeek={eligibleThisWeek}
        />
      )}
    </div>
  );
}
