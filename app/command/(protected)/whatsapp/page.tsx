import { getWhatsAppConnectionStatus, getUnmatchedChats, type WhatsAppConnectionStatus } from "@/lib/command/whatsapp";
import { WhatsAppAssign } from "@/components/command/WhatsAppAssign";

// Command Centre → WhatsApp. Bridge connection status + the queue of
// conversations waiting to be assigned to a property.

export const dynamic = "force-dynamic";

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  });
}

export default async function WhatsAppCommandPage() {
  const [status, chats] = await Promise.all([getWhatsAppConnectionStatus(), getUnmatchedChats()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">WhatsApp</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Bridge connection, and conversations waiting to be assigned to a property. Assigning a chat
          moves every held message onto the file and links all future messages automatically.
        </p>
      </div>

      <ConnectionCard status={status} />

      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">
          Needs assigning <span className="text-neutral-600">({chats.length})</span>
        </h2>
        {chats.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-6 text-center text-[13px] text-neutral-500">
            Nothing waiting. Every conversation is linked to a property.
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((c) => (
              <WhatsAppAssign key={c.waChatId} chat={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionCard({ status }: { status: WhatsAppConnectionStatus }) {
  if (!status.configured) {
    return (
      <div className="bg-neutral-900 border border-[#5a3f2c] rounded-xl px-4 py-3 text-[13px] text-[#f6b17a]">
        Bridge not configured — set <code className="text-neutral-300">WHATSAPP_BRIDGE_URL</code> and{" "}
        <code className="text-neutral-300">WHATSAPP_BRIDGE_SECRET</code> in the environment.
      </div>
    );
  }
  if (!status.reachable) {
    return (
      <div className="bg-neutral-900 border border-[#5a2c2c] rounded-xl px-4 py-3 text-[13px] text-[#f8a4a4]">
        Bridge not responding. Check the Railway service is running.
      </div>
    );
  }
  const open = status.connection === "open";
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${open ? "bg-[#6ee7b7]" : "bg-[#f6b17a]"}`} />
          <span className="text-[14px] font-medium text-neutral-100">
            {open ? "Connected" : `Not connected (${status.connection ?? "unknown"})`}
          </span>
          {status.phoneNumber && <span className="text-[13px] text-neutral-500">{status.phoneNumber}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-neutral-500">Last message: {fmtWhen(status.lastMessageAt)}</span>
          {status.pairUrl && (
            <a href={status.pairUrl} target="_blank" rel="noreferrer"
              className="text-[12px] px-2.5 py-1 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800/60 transition-colors">
              {open ? "Re-pair" : "Pair / scan QR"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
