/**
 * /audit-gallery — dev-only, no auth required.
 * Renders the before/after audit gallery with full agent CSS loaded.
 * Used by scripts/screenshot-audit-gallery.mjs for Playwright screenshots.
 */
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";
import BeforeAfterPage from "@/app/agent/audit/before-after/page";

export default function AuditGalleryStandalone() {
  return <BeforeAfterPage />;
}
