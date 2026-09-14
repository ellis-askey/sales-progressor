import { ListBullets, Clock } from "@phosphor-icons/react/dist/ssr";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";
import { Pill } from "@/components/ui/Pill";

// Enquiries empty state — shown when no sale is currently in the enquiries stage
// (before enquiries are raised, or after they're satisfied). Reached only once
// the agency has a live file (the nav gates on hasSelfManagedFiles), so this is
// the "all clear" resting state, not a brand-new-account state. Mirrors the
// Comms / To-Do / Completions empty states. Info-only: there's no user action
// that creates an enquiry, so the cards carry no CTA.
export function EnquiriesEmptyState() {
  return (
    <div className="agent-stagger" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 210, padding: "28px 30px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        <HeroArt light="/enquiries-hero.png" dark="/enquiries-hero-dark.png" maxWidth="46%" maskStart="42%" />
        <div style={{ position: "relative", maxWidth: 480 }}>
          <Pill tone="success" size="sm" glass style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            All clear
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
            No enquiries need your attention
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 400 }}>
            When a sale reaches the enquiries stage, anything that needs chasing or reviewing will appear here.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div>
        <p className="agent-eyebrow" style={{ marginBottom: 12 }}>How it works</p>
        <div className="setup-cards-2">
          <SetupCard
            glassId="empty-enquiries-overview"
            label="Enquiries empty · One place"
            icon={<ListBullets size={20} weight="regular" />}
            tint="coral"
            title="Everything in one place"
            desc="See which sale has enquiries outstanding, who they're with and how long they've been waiting."
          />
          <SetupCard
            glassId="empty-enquiries-chasing"
            label="Enquiries empty · Needs chasing"
            icon={<Clock size={20} weight="regular" />}
            tint="coral"
            title="Know what needs chasing"
            desc="Once replies are due, we'll show you where things are sitting so you know what needs attention."
          />
        </div>
      </div>
    </div>
  );
}
