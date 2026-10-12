// Legacy route — Forms moved to /boardwalk/forms. See ../page.tsx.
import { redirect } from "next/navigation";

export default function LegacyTypeformNew() {
  redirect("/boardwalk/forms/new");
}
