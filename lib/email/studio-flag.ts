// Temporary visibility gate for the expanded Email Studio (2026-10). While the
// new designer is being reviewed, only these operators see it; everyone else
// keeps the current 3-step branding studio. Flip to a real flag / full rollout
// once the send path is threaded and it's signed off.

const EMAIL_STUDIO_EMAILS = new Set([
  "ellis@thesalesprogressor.co.uk",
  "ellisaskey@googlemail.com",
  "ellisaskey+superadmin@googlemail.com",
  "ellisaskey+nm@googlemail.com", // director of Westwood Leber — agency studio (Profile)
  "ellisaskey+sm@googlemail.com", // owner of Sales Proggos — business client-branding studio
]);

export function emailStudioEnabled(email: string | null | undefined): boolean {
  return !!email && EMAIL_STUDIO_EMAILS.has(email.toLowerCase());
}
