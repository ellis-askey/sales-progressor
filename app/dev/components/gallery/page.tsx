"use client";

// Component gallery.
//  · Button / RadioGroup — uiarc.dev (MIT), components/arc (used in production)
//  · LabelInput — Bencho (MIT), components/ui/LabelInput
//  · Arc batch — the self-contained + Radix uiarc free components (MIT), under
//    components/arc, shown here under .arc-scope + ArcProvider. Every demo is in
//    an error boundary so a prop mismatch shows a note instead of 500-ing.
// /dev convention: throwaway. Preserved here as a raw SOURCE to draw from while
// building the canonical Design System at /dev/components — not the system
// itself. Dev-only (blocks in production).

import React, { useState } from "react";
import { notFound } from "next/navigation";
import { LabelInput } from "@/components/ui/LabelInput";
import "@/components/arc/foundation.css";
import { ArcProvider } from "@/components/arc/lib/arc-provider";

import { Button } from "@/components/arc/button/button";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";
import { Avatar } from "@/components/arc/avatar/avatar";
import { AvatarGroup } from "@/components/arc/avatar-group/avatar-group";
import { Badge } from "@/components/arc/badge/badge";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { AnimatedCounter } from "@/components/arc/animated-counter/animated-counter";
import { Sparkline } from "@/components/arc/sparkline/sparkline";
import { Gauge } from "@/components/arc/gauge/gauge";
import { ActivityHeatmap } from "@/components/arc/activity-heatmap/activity-heatmap";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Progress } from "@/components/arc/progress/progress";
import { Stepper } from "@/components/arc/stepper/stepper";
import { Countdown } from "@/components/arc/countdown/countdown";
import { Pencil, Share2, Archive } from "lucide-react";
import { UsageMeter } from "@/components/arc/usage-meter/usage-meter";
import { OnboardingChecklist } from "@/components/arc/onboarding-checklist/onboarding-checklist";
import { Pagination } from "@/components/arc/pagination/pagination";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Alert } from "@/components/arc/alert/alert";
import { AnnouncementBar } from "@/components/arc/announcement-bar/announcement-bar";
import { CookieConsent } from "@/components/arc/cookie-consent/cookie-consent";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { OtpInput } from "@/components/arc/otp-input/otp-input";
import { NumberField } from "@/components/arc/number-field/number-field";
import { MoneyInput } from "@/components/arc/money-input/money-input";
import { PhoneInput } from "@/components/arc/phone-input/phone-input";
import { SearchField } from "@/components/arc/search-field/search-field";
import { ExpandingSearch } from "@/components/arc/expanding-search/expanding-search";
import { InlineEdit } from "@/components/arc/inline-edit/inline-edit";
import { TagInput } from "@/components/arc/tag-input/tag-input";
import { MentionInput } from "@/components/arc/mention-input/mention-input";
import { Combobox } from "@/components/arc/combobox/combobox";
import { MultiSelect } from "@/components/arc/multi-select/multi-select";
import { MorphSelect } from "@/components/arc/morph-select/morph-select";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import { BillingToggle } from "@/components/arc/billing-toggle/billing-toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/arc/toggle-group/toggle-group";
import { Slider } from "@/components/arc/slider/slider";
import { ElasticSlider } from "@/components/arc/elastic-slider/elastic-slider";
import { RulerSlider } from "@/components/arc/ruler-slider/ruler-slider";
import { Rating } from "@/components/arc/rating/rating";
import { ScrubInput } from "@/components/arc/scrub-input/scrub-input";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { ExpandingButtonGroup } from "@/components/arc/expanding-button-group/expanding-button-group";
import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { HoldToConfirm } from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { ContextMenu, contextMenuExampleItems } from "@/components/arc/context-menu/context-menu";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { Breadcrumb } from "@/components/arc/breadcrumb/breadcrumb";
import { ScrollArea } from "@/components/arc/scroll-area/scroll-area";
import { ExpandableCard } from "@/components/arc/expandable-card/expandable-card";
import { ExpandableText } from "@/components/arc/expandable-text/expandable-text";
import { Timeline } from "@/components/arc/timeline/timeline";
import { CommentThread } from "@/components/arc/comment-thread/comment-thread";
import { Carousel } from "@/components/arc/carousel/carousel";
import { CardStack } from "@/components/arc/card-stack/card-stack";
import { TextReveal } from "@/components/arc/text-reveal/text-reveal";
import { InViewTitle } from "@/components/arc/in-view-title/in-view-title";
import { TextMorph } from "@/components/arc/text-morph/text-morph";
// Radix-backed
import { Switch } from "@/components/arc/switch/switch";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/arc/tabs/tabs";
import { Accordion } from "@/components/arc/accordion/accordion";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import { Select } from "@/components/arc/select/select";
import { Card } from "@/components/arc/card/card";

const A = {
  Button, RadioGroup, Avatar, AvatarGroup, Badge, MetricCard, AnimatedCounter, Sparkline, Gauge,
  ActivityHeatmap, Skeleton, Progress, Stepper, Countdown, UsageMeter, OnboardingChecklist, Pagination,
  EmptyState, Alert, AnnouncementBar, CookieConsent, Input, Textarea, PasswordField, OtpInput, NumberField,
  MoneyInput, PhoneInput, SearchField, ExpandingSearch, InlineEdit, TagInput, MentionInput, Combobox,
  MultiSelect, MorphSelect, ChipGroup, RadioCards, BillingToggle, ToggleGroup, ToggleGroupItem, Slider,
  ElasticSlider, RulerSlider, Rating, ScrubInput, ActionButton, ExpandingButtonGroup, CopyButton, ConfirmMorph,
  HoldToConfirm, ContextMenu, UserMenu, ThemeSwitch, Breadcrumb, ScrollArea, ExpandableCard, ExpandableText,
  Timeline, CommentThread, Carousel, CardStack, TextReveal, InViewTitle, TextMorph,
  Switch, Checkbox, Tabs, TabsList, TabsTrigger, TabsContent, Accordion, Tooltip, Select, Card,
} as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;

const noop = () => {};
const OPTS = [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }, { value: "c", label: "Option C" }];

// Demo data for the richer components, matching each component's real prop shape.
const NOW = new Date("2026-11-18T09:00:00Z").getTime();
const HEATMAP_DAYS = Array.from({ length: 119 }, (_, i) => {
  const d = new Date(2026, 0, 1 + i);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { date: iso, count: (i * 7 + 3) % 11 };
});

class Boundary extends React.Component<{ children: React.ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    return this.state.err
      ? <span style={{ fontSize: 11.5, color: "#B05A20", fontStyle: "italic" }}>demo needs props — component installed</span>
      : this.props.children;
  }
}

function Demo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18, borderRadius: 14, background: "#fff", border: "1px solid rgba(23,23,30,0.08)", minHeight: 72 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a938a" }}>{title}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}><Boundary>{children}</Boundary></div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>{children}</div>;
}

export default function ComponentsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const [role, setRole] = useState("director");
  // Client-only render: these vendored components have varied APIs, and a throw
  // during SSR 500s the whole page in dev before the client error boundary can
  // catch it. Rendering after mount means SSR can't crash and each demo's
  // boundary handles any prop mismatch on the client.
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f2ef", color: "#20242e", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "48px 24px 160px", display: "flex", justifyContent: "center" }}>
      <div className="arc-scope" data-accent="coral" style={{ width: "100%", maxWidth: 980, display: "flex", flexDirection: "column", gap: 40 }}>
        <ArcProvider>
          <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Components</h1>
            <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 640 }}>
              The three in production (Button, RadioGroup, LabelInput) plus the installed uiarc free set. Each demo is
              error-bounded; anything showing &ldquo;needs props&rdquo; is installed but awaiting a tailored demo.
            </p>
          </header>

          {!mounted ? <p style={{ fontSize: 14, color: "#9a938a" }}>Loading components…</p> : <>
          <Section title="Production">
            <Grid>
              <Demo title="Button"><A.Button variant="primary">Primary</A.Button><A.Button variant="secondary">Secondary</A.Button><A.Button variant="ghost">Ghost</A.Button></Demo>
              <Demo title="Radio group"><div style={{ width: "100%" }}><A.RadioGroup label="Role" name="r" value={role} onValueChange={setRole} options={[{ value: "director", label: "Director" }, { value: "negotiator", label: "Negotiator" }]} /></div></Demo>
              <Demo title="Label input"><LabelInput field="Email" /></Demo>
            </Grid>
          </Section>

          <Section title="Actions">
            <Grid>
              <Demo title="Action button"><A.ActionButton>Save</A.ActionButton></Demo>
              <Demo title="Copy button"><A.CopyButton value="Copy me" /></Demo>
              <Demo title="Confirm morph"><A.ConfirmMorph onConfirm={noop}>Delete</A.ConfirmMorph></Demo>
              <Demo title="Hold to confirm"><A.HoldToConfirm onConfirm={noop}>Hold to delete</A.HoldToConfirm></Demo>
              <Demo title="Expanding button group"><A.ExpandingButtonGroup label="Actions" items={[{ id: "edit", label: "Edit", icon: <Pencil size={16} /> }, { id: "share", label: "Share", icon: <Share2 size={16} /> }, { id: "archive", label: "Archive", icon: <Archive size={16} /> }]} /></Demo>
              <Demo title="Context menu"><A.ContextMenu items={contextMenuExampleItems}><div style={{ padding: 14, border: "1px dashed #ccc", borderRadius: 8 }}>Right-click</div></A.ContextMenu></Demo>
              <Demo title="User menu"><A.UserMenu user={{ name: "Sarah Jones", email: "sarah@agency.co.uk", plan: "Director" }} /></Demo>
              <Demo title="Theme switch"><A.ThemeSwitch /></Demo>
            </Grid>
          </Section>

          <Section title="Inputs">
            <Grid>
              <Demo title="Input"><A.Input label="Email" /></Demo>
              <Demo title="Textarea"><A.Textarea label="Notes" /></Demo>
              <Demo title="Password field"><A.PasswordField label="Password" /></Demo>
              <Demo title="Number field"><A.NumberField label="Quantity" /></Demo>
              <Demo title="Money input"><A.MoneyInput label="Amount" /></Demo>
              <Demo title="Phone input"><A.PhoneInput label="Phone" /></Demo>
              <Demo title="OTP"><A.OtpInput label="Code" length={6} /></Demo>
              <Demo title="Search field"><A.SearchField label="Search" /></Demo>
              <Demo title="Expanding search"><A.ExpandingSearch label="Search" /></Demo>
              <Demo title="Inline edit"><A.InlineEdit label="Project name" value="Oakfield Drive" onSave={noop} /></Demo>
              <Demo title="Tag input"><A.TagInput label="Tags" defaultValue={["design", "research"]} /></Demo>
              <Demo title="Mention input"><A.MentionInput label="Comment" people={[{ id: "1", name: "Sarah" }]} /></Demo>
              <Demo title="Combobox"><A.Combobox label="Pick one" options={OPTS} /></Demo>
              <Demo title="Multi-select"><A.MultiSelect label="Pick many" options={OPTS} /></Demo>
              <Demo title="Morph select"><A.MorphSelect label="Select" items={OPTS} /></Demo>
              <Demo title="Select"><A.Select label="Select" options={OPTS} /></Demo>
              <Demo title="Chip group"><A.ChipGroup label="Topics" options={OPTS} value={["a"]} onValueChange={noop} /></Demo>
              <Demo title="Radio cards"><A.RadioCards options={OPTS} defaultValue="a" /></Demo>
              <Demo title="Billing toggle"><A.BillingToggle /></Demo>
              <Demo title="Toggle group"><A.ToggleGroup type="single" defaultValue="a"><A.ToggleGroupItem value="a">A</A.ToggleGroupItem><A.ToggleGroupItem value="b">B</A.ToggleGroupItem></A.ToggleGroup></Demo>
              <Demo title="Switch"><A.Switch /></Demo>
              <Demo title="Checkbox"><A.Checkbox /></Demo>
              <Demo title="Rating"><A.Rating label="Rating" defaultValue={3} /></Demo>
              <Demo title="Slider"><div style={{ width: 200 }}><A.Slider label="Volume" defaultValue={40} /></div></Demo>
              <Demo title="Elastic slider"><div style={{ width: 200 }}><A.ElasticSlider label="Brightness" defaultValue={40} /></div></Demo>
              <Demo title="Ruler slider"><div style={{ width: 220 }}><A.RulerSlider label="Weight" defaultValue={40} /></div></Demo>
              <Demo title="Scrub input"><A.ScrubInput label="Value" defaultValue={10} /></Demo>
            </Grid>
          </Section>

          <Section title="Disclosure">
            <Grid>
              <Demo title="Breadcrumb"><A.Breadcrumb items={[{ label: "Home", href: "#" }, { label: "Files", href: "#" }, { label: "Oakfield" }]} /></Demo>
              <Demo title="Scroll area"><div style={{ height: 90, width: 220 }}><A.ScrollArea><div style={{ height: 300 }}>Scrollable content…</div></A.ScrollArea></div></Demo>
              <Demo title="Expandable card"><A.ExpandableCard title="Details"><p>Hidden content.</p></A.ExpandableCard></Demo>
              <Demo title="Expandable text"><A.ExpandableText>Long passage of text that can be expanded and collapsed by the reader when it runs past a couple of lines in the layout.</A.ExpandableText></Demo>
              <Demo title="Accordion"><A.Accordion items={[{ title: "One", content: "First" }, { title: "Two", content: "Second" }]} /></Demo>
              <Demo title="Tabs"><div style={{ width: "100%" }}><A.Tabs defaultValue="overview"><A.TabsList aria-label="Project"><A.TabsTrigger value="overview">Overview</A.TabsTrigger><A.TabsTrigger value="activity">Activity</A.TabsTrigger></A.TabsList><A.TabsContent value="overview">Summary and stats</A.TabsContent><A.TabsContent value="activity">Recent events</A.TabsContent></A.Tabs></div></Demo>
              <Demo title="Tooltip"><A.Tooltip content="A tooltip"><span style={{ textDecoration: "underline dotted" }}>Hover me</span></A.Tooltip></Demo>
            </Grid>
          </Section>

          <Section title="Feedback">
            <Grid>
              <Demo title="Alert"><A.Alert title="Heads up" tone="info">Something to know.</A.Alert></Demo>
              <Demo title="Announcement bar"><div style={{ width: "100%" }}><A.AnnouncementBar id="demo-banner" tone="inverted" messages={[{ id: "beta", message: "Workflows are now in beta.", action: { label: "Read more", href: "#" } }, { id: "sale", message: "New components added this week." }]} /></div></Demo>
              <Demo title="Cookie consent"><A.CookieConsent /></Demo>
              <Demo title="Progress"><div style={{ width: 220 }}><A.Progress value={62} /></div></Demo>
              <Demo title="Skeleton"><A.Skeleton lines={3} avatar /></Demo>
              <Demo title="Stepper"><A.Stepper current={1} label="Setup" steps={[{ id: "a", label: "Account" }, { id: "b", label: "Agency" }, { id: "c", label: "Done" }]} /></Demo>
              <Demo title="Countdown"><A.Countdown target="2027-12-31T00:00:00Z" /></Demo>
              <Demo title="Usage meter"><A.UsageMeter label="Storage" limit={1000} unit="GB" segments={[{ id: "files", label: "Files", value: 320 }, { id: "media", label: "Media", value: 100 }]} /></Demo>
              <Demo title="Onboarding checklist"><A.OnboardingChecklist title="Get started" steps={[{ id: "1", title: "Add your logo" }, { id: "2", title: "Invite your team" }]} /></Demo>
              <Demo title="Pagination"><A.Pagination page={2} pageCount={10} onPageChange={noop} /></Demo>
              <Demo title="Empty state"><A.EmptyState title="Nothing here" description="Add your first item to get started." /></Demo>
            </Grid>
          </Section>

          <Section title="Data">
            <Grid>
              <Demo title="Avatar"><A.Avatar name="Sarah Jones" status="online" /><A.Avatar name="Tom Lee" size="lg" /></Demo>
              <Demo title="Avatar group"><A.AvatarGroup members={[{ name: "Sarah Jones" }, { name: "Tom Lee" }, { name: "Priya Shah" }, { name: "James Patel" }, { name: "Mei Lin" }]} /></Demo>
              <Demo title="Badge"><A.Badge>New</A.Badge><A.Badge dot>Live</A.Badge><A.Badge outline>Draft</A.Badge></Demo>
              <Demo title="Card"><A.Card>Card body</A.Card></Demo>
              <Demo title="Metric card"><A.MetricCard label="Revenue" value={12480} context="vs last month" change="+12%" /></Demo>
              <Demo title="Animated counter"><A.AnimatedCounter value={1284} label="Signups" /></Demo>
              <Demo title="Sparkline"><A.Sparkline data={[3, 7, 4, 9, 6, 8, 5, 11, 9]} /></Demo>
              <Demo title="Gauge"><A.Gauge value={68} /></Demo>
              <Demo title="Activity heatmap"><A.ActivityHeatmap label="Client contact in 2026" period="2026" days={HEATMAP_DAYS} /></Demo>
              <Demo title="Timeline"><A.Timeline label="Activity" now={NOW} events={[{ id: "1", at: NOW - 3_600_000, actor: "Sarah", title: "instructed the solicitor" }, { id: "2", at: NOW - 86_400_000, actor: "Tom", title: "ordered searches" }]} /></Demo>
              <Demo title="Comment thread"><A.CommentThread currentUser={{ id: "u1", name: "Sarah Jones" }} comments={[{ id: "1", author: { id: "u1", name: "Sarah Jones" }, body: "Looks good to me.", createdAt: "2h" }]} /></Demo>
              <Demo title="Carousel"><div style={{ width: "100%" }}><A.Carousel label="Highlights">{["Oakfield Drive", "Maple Court", "Elm Terrace"].map((t, i) => <div key={t} style={{ display: "grid", placeItems: "center", height: 120, borderRadius: 12, color: "#fff", fontWeight: 600, background: `linear-gradient(135deg, ${["#ff8365", "#6b74ff", "#2bb673"][i]}, rgba(0,0,0,0.15))` }}>{t}</div>)}</A.Carousel></div></Demo>
              <Demo title="Card stack"><A.CardStack label="Shortlist" items={[{ id: "1", title: "Oakfield Drive" }, { id: "2", title: "Maple Court" }, { id: "3", title: "Elm Terrace" }]} getKey={(c: { id: string }) => c.id} getLabel={(c: { title: string }) => c.title} renderCard={(c: { title: string }) => <div style={{ display: "grid", placeItems: "center", height: "100%", fontWeight: 600 }}>{c.title}</div>} /></Demo>
            </Grid>
          </Section>

          <Section title="Text">
            <Grid>
              <Demo title="Text reveal"><div style={{ fontSize: 20, fontWeight: 600 }}><A.TextReveal text="Text that reveals on view." /></div></Demo>
              <Demo title="Text morph"><div style={{ fontSize: 20, fontWeight: 600 }}><A.TextMorph>Morphing label</A.TextMorph></div></Demo>
              <Demo title="In-view title"><div style={{ fontSize: 20, fontWeight: 600 }}><A.InViewTitle text="A title that animates in." /></div></Demo>
            </Grid>
          </Section>

          <Section title="Remaining to import">
            <div style={{ fontSize: 13, color: "#6b6258", lineHeight: 1.7 }}>
              <p style={{ margin: "4px 0", fontWeight: 700 }}>Skipped — heavy dependencies (your call):</p>
              <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
                <li>Charts: line, bar, donut, streamgraph, brush, waffle, slope, ridgeline, treemap</li>
                <li>Rich text editor, code block, JSON viewer</li>
                <li>Calendar, date / date-range / time / colour pickers, signature pad</li>
                <li>Sortable data table, tree table, tree view</li>
              </ul>
              <p style={{ margin: "4px 0", fontWeight: 700 }}>Skipped — incompatible with our motion version:</p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Text shimmer (imports <code>usePageInView</code>, not in motion 11)</li>
              </ul>
            </div>
          </Section>
          </>}
        </ArcProvider>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h2>
      {children}
    </section>
  );
}
