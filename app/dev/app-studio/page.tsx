import { notFound } from "next/navigation";
import { AppStudioSandbox } from "./AppStudioSandbox";

// Dev-only sandbox for the new App Colour Studio (the richer replacement for the
// single-hex BrandColorPicker). 404 in production, like the rest of /dev. No
// server wiring yet — Save just logs the config so the shape can be reviewed
// before we insert + wire it into /agent/account/profile.
export default function AppStudioPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AppStudioSandbox />;
}
