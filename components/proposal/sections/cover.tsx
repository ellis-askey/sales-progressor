import { Section } from "./_shell";
import { Chip, PButton } from "../ui";

export function CoverSection({ onExplore }: { onExplore: () => void }) {
  return (
    <Section id="cover" flush>
      <div style={{ paddingTop: "clamp(2rem, 6vw, 4.5rem)", paddingBottom: "clamp(1rem, 3vw, 2rem)" }}>
        <div className="prop-flex-wrap" style={{ marginBottom: "1.6rem" }}>
          <Chip tone="coral">Confidential</Chip>
          <Chip>Strategic partnership proposal</Chip>
          <Chip>Bristol · 11 December 2026</Chip>
        </div>

        <div className="prop-cover-grid">
          <div>
            <p className="prop-eyebrow" style={{ marginBottom: "1.1rem" }}>
              The Sales Progressor × Boardwalk Property Co
            </p>
            <h1 className="prop-display">
              Beyond Sales<br />Progression<span className="prop-stop">.</span>
            </h1>
            <p className="prop-lead" style={{ marginTop: "1.4rem", maxWidth: "34ch" }}>
              Building the next generation of estate agency technology. Built around a real agency. Designed for the wider
              industry.
            </p>
            <div className="prop-flex-wrap" style={{ marginTop: "2rem", gap: "0.75rem" }}>
              <PButton onClick={onExplore}>
                Explore the proposal
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </PButton>
              <span className="prop-caption" style={{ alignSelf: "center" }}>
                A two-minute overview, or twenty minutes in the models. Prepared by Ellis Askey for Nick and Jack.
              </span>
            </div>
          </div>

          <div className="prop-cover-art" aria-hidden>
            <CubeMotif />
          </div>
        </div>

        {/* The central proposition — prominent, in the editorial serif. */}
        <div className="prop-panel" style={{ marginTop: "clamp(2.5rem, 5vw, 4rem)" }}>
          <p className="prop-eyebrow" style={{ marginBottom: "1rem" }}>The proposition</p>
          <p className="prop-serif" style={{ fontSize: "clamp(1.5rem, 3.2vw, 2.35rem)", lineHeight: 1.22, color: "var(--prop-navy-ink)", margin: 0 }}>
            What if every operational problem we solve for Boardwalk becomes a{" "}
            <span className="prop-coral-text" style={{ color: "var(--prop-coral-soft)" }}>commercial opportunity</span> across the
            entire estate agency industry?
          </p>
        </div>
      </div>

      <style>{`
        .prop-cover-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: clamp(1.5rem, 4vw, 3rem); align-items: center; }
        .prop-cover-art { display: flex; justify-content: center; }
        @media (max-width: 860px) {
          .prop-cover-grid { grid-template-columns: 1fr; }
          .prop-cover-art { order: -1; max-width: 360px; }
        }
      `}</style>
    </Section>
  );
}

function CubeMotif() {
  // An isometric network of cube outlines with one solid coral cube at the
  // centre — the printed cover, redrawn as light SVG line-art. Purely decorative.
  const line = "var(--prop-line-strong)";
  const ink = "var(--prop-ink-3)";
  return (
    <svg width="100%" viewBox="0 0 420 380" fill="none" style={{ maxWidth: 440 }}>
      <defs>
        <linearGradient id="prop-cube" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--prop-coral-soft)" />
          <stop offset="1" stopColor="var(--prop-coral)" />
        </linearGradient>
      </defs>
      {/* connecting lines */}
      <g stroke={line} strokeWidth="1">
        <path d="M210 190 L90 120 M210 190 L330 120 M210 190 L90 260 M210 190 L330 260 M210 190 L210 80 M210 190 L210 300" />
      </g>
      {/* satellite cubes (outline) */}
      {[
        [90, 120],
        [330, 120],
        [90, 260],
        [330, 260],
        [210, 70],
        [210, 310],
      ].map(([x, y], i) => (
        <Cube key={i} cx={x} cy={y} s={30} stroke={ink} />
      ))}
      {/* centre cube (solid coral) */}
      <SolidCube cx={210} cy={190} s={52} />
    </svg>
  );
}

function Cube({ cx, cy, s, stroke }: { cx: number; cy: number; s: number; stroke: string }) {
  const h = s * 0.5;
  const top = `${cx},${cy - s} ${cx + s},${cy - h} ${cx},${cy} ${cx - s},${cy - h}`;
  return (
    <g stroke={stroke} strokeWidth="1.1" fill="none" strokeLinejoin="round" opacity="0.8">
      <polygon points={top} />
      <path d={`M${cx - s},${cy - h} L${cx - s},${cy + h} L${cx},${cy + s} L${cx},${cy}`} />
      <path d={`M${cx + s},${cy - h} L${cx + s},${cy + h} L${cx},${cy + s} L${cx},${cy}`} />
    </g>
  );
}

function SolidCube({ cx, cy, s }: { cx: number; cy: number; s: number }) {
  const h = s * 0.5;
  return (
    <g strokeLinejoin="round">
      <polygon points={`${cx},${cy - s} ${cx + s},${cy - h} ${cx},${cy} ${cx - s},${cy - h}`} fill="url(#prop-cube)" />
      <polygon points={`${cx - s},${cy - h} ${cx - s},${cy + h} ${cx},${cy + s} ${cx},${cy}`} fill="var(--prop-coral-strong)" />
      <polygon points={`${cx + s},${cy - h} ${cx + s},${cy + h} ${cx},${cy + s} ${cx},${cy}`} fill="var(--prop-coral)" />
    </g>
  );
}
