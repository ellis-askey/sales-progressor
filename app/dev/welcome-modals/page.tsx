import { notFound } from "next/navigation";
import { WelcomePreview } from "./WelcomePreview";

// Dev-only preview of the real welcome modals. 404 in production (same prod-block
// convention as the rest of /dev).
export default function WelcomeModalsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <WelcomePreview />;
}
