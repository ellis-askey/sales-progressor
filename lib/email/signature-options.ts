// The per-message signature-style options a composer shows, derived from the
// signature actually configured for the file (the agent's own, or an external
// progression business's per-client sign-off). Keeps the New email + chase
// composers in step with one source of truth, so the picker never offers a
// variant that doesn't exist for that file.
//
//   Basic            — assembled block, no logo (always available)
//   Logo             — assembled block + the agency logo (only when a logo is set)
//   Signature image  — the uploaded image (only when one is set)
//   Custom           — the pasted HTML signature (only when one is set)
//
// `selected` is the style that matches the saved default, so the composer opens
// on what the sender actually configured.

import type { EmailSignatureMode } from "@prisma/client";

export type SignatureStyleKey = "basic" | "logo" | "image" | "custom";
export type SignatureStyleOption = { key: SignatureStyleKey; label: string; sub: string };

export function buildSignatureStyleOptions(opts: {
  savedMode: EmailSignatureMode;
  hasImage: boolean;
  hasCustom: boolean;
  hasLogo: boolean;
}): { options: SignatureStyleOption[]; selected: SignatureStyleKey } {
  const { savedMode, hasImage, hasCustom, hasLogo } = opts;

  const options: SignatureStyleOption[] = [{ key: "basic", label: "Basic", sub: "Name & details, no logo" }];
  if (hasLogo) options.push({ key: "logo", label: "Logo", sub: "With the agency logo" });
  if (hasImage) options.push({ key: "image", label: "Signature image", sub: "Your uploaded signature" });
  if (hasCustom) options.push({ key: "custom", label: "Custom", sub: "Your pasted signature" });

  // The saved default's natural rendering: an image/custom signature picks its
  // own option; a BASIC one renders with the logo band when the agency has a logo.
  let selected: SignatureStyleKey = hasLogo ? "logo" : "basic";
  if (savedMode === "IMAGE" && hasImage) selected = "image";
  else if (savedMode === "CUSTOM" && hasCustom) selected = "custom";

  return { options, selected };
}
