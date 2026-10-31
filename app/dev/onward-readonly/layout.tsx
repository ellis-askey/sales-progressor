// /dev/onward-readonly layout — renders the portal's read-only onward panel in a
// light, mobile-width portal-scope frame so what you judge matches the real
// client portal. Dev-only (page.tsx blocks in prod).

import type { ReactNode } from "react";
import "@/app/styles/glass.css";

export default function DevOnwardReadOnlyLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="portal-scope"
      style={{ minHeight: "100vh", background: "#f4f5f7", display: "flex", justifyContent: "center", padding: "28px 0" }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>{children}</div>
    </div>
  );
}
