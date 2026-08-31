import Link from "next/link";
import { PlatformEmailTemplatesEditor } from "@/components/command/email-templates/PlatformEmailTemplatesEditor";

// Command Centre → Other client emails. Edit Sales Progressor's own defaults for
// the longer automated client emails (completion pack, exchange day, chase,
// weekly update). This is the copy every agency inherits unless they override it
// in their own account. Milestone step emails live under Milestone emails.

export const dynamic = "force-dynamic";

export default function CommandEmailTemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/command/milestone-emails" className="text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Milestone emails
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-100">Other client emails</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          The default wording for the longer automated client emails. This is what every agency inherits unless they
          change it in their own account. Edits apply from the next send. The step-by-step milestone emails are edited
          under Milestone emails.
        </p>
      </div>

      <PlatformEmailTemplatesEditor />
    </div>
  );
}
