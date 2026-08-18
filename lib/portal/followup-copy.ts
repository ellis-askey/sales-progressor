// The follow-up email copy deck (pre-set templates, no live AI).
//
// Axes:
//   - tone: "calm" (a gentle check-in) or "behind" (firmer, still polite).
//   - repeat: first touch, or "following up" when a real prior email has been
//     sent (referenced by its date). The caller only passes a date when a filed
//     copy actually exists, so we never claim an email that wasn't sent.
//   - multi: 2+ clients on this side → "we / us / our", else "I / me / my".
//
// Light rotation (2 variants per shape) so a repeat is never word-for-word the
// same. Voice: plain, no em-dashes, no exclamations, no legal statements, no
// invented dates or figures. Greets the solicitor's handler by first name;
// every `{thing}` is a bare noun so it reads cleanly as "{thing} for {address}".

export type FollowupTone = "calm" | "behind";

type Pron = { Sub: string; sub: string; obj: string; pos: string; be: string };
function pronouns(multi: boolean): Pron {
  return multi
    ? { Sub: "We", sub: "we", obj: "us", pos: "our", be: "are" }
    : { Sub: "I", sub: "I", obj: "me", pos: "my", be: "am" };
}

export type FollowupDraftInput = {
  clientFirstName: string; // signs off
  solicitorFirstName: string; // greeted
  addressShort: string; // first line of the property address
  thing: string; // bare noun, e.g. "the searches"
  subject: string; // subject stem, e.g. "Searches"
  tone: FollowupTone;
  lastSentDate: Date | null; // non-null only when a filed sent copy exists
  variant: number; // rotates the wording
  multi: boolean; // 2+ clients on this side
};

export type FollowupDraft = { subject: string; body: string };

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function pick(arr: string[], variant: number): string {
  return arr[((variant % arr.length) + arr.length) % arr.length];
}

export function buildFollowupDraft(input: FollowupDraftInput): FollowupDraft {
  const { clientFirstName, solicitorFirstName, addressShort, thing, subject, tone, lastSentDate, variant, multi } = input;
  const greet = solicitorFirstName || "there";
  const sign = `Thanks,\n${clientFirstName}`;
  const following = lastSentDate !== null;
  const d = following ? fmtDate(lastSentDate as Date) : "";
  const { Sub, sub, obj, pos, be } = pronouns(multi);

  const subjectLine = following ? `${subject} for ${addressShort} (following up)` : `${subject} for ${addressShort}`;

  let body: string;

  if (!following && tone === "calm") {
    body = pick(
      [
        `Hi ${greet},\n\n${Sub} hope you are well. ${Sub} just wanted to check in on ${thing} for ${addressShort}. Do you know roughly when ${sub} ${be} likely to have an update? ${Sub} just want to make sure everything is moving along and there isn't anything you need from ${obj}.\n\n${sign}`,
        `Hi ${greet},\n\n${Sub} hope you are well. ${Sub} wanted to see where things are up to with ${thing} for ${addressShort}. Do you have a rough idea of timescales from here? If there is anything you need from ${obj} in the meantime, just let ${obj} know.\n\n${sign}`,
      ],
      variant,
    );
  } else if (!following && tone === "behind") {
    body = pick(
      [
        `Hi ${greet},\n\n${Sub} hope you are well. ${Sub} wanted to check in on ${thing} for ${addressShort}, as ${sub} ${be} keen to keep things moving. Could you let ${obj} know where things currently stand and what the next step is from here? If you have a rough idea of timescales as well, that would be really helpful.\n\n${sign}`,
        `Hi ${greet},\n\n${Sub} just wanted to chase ${thing} for ${addressShort} and see where things are up to. Are you able to give ${obj} an idea of the current position and likely timescales from here? ${Sub} ${be} keen to keep things moving, so if there is anything you need from ${obj}, please let ${obj} know.\n\n${sign}`,
      ],
      variant,
    );
  } else if (following && tone === "calm") {
    body = pick(
      [
        `Hi ${greet},\n\n${Sub} just wanted to follow up on ${pos} email from ${d} about ${thing} for ${addressShort}. Has there been any progress since then? It would be great if you could let ${obj} know where things currently stand and what sort of timescale ${sub} ${be} looking at from here.\n\n${sign}`,
        `Hi ${greet},\n\n${Sub} just wanted to follow up on ${thing} for ${addressShort} after ${pos} email on ${d}. Has there been any progress since then, and do you have a rough idea of timescales from here? If there is anything you need from ${obj} in the meantime, please let ${obj} know.\n\n${sign}`,
      ],
      variant,
    );
  } else {
    body = pick(
      [
        `Hi ${greet},\n\n${Sub} just wanted to follow up again on ${pos} email from ${d} about ${thing} for ${addressShort}. Are you able to let ${obj} know where things currently stand and whether there has been any progress since then? An idea of the likely timescale from here would be really helpful.\n\n${sign}`,
        `Hi ${greet},\n\n${Sub} ${be} just chasing again on ${thing} for ${addressShort} following ${pos} email on ${d}. Could you let ${obj} know the current position and what sort of timescale ${sub} ${be} looking at from here? If there is anything holding things up that ${sub} can help with from ${pos} side, please let ${obj} know.\n\n${sign}`,
      ],
      variant,
    );
  }

  return { subject: subjectLine, body };
}

// "Waiting on the other side" draft: a general status request to the client's
// OWN solicitor (who can chase the other side). `otherSolicitor` is the other
// side's solicitor from this client's perspective ("the buyer's solicitor" for
// a seller, "the seller's solicitor" for a buyer). Two variations, rotated.
export function buildRequestUpdateDraft(input: {
  clientFirstName: string;
  solicitorFirstName: string;
  addressShort: string;
  otherSolicitor: string;
  variant: number;
  multi: boolean;
}): FollowupDraft {
  const { clientFirstName, solicitorFirstName, addressShort, otherSolicitor, variant, multi } = input;
  const greet = solicitorFirstName || "there";
  const sign = `Thanks,\n${clientFirstName}`;
  const { Sub, sub, be } = pronouns(multi);
  const body = pick(
    [
      `Hi ${greet},\n\n${Sub} hope you are well.\n\nJust checking in on ${addressShort} to see how things are going. Are you still waiting on anything from ${otherSolicitor}? If so, have they given you any idea of when you might hear back?\n\n${sign}`,
      `Hi ${greet},\n\n${Sub} hope you are well.\n\nAs far as ${sub} ${be} aware, things are with ${otherSolicitor} at the moment. ${Sub} just wanted to check in and see if you have heard anything further from them, or if there is anything you are still waiting on?\n\n${sign}`,
    ],
    variant,
  );
  return { subject: `Update on ${addressShort}`, body };
}
