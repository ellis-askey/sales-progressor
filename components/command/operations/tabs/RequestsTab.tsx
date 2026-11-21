import { ParamTabs } from "@/components/command/ui/primitives";
import { ProposalsView } from "@/components/command/operations/requests/ProposalsView";
import { CrmView } from "@/components/command/operations/requests/CrmView";

// Operations workspace → Requests tab. Two secondary views (?view=):
//   • Proposals — /command/proposals (AI-proposal review inbox; approve/dismiss
//                 run their existing actions — unchanged).
//   • CRM       — /command/crm-requests (CRM-connection demand league table).
// Only the active view's loaders run (lazy). Neither takes params.

const REQ_VIEWS = [
  { key: "proposals", label: "Proposed updates" },
  { key: "crm", label: "CRM requests" },
] as const;
type ReqView = (typeof REQ_VIEWS)[number]["key"];

export async function RequestsTab({ view }: { view?: string }) {
  const active: ReqView = (REQ_VIEWS.some((v) => v.key === view) ? view : "proposals") as ReqView;
  const hrefFor = (v: string) => `/command/operations?tab=requests&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...REQ_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "proposals" && <ProposalsView />}
      {active === "crm" && <CrmView />}
    </div>
  );
}
