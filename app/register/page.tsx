import RegisterForm from "./RegisterForm";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";

// Server wrapper: reads the server-only progression flag and passes it to the
// client form. When the flag is off, RegisterForm renders exactly the existing
// agent signup (no account-type chooser). See
// docs/active/progression-businesses/10-signup-team-billing-spec.md, Arc S1.
export default function RegisterPage() {
  return <RegisterForm progressorEnabled={progressionBusinessesEnabled()} />;
}
