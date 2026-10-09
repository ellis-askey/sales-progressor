"use server";

import { redirect } from "next/navigation";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { applyUnsubscribe } from "@/lib/email/apply-unsubscribe";

// The actual unsubscribe only happens here — on a real button press (POST via a
// form), never on page open. This is what keeps email link-scanners from
// unsubscribing a recipient who never clicked.
export async function confirmUnsubscribeAction(formData: FormData): Promise<void> {
  const t = String(formData.get("t") ?? "");
  const subject = t ? verifyUnsubscribeToken(decodeURIComponent(t)) : null;
  if (!subject) redirect("/unsubscribed?status=invalid");
  const res = await applyUnsubscribe(subject);
  if (!res.ok) redirect("/unsubscribed?status=invalid");
  redirect(`/unsubscribed?status=ok${res.type ? `&type=${res.type}` : ""}`);
}
