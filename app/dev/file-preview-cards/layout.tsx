// /dev/file-preview-cards — isolated prototype for the file-preview drawer's
// three info cards: Last comms (reframed from "Latest note"), Next reminder, and
// Next step. Dev-only, presentation-only, mock data, no writes. Lets Ellis react
// to the enriched strings as rendered pixels before any of it is wired in.
import type { ReactNode } from "react";
export default function FilePreviewCardsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
