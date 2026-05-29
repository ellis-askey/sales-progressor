// Field + email assembly. Filters Sections by `when`, joins surviving
// texts. Returns flat strings — existing `{var}` interpolation in
// lib/services/portal.ts:915 runs on these outputs unchanged.

import type { Section, FileShape, RecipientEmailSkeleton } from "./types";
import { matches } from "./matches";

// ── assembleField — filter + join one field ─────────────────────────────
//
// Empty result is a real possibility (no section matched). Callers should
// validate fields they expect to be non-empty (subject, action). For
// optional fields (whatNext), empty just means "no paragraph rendered".
export function assembleField(
  sections: Section[],
  shape: FileShape,
  separator: string = "\n\n",
): string {
  return sections
    .filter((s) => !s.when || matches(s.when, shape))
    .map((s) => s.text)
    .join(separator);
}

// ── assembleEmail — render all five fields for one recipient ────────────
//
// Field-level separator conventions:
//   subject + opening + action — " " (typically one section each, but
//     supports conditional fragment joins like "Subject prefix" + "core").
//   whatHappened + whatNext — "\n\n" (each section is a paragraph;
//     paragraph breaks between conditional inserts).
//
// Returns the assembled-but-not-yet-interpolated strings. The send path
// then runs interpolate({address}, {First}, ...) over these as today.
export type AssembledEmail = {
  subject: string;
  heroLabel: string;
  opening: string;
  whatHappened: string;
  whatNext: string;       // empty string when skeleton.whatNext is undefined
  action: string;
};

export function assembleEmail(
  skeleton: RecipientEmailSkeleton,
  shape: FileShape,
): AssembledEmail {
  return {
    subject:       assembleField(skeleton.subject,      shape, " "),
    heroLabel:     assembleField(skeleton.heroLabel,    shape, " "),
    opening:       assembleField(skeleton.opening,      shape, " "),
    whatHappened:  assembleField(skeleton.whatHappened, shape, "\n\n"),
    whatNext:      skeleton.whatNext
                     ? assembleField(skeleton.whatNext, shape, "\n\n")
                     : "",
    action:        assembleField(skeleton.action,       shape, " "),
  };
}

// ── interpolate (mirrors the existing helper) ────────────────────────────
//
// Duplicated from lib/services/portal.ts:915 so the snapshot tool can
// render full bodies without depending on the send-path module (which
// pulls in prisma and other server-only deps). When the assembler is
// integrated into the live send path, the existing interpolate function
// is reused — this is just a snapshot-time mirror.
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
