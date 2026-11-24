import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Lightbulb, TrendingUp,
  PoundSterling, RotateCcw,
  FolderOpen, Users, Settings,
  UserPlus, BookOpen,
  PenLine, Radar,
  Building2, Rocket,
  MonitorSmartphone,
} from "lucide-react";

export interface WorkspaceNavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Match this route exactly (a section landing whose href prefixes its siblings,
   *  e.g. /command/content) so it doesn't stay active on them. */
  exact?: boolean;
  soon?: boolean;
}

export interface WorkspaceNavSection {
  id: string;
  label: string;
  items: WorkspaceNavItem[];
}

// ── The eight-section Admin & Founder Workspace navigation ──────────────────
//
// Every href points at an EXISTING command route. This is a grouping and
// relabelling of what already ships, NOT a route migration — bookmarks, deep
// links, emailed links and existing workflows are unaffected because no route
// moves. The previous six-bucket sidebar (Today / Day to day / Money / Growth /
// Content / System) overloaded "Day to day" and "System"; this splits them into
// the agreed Customers / Operations / Platform / System homes so each capability
// has one obvious place.
//
// Deeper in-section consolidation lands in later phases and is deliberately NOT
// done here: unified customer-account tabs, global search, and folding the
// analytics pages (Growth is still a flat list for now). See
// docs/active/admin-workspace/00-AUDIT-AND-ARCHITECTURE.md §B and
// docs/active/admin-workspace/01-PHASE-0-1-PROPOSAL.md.
export const WORKSPACE_NAV: WorkspaceNavSection[] = [
  {
    id: "today",
    label: "Today",
    items: [
      { href: "/command/overview", label: "Today", Icon: LayoutDashboard },
      { href: "/command/insights", label: "Briefing", Icon: Lightbulb },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { href: "/command/agencies", label: "Agencies & agents", Icon: Users },
      { href: "/command/businesses", label: "Progression companies", Icon: Building2 },
      { href: "/command/trials/boardwalk", label: "Boardwalk trial", Icon: Rocket },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      // Collapsed (consolidation): Revenue / Quote inbox / Surveyor firms are now
      // the Revenue / Quotes / Firms tabs inside /command/money, and the legacy
      // routes redirect there (see lib/money-redirects.ts). exact:true keeps this
      // highlighted across every tab (the tab lives in ?tab=).
      { href: "/command/money", label: "Money", Icon: PoundSterling, exact: true },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      // Collapsed (consolidation): Files / Messages / WhatsApp / Proposed updates
      // / CRM requests / Email senders / Agent emails / Email threading are now
      // the Files / Messaging / Email / Requests tabs inside /command/operations,
      // and the legacy routes redirect there (see lib/operations-redirects.ts).
      // exact:true keeps this highlighted across every tab (the tab lives in
      // ?tab=).
      { href: "/command/operations", label: "Operations", Icon: FolderOpen, exact: true },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      // Collapsed (consolidation Phase 5A): the nine analytics dashboards
      // (Trends / Website & Growth / Chain invites / Getting started / Feature
      // usage / App adoption / Repeat use / Growth tests / Chase experiment) are
      // now the Trends / Acquisition / Activation / Engagement / Retention /
      // Experiments tabs inside /command/growth, and the legacy routes redirect
      // there (see lib/growth-redirects.ts). exact:true keeps this highlighted
      // across every tab (the tab lives in ?tab=, so the pathname is always this).
      { href: "/command/growth", label: "Growth", Icon: TrendingUp, exact: true },
      // Operational feature arcs — kept as their own destinations (write-heavy,
      // not analytics dashboards).
      { href: "/command/prospects", label: "Prospects", Icon: UserPlus },
      { href: "/command/ai-outreach", label: "AI Outreach", Icon: Radar },
      // Timeframes moved to the Platform workspace (Engine tab) in the Platform
      // consolidation — it's engine timing, not a growth metric.
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      // Collapsed to one canonical entry (consolidation Phase 4A): the former ten
      // content links are now the Overview / Ideas / Create / Plan / Measure /
      // Brand tabs inside /command/content, and the legacy routes redirect there
      // (see lib/content-redirects.ts). exact:true keeps this highlighted across
      // every tab (the tab lives in ?tab=, so the pathname is always this).
      { href: "/command/content", label: "Content", Icon: PenLine, exact: true },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      // Collapsed (consolidation): Email catalogue / Milestone emails / Other
      // client emails / Milestone updates / Solicitor chasing / Rules, plus
      // Timeframes (moved from Growth), are now the Emails / Updates / Chasing /
      // Engine tabs inside /command/platform; the legacy routes redirect there
      // (see lib/platform-redirects.ts). exact:true keeps this highlighted across
      // every tab (the tab lives in ?tab=).
      { href: "/command/platform", label: "Platform", Icon: BookOpen, exact: true },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      // Collapsed (consolidation, final section): System status / Activity /
      // Audit log / Platform updates / Critique / Settings are now the
      // Monitoring / Updates / Critique / Settings tabs inside /command/system,
      // and the legacy routes redirect there (see lib/system-redirects.ts).
      // exact:true keeps this highlighted across every tab (the tab lives in
      // ?tab=).
      { href: "/command/system", label: "System", Icon: Settings, exact: true },
      // Standalone tools — not one of the six consolidated System pages.
      { href: "/command/pages", label: "Page gallery", Icon: MonitorSmartphone },
      { href: "/command/admin/demo", label: "Reset demo", Icon: RotateCcw },
    ],
  },
];
