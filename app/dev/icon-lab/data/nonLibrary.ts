// Non-library icons discovered in the dashboard surface (hand-rolled SVG, custom
// components, emoji-as-icon, and CSS-drawn marks). Catalogued for completeness —
// these are NOT from lucide/phosphor and so can't be previewed in a family. The
// lab lists them honestly as "outside the icon libraries".

export type NonLibraryIcon = {
  name: string;
  kind: "inline-svg" | "custom-component" | "emoji" | "css";
  represents: string;
  where: string; // file path(s)
};

export const NON_LIBRARY: NonLibraryIcon[] = [
  { name: "EmptyState default glyph", kind: "inline-svg", represents: "Empty inbox / archive box (default empty-state art)", where: "components/ui/EmptyState.tsx" },
  { name: "AnimatedTick", kind: "inline-svg", represents: "Self-drawing confirmation checkmark (canonical success tick)", where: "components/ui/AnimatedTick.tsx" },
  { name: "ClaimHouseGlyph", kind: "inline-svg", represents: "Gradient house — property-image fallback on the claim surface", where: "components/claim/ClaimHouseGlyph.tsx" },
  { name: "BrandMark", kind: "custom-component", represents: "The Sales Progressor coral 'C' logo (renders /brand-icon.png)", where: "components/brand/BrandMark.tsx" },
  { name: "GoogleIcon / MicrosoftIcon", kind: "inline-svg", represents: "Multi-colour OAuth brand marks on sign-in buttons", where: "components/login/GoogleIcon.tsx, MicrosoftIcon.tsx" },
  { name: "Provider logos (Gmail/Outlook/Yahoo/iCloud/Zoho/eXp/generic)", kind: "custom-component", represents: "Email-provider brand marks on connection tiles (dynamic via ProviderLogo)", where: "components/account/provider-logos.tsx" },
  { name: "Button Spinner", kind: "css", represents: "Ring loading spinner (border + agent-spin keyframe) — reused in ~23 files", where: "components/ui/Button.tsx + app/agent/styles/agent-system.css" },
  { name: "LoadingDots", kind: "css", represents: "Three pulsing dots loading glyph", where: "components/hub/LoadingDots.tsx" },
  { name: "SavingPulse", kind: "css", represents: "Three bouncing dots 'Saving…' indicator", where: "components/ui/SavingPulse.tsx" },
  { name: "Document-type emoji", kind: "emoji", represents: "📄 PDF · 🖼️ image · 📎 other (mimeType → emoji map)", where: "components/transaction/DocumentsSection.tsx" },
  { name: "Status / action emoji", kind: "emoji", represents: "✓ done · ✗ fail · ★/☆ rating · ✦ hub spark · ⏳ waiting · 💬 chat · ⚡ activity · ✕ close", where: "many: MilestonePanel, CommsEntry, RiskBadge, SurveyForm, AgentNav, CloudConversation, …" },
  { name: "WhatsApp status ticks", kind: "emoji", represents: "✓ sent · ✓✓ delivered · coloured ✓✓ read", where: "components/whatsapp/CloudConversation.tsx" },
  { name: "Chain direction glyphs", kind: "emoji", represents: "↑ / ↓ / ▾ chain position + disclosure", where: "components/chain/LinkCard.tsx" },
];

export const NON_LIBRARY_META = {
  otherLibraries: "None — no heroicons, react-icons, tabler, feather, fontawesome, radix-icons, MUI, iconify, or SVG-sprite system anywhere in scope.",
  note: "EmptyState hand-inlines a heroicons-shaped path but does not import the heroicons package.",
  priorTool: "A small internal icon registry/preview already exists at app/agent/audit/icons/IconAuditView.tsx (left untouched).",
};
