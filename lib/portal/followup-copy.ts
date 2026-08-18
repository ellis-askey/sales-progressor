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
// same. Voice: plain, first-person, no em-dashes, no exclamations, no legal
// statements, no invented dates or figures.

export type FollowupTone = "calm" | "behind";

export type FollowupDraftInput = {
  firstName: string; // the client, who signs off
  addressShort: string; // first line of the property address
  thing: string; // e.g. "the property searches"
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

function pick<T>(arr: T[], variant: number): T {
  return arr[((variant % arr.length) + arr.length) % arr.length];
}

export function buildFollowupDraft(input: FollowupDraftInput): FollowupDraft {
  const { firstName, addressShort, thing, subject, tone, lastSentDate, variant } = input;
  const sign = `Thanks,\n${firstName}`;
  const following = lastSentDate !== null;

  const subjectLine = following
    ? `${subject} for ${addressShort} (following up)`
    : `${subject} for ${addressShort}`;

  let body: string;

  if (!following && tone === "calm") {
    body = pick(
      [
        `Hi,\n\nJust checking in on ${thing} for ${addressShort}. Is there any update, and a rough idea of timing?\n\n${sign}`,
        `Hi,\n\nHope you are well. Could you let me know where things stand with ${thing} for ${addressShort}, and roughly when to expect it?\n\n${sign}`,
      ],
      variant,
    );
  } else if (!following && tone === "behind") {
    body = pick(
      [
        `Hi,\n\nI am keen to keep things moving on ${thing} for ${addressShort}. Are you able to let me know where it is at, and when it is likely to be sorted?\n\n${sign}`,
        `Hi,\n\nCould I get an update on ${thing} for ${addressShort}? I would really like to keep this moving, so anything you can tell me on timing would help.\n\n${sign}`,
      ],
      variant,
    );
  } else if (following && tone === "calm") {
    const d = fmtDate(lastSentDate as Date);
    body = pick(
      [
        `Hi,\n\nFollowing up on my email from ${d} about ${thing} for ${addressShort}. Are you able to let me know where things stand, and when you would expect it to be sorted?\n\n${sign}`,
        `Hi,\n\nJust circling back on ${thing} for ${addressShort} after my email on ${d}. Any update on progress or timing would be great.\n\n${sign}`,
      ],
      variant,
    );
  } else {
    const d = fmtDate(lastSentDate as Date);
    body = pick(
      [
        `Hi,\n\nFollowing up again on my email from ${d} about ${thing} for ${addressShort}. I am keen to keep things moving, so any update on where it is at and likely timing would be a big help.\n\n${sign}`,
        `Hi,\n\nI wrote on ${d} about ${thing} for ${addressShort} and wanted to follow up, as I am keen not to let this slip. Could you let me know the current position and when it is likely to be done?\n\n${sign}`,
      ],
      variant,
    );
  }

  return { subject: subjectLine, body };
}
