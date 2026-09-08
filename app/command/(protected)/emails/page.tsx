import { specimenIndex } from "@/lib/command/email-catalogue/registry";
import { EmailCatalogue } from "./EmailCatalogue";

export const dynamic = "force-dynamic";

// Command Centre Email Catalogue — every email the portal can send, rendered
// from the real builders under a selectable scenario. Superadmin-gated by the
// /command/(protected) layout. See docs/active/email-catalogue/SPEC.md.
export default function CommandEmailsPage() {
  return <EmailCatalogue specimens={specimenIndex()} />;
}
