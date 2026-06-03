// Contact-dedupe helpers used by every surface that creates or mutates
// Contact rows on a transaction. Pure functions, no DB, shared between
// server actions and the new-sale client form.
//
// Rule: two contacts on the same transaction may not share a phone OR an
// email. Blank values do not count as duplicates of each other (two
// contacts with no phone is fine).
//
// Canonical forms (the dedupe key):
//   phone: strip every non-digit character, collapse +44 / 0044 to a
//          leading 0. "07700 900 123", "+44 7700 900123", "07700900123"
//          all become "07700900123".
//   email: trim + lowercase. No dot-normalisation, no plus-aliasing —
//          those would silently merge legitimately distinct addresses on
//          some providers.

export type ContactLike = {
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type ContactConflict = {
  kind: "phone" | "email";
  withName: string; // the OTHER contact (the one that already has the value)
};

export type ContactConflictAt = ContactConflict & {
  offenderIndex: number; // position in the input list of the second occurrence
};

export function phoneToCanonicalDigits(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Keep digits and a leading "+" (so we can detect +44 / 0044 prefixes).
  let s = trimmed.replace(/[^\d+]/g, "");
  if (s.startsWith("+44")) s = "0" + s.slice(3);
  else if (s.startsWith("0044")) s = "0" + s.slice(4);
  // Strip any remaining "+" — canonical form is digits only.
  s = s.replace(/\+/g, "");
  return s.length > 0 ? s : null;
}

export function emailToCanonical(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

// Returns the first conflict found between `candidate` and any row in
// `others`. Phone is checked before email, so a phone-and-email double
// duplicate reports the phone conflict (single most-actionable cue).
export function findContactConflict(
  candidate: ContactLike,
  others: ContactLike[],
): ContactConflict | null {
  const candPhone = phoneToCanonicalDigits(candidate.phone);
  const candEmail = emailToCanonical(candidate.email);
  if (!candPhone && !candEmail) return null;

  for (const other of others) {
    if (candPhone) {
      const otherPhone = phoneToCanonicalDigits(other.phone);
      if (otherPhone && otherPhone === candPhone) {
        return { kind: "phone", withName: other.name };
      }
    }
    if (candEmail) {
      const otherEmail = emailToCanonical(other.email);
      if (otherEmail && otherEmail === candEmail) {
        return { kind: "email", withName: other.name };
      }
    }
  }
  return null;
}

// Used by createTransactionAction (server) to flag the first pairwise
// conflict inside the contacts batch. Walks left-to-right so the
// offenderIndex always points at the second occurrence — the one the
// agent typed most recently and is most likely to want to fix.
export function findFirstPairwiseConflict(
  contacts: ContactLike[],
): ContactConflictAt | null {
  for (let i = 0; i < contacts.length; i += 1) {
    const conflict = findContactConflict(contacts[i], contacts.slice(0, i));
    if (conflict) {
      return {
        kind: conflict.kind,
        withName: conflict.withName,
        offenderIndex: i,
      };
    }
  }
  return null;
}

// Used by the new-sale client form for the live inline signal. Returns a
// map keyed by the SECOND occurrence's index so each card knows whether
// it conflicts with an earlier one and which one.
export function mapPairwiseConflicts(
  contacts: ContactLike[],
): Record<number, ContactConflict> {
  const out: Record<number, ContactConflict> = {};
  for (let i = 0; i < contacts.length; i += 1) {
    const conflict = findContactConflict(contacts[i], contacts.slice(0, i));
    if (conflict) out[i] = conflict;
  }
  return out;
}
