"use client";

import { useMemo, useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Reveal, ResetButton, Note, gbp } from "../ui";
import { formsConsolidation, FORMS_BUNDLE_ANNUAL, FORMS_BUNDLE_MONTHLY, pct } from "@/lib/proposal/model";
import { useBeacon } from "../analytics-client";

interface Sub {
  id: string;
  label: string;
  annual: number;
}
const DEFAULT_SUBS: Sub[] = [
  { id: "typeform", label: "Typeform", annual: 550 },
  { id: "todoist", label: "Todoist", annual: 550 },
];

const BENEFITS = [
  "Forms that populate property files automatically",
  "Tasks connected to transactions and staff",
  "Shared operational context across the business",
  "Agency-specific functionality, not a generic tool",
  "Future AI access to connected operational data",
];

export function FormsSection() {
  const { track } = useBeacon();
  const [subs, setSubs] = useState<Sub[]>(DEFAULT_SUBS);
  const [touched, setTouched] = useState(false);

  const result = useMemo(() => formsConsolidation({ subscriptionsAnnual: subs.map((s) => s.annual) }), [subs]);

  const onInteract = () => {
    if (!touched) {
      setTouched(true);
      track("calculator_open", { detail: "forms", sectionId: "forms" });
    }
  };

  const setAnnual = (id: string, annual: number) => {
    onInteract();
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, annual } : s)));
  };
  const setLabel = (id: string, label: string) =>
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  const addSub = () => {
    onInteract();
    setSubs((prev) => [...prev, { id: `sub-${prev.length}-${Math.round(prev.reduce((a, s) => a + s.annual, 1))}`, label: "New subscription", annual: 0 }]);
  };
  const removeSub = (id: string) => setSubs((prev) => prev.filter((s) => s.id !== id));
  const reset = () => { setSubs(DEFAULT_SUBS); setTouched(false); };

  const maxBar = Math.max(result.existingAnnual, FORMS_BUNDLE_ANNUAL, 1);

  return (
    <Section id="forms">
      <SectionHead
        eyebrow="05 — Forms & tasks"
        title={
          <>
            Two subscriptions. One connected platform<span className="prop-stop">.</span>
          </>
        }
        lead="Forms and task management show how we can compete on price while offering more. Initial alternatives to Typeform and Todoist were built in an afternoon — that demonstrates speed, not a finished product. The real advantage is making them work with an agency's data and workflows."
      />

      <div className="prop-calc">
        <div className="prop-card prop-card--pad-lg">
          <div className="prop-between" style={{ marginBottom: "1.1rem" }}>
            <h3 className="prop-h3">Your current software</h3>
            <ResetButton onClick={reset} />
          </div>

          <div className="prop-stack">
            {subs.map((s) => (
              <div key={s.id} className="prop-card prop-card--quiet" style={{ padding: "0.9rem 1rem" }}>
                <div className="prop-between" style={{ marginBottom: "0.6rem" }}>
                  <input
                    className="prop-input"
                    style={{ height: 34, maxWidth: 200, fontSize: "0.875rem", fontWeight: 600 }}
                    value={s.label}
                    aria-label="Subscription name"
                    onChange={(e) => setLabel(s.id, e.target.value)}
                  />
                  <div className="prop-flex" style={{ alignItems: "center", gap: 8 }}>
                    <span className="prop-field-value">{gbp(s.annual)}/yr</span>
                    {subs.length > 1 && (
                      <button className="prop-iconbtn" style={{ width: 28, height: 28 }} aria-label={`Remove ${s.label}`} onClick={() => removeSub(s.id)}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <input
                  className="prop-slider"
                  type="range"
                  min={0}
                  max={2000}
                  step={25}
                  value={s.annual}
                  aria-label={`${s.label} annual cost`}
                  onChange={(e) => setAnnual(s.id, Number(e.target.value))}
                  style={{ ["--prop-track" as string]: `linear-gradient(90deg, var(--prop-coral) ${(s.annual / 2000) * 100}%, var(--prop-line-strong) ${(s.annual / 2000) * 100}%)` }}
                />
              </div>
            ))}
            <button className="prop-btn prop-btn--ghost prop-btn--sm" onClick={addSub}>
              + Add a subscription to consolidate
            </button>
          </div>
        </div>

        <Reveal>
          <div className="prop-card prop-card--pad-lg" style={{ height: "100%" }}>
            <h3 className="prop-h3" style={{ marginBottom: "1.2rem" }}>The integrated TSP bundle</h3>

            <div className="prop-stack-lg">
              <div>
                <div className="prop-between" style={{ marginBottom: 6 }}>
                  <span className="prop-field-label">Current combined spend</span>
                  <span className="prop-field-value">{gbp(result.existingAnnual)}/yr</span>
                </div>
                <div className="prop-bar-track"><div className="prop-bar-fill prop-bar-fill--navy" style={{ width: `${(result.existingAnnual / maxBar) * 100}%` }} /></div>
              </div>
              <div>
                <div className="prop-between" style={{ marginBottom: 6 }}>
                  <span className="prop-field-label">TSP Forms + Tasks bundle</span>
                  <span className="prop-field-value">{gbp(FORMS_BUNDLE_ANNUAL)}/yr</span>
                </div>
                <div className="prop-bar-track"><div className="prop-bar-fill" style={{ width: `${(FORMS_BUNDLE_ANNUAL / maxBar) * 100}%` }} /></div>
                <p className="prop-caption" style={{ marginTop: 6 }}>£{FORMS_BUNDLE_MONTHLY}/month · £29 each, or £49 together</p>
              </div>
            </div>

            <div className="prop-grid prop-grid-2" style={{ marginTop: "1.6rem" }}>
              <div>
                <div className="prop-stat-value prop-stat-value--coral">{result.annualSaving >= 0 ? gbp(result.annualSaving) : "—"}</div>
                <div className="prop-stat-label">Illustrative annual saving</div>
              </div>
              <div>
                <div className="prop-stat-value">{result.pctSaving > 0 ? pct(result.pctSaving, 1) : "—"}</div>
                <div className="prop-stat-label">Cost reduction</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal>
        <div className="prop-panel" style={{ marginTop: "2rem" }}>
          <h3 className="prop-h3" style={{ color: "var(--prop-navy-ink)", marginBottom: "1rem" }}>
            The benefit isn&rsquo;t only price
          </h3>
          <div className="prop-grid prop-grid-3">
            {BENEFITS.map((b) => (
              <div key={b} className="prop-flex" style={{ gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "var(--prop-coral-soft)", marginTop: 2, flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="prop-body" style={{ color: "var(--prop-navy-ink-2)", fontSize: "0.9375rem" }}>{b}</span>
              </div>
            ))}
          </div>
          <p className="prop-fnote" style={{ color: "var(--prop-navy-ink-2)", marginTop: "1.2rem" }}>
            A generic task app doesn&rsquo;t understand a property transaction. TSP can be designed to. Added subscriptions are
            hypothetical and don&rsquo;t imply those tools have been built — set your own illustrative figure for each.
          </p>
        </div>
      </Reveal>

      <Note>
        Proposed pricing is a working assumption, subject to commercial validation. Baseline assumes two subscriptions at £550
        each annually, giving the prospectus figure of {gbp(512)} saved (~46.5%).
      </Note>

      <style>{`
        .prop-calc { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(1rem, 2.5vw, 1.75rem); margin-top: 2rem; align-items: start; }
        @media (max-width: 820px) { .prop-calc { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}
