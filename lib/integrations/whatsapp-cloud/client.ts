import "server-only";
// Cloud API send client. Phase 1: free-form text only (enough to prove the
// pipe end-to-end); templates/media land with Phases 4-5. A successful return
// means Meta ACCEPTED the message — delivery truth arrives later via status
// webhooks (REBUILD_PLAN §C1 principle 2: nothing says "sent" on faith).

import { graphBase } from "./config";
import { resolveAccessToken } from "./accounts";

export type CloudSendResult =
  | { ok: true; wamid: string }
  | { ok: false; errorCode: number | null; error: string };

// Meta error payload shape (subset).
type GraphError = { error?: { code?: number; message?: string; error_data?: { details?: string } } };

// Friendly translations for the error codes the send path must expect
// (REBUILD_PLAN §B1). Everything else surfaces Meta's own message.
function friendlySendError(code: number | null, raw: string): string {
  if (code === 131047)
    return "The 24-hour reply window for this person has closed, so a free-form message can't be sent. A template message is needed to re-open the conversation.";
  if (code === 131026) return "This number can't receive WhatsApp messages (no WhatsApp account, or an outdated app).";
  if (code === 131056) return "Too many messages to this person in a short burst. Wait a moment and try again.";
  if (code === 190) return "The WhatsApp access token has expired or been revoked. Generate a fresh token and update the environment.";
  if (code === 100) return `WhatsApp rejected the request as invalid: ${raw}`;
  return raw;
}

export async function sendCloudText(args: {
  phoneNumberId: string;
  to: string; // E.164, with or without +
  body: string;
}): Promise<CloudSendResult> {
  const token = await resolveAccessToken(args.phoneNumberId);
  if (!token) return { ok: false, errorCode: null, error: "WhatsApp Cloud API is not configured." };

  const to = args.to.replace(/[^0-9]/g, "");
  if (!to) return { ok: false, errorCode: null, error: "No valid recipient number." };

  let res: Response;
  try {
    res = await fetch(`${graphBase()}/${args.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: args.body },
      }),
    });
  } catch {
    return { ok: false, errorCode: null, error: "Couldn't reach WhatsApp. Try again in a moment." };
  }

  const json = (await res.json().catch(() => ({}))) as GraphError & { messages?: Array<{ id?: string }> };
  if (!res.ok) {
    const code = json.error?.code ?? null;
    const raw = [json.error?.message, json.error?.error_data?.details].filter(Boolean).join(" — ") || `HTTP ${res.status}`;
    return { ok: false, errorCode: code, error: friendlySendError(code, raw) };
  }
  const wamid = json.messages?.[0]?.id;
  if (!wamid) return { ok: false, errorCode: null, error: "WhatsApp accepted the request but returned no message id." };
  return { ok: true, wamid };
}
