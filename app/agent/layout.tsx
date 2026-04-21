import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AgentNav } from "@/components/agent/AgentNav";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  // Only negotiators (agents) and admins (for oversight) may enter the agent area
  if (session.user.role !== "negotiator" && session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>The Sales Progressor</span>
              {session.user.firmName && (
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>{session.user.firmName}</span>
              )}
            </div>
            <AgentNav />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{session.user.name}</span>
            <Link
              href="/api/auth/signout"
              style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
        {children}
      </main>
    </div>
  );
}
