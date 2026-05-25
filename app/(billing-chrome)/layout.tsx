// app/(billing-chrome)/layout.tsx
//
// Layout for the billing environment. Route group is invisible in URLs
// (parens) but escapes the working-app layout chain — pages under this
// group do NOT inherit app/agent/layout.tsx + AgentShell. The director
// gets a near-document environment instead of the working-app sidebar.
//
// Architecture: pages live at file paths like
//   app/(billing-chrome)/agent/polish/billing-hub-v2/page.tsx
// which Next.js serves at the URL /agent/polish/billing-hub-v2. They
// inherit ONLY app/layout.tsx (root) and this layout — NOT the existing
// app/agent/layout.tsx, which lives on a separate file-tree branch.
//
// Theme tokens stay live (data-theme attribute set from the resolved
// session) so the brand accent (--agent-coral) is available, but the
// canvas itself is near-white — no aurora backdrop, no glass cards.
// Brand expressed as accent only, per the v2 brief.
//
// Director-only guard runs here. Negotiators / internal staff hit
// notFound() and never see this surface.

import { resolveDirectorSession } from "@/lib/agent-session";
import { BillingChromeHeader } from "@/components/billing/chrome/BillingChromeHeader";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

export default async function BillingChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = await resolveDirectorSession();

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: "100vh",
        background: "#fafafa",
        color: "var(--agent-text-primary, #111827)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <BillingChromeHeader />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
