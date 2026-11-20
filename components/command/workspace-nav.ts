import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Lightbulb, TrendingUp, Zap, RefreshCw, Activity, Send,
  HeartPulse, FlaskConical, Shield, PoundSterling, RotateCcw, Handshake, Inbox,
  FolderOpen, Users, Settings, MailCheck, ListChecks, Mails, MessageSquare, Mail,
  MailPlus, AtSign, Smartphone, Link2, BarChart3, UserPlus, Globe, BookOpen,
  PenLine, Fingerprint, Sparkle, Megaphone, Compass, Timer, CalendarDays, Radar,
  Camera, Building2, Gavel, Rocket,
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
      { href: "/command/revenue", label: "Revenue", Icon: PoundSterling },
      { href: "/command/providers/quotes", label: "Quote inbox", Icon: Inbox },
      { href: "/command/providers", label: "Surveyor firms", Icon: Handshake },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/command/files", label: "Files", Icon: FolderOpen },
      { href: "/command/outbound", label: "Messages", Icon: Send },
      { href: "/command/whatsapp", label: "WhatsApp", Icon: MessageSquare },
      { href: "/command/proposals", label: "Proposed updates", Icon: Inbox },
      { href: "/command/crm-requests", label: "CRM requests", Icon: Link2 },
      { href: "/command/email-senders", label: "Email senders", Icon: AtSign },
      { href: "/command/agent-emails", label: "Agent emails", Icon: Mail },
      { href: "/command/email-threading", label: "Email threading", Icon: Mails },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      { href: "/command/website-growth", label: "Website & Growth", Icon: Globe },
      { href: "/command/prospects", label: "Prospects", Icon: UserPlus },
      { href: "/command/ai-outreach", label: "AI Outreach", Icon: Radar },
      { href: "/command/activation", label: "Getting started", Icon: Zap },
      { href: "/command/chain-invites", label: "Chain invites", Icon: Link2 },
      { href: "/command/adoption", label: "App adoption", Icon: Smartphone },
      { href: "/command/followup-usage", label: "Feature usage", Icon: BarChart3 },
      { href: "/command/retention", label: "Repeat use", Icon: RefreshCw },
      { href: "/command/growth", label: "Trends", Icon: TrendingUp },
      { href: "/command/timeframes", label: "Timeframes", Icon: Timer },
      { href: "/command/experiments", label: "Growth tests", Icon: FlaskConical },
      { href: "/command/enquiries-chase", label: "Chase experiment", Icon: MailCheck },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { href: "/command/content", label: "Overview", Icon: LayoutDashboard, exact: true },
      { href: "/command/content/inbox", label: "Content inbox", Icon: Inbox },
      { href: "/command/content/opportunities", label: "Brand opportunities", Icon: Megaphone },
      { href: "/command/content/strategy", label: "Strategy", Icon: Compass },
      { href: "/command/content/create", label: "Create", Icon: Sparkle },
      { href: "/command/content/calendar", label: "Calendar", Icon: CalendarDays },
      { href: "/command/content/performance", label: "Performance", Icon: BarChart3 },
      { href: "/command/content/thoughts", label: "Things you think", Icon: Lightbulb },
      { href: "/command/content/brand", label: "Your brand", Icon: Fingerprint },
      { href: "/command/content/drafts", label: "Drafts & images", Icon: PenLine },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/command/emails", label: "Email catalogue", Icon: BookOpen },
      { href: "/command/milestone-emails", label: "Milestone emails", Icon: Mails },
      { href: "/command/email-templates", label: "Other client emails", Icon: MailPlus },
      { href: "/command/milestone-updates", label: "Milestone updates", Icon: MessageSquare },
      { href: "/command/solicitor-chase", label: "Solicitor chasing", Icon: Gavel },
      { href: "/command/rules", label: "Rules", Icon: ListChecks },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/command/health", label: "System status", Icon: HeartPulse },
      { href: "/command/activity", label: "Activity", Icon: Activity },
      { href: "/command/audit", label: "Audit log", Icon: Shield },
      { href: "/command/updates", label: "Platform updates", Icon: Megaphone },
      { href: "/command/critique", label: "Critique", Icon: Camera },
      { href: "/command/settings", label: "Settings", Icon: Settings },
      { href: "/command/admin/demo", label: "Reset demo", Icon: RotateCcw },
    ],
  },
];
