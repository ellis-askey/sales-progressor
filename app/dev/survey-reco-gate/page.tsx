"use client";

// /dev harness for the "survey quotes → TSP-outsourced only" change. Renders
// every component that changed, byte for byte in this state, so the UI can be
// reviewed without seeding a non-TSP file. Nothing here hits the database — the
// recommendation card is rendered against a fake token, so its button shows the
// "couldn't find your details" error state (expected on /dev).

import { SurveyRecommendationCard } from "@/components/portal/SurveyRecommendationCard";
import { P } from "@/components/portal/portal-ui";

const AGENCY = "Hunters Richmond";
const BUYER = "Jonathan Whitfield";
const ADDRESS = "14 Marlborough Road, Richmond, TW10 6JR";

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>{title}</h2>
      {note && <p style={{ fontSize: 13, color: "#555", margin: "0 0 14px", lineHeight: 1.5 }}>{note}</p>}
      {children}
    </section>
  );
}

// A phone-width light "portal" frame so the portal tokens render as they would
// on a real buyer page.
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 420, maxWidth: "100%", background: "#F6F7F9", borderRadius: 20, padding: 18, border: "1px solid #E6E8EC" }}>
      {children}
    </div>
  );
}

function MailPreview({ subject, body }: { subject: string; body: string }) {
  return (
    <div style={{ width: 620, maxWidth: "100%", border: "1px solid #E6E8EC", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #EEF0F3", background: "#FAFBFC" }}>
        <div style={{ fontSize: 11, color: "#8B91A3", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Subject</div>
        <div style={{ fontSize: 14, color: "#1A1D29", fontWeight: 600 }}>{subject}</div>
      </div>
      <pre style={{ margin: 0, padding: 16, fontSize: 13.5, lineHeight: 1.6, color: "#1A1D29", whiteSpace: "pre-wrap", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>{body}</pre>
    </div>
  );
}

export default function SurveyRecoGateDevPage() {
  const agentEmailSubject = `${BUYER.split(" ")[0]} would like a surveyor recommendation: ${ADDRESS}`;
  const agentEmailBody = `Hi Priya,

${BUYER} has asked whether you can recommend a surveyor for ${ADDRESS}.

If you have someone you'd suggest, reply to this email to reach ${BUYER.split(" ")[0]}, or contact them on jonathan.whitfield@example.com / 07700 900123.

Thanks,
Sales Progressor`;

  return (
    <main style={{ padding: "32px 28px 96px", maxWidth: 980, margin: "0 auto", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0A0A0A", marginBottom: 6 }}>
        Survey quotes → TSP-outsourced only
      </h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 32, lineHeight: 1.55, maxWidth: 680 }}>
        Temporary gate. Only files TSP progresses keep the vetted-surveyor quote network. Self-managed,
        in-house, and external-business files route the buyer to &ldquo;ask my agent for a recommendation&rdquo; instead.
        Every component that changed is shown below in its new state.
      </p>

      <Section
        title="1 · Buyer card — ask state (non-TSP homepage + menu)"
        note="Replaces the blue 'Get a survey quote' card on the portal homepage and the quote entry in the portal menu. The accent follows the agency's portal theme. (The button errors here because /dev has no real file.)"
      >
        <Phone>
          <SurveyRecommendationCard token="dev-fake-token" agencyName={AGENCY} asked={false} />
        </Phone>
      </Section>

      <Section
        title="2 · Buyer card — asked state"
        note="After tapping, the card flips to this and can't refire. Shown on reload too (we record the ask on the file)."
      >
        <Phone>
          <SurveyRecommendationCard token="dev-fake-token" agencyName={AGENCY} asked={true} />
        </Phone>
      </Section>

      <Section
        title="3 · Email to the agent"
        note="Sent when the buyer taps 'Ask for a recommendation'. Reply-to is the buyer, so the agent hits reply and reaches them directly. Also logged on the file timeline."
      >
        <MailPreview subject={agentEmailSubject} body={agentEmailBody} />
      </Section>

      <Section
        title="4 · /quote page — blocked on non-TSP files"
        note="Defence in depth: a stale /quote link on a non-TSP file shows this dead-end instead of the provider picker."
      >
        <div style={{ width: 480, maxWidth: "100%", border: "1px solid #E6E8EC", borderRadius: 12, background: "#fff", textAlign: "center", padding: "56px 24px" }}>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: "#1A1D29", marginBottom: 8 }}>Arranging your survey</h3>
          <p style={{ fontSize: 14, color: "#8B91A3", margin: 0, lineHeight: 1.5 }}>
            Your agent is looking after your survey on this sale. If you&apos;d like a recommendation, ask them from your portal and they&apos;ll be in touch.
          </p>
        </div>
      </Section>

      <Section
        title="5 · Overdue-survey chase email (non-TSP, survey is the only due item)"
        note="On non-TSP files a chased survey gets this nudge instead of the quote offer, with an 'Open your portal' button. Shown when the survey is the sole due item; when bundled with other items it rides as a normal 'book your survey' line."
      >
        <MailPreview
          subject={`Quick update on ${ADDRESS}`}
          body={`Now's a good time to arrange your property survey.

A survey gives you an independent assessment of the property's condition, helping you understand any potential issues before you commit to your purchase.

If you haven't chosen a surveyor yet, you can request a recommendation from your estate agent directly through your portal.

Already booked your survey? Simply confirm this in your portal so everyone knows it's underway.

[ button: Open your portal ]`}
        />
      </Section>

      <Section title="6 · Where the gate is applied">
        <div style={{ border: "1px solid #E6E8EC", borderRadius: 12, overflow: "hidden", fontSize: 13.5 }}>
          {[
            ["Portal homepage card", "Non-TSP buyer → recommendation card; seller → hidden"],
            ["Portal menu 'Request a quote'", "Non-TSP buyer → recommendation card; seller → hidden"],
            ["Overdue-survey chase email", "Non-TSP → quote button removed (plain nudge)"],
            ["/quote page + submit action", "Non-TSP → blocked dead-end / refused"],
            ["Agent file sidebar 'Send quote link'", "Shown on TSP-outsourced only (was all outsourced)"],
          ].map(([a, b], i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "11px 14px", background: i % 2 ? "#FAFBFC" : "#fff", borderTop: i ? "1px solid #EEF0F3" : "none" }}>
              <div style={{ flex: "0 0 240px", fontWeight: 700, color: "#1A1D29" }}>{a}</div>
              <div style={{ color: "#555" }}>{b}</div>
            </div>
          ))}
        </div>
      </Section>

      <p style={{ fontSize: 12, color: P.textMuted, marginTop: 24 }}>
        Components: SurveyRecommendationCard · request-survey-recommendation action · survey-providers gate ·
        portal page · PortalMenuDrawer · client-chase-digest · /quote page + actions · AgentFileSidebar · SidebarPanel.
      </p>
    </main>
  );
}
