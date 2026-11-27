import { ParamTabs } from "@/components/command/ui/primitives";
import { AttentionTab } from "@/components/command/operations/tabs/AttentionTab";
import { FilesTab } from "@/components/command/operations/tabs/FilesTab";
import { MessagingTab } from "@/components/command/operations/tabs/MessagingTab";
import { EmailTab } from "@/components/command/operations/tabs/EmailTab";
import { RequestsTab } from "@/components/command/operations/tabs/RequestsTab";

// Operations workspace (Command Centre consolidation). The eight Operations
// landing pages become four tabs with secondary views:
//   • Files      — /command/files (the ?tx= operational FilePanel lives here)
//   • Messaging  — Messages (/command/outbound) + WhatsApp (/command/whatsapp)
//   • Email      — Senders (/command/email-senders) + Agent emails
//                  (/command/agent-emails) + Threading (/command/email-threading)
//   • Requests   — Proposed updates (/command/proposals) + CRM requests
//                  (/command/crm-requests)
// Legacy routes redirect here (lib/operations-redirects.ts). Only the active
// tab + active secondary view's loaders run (`active === key &&`), so no extra
// queries vs the old pages, no new external calls. Message delivery, WhatsApp
// integrations, email threading/transport and sender auth are untouched — this
// only relocates the UI.
//
// The agent-emails kind selector moved from ?tab= to ?kind= (the workspace owns
// ?tab=). tab is coerced from a possible array (defence-in-depth against a
// forwarded legacy ?tab=), so a stray legacy param can never flip the workspace
// tab.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the Files tab does a storage listing + several reads

const TABS = [
  { key: "files", label: "Files" },
  { key: "attention", label: "Attention" },
  { key: "messaging", label: "Messaging" },
  { key: "email", label: "Email" },
  { key: "requests", label: "Requests" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function OperationsWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[]; view?: string;
    // files
    q?: string; tx?: string; status?: string; att?: string; managed?: string; created?: string;
    // messaging (messages) + email (agents) scope + filters
    mode?: string; agency?: string; ch?: string; st?: string; ai?: string;
    from?: string; to?: string; rec?: string; cursor?: string; pending?: string; kind?: string;
    // attention (operational signal queue)
    sev?: string; ack?: string;
  }>;
}) {
  const sp = await searchParams;
  const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active: Tab = (TABS.some((t) => t.key === rawTab) ? rawTab : "files") as Tab;

  // Preserve the comms scope (mode/agency) across tab switches; tab-specific
  // filters are not carried between tabs.
  const scope = new URLSearchParams();
  if (sp.mode) scope.set("mode", sp.mode);
  if (sp.agency) scope.set("agency", sp.agency);
  const scopeQs = scope.toString();
  const hrefFor = (key: string) => `/command/operations?tab=${key}${scopeQs ? `&${scopeQs}` : ""}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Operations</h1>
      <ParamTabs options={[...TABS]} active={active} hrefFor={hrefFor} />

      {active === "files" && (
        <FilesTab q={sp.q} tx={sp.tx} status={sp.status} att={sp.att} managed={sp.managed} created={sp.created} />
      )}
      {active === "attention" && <AttentionTab sev={sp.sev} ack={sp.ack} />}
      {active === "messaging" && (
        <MessagingTab
          view={sp.view}
          mode={sp.mode} agency={sp.agency} ch={sp.ch} st={sp.st} ai={sp.ai}
          from={sp.from} to={sp.to} rec={sp.rec} q={sp.q} cursor={sp.cursor} pending={sp.pending}
        />
      )}
      {active === "email" && (
        <EmailTab view={sp.view} mode={sp.mode} agency={sp.agency} kind={sp.kind} rec={sp.rec} cursor={sp.cursor} />
      )}
      {active === "requests" && <RequestsTab view={sp.view} />}
    </div>
  );
}
