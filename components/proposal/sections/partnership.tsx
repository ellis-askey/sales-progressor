import { Section } from "./_shell";
import { SectionHead, Reveal, Disclosure } from "../ui";

const ROLES = [
  {
    who: "Ellis",
    role: "Product & technology",
    summary: "Development, design, infrastructure, AI, security and technical direction.",
    practice:
      "I would lead the product vision, architecture, integrations and the technical roadmap — translating our operational ideas into reliable software that can scale. My job is to make sure what we build is production-grade, secure and genuinely reusable.",
  },
  {
    who: "Nick & Jack",
    role: "Commercial growth",
    summary: "Marketing, customer acquisition, positioning, industry relationships and commercial development.",
    practice:
      "You would lead how we reach agencies and how we grow — marketing, positioning, demonstrations, industry relationships and commercial development. Your individual responsibilities are something we would shape around your strengths and interests.",
  },
  {
    who: "Boardwalk",
    role: "Operational development partner",
    summary: "Real agency requirements, early access, day-to-day use and structured feedback.",
    practice:
      "Boardwalk becomes a flagship customer and our principal operational development partner. You and your team identify the tools and workflows that would genuinely improve the business; I build them to a commercial standard, with Boardwalk getting early access and feeding back through normal use.",
  },
];

export function PartnershipSection() {
  return (
    <Section id="partnership">
      <SectionHead
        eyebrow="03 — The partnership"
        title={
          <>
            Complementary strengths. Shared ambition<span className="prop-stop">.</span>
          </>
        }
        lead="A partnership built on three contributions, not a management hierarchy. We agree the priorities, objectives and budgets together — then each of us has the autonomy to deliver within our own area."
      />

      <div className="prop-grid prop-grid-3" style={{ marginTop: "2.25rem" }}>
        {ROLES.map((r, i) => (
          <Reveal key={r.who} delay={i * 70}>
            <div className="prop-card prop-card--pad-lg" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <p className="prop-eyebrow" style={{ marginBottom: "0.7rem" }}>{r.who}</p>
              <h3 className="prop-h2" style={{ marginBottom: "0.6rem" }}>{r.role}</h3>
              <p className="prop-body" style={{ flex: 1 }}>{r.summary}</p>
              <div style={{ marginTop: "1rem" }}>
                <Disclosure title="What this looks like in practice">
                  <p className="prop-body" style={{ fontSize: "0.9375rem" }}>{r.practice}</p>
                </Disclosure>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="prop-partner-flow" aria-hidden>
        {[0, 1, 2].map((i) => (
          <svg key={i} width="18" height="30" viewBox="0 0 18 30" fill="none">
            <path d="M9 0v22m0 0l-5-5m5 5l5-5" stroke="var(--prop-coral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ))}
      </div>

      <Reveal>
        <div className="prop-panel" style={{ textAlign: "center" }}>
          <h3 className="prop-h2" style={{ color: "var(--prop-navy-ink)", margin: 0 }}>
            Shared strategy and a nationally scalable technology business
          </h3>
          <p className="prop-body" style={{ color: "var(--prop-navy-ink-2)", marginTop: "0.8rem", maxWidth: "62ch", marginInline: "auto" }}>
            The wider strategy, major commercial commitments, recruitment and investment decisions are shaped collectively.
            Boardwalk&rsquo;s customer relationship stays distinct from Nick and Jack&rsquo;s involvement in TSP as strategic
            partners and shareholders.
          </p>
        </div>
      </Reveal>

      <style>{`
        .prop-partner-flow { display: flex; justify-content: space-around; max-width: 680px; margin: 1.1rem auto; }
        @media (max-width: 560px) { .prop-partner-flow { max-width: 100%; } }
      `}</style>
    </Section>
  );
}
