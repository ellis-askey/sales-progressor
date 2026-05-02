import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabNav } from "@/components/admin/command-centre/TabNav";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import Link from "next/link";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "ellisaskey@googlemail.com";

export default async function CommandCentreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (session.user.role !== "admin" || session.user.email !== FOUNDER_EMAIL) {
    redirect("/admin");
  }

  const todoCount = await countManualTasksDueToday(session.user.agencyId).catch(() => 0);

  return (
    <AppShell session={session} activePath="/admin" todoCount={todoCount}>
      <PageHeader
        title="Command Centre"
        subtitle="Platform intelligence and experiments"
        action={
          <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors font-medium">
            ← Admin
          </Link>
        }
      />
      <TabNav />
      <div className="px-8 py-7 max-w-6xl">
        {children}
      </div>
    </AppShell>
  );
}
