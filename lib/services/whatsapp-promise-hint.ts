// Pure helpers for the WhatsApp promise scanner (no prisma/AI imports, so they
// are unit-testable in isolation).
//
// Intention rebuild (founder-approved 2026-10-19): the old PROMISE_HINT phrase
// gate is gone — "surely it's not the phrasing, it's the intention". Every sent
// message now gets the AI read EXCEPT the obviously pointless (emoji-only,
// pleasantries, media placeholders). The model judges intention; these helpers
// only skim off messages that cannot possibly contain a commitment, and redact
// third-party context before it reaches the model (privacy option B — mirrors
// the technique in lib/chase/voice-profile.ts redactPairs).

// Messages that cannot contain a commitment: too short to say anything, no
// letters at all (emoji/punctuation), a bare media placeholder, or pure
// pleasantries. Deliberately NOT skipped: short affirmatives ("ok", "yep",
// "will do") — with conversation context those are often real commitments.
const PLEASANTRIES =
  /^(thanks?|thank you( so much| both)?|ta|cheers|much appreciated|great|perfect|lovely|brill(iant)?|amazing|fantastic|nice one|good stuff|no worries|no problem|haha+|lol|morning|afternoon|evening|hi|hello|hey)$/i;

export function isWorthReading(raw: string | null | undefined): boolean {
  const text = (raw ?? "").trim();
  if (text.length < 2) return false;
  if (!/\p{L}/u.test(text)) return false; // no letters: emoji / punctuation only
  if (/^\[(image|video|audio|document|sticker|media|voice note)\]$/i.test(text)) return false;
  const bare = text.replace(/[\s!.…🙏👍🙌😊😁🤣❤️x]+$/giu, "").trim();
  if (PLEASANTRIES.test(bare)) return false;
  return true;
}

// ── Redaction (privacy option B) ────────────────────────────────────────────
// Client/third-party context messages are redacted before the AI sees them:
// the sale's address segments and every participant name are replaced with
// [redacted], plus anything phone- or email-shaped. The sender's OWN message is
// never redacted (they consented when linking). Longest-first replacement so
// "Smith & Co" goes before "Smith".

export function buildRedactionTokens(input: {
  propertyAddress?: string | null;
  names?: Array<string | null | undefined>;
}): string[] {
  const raw: string[] = [];
  if (input.propertyAddress) {
    raw.push(input.propertyAddress);
    for (const seg of input.propertyAddress.split(",")) raw.push(seg.trim());
  }
  for (const n of input.names ?? []) {
    if (!n) continue;
    raw.push(n);
    for (const w of n.split(/\s+/)) raw.push(w);
  }
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const t of raw) {
    const v = t.trim();
    // Short/stopword-ish tokens would shred ordinary prose ("of", "the", "Mr").
    if (v.length < 3) continue;
    if (/^(the|and|of|mr|mrs|ms|miss|dr)$/i.test(v)) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(v);
  }
  return tokens.sort((a, b) => b.length - a.length);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function redactForAi(text: string, tokens: string[]): string {
  let out = text;
  for (const tok of tokens) {
    out = out.replace(new RegExp(escapeRegExp(tok), "gi"), "[redacted]");
  }
  // Phone-shaped digit runs and emails, regardless of token list.
  out = out.replace(/\+?\d[\d\s()-]{6,}\d/g, "[redacted]");
  out = out.replace(/\S+@\S+\.\S+/g, "[redacted]");
  return out;
}
