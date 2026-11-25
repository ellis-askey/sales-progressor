import { Section } from "./_shell";
import { SectionHead, Reveal } from "../ui";

const PILLARS = [
  {
    n: "01",
    title: "An existing business",
    body: "Working software, real users, paying customers and established infrastructure. We are not starting with an idea or a blank sheet of paper.",
  },
  {
    n: "02",
    title: "A real agency",
    body: "Boardwalk shapes functionality around the practical, day-to-day needs of a growing estate agency. The product is built against real workflows.",
  },
  {
    n: "03",
    title: "National growth",
    body: "Invest in marketing now and commercialise reusable tools as they become ready, so we build the product and grow the business at the same time.",
  },
];

export function OpportunitySection() {
  return (
    <Section id="opportunity">
      <SectionHead
        eyebrow="01 — The opportunity"
        title={
          <>
            An opportunity to build something bigger<span className="prop-stop">.</span>
          </>
        }
        lead="The conversations we have had so far have made me think about what we could achieve beyond our existing relationship. I believe we can combine the platform I have already built with your experience of running and growing an estate agency, then take that technology to the wider industry."
      />

      <div className="prop-grid prop-grid-3" style={{ marginTop: "2.5rem" }}>
        {PILLARS.map((p, i) => (
          <Reveal key={p.n} delay={i * 70}>
            <div className="prop-card prop-card--pad-lg" style={{ height: "100%" }}>
              <div className="prop-accent-rule" style={{ marginBottom: "1.1rem" }} />
              <div className="prop-caption prop-tabular" style={{ marginBottom: "0.4rem" }}>{p.n}</div>
              <h3 className="prop-h2" style={{ marginBottom: "0.7rem" }}>{p.title}</h3>
              <p className="prop-body">{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="prop-panel" style={{ marginTop: "2.5rem", display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
          <p className="prop-serif" style={{ fontSize: "clamp(1.2rem, 2.4vw, 1.7rem)", lineHeight: 1.35, color: "var(--prop-navy-ink)", margin: 0 }}>
            Boardwalk benefits from better technology. TSP benefits from operational expertise, commercial investment and a
            growing customer base. Together, we build a business with national potential.
          </p>
          <p className="prop-body" style={{ color: "var(--prop-navy-ink-2)", margin: 0 }}>
            I would lead product and technology; you would lead commercial growth and marketing. We would shape the wider
            strategy together, with an equity-based partnership allowing us all to participate in the long-term success of the
            business. From January 2027, TSP operates as a software-only business — the focus is the platform, its customers and
            the wider opportunity.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
