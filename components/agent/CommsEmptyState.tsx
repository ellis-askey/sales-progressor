import { ChatText, BookOpen, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";
import { Pill } from "@/components/ui/Pill";

// The "Learn more about Updates" guide card is built below but hidden until its
// "View guide" target exists (logged in docs/active/TODO.md). The three cards'
// "Learn more" links land at the same time, so they share this flag.
const SHOW_UPDATES_GUIDE = false;

// Updates onboarding empty state (agency users, no updates yet). Mirrors the
// Completions and To-Do empty states. There's no user action that creates an
// update, so the cards are info-only until the guides are built.
export function CommsEmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 210, padding: "28px 30px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        <HeroArt light="/updates-hero.png" dark="/updates-hero-dark.png" maxWidth="46%" maskStart="42%" />
        <div style={{ position: "relative", maxWidth: 480 }}>
          <Pill tone="brand" size="sm" glass style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            Nothing here yet
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
            Nothing to catch up on yet
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 300 }}>
            Updates from across your sales will appear here as they happen.
          </p>
        </div>
      </div>

      {/* What you'll see here */}
      <div>
        <p className="agent-eyebrow" style={{ marginBottom: 12 }}>What you&rsquo;ll see here</p>
        <div className="setup-cards-3">
          <SetupCard
            glassId="empty-updates-solicitor"
            label="Updates empty · Solicitor replies"
            iconSrc="/updates-solicitor.png"
            tint="coral"
            title="Solicitor replies, no chasing"
            desc="When a solicitor replies to one of our automatic chases, their reply and any dates they give appear right here."
          />
          <SetupCard
            glassId="empty-updates-progress"
            label="Updates empty · File progress"
            iconSrc="/updates-progress.png"
            tint="blue"
            title="See every file's progress"
            desc="Next to each update you'll see that sale's completion, its current stage and what it needs next."
          />
          <SetupCard
            glassId="empty-updates-confirmed"
            label="Updates empty · Who confirmed"
            iconSrc="/updates-confirmed.png"
            tint="green"
            title="See who confirmed each step"
            desc="As a buyer, seller or their solicitor confirms a step, you'll see it marked done and exactly who did it."
          />
        </div>
      </div>

      {/* Guide card — built, hidden until its "View guide" target exists. */}
      {SHOW_UPDATES_GUIDE && (
        <div className="agent-glass" style={{ padding: "18px 20px", borderRadius: "var(--agent-radius-lg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(var(--agent-coral-rgb), 0.12)", color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ChatText size={20} weight="regular" />
            </span>
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Learn more about Updates</p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>See how Updates keeps you and your team across every important movement.</p>
            </div>
          </div>
          <button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 8, flexShrink: 0 }}>
            <BookOpen size={14} weight="bold" />
            View guide
            <ArrowSquareOut size={13} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
