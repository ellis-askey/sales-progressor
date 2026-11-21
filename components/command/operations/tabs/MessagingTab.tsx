import { ParamTabs } from "@/components/command/ui/primitives";
import { MessagesView } from "@/components/command/operations/messaging/MessagesView";
import { WhatsAppView } from "@/components/command/operations/messaging/WhatsAppView";

// Operations workspace → Messaging tab. Two secondary views (?view=):
//   • Messages — /command/outbound (the outbound-message log).
//   • WhatsApp — /command/whatsapp (bridge status + conversation queues).
// Only the active view's loaders run (lazy). Messages' filter params are threaded
// through; WhatsApp takes none. No message delivery / integration logic touched.

const MSG_VIEWS = [
  { key: "messages", label: "Messages" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;
type MsgView = (typeof MSG_VIEWS)[number]["key"];

export async function MessagingTab({
  view,
  mode, agency, ch, st, ai, from, to, rec, q, cursor, pending,
}: {
  view?: string;
  mode?: string; agency?: string; ch?: string; st?: string; ai?: string;
  from?: string; to?: string; rec?: string; q?: string; cursor?: string; pending?: string;
}) {
  const active: MsgView = (MSG_VIEWS.some((v) => v.key === view) ? view : "messages") as MsgView;
  const hrefFor = (v: string) => `/command/operations?tab=messaging&view=${v}`;

  return (
    <div className="space-y-6">
      <ParamTabs options={[...MSG_VIEWS]} active={active} hrefFor={hrefFor} />
      {active === "messages" && (
        <MessagesView mode={mode} agency={agency} ch={ch} st={st} ai={ai} from={from} to={to} rec={rec} q={q} cursor={cursor} pending={pending} />
      )}
      {active === "whatsapp" && <WhatsAppView />}
    </div>
  );
}
