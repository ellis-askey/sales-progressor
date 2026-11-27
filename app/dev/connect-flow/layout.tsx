import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isFounderEmail } from "@/lib/security/founder";
import { AppBackground } from "@/components/decor/AppBackground";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import { ToastProvider } from "@/components/ui/Toast";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

// Founder-gated + production-reachable (notFound, not a NODE_ENV block), rendered
// inside the real agent surface (iridescent AppBackground + agent theme) with the
// toast provider mounted — /dev routes don't inherit the agent shell.
export const dynamic = "force-dynamic";

export default async function ConnectFlowDevLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!isFounderEmail(session.user.email)) notFound();

  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <AppBackground />
      <div className="agent-shell-root" data-theme="custom">
        <ToastProvider>{children}</ToastProvider>
      </div>
    </div>
  );
}
