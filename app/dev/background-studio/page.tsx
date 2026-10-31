import { notFound } from "next/navigation";
import { BackgroundStudioSandbox } from "./BackgroundStudioSandbox";

// Dev-only sandbox for the moving-background colour studio: the settings card +
// the full-screen live editor, both driven by the REAL WebGL shaders
// (Iridescence for light, SoftAurora for dark) via <AppBackground>'s new colour
// props. 404 in production, like the rest of /dev. No server wiring yet — Save
// just logs what it would persist so the shape can be reviewed before we insert
// + wire it into /agent/account appearance settings.
export default function BackgroundStudioPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BackgroundStudioSandbox />;
}
