// /dev/compose-spacing — before/after of the email composer line-spacing fix
// (critique #300). Dev-only; presentation; no wiring.
import type { ReactNode } from "react";
export default function ComposeSpacingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
