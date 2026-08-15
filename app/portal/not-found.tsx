// app/portal/not-found.tsx — 404 for the buyer/seller portal. Same look as the
// app-wide 404, but the message is about an expired/incorrect link and there's
// no "dashboard" button (clients don't have one).

import { NotFoundView } from "@/components/ui/NotFoundView";

export default function PortalNotFound() {
  return (
    <NotFoundView
      title="Page not found"
      message="This link may have expired, or the address isn't quite right. Please check the link you were sent and try again, or get in touch with your sales progressor."
    />
  );
}
