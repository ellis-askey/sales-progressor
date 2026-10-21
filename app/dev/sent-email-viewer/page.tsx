import { notFound } from "next/navigation";
import { SentEmailViewerSandbox } from "./SentEmailViewerSandbox";

// Dev-only preview of the "open a sent chase email" viewer (centre modal on
// desktop, bottom sheet on tablet/mobile — the LogUpdateModal pattern). 404 in
// production, like the rest of /dev. No server wiring — mock data only, so the
// real chrome + styling can be judged before building it into the chase tab.
export default function SentEmailViewerPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SentEmailViewerSandbox />;
}
