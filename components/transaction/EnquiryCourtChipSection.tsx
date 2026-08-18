// Server wrapper for the hero "whose court" chip. Reads the enquiries hero
// state and renders the chip (or nothing when there's no live enquiries
// activity: before enquiries start, or once they're satisfied). Passed into
// PropertyHero as a slot so the hero stays unaware of enquiry semantics.

import { getEnquiryHeroState } from "@/lib/enquiries/tracker";
import { EnquiryCourtChip } from "./EnquiryCourtChip";

export async function EnquiryCourtChipSection({ transactionId }: { transactionId: string }) {
  const data = await getEnquiryHeroState(transactionId).catch(() => null);
  if (!data) return null;
  return <EnquiryCourtChip transactionId={transactionId} data={data} />;
}
