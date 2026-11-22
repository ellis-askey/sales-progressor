import { SetupCard } from "@/components/agent/SetupCard";
import { OnboardingHero } from "@/components/ui/OnboardingHero";

// Updates onboarding empty state (agency users, no updates yet). The hero is the
// canonical OnboardingHero; the three cards are canonical SetupCards. There's no
// user action that creates an update, so the cards are info-only.
// (The old hidden "Learn more / View guide" card was removed 2026-11-22 — it was
// a dead control behind a flag; re-add it as a real link when the guide exists.)
export function CommsEmptyState({ progressorName = null }: { progressorName?: string | null }) {
  return (
    <div className="agent-bloom-stagger agent-canon-cta" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <OnboardingHero
        title="Nothing to catch up on yet"
        body={progressorName
          ? `Updates across your sales, including activity from ${progressorName}, will appear here as they happen.`
          : "Updates from across your sales will appear here as they happen."}
        art={{ light: "/updates-hero.png", dark: "/updates-hero-dark.png", maxWidth: "46%", maskStart: "42%" }}
      />

      {/* What you'll see here */}
      <div>
        <p className="agent-eyebrow" style={{ marginBottom: 12 }}>What you&rsquo;ll see here</p>
        <div className="setup-cards-3">
          <SetupCard
            glassId="empty-updates-solicitor"
            label="Updates empty · Solicitor replies"
            iconSrc="/updates-solicitor.png"
            tint="coral"
            title="Solicitor replies, without the chasing"
            desc="See replies to automatic chases, including any dates or updates provided by solicitors."
          />
          <SetupCard
            glassId="empty-updates-progress"
            label="Updates empty · File progress"
            iconSrc="/updates-progress.png"
            tint="blue"
            title="See every sale's progress"
            desc="View each sale's current stage, progress towards completion and what needs attention next."
          />
          <SetupCard
            glassId="empty-updates-confirmed"
            label="Updates empty · Who confirmed"
            iconSrc="/updates-confirmed.png"
            tint="green"
            title="See who confirmed each step"
            desc="Know when a buyer, seller or solicitor confirms a milestone, and who confirmed it."
          />
        </div>
      </div>
    </div>
  );
}
