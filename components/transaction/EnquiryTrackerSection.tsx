// Server wrapper that fetches the enquiries tracker view and renders the panel
// (or nothing if the enquiries loop hasn't opened). Dropped into both the
// internal and the agent file views so self-managed and outsourced files both
// get movement logging. Stage 1.6b.

import { getEnquiryTrackerView } from "@/lib/enquiries/tracker";
import { EnquiryTrackerPanel } from "./EnquiryTrackerPanel";

export async function EnquiryTrackerSection({ transactionId }: { transactionId: string }) {
  const data = await getEnquiryTrackerView(transactionId).catch(() => null);
  if (!data) return null;
  return <EnquiryTrackerPanel transactionId={transactionId} data={data} />;
}
