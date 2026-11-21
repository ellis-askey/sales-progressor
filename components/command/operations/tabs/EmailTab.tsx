import { ParamTabs } from "@/components/command/ui/primitives";
import { SendersView } from "@/components/command/operations/email/SendersView";
import { AgentEmailsView } from "@/components/command/operations/email/AgentEmailsView";
import { ThreadingView } from "@/components/command/operations/email/ThreadingView";

// Operations workspace → Email tab. Three secondary views (?view=):
//   • Senders   — /command/email-senders (sender resolution + domain auth).
//   • Agents    — /command/agent-emails (emails sent to agency users).
//   • Threading — /command/email-threading (Outlook native-reply diagnostic).
// Only the active view's loaders run (lazy). Agent-emails' params (incl. the
// kind selector, renamed from ?tab= to ?kind=) are threaded through. No sender
// authentication / transport logic touched.

const EMAIL_VIEWS = [
  { key: "senders", label: "Senders" },
  { key: "agents", label: "Agent emails" },
  { key: "threading", label: "Threading" },
] as const;
type EmailView = (typeof EMAIL_VIEWS)[number]["key"];

export async function EmailTab({
  view,
  mode, agency, kind, rec, cursor,
}: {
  view?: string;
  mode?: string; agency?: string; kind?: string; rec?: string; cursor?: string;
}) {
  const active: EmailView = (EMAIL_VIEWS.some((v) => v.key === view) ? view : "senders") as EmailView;
  const hrefFor = (v: string) => `/command/operations?tab=email&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...EMAIL_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "senders" && <SendersView />}
      {active === "agents" && <AgentEmailsView mode={mode} agency={agency} kind={kind} rec={rec} cursor={cursor} />}
      {active === "threading" && <ThreadingView />}
    </div>
  );
}
