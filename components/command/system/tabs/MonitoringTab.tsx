import { ParamTabs } from "@/components/command/ui/primitives";
import { StatusView } from "@/components/command/system/monitoring/StatusView";
import { ActivityView } from "@/components/command/system/monitoring/ActivityView";
import { AuditView } from "@/components/command/system/monitoring/AuditView";

// System workspace → Monitoring tab. Three secondary views (?view=):
//   • Status   — /command/health (background jobs + send failures + deploys)
//   • Activity — /command/activity (platform activity heatmap / feed)
//   • Audit    — /command/audit (admin-action audit log)
// Only the active view's loaders run (lazy). Each view's own filters are
// threaded through. Read-only diagnostics — no infra/logging behaviour touched.

const MON_VIEWS = [
  { key: "status", label: "Status" },
  { key: "activity", label: "Activity" },
  { key: "audit", label: "Audit" },
] as const;
type MonView = (typeof MON_VIEWS)[number]["key"];

export async function MonitoringTab({
  view,
  mode, agency, who, sort,
  action, target, admin, from, to, page,
}: {
  view?: string;
  mode?: string; agency?: string; who?: string; sort?: string;
  action?: string; target?: string; admin?: string; from?: string; to?: string; page?: string;
}) {
  const active: MonView = (MON_VIEWS.some((v) => v.key === view) ? view : "status") as MonView;
  const hrefFor = (v: string) => `/command/system?tab=monitoring&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...MON_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "status" && <StatusView />}
      {active === "activity" && <ActivityView mode={mode} agency={agency} who={who} sort={sort} />}
      {active === "audit" && <AuditView action={action} target={target} admin={admin} from={from} to={to} page={page} />}
    </div>
  );
}
