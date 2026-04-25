import { requireSession } from "@/lib/session";
import { SendingAddressesSection } from "@/components/verified-emails/SendingAddressesSection";
import { TeamManagement } from "@/components/agent/TeamManagement";

export default async function AgentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const session = await requireSession();
  const { verified } = await searchParams;
  const isDirector = session.user.role === "director";

  return (
    <>
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 12 }}>{session.user.firmName ?? "Agent Portal"}</p>
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>Settings</h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>Manage your account and team preferences.</p>
        </div>
      </div>

      <div className="px-8 py-7 max-w-2xl space-y-6">

        {/* Team — directors only */}
        {isDirector && (
          <div className="glass-card p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-900/80 mb-1">Team</h2>
              <p className="text-xs text-slate-900/50">
                Manage your negotiators. Create accounts, control file visibility, and remove access.
              </p>
            </div>
            <TeamManagement currentUserId={session.user.id} />
          </div>
        )}

        {/* Sending addresses */}
        <div className="glass-card p-6">
          <div className="mb-5">
            <h2 className="text-sm font-bold text-slate-900/80 mb-1">Sending addresses</h2>
            <p className="text-xs text-slate-900/50">
              Verify a work email address to send emails to clients directly from the dashboard.
              Emails appear as coming from you — not a generic system address.
            </p>
          </div>
          <SendingAddressesSection initialVerified={verified === "1"} />
        </div>

      </div>
    </>
  );
}
