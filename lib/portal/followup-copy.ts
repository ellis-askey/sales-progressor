// The follow-up email copy deck (pre-set templates, no live AI).
//
// Two axes:
//   - tone: "calm" (a gentle check-in) or "behind" (firmer, still polite, when
//     the step is genuinely overdue).
//   - repeat: first touch, or "following up" when a real prior email has been
//     sent (referenced by its date). The caller only passes a date when a filed
//     copy actually exists, so we never claim an email that wasn't sent.
//
// Light rotation (2 variants per shape) so a repeat is never word-for-word the
// same. Voice: plain, first-person plural ("we"), no em-dashes, no exclamations,
// no legal statements, no invented dates or figures. Greets the solicitor's
// handler by first name; every `{thing}` is a bare noun so it reads cleanly as
// "{thing} for {address}".

export type FollowupTone = "calm" | "behind";

export type FollowupDraftInput = {
  clientFirstName: string; // signs off
  solicitorFirstName: string; // greeted
  addressShort: string; // first line of the property address
  thing: string; // bare noun, e.g. "the searches"
  subject: string; // subject stem, e.g. "Searches"
  tone: FollowupTone;
  // The date of their last actually-sent email to this solicitor, or null for a
  // first touch. Only ever non-null when a filed copy exists.
  lastSentDate: Date | null;
  // Rotates the wording so repeats differ. Any integer.
  variant: number;
};

export type FollowupDraft = { subject: string; body: string };

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function pick(arr: string[], variant: number): string {
  return arr[((variant % arr.length) + arr.length) % arr.length];
}

export function buildFollowupDraft(input: FollowupDraftInput): FollowupDraft {
  const { clientFirstName, solicitorFirstName, addressShort, thing, subject, tone, lastSentDate, variant } = input;
  const greet = solicitorFirstName || "there";
  const sign = `Thanks,\n${clientFirstName}`;
  const following = lastSentDate !== null;
  const d = following ? fmtDate(lastSentDate as Date) : "";

  const subjectLine = following ? `${subject} for ${addressShort} (following up)` : `${subject} for ${addressShort}`;

  let body: string;

  if (!following && tone === "calm") {
    body = pick(
      [
        `Hi ${greet},\n\nI hope you are well. We just wanted to check in on ${thing} for ${addressShort}. Do you know roughly when we are likely to have an update? We just want to make sure everything is moving along and there isn't anything you need from us.\n\n${sign}`,
        `Hi ${greet},\n\nI hope you are well. We wanted to see where things are up to with ${thing} for ${addressShort}. Do you have a rough idea of timescales from here? If there is anything you need from us in the meantime, just let us know.\n\n${sign}`,
      ],
      variant,
    );
  } else if (!following && tone === "behind") {
    body = pick(
      [
        `Hi ${greet},\n\nI hope you are well. We wanted to check in on ${thing} for ${addressShort}, as we are keen to keep things moving. Could you let us know where things currently stand and what the next step is from here? If you have a rough idea of timescales as well, that would be really helpful.\n\n${sign}`,
        `Hi ${greet},\n\nWe just wanted to chase ${thing} for ${addressShort} and see where things are up to. Are you able to give us an idea of the current position and likely timescales from here? We are keen to keep things moving, so if there is anything you need from us, please let us know.\n\n${sign}`,
      ],
      variant,
    );
  } else if (following && tone === "calm") {
    body = pick(
      [
        `Hi ${greet},\n\nWe just wanted to follow up on our email from ${d} about ${thing} for ${addressShort}. Has there been any progress since then? It would be great if you could let us know where things currently stand and what sort of timescale we are looking at from here.\n\n${sign}`,
        `Hi ${greet},\n\nWe just wanted to follow up on ${thing} for ${addressShort} after our email on ${d}. Has there been any progress since then, and do you have a rough idea of timescales from here? If there is anything you need from us in the meantime, please let us know.\n\n${sign}`,
      ],
      variant,
    );
  } else {
    body = pick(
      [
        `Hi ${greet},\n\nWe just wanted to follow up again on our email from ${d} about ${thing} for ${addressShort}. Are you able to let us know where things currently stand and whether there has been any progress since then? An idea of the likely timescale from here would be really helpful.\n\n${sign}`,
        `Hi ${greet},\n\nWe are just chasing again on ${thing} for ${addressShort} following our email on ${d}. Could you let us know the current position and what sort of timescale we are looking at from here? If there is anything holding things up that we can help with from our side, please let us know.\n\n${sign}`,
      ],
      variant,
    );
  }

  return { subject: subjectLine, body };
}

// "Waiting on the other side" draft: a general status request to the client's
// OWN solicitor (who can chase the other side), rather than a step-specific
// chase. Two variations, rotated. No date reference (this isn't a follow-up to
// a prior email).
export function buildRequestUpdateDraft(input: {
  clientFirstName: string;
  solicitorFirstName: string;
  addressShort: string;
  variant: number;
}): FollowupDraft {
  const { clientFirstName, solicitorFirstName, addressShort, variant } = input;
  const greet = solicitorFirstName || "there";
  const sign = `Thanks,\n${clientFirstName}`;
  const body = pick(
    [
      `Hi ${greet},\n\nI hope you are well. We just wanted to check in on where things are up to with ${addressShort}. We understand things may be with the other side at the moment. Have you had any update, and is there anything you are waiting on that we could help move along?\n\n${sign}`,
      `Hi ${greet},\n\nI hope you are well. We wanted to see if there is any update on ${addressShort}. Do you know where things currently stand, and is there anything outstanding from the other side that you are able to chase?\n\n${sign}`,
    ],
    variant,
  );
  return { subject: `Update on ${addressShort}`, body };
}
