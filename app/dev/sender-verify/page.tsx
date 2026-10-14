import { notFound } from "next/navigation";
import { SenderVerifyPreview } from "./SenderVerifyPreview";

// Dev-only mock of the Sending-address card with the proposed paste-the-link
// verification step (replaces the "click the link in the email" step that dead-ends
// on a SendGrid login screen). 404 in production (same prod-block convention as the
// rest of /dev). Delete once the real step ships in SenderDomainSection.
export default function SenderVerifyDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SenderVerifyPreview />;
}
