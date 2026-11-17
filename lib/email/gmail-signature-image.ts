// Shared, dependency-free detector (safe to import on the client AND the server):
// does a signature's HTML reference an image hosted on Gmail's private signature
// proxy?
//
// When someone copies their signature straight out of Gmail and pastes it into
// the custom-signature box, the image does NOT come across as something we can
// re-host. Inline base64 images are uploaded to our public bucket by
// lib/email/signature-images.ts, but a Gmail signature arrives as a LINK to
// Google's mail-signature CDN, e.g.
//   https://ci3.googleusercontent.com/mail-sig/AIorK4...
// Those URLs only load inside that user's own authenticated Gmail session: our
// server can't fetch them to re-host, and a recipient's inbox can't load them
// either, so the image silently vanishes from every email that's sent. We detect
// it so the settings UI can warn at paste time and steer the user to upload the
// image as a file instead.
export function hasGmailHostedSignatureImage(html: string | null | undefined): boolean {
  return !!html && /googleusercontent\.com\/mail-sig\//i.test(html);
}
