// /dev/completions-rows — isolated prototype for the Completions list row at
// narrow widths (the <=760px mobile reflow). Dev-only, presentation-only, mock
// data, no writes. Uses container queries so the width slider drives the
// breakpoint without resizing the browser.
import type { ReactNode } from "react";
export default function CompletionsRowsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
