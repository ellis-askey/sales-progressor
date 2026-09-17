// Pure pre-filter for the WhatsApp promise scanner (no prisma/AI imports, so it's
// unit-testable in isolation). Only messages that plausibly contain a first-person
// future commitment get an AI read; everything else is stamped and skipped for
// free. This only GATES the (cheap) AI read — the model still makes the real
// judgement — so being generous on phrasing just costs an occasional extra read.
//
// Covers: "I'll / I will / I shall / I'm going to / I plan to / I intend to /
// let me / leave it with me", plus a "will|shall <action verb>" form ("shall
// speak", "will chase"). "shall" was a genuine blind spot — polite UK phrasing
// like "I shall speak with the solicitor first thing" was skipped entirely.
export const PROMISE_HINT =
  /\b(i'?ll|i will|i shall|i'?m going to|i am going to|i plan to|i intend to|let me|leave it with me|(?:will|shall) (?:chase|call|email|follow|check|come back|do it|get|sort|look|speak|ring|update|send|note|nudge|report))\b/i;
