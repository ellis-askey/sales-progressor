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
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7">
          <p className="glass-section-label text-label-secondary-on-dark mb-4">
            {session.user.firmName ?? "Agent Portal"}
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your account and team preferences.</p>
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
