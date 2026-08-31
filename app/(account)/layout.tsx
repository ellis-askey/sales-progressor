// app/(account)/layout.tsx
//
// Layout for the Account area. Route-group escape (lives at the app root) so
// pages under it don't inherit app/agent/layout.tsx + AgentShell. Redesign
// (2026-08-31): the shell mirrors the agent shell's shape — a fixed sidebar
// with the Sales Progressor logo at the top, the Account nav in the middle
// (agent-rail interaction), and the signed-in user at the bottom. Each page
// renders its own AccountPageHeader (title + subtitle + Back to Sales
// Progressor), so the full-width top bar is gone.
//
// File-tree: pages live at app/(account)/agent/account/<tab>/page.tsx.
// URLs: /agent/account/<tab>. Layout inheritance: app/layout.tsx + this.

import Link from "next/link";
import { FolderOpen } from "@phosphor-icons/react/dist/ssr";
import { resolveAgentSession } from "@/lib/agent-session";
import { getAgencyDirectorStatus } from "@/lib/agency/director-status";
import { prisma } from "@/lib/prisma";
import { AccountLeftNav } from "@/components/account/chrome/AccountLeftNav";
import { AccountSidebarUser } from "@/components/account/chrome/AccountSidebarUser";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { role, theme, session } = await resolveAgentSession();

  // Negotiators need this so the nav can hide/show the Team tab.
  let agencyHasDirector = true;
  if (role === "negotiator" && session.user.agencyId) {
    const ds = await getAgencyDirectorStatus(session.user.agencyId);
    agencyHasDirector = ds.hasDirector;
  }

  // Avatar for the sidebar user chip (falls back to initials).
  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, name: true },
  });
  const displayName = userRecord?.name ?? session.user.name ?? "You";

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: "100vh",
        display: "flex",
        color: "#111827",
        background:
          "radial-gradient(1100px 520px at 78% -8%, rgba(255,107,74,0.07), transparent 60%), linear-gradient(180deg, #fcf8f5 0%, #faf9f8 42%)",
      }}
    >
      <aside className="account-shell-nav">
        <Link href="/agent/hub" className="account-brand" aria-label="Sales Progressor">
          <span className="account-brand-mark">
            <FolderOpen weight="fill" style={{ width: 15, height: 15, color: "#fff" }} />
          </span>
          <span className="account-brand-word">Sales Progressor</span>
        </Link>

        <div className="account-nav-scroll">
          <AccountLeftNav role={role} agencyHasDirector={agencyHasDirector} />
        </div>

        <div className="account-user-slot">
          <AccountSidebarUser name={displayName} role={role} image={userRecord?.image ?? null} />
        </div>
      </aside>

      <main className="account-shell-main">
        <div className="account-shell-container">{children}</div>
      </main>

      <style>{`
        .account-shell-nav {
          position: sticky;
          top: 0;
          align-self: flex-start;
          height: 100vh;
          width: 260px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 18px 14px 14px;
          background: rgba(255,255,255,0.72);
          backdrop-filter: saturate(140%) blur(8px);
          -webkit-backdrop-filter: saturate(140%) blur(8px);
          border-right: 0.5px solid rgba(0,0,0,0.08);
        }
        .account-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          padding: 6px 8px 14px;
        }
        .account-brand-mark {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 9px;
          background: linear-gradient(135deg, var(--agent-coral, #FF6B4A) 0%, var(--agent-coral-deep, #E84F2D) 100%);
          box-shadow: 0 1px 4px rgba(0,0,0,0.10);
        }
        .account-brand-word { font-size: 14px; font-weight: 700; color: #111827; letter-spacing: -0.01em; }
        .account-nav-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-top: 2px; }
        .account-user-slot { border-top: 0.5px solid rgba(0,0,0,0.07); padding-top: 10px; margin-top: 8px; }

        .account-shell-main { flex: 1; min-width: 0; }
        .account-shell-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 32px 88px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        @media (max-width: 860px) {
          .account-shell-nav {
            position: static; height: auto; width: 100%;
            flex-direction: row; align-items: center; gap: 8px;
            padding: 10px 12px; overflow-x: auto;
            border-right: none; border-bottom: 0.5px solid rgba(0,0,0,0.08);
          }
          .account-brand { padding: 4px 6px; }
          .account-brand-word { display: none; }
          .account-nav-scroll { overflow-x: auto; overflow-y: visible; }
          .account-nav-scroll nav > div { flex-direction: row !important; }
          .account-user-slot { border-top: none; padding-top: 0; margin-top: 0; margin-left: auto; min-width: 190px; }
          .account-shell-container { padding: 24px 18px 64px; gap: 22px; }
        }
      `}</style>
    </div>
  );
}
