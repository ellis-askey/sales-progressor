"use client";

// /claim-bg-preview
// Twelve distinct background directions for the claim shell.
// Live claim pages stay on flat cream until Ellis picks one to refine.

import { useState } from "react";
import { displayChainPosition } from "@/lib/chain/positions";
import "../claim/styles/claim-flow.css";

type Option =
  | "01" | "02" | "03" | "04" | "05" | "06"
  | "07" | "08" | "09" | "10" | "11" | "12";

const OPTIONS: { id: Option; name: string; note: string }[] = [
  { id: "01", name: "Flat cream",          note: "Current baseline — no effects" },
  { id: "02", name: "Corner bloom",        note: "Single soft coral wash, top-right, static" },
  { id: "03", name: "Drifting orbs",       note: "Two large blurred orbs, slow animation" },
  { id: "04", name: "Diagonal wash",       note: "Cream → ivory + corner coral accent" },
  { id: "05", name: "Mesh gradient",       note: "Four-point soft color blobs" },
  { id: "06", name: "Editorial split",     note: "Horizontal band split with coral hairline" },
  { id: "07", name: "Spotlight from top",  note: "Wide amber glow behind the hero" },
  { id: "08", name: "Vignette frame",      note: "Cream centre, darker at edges" },
  { id: "09", name: "Dot grid",            note: "Fine dotted pattern on cream" },
  { id: "10", name: "Aurora streaks",      note: "Diagonal animated soft color bands" },
  { id: "11", name: "Architectural wedge", note: "Large coral triangle, top-right" },
  { id: "12", name: "Cream + film grain",  note: "Flat cream with fine SVG noise" },
];

const SCOPED_CSS = `
  /* ── 01 Flat cream (baseline) ── */
  .claim-page.bg-01 { background: #FDF9F5; }

  /* ── 02 Corner bloom ── */
  .claim-page.bg-02 {
    background:
      radial-gradient(ellipse 60% 50% at 92% 8%, rgba(255,107,74,.10) 0%, transparent 60%),
      #FDF9F5;
  }

  /* ── 03 Drifting orbs (animated) ── */
  .claim-page.bg-03 { background: #FDF9F5; position: relative; overflow-x: hidden; }
  .claim-page.bg-03::before,
  .claim-page.bg-03::after {
    content: ""; position: fixed; border-radius: 50%; filter: blur(90px);
    pointer-events: none; z-index: 0;
  }
  .claim-page.bg-03::before {
    width: 520px; height: 520px; background: rgba(255,107,74,.18);
    top: -120px; left: -120px;
    animation: bg-orb-a 28s ease-in-out infinite alternate;
  }
  .claim-page.bg-03::after {
    width: 560px; height: 560px; background: rgba(255,180,77,.16);
    bottom: -160px; right: -160px;
    animation: bg-orb-b 32s ease-in-out infinite alternate;
  }
  @keyframes bg-orb-a { 0% { transform: translate(0,0); } 100% { transform: translate(100px, 80px); } }
  @keyframes bg-orb-b { 0% { transform: translate(0,0); } 100% { transform: translate(-80px, -100px); } }
  .claim-page.bg-03 > * { position: relative; z-index: 1; }

  /* ── 04 Diagonal wash ── */
  .claim-page.bg-04 {
    background:
      radial-gradient(ellipse 50% 40% at 100% 0%, rgba(255,107,74,.14) 0%, transparent 55%),
      linear-gradient(135deg, #FDF9F5 0%, #FBF2EA 100%);
  }

  /* ── 05 Mesh gradient (four-point) ── */
  .claim-page.bg-05 {
    background:
      radial-gradient(at 20% 18%, rgba(255,107,74,.12) 0px, transparent 50%),
      radial-gradient(at 82% 28%, rgba(255,180,77,.12) 0px, transparent 50%),
      radial-gradient(at 70% 82%, rgba(255,180,150,.10) 0px, transparent 50%),
      radial-gradient(at 22% 78%, rgba(255,140,100,.09) 0px, transparent 50%),
      #FDF9F5;
  }

  /* ── 06 Editorial split (horizontal band + hairline) ── */
  .claim-page.bg-06 {
    background: linear-gradient(
      180deg,
      #FDF9F5 0%,
      #FDF9F5 42%,
      #F7EFE5 42%,
      #F7EFE5 100%
    );
    position: relative;
  }
  .claim-page.bg-06::after {
    content: ""; position: fixed; left: 0; right: 0; top: 42%;
    height: 1px; background: rgba(255,107,74,.45);
    pointer-events: none; z-index: 0;
  }
  .claim-page.bg-06 > * { position: relative; z-index: 1; }

  /* ── 07 Spotlight from top ── */
  .claim-page.bg-07 {
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,180,77,.20) 0%, transparent 55%),
      #FDF9F5;
  }

  /* ── 08 Vignette frame ── */
  .claim-page.bg-08 {
    background: radial-gradient(ellipse 100% 80% at 50% 50%, #FDF9F5 25%, #F0E5D2 100%);
  }

  /* ── 09 Dot grid ── */
  .claim-page.bg-09 {
    background:
      radial-gradient(circle, rgba(0,0,0,.07) 1px, transparent 1px) 0 0 / 18px 18px,
      #FDF9F5;
  }

  /* ── 10 Aurora streaks (animated) ── */
  .claim-page.bg-10 {
    background:
      linear-gradient(
        120deg,
        rgba(255,107,74,.10) 0%,
        transparent 30%,
        rgba(255,180,77,.10) 70%,
        transparent 100%
      ),
      #FDF9F5;
    background-size: 200% 200%;
    animation: bg-aurora-shift 18s ease-in-out infinite alternate;
  }
  @keyframes bg-aurora-shift {
    0%   { background-position: 0% 0%; }
    100% { background-position: 100% 100%; }
  }

  /* ── 11 Architectural wedge (top-right coral triangle) ── */
  .claim-page.bg-11 { background: #FDF9F5; position: relative; }
  .claim-page.bg-11::before {
    content: ""; position: fixed; top: 0; right: 0;
    width: 42%; height: 65%;
    background: linear-gradient(225deg, rgba(255,107,74,.18) 0%, rgba(255,107,74,.02) 100%);
    clip-path: polygon(100% 0, 100% 100%, 0 0);
    pointer-events: none; z-index: 0;
  }
  .claim-page.bg-11 > * { position: relative; z-index: 1; }

  /* ── 12 Cream + film grain (SVG noise overlay) ── */
  .claim-page.bg-12 {
    background:
      url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.10 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
      #FDF9F5;
  }

  /* ── Picker panel (right side, vertical) ── */
  .bg-picker {
    position: fixed; top: 16px; right: 16px;
    z-index: 1000;
    width: 280px;
    background: rgba(255,255,255,.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(0,0,0,.10);
    border-radius: 12px;
    padding: 8px;
    display: flex; flex-direction: column; gap: 2px;
    box-shadow: 0 6px 24px rgba(0,0,0,.12);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .bg-picker-title {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .08em;
    color: rgba(0,0,0,.4);
    padding: 6px 10px 8px;
    border-bottom: 1px solid rgba(0,0,0,.06);
    margin-bottom: 4px;
  }
  .bg-picker button {
    appearance: none; border: none; cursor: pointer;
    padding: 10px 12px;
    text-align: left;
    border-radius: 8px;
    background: transparent;
    color: rgba(0,0,0,.75);
    display: flex; flex-direction: column; gap: 2px;
    transition: background 120ms, color 120ms;
    font-family: inherit;
  }
  .bg-picker button:not(.on):hover {
    background: rgba(0,0,0,.04);
  }
  .bg-picker button.on {
    background: #FF6B4A;
    color: #fff;
  }
  .bg-picker-name {
    font-size: 13px; font-weight: 600;
    display: flex; align-items: center; gap: 8px;
  }
  .bg-picker-num {
    font-size: 10px; font-weight: 700;
    background: rgba(0,0,0,.08);
    padding: 1px 6px; border-radius: 4px;
    font-family: monospace;
  }
  .bg-picker button.on .bg-picker-num {
    background: rgba(255,255,255,.25);
  }
  .bg-picker-note {
    font-size: 11px; opacity: 0.65; line-height: 1.4;
  }

  /* Shrink the hero so the picker doesn't overlap it on standard screens */
  .claim-page .claim-container { max-width: min(640px, calc(100vw - 340px)); }
  @media (max-width: 900px) {
    .claim-page .claim-container { max-width: 100%; }
    .bg-picker { width: 240px; }
  }
`;

const SAMPLE = {
  originatorName: "Jane Smith",
  originatorAgency: "Foster & Co",
  stubPropertyAddress: "47 Oak Road, Bristol, BS6 7TH",
  invitedDate: "21 May 2026",
  links: [
    { id: "1",    position: 0, transactionId: "tx1", stubPropertyAddress: null,         transaction: { propertyAddress: "12 Pine Lane, Bristol" }, claimedBy: { firmName: "Whitfield & Sons" } },
    { id: "2",    position: 1, transactionId: "tx2", stubPropertyAddress: null,         transaction: { propertyAddress: "47 Oak Road, Bristol" }, claimedBy: { firmName: "Foster & Co" } },
    { id: "stub", position: 2, transactionId: null,  stubPropertyAddress: "Your sale",  transaction: null, claimedBy: null },
    { id: "3",    position: 3, transactionId: null,  stubPropertyAddress: null,         transaction: null, claimedBy: null },
  ],
};

export default function ClaimBgPreviewPage() {
  const [option, setOption] = useState<Option>("01");
  const total = SAMPLE.links.length;

  return (
    <>
      <style>{SCOPED_CSS}</style>

      <aside className="bg-picker">
        <div className="bg-picker-title">Background · 12 options</div>
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={option === opt.id ? "on" : ""}
            onClick={() => setOption(opt.id)}
          >
            <span className="bg-picker-name">
              <span className="bg-picker-num">{opt.id}</span>
              {opt.name}
            </span>
            <span className="bg-picker-note">{opt.note}</span>
          </button>
        ))}
      </aside>

      <div className={`claim-page bg-${option}`}>
        <header className="claim-header">
          <a
            href="https://www.thesalesprogressor.co.uk"
            target="_blank"
            rel="noopener"
            className="claim-wordmark"
          >
            The Sales Progressor
          </a>
        </header>

        <div className="claim-container">
          <div className="claim-hero">
            <p className="claim-hero-eyebrow">
              {SAMPLE.originatorName.toUpperCase()} · {SAMPLE.originatorAgency.toUpperCase()}
            </p>
            <h1 className="claim-hero-h1">Your sale is part of a live chain.</h1>
            <p className="claim-hero-sub">
              {SAMPLE.originatorName} at {SAMPLE.originatorAgency} has linked{" "}
              {SAMPLE.stubPropertyAddress} to their file. Join to see where the chain stands.
            </p>
            <div className="claim-hero-rule" />

            <div className="claim-chain">
              {SAMPLE.links.map((cl, i) => {
                const isYours = cl.id === "stub";
                const isClaimed = cl.transactionId !== null;
                const address = isClaimed
                  ? (cl.transaction?.propertyAddress ?? "")
                  : isYours
                  ? (cl.stubPropertyAddress ?? "")
                  : "";
                const agency = cl.claimedBy?.firmName ?? null;

                return (
                  <div key={cl.id}>
                    {i > 0 && (
                      <div className="claim-chain-connector">
                        <div className="claim-chain-connector-dot" />
                        <div className="claim-chain-connector-line" />
                        <div className="claim-chain-connector-dot" />
                      </div>
                    )}
                    <div className="claim-chain-row">
                      <div className="claim-chain-gutter">
                        <span className="claim-chain-num">
                          {String(displayChainPosition(cl.position, total)).padStart(2, "0")}
                        </span>
                      </div>
                      <div
                        className={`claim-chain-card ${
                          isYours
                            ? "claim-chain-card--yours"
                            : isClaimed
                            ? "claim-chain-card--claimed"
                            : "claim-chain-card--pending"
                        }`}
                      >
                        {isYours ? (
                          <>
                            <div className="claim-chain-head">
                              <span className="claim-chain-address">{address || "Your sale"}</span>
                              <span className="claim-chain-status">YOU</span>
                            </div>
                            <div className="claim-chain-inner">
                              <span className="claim-chain-inner-text">
                                Your sale · Claim to join
                              </span>
                              <span className="claim-chain-inner-arrow">→</span>
                            </div>
                          </>
                        ) : isClaimed ? (
                          <>
                            <div className="claim-chain-head">
                              <span className="claim-chain-address">{address}</span>
                              <span className="claim-chain-status">✓ Joined</span>
                            </div>
                            {agency && <div className="claim-chain-agency">{agency}</div>}
                          </>
                        ) : (
                          <div className="claim-chain-head">
                            <span
                              className="claim-chain-address"
                              style={{
                                color: "rgba(255,255,255,.5)",
                                fontStyle: "italic",
                                fontWeight: 400,
                              }}
                            >
                              Invite pending
                            </span>
                            <span className="claim-chain-status">Invite sent</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,.15)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.60)" }}>
                Invited by:{" "}
                <strong style={{ color: "rgba(255,255,255,.85)" }}>{SAMPLE.originatorName}</strong>
                {", "}
                {SAMPLE.originatorAgency}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.50)" }}>
                Invited on: {SAMPLE.invitedDate}
              </span>
            </div>
          </div>

          <div className="claim-cta" style={{ marginTop: 20 }}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="claim-btn"
            >
              Claim this sale
            </a>
            <p className="claim-microcopy">Free to use · Takes 30 seconds</p>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="claim-decline-link"
            >
              This isn&apos;t mine. Decline invite
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
