import { Section } from "./_shell";
import { SectionHead, Reveal, Disclosure } from "../ui";

export function EquitySection() {
  return (
    <Section id="equity">
      <SectionHead
        eyebrow="15 — Partnership & equity"
        title={
          <>
            A meaningful stake in what we build<span className="prop-stop">.</span>
          </>
        }
        lead="An equity-based partnership that recognises the business today and the value we can create together. An initial capital investment into The Sales Progressor Ltd, in return for a minority equity stake."
      />

      <div className="prop-grid prop-grid-2" style={{ marginTop: "2.25rem" }}>
        <Reveal>
          <div className="prop-card prop-card--pad-lg" style={{ height: "100%" }}>
            <p className="prop-eyebrow" style={{ marginBottom: "0.8rem" }}>Boardwalk as a customer</p>
            <p className="prop-body">
              Access to the platform and agreed new functionality, shaped around your operational needs. Software pricing and
              included development scope are agreed separately — the customer relationship stays distinct from the investment.
            </p>
          </div>
        </Reveal>
        <Reveal delay={70}>
          <div className="prop-card prop-card--pad-lg" style={{ height: "100%" }}>
            <p className="prop-eyebrow" style={{ marginBottom: "0.8rem" }}>Nick & Jack as partners</p>
            <p className="prop-body">
              Participation in the value and success of TSP through agreed equity, strategic influence and commercial leadership.
              Capital goes into the company, not a personal share sale. I would retain majority ownership and technical direction.
            </p>
          </div>
        </Reveal>
      </div>

      <div className="prop-stack" style={{ marginTop: "2rem" }}>
        <Disclosure title="An opportunity to increase participation over time">
          <p className="prop-body">
            I would be open to an agreed route to further equity if we achieve significant, mutually agreed growth milestones —
            for example sustained customer revenue, profitable acquisition, retention or further investment. Any additional equity
            would be defined and capped in advance, not an automatic entitlement, and structured to stay fair to all of us.
          </p>
        </Disclosure>
        <Disclosure title="What the formal agreement would cover">
          <p className="prop-body">
            Capital and equity terms, shareholder rights, IP ownership and future developments, agreed roles, technical and
            commercial decision-making, budgets, reserved matters, future funding, reinvestment, confidentiality, data
            protection, conflicts of interest and exit arrangements.
          </p>
        </Disclosure>
      </div>

      <p className="prop-fnote" style={{ marginTop: "1.5rem" }}>
        No specific equity percentage, valuation, milestone award or investor commitment is offered here as agreed. Existing IP
        and future reusable developments are intended to remain within TSP, subject to verification and definitive legal
        documentation.
      </p>
    </Section>
  );
}
