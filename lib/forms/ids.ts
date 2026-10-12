// ID helpers for Boardwalk Forms. Kept dependency-free and isomorphic — the
// builder mints question/choice ids client-side so new questions appear
// instantly, and the server mints publicIds.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomString(length: number): string {
  let out = "";
  if (typeof globalThis.crypto !== "undefined" && "getRandomValues" in globalThis.crypto) {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  } else {
    for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Public form URL slug: 10 chars of [a-z0-9] ≈ 52 bits — unguessable in practice. */
export function newPublicId(): string {
  return randomString(10);
}

/** Question / choice / rule ids: short, unique within one form document. */
export function newEntityId(prefix: string): string {
  return `${prefix}_${randomString(8)}`;
}
