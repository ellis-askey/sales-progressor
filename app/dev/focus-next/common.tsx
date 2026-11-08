"use client";
// Shared, visual-agnostic helpers for the Focus Next explorations + final build.
// No styling here — each direction maps tone -> its own look. Local/dev only.
import { EnvelopeSimple, WhatsappLogo, Phone } from "@phosphor-icons/react";
import { extractFirstName } from "@/lib/contacts/displayName";
import { type Side, type Comm, type CommState, type Sale, rel, sideSignal, sideCovered } from "./mock";

export type Tone = "danger" | "warn" | "info" | "ok" | "neutral";
export const CH: Record<Comm["channel"], typeof EnvelopeSimple> = { email: EnvelopeSimple, whatsapp: WhatsappLogo, call: Phone };
export const STATE_LABEL: Record<CommState, string> = {
  replied: "Replied", opened: "Opened", delivered: "Delivered", sent: "Sent",
  messaged: "Sent", called: "Call", logged: "Logged", bounced: "Bounced", failed: "Failed to send",
};
export const who = (s: Side) => (s.kind === "vendor" ? "Seller" : "Buyer");
export const first = (name: string) => extractFirstName(name);
export const dirWord = (m: Comm) => (m.dir === "in" ? "They" : m.automated ? "Auto" : "You");
export const isBad = (st: CommState) => st === "bounced" || st === "failed";

export function sideStatus(s: Side): { tone: Tone; text: string; short: string } {
  if (s.parked) return { tone: "neutral", text: "Set aside this week", short: "set aside" };
  if (s.touchedThisWeek) return { tone: "ok", text: "Contacted this week", short: "done" };
  const sig = sideSignal(s);
  if (sig.bounced) return { tone: "danger", text: "Last message didn't get through", short: "bounced" };
  if (sig.lastHumanDays == null) return { tone: "danger", text: "Not yet contacted", short: "new" };
  if (sig.quiet) return { tone: sig.quietDays! >= 21 ? "danger" : "warn", text: `Quiet for ${sig.quietDays} days`, short: `quiet ${sig.quietDays}d` };
  if (sig.awaitingReply) return { tone: "warn", text: `Waiting on a reply, ${sig.awaitingDays}d`, short: `awaiting ${sig.awaitingDays}d` };
  return { tone: "ok", text: `In touch, last spoke ${rel(sig.lastHumanDays)} ago`, short: `in touch ${rel(sig.lastHumanDays)}` };
}

// a short human sentence describing the sale's most pressing issue, for headlines
export function headline(sale: Sale): { tone: Tone; text: string } | null {
  const c = sale.concerns[0];
  if (c) return { tone: c.tone === "danger" ? "danger" : c.tone === "warn" ? "warn" : "info", text: c.title };
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s && !sideCovered(s));
  const worst = sides.map((s) => ({ s, st: sideStatus(s) })).filter((x) => x.st.tone === "danger" || x.st.tone === "warn")
    .sort((a, b) => (a.st.tone === "danger" ? 0 : 1) - (b.st.tone === "danger" ? 0 : 1))[0];
  if (worst) return { tone: worst.st.tone, text: `${who(worst.s)}: ${worst.st.text.toLowerCase()}` };
  return null;
}
