"use server";

import { redirect } from "next/navigation";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { pauseContactChases } from "@/lib/services/chase-pause";

const PAUSE_DAYS = 7;

// The pause only happens here — on a real button press (POST), never on page
// open — so an email scanner opening the link in the background can't pause a
// client's chases.
export async function confirmPauseAction(formData: FormData): Promise<void> {
  const t = String(formData.get("t") ?? "");
  const subject = t ? verifyUnsubscribeToken(decodeURIComponent(t)) : null;
  if (!subject || !subject.startsWith("pause:")) redirect("/chases-paused?status=invalid");

  const contactId = subject!.slice("pause:".length);
  const until = new Date(Date.now() + PAUSE_DAYS * 24 * 60 * 60 * 1000);
  const result = await pauseContactChases(contactId, until, "email").catch(() => null);
  if (!result) redirect("/chases-paused?status=invalid");

  redirect(`/chases-paused?status=ok&until=${until.toISOString().slice(0, 10)}`);
}
