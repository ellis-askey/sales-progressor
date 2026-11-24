"use server";

// Re-render an edited review email through the SAME branded renderer the live
// send path uses (renderEditedEmailHtml, lib/email/milestone-digest) — so the
// /dev preview's edit→save loop stays byte-for-byte faithful to the inbox.
import { renderEditedEmailHtml } from "@/lib/email/milestone-digest";
import { resolveEmailTheme } from "@/lib/email/brand-theme";

export async function renderEditedPreviewAction(input: {
  address: string;
  subject: string;
  text: string;
  portalUrl: string;
}): Promise<string> {
  return renderEditedEmailHtml({
    address: input.address,
    heading: input.subject,
    text: input.text,
    portalUrl: input.portalUrl,
    theme: resolveEmailTheme(null),
  });
}
