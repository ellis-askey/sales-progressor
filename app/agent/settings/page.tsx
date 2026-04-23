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
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900/90 mb-1">Settings</h1>
        <p className="text-sm text-slate-900/50">Manage your account preferences</p>
      </div>

      {/* Team management — directors only */}
      {isDirector && (
        <section>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900/70 uppercase tracking-wider mb-0.5">
              Team
            </h2>
            <p className="text-xs text-slate-900/50">
              Manage your negotiators. Create accounts, control file visibility, and remove access.
            </p>
          </div>
          <TeamManagement currentUserId={session.user.id} />
        </section>
      )}

      {/* Sending addresses */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-900/70 uppercase tracking-wider mb-0.5">
            Sending addresses
          </h2>
          <p className="text-xs text-slate-900/50">
            Verify a work email address to send emails to clients directly from the dashboard.
            Emails will appear as coming from you — not from a generic system address.
          </p>
        </div>
        <SendingAddressesSection initialVerified={verified === "1"} />
      </section>
    </div>
  );
}
