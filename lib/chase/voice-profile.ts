// lib/chase/voice-profile.ts
//
// Chase voice learning. Once a progressor has edited enough AI-drafted chase
// messages before sending, we distil HOW they rewrite (their sign-offs, openers,
// favourite phrasing, length, formality) into a short, PII-free style profile and
// store it on the user. The chase generator injects that profile so future drafts
// already sound like them. If they send drafts unchanged, nothing is learned and
// nothing changes.
//
// The (draft, final) pairs already exist on OutboundMessage (generatedText =
// draft, content = final sent). We never add new capture; we only read, redact,
// distil, and store. The distil INPUT is redacted (address, names, firms stripped)
// and the stored/injected profile is style-only, so no client detail rides along
// on future generations.

import { prisma } from "@/lib/prisma";

// Build the profile once someone has edited this many AI chases; re-distil once
// they've accumulated this many more; learn from the most recent this-many pairs.
const EDIT_THRESHOLD = 5;
const REFRESH_EVERY = 3;
const MAX_PAIRS = 12;
const CANDIDATE_FETCH = 40;

const MODEL = "claude-haiku-4-5-20251001";

type Pair = { draft: string; final: string; transactionId: string | null };

// Recent AI-drafted chases this user actually EDITED before sending. Prisma can't
// compare two columns in a where, so we fetch recent AI candidates and filter.
async function getEditedChases(userId: string): Promise<Pair[]> {
  const rows = await prisma.outboundMessage.findMany({
    where: { createdById: userId, wasAiGenerated: true, generatedText: { not: null } },
    orderBy: { createdAt: "desc" },
    take: CANDIDATE_FETCH,
    select: { content: true, generatedText: true, transactionId: true },
  });
  return rows
    .filter((r) => r.generatedText != null && r.content.trim() !== r.generatedText.trim())
    .map((r) => ({ draft: r.generatedText as string, final: r.content, transactionId: r.transactionId }));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strip the property address, client/solicitor names and firm names out of the
// pairs before they go anywhere near the model. Imperfect but removes the obvious
// PII; the distil prompt also forbids reproducing anything redacted.
async function redactPairs(pairs: Pair[]): Promise<Array<{ draft: string; final: string }>> {
  const txIds = [...new Set(pairs.map((p) => p.transactionId).filter((x): x is string => !!x))];
  const txs = txIds.length
    ? await prisma.propertyTransaction.findMany({
        where: { id: { in: txIds } },
        select: {
          id: true,
          propertyAddress: true,
          contacts: { select: { name: true } },
          vendorSolicitorContact: { select: { name: true } },
          purchaserSolicitorContact: { select: { name: true } },
          vendorSolicitorFirm: { select: { name: true } },
          purchaserSolicitorFirm: { select: { name: true } },
        },
      })
    : [];
  const tokensByTx = new Map<string, string[]>();
  for (const t of txs) {
    const raw: string[] = [];
    if (t.propertyAddress) {
      raw.push(t.propertyAddress);
      for (const seg of t.propertyAddress.split(",")) raw.push(seg.trim());
    }
    const names = [
      ...t.contacts.map((c) => c.name),
      t.vendorSolicitorContact?.name,
      t.purchaserSolicitorContact?.name,
      t.vendorSolicitorFirm?.name,
      t.purchaserSolicitorFirm?.name,
    ].filter((x): x is string => !!x);
    for (const n of names) {
      raw.push(n);
      for (const w of n.split(/\s+/)) raw.push(w); // first names, surnames, firm words
    }
    // De-dupe, keep tokens worth redacting, redact longest first so "Smith & Co"
    // goes before "Smith".
    const tokens = [...new Set(raw.map((s) => s.trim()).filter((s) => s.length >= 3))].sort(
      (a, b) => b.length - a.length,
    );
    tokensByTx.set(t.id, tokens);
  }

  const redactOne = (text: string, tokens: string[]): string => {
    let out = text;
    for (const tok of tokens) {
      out = out.replace(new RegExp(escapeRegExp(tok), "gi"), "[redacted]");
    }
    return out;
  };

  return pairs.map((p) => {
    const tokens = p.transactionId ? tokensByTx.get(p.transactionId) ?? [] : [];
    return { draft: redactOne(p.draft, tokens), final: redactOne(p.final, tokens) };
  });
}

// Distil the redacted pairs into short, style-only bullets via Haiku. Returns the
// profile text, or null when there's no clear style or the model is unavailable.
async function distilProfile(pairs: Array<{ draft: string; final: string }>): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || pairs.length === 0) return null;

  const pairsText = pairs
    .map((p, i) => `PAIR ${i + 1}\nDRAFT:\n${p.draft}\n\nSENT:\n${p.final}`)
    .join("\n\n----\n\n");

  const system =
    "You analyse how ONE estate-agency sales progressor personalises AI-drafted chase messages, to capture their personal writing style. You output ONLY style guidance as short bullet points. You never include names, addresses, firms, or any case detail.";
  const user =
    "Below are pairs showing an AI DRAFT and how the progressor REWROTE it before sending. Identify what is consistent about how THIS person writes, compared with the drafts.\n\n" +
    "Look at: greetings and openers, sign-offs, favourite words or phrases, sentence length, formality, contractions, punctuation, and anything they consistently cut or add.\n\n" +
    "Rules: describe STYLE ONLY. Never output any name, address, firm, or case detail (they are redacted as [redacted]; do not guess them). Give 4 to 7 short bullet points, each an instruction a writer could follow. If there is no clear consistent style, output exactly: No strong personal style yet.\n\n" +
    pairsText;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "";
    const trimmed = text.trim();
    if (!trimmed || /no strong personal style/i.test(trimmed)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

// Read the stored profile for injection into the chase prompt (fast path).
export async function getVoiceProfile(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { chaseVoiceProfile: true } });
  return u?.chaseVoiceProfile ?? null;
}

// Build (or rebuild) the profile from the user's recent edited chases and store it.
async function buildFromPairs(userId: string, edited: Pair[]): Promise<void> {
  const redacted = await redactPairs(edited.slice(0, MAX_PAIRS));
  const profile = await distilProfile(redacted);
  await prisma.user.update({
    where: { id: userId },
    data: {
      chaseVoiceProfile: profile, // null when no clear style; stops a useless note being injected
      chaseVoiceProfileBuiltAt: new Date(),
      chaseVoiceProfileSamples: edited.length,
    },
  });
}

// Called post-response (Next after()) from the generator. Cheap when nothing is
// due: one small read + one bounded fetch. Only distils when the user has crossed
// the threshold or racked up enough new edits since the last build.
export async function maybeRefreshVoiceProfile(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { chaseVoiceProfileSamples: true, chaseVoiceProfileBuiltAt: true },
  });
  if (!u) return;
  const edited = await getEditedChases(userId);
  if (edited.length < EDIT_THRESHOLD) return;
  const grewEnough = edited.length - u.chaseVoiceProfileSamples >= REFRESH_EVERY;
  const neverBuilt = u.chaseVoiceProfileBuiltAt == null;
  if (!neverBuilt && !grewEnough) return;
  await buildFromPairs(userId, edited);
}
