// /dev/hub-slice — isolated vertical-slice experiment. Dev-only (page gates in
// prod). Self-contained: uses the shared kit + tokens read-only, changes nothing
// shared, global, or production. A test of design quality, not an approved system.
import type { ReactNode } from "react";
import "@/app/styles/liquid-glass.css";
export default function HubSliceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
