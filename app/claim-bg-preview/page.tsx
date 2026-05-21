"use client";

// /claim-bg-preview
// Standalone preview of the real /claim landing page on each candidate background.
// Same DOM as /claim/page.tsx (header, hero, chain visual, meta strip, CTA),
// hardcoded sample data so no token / DB is needed. A/B/C overlay top-centre
// swaps the background class on .claim-page. Pick one, then I wire it in.

import { useState } from "react";
import { displayChainPosition } from "@/lib/chain/positions";
import "../claim/styles/claim-flow.css";

type Option = "A" | "B" | "C";

const SCOPED_CSS = `
  /* ── Background options applied to .claim-page wrapper ── */

  /* A — subtle static bloom (single soft coral wash, top-right, no motion) */
  .claim-page.bg-A {
    background:
      radial-gradient(ellipse 60% 50% at 92% 8%, rgba(255,107,74,.10) 0%, transparent 60%),
      #FDF9F5;
  }

  /* B — drifting two-orb gradient (animated) */
  .claim-page.bg-B {
    background: #FDF9F5;
    position: relative;
    overflow-x: hidden;
  }
  .claim-page.bg-B::before,
  .claim-page.bg-B::after {
    content: "";
    position: fixed;
    border-radius: 50%;
    filter: blur(90px);
    pointer-events: none;
    z-index: 0;
  }
  .claim-page.bg-B::before {
    width: 520px; height: 520px;
    background: rgba(255,107,74,.18);
    top: -120px; left: -120px;
    animation: bg-B-drift-a 28s ease-in-out infinite alternate;
  }
  .claim-page.bg-B::after {
    width: 560px; height: 560px;
    background: rgba(255,180,77,.16);
    bottom: -160px; right: -160px;
    animation: bg-B-drift-b 32s ease-in-out infinite alternate;
  }
  @keyframes bg-B-drift-a {
    0%   { transform: translate(0, 0); }
    100% { transform: translate(100px, 80px); }
  }
  @keyframes bg-B-drift-b {
    0%   { transform: translate(0, 0); }
    100% { transform: translate(-80px, -100px); }
  }
  .claim-page.bg-B > * { position: relative; z-index: 1; }

  /* C — diagonal warm gradient + corner accent (static) */
  .claim-page.bg-C {
    background:
      radial-gradient(ellipse 50% 40% at 100% 0%, rgba(255,107,74,.14) 0%, transparent 55%),
      linear-gradient(135deg, #FDF9F5 0%, #FBF2EA 100%);
  }

  /* ── A/B/C picker ── */
  .bg-picker {
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    z-index: 1000;
    background: rgba(255,255,255,.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(0,0,0,.08);
    border-radius: 12px;
    padding: 6px;
    display: flex; gap: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,.08);
  }
  .bg-picker button {
    appearance: none; border: none; cursor: pointer;
    padding: 8px 14px;
    font-size: 12px; font-weight: 600;
    border-radius: 8px;
    background: transparent;
    color: rgba(0,0,0,.55);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    transition: background 150ms, color 150ms;
  }
  .bg-picker button.on {
    background: #FF6B4A;
    color: #fff;
  }
  .bg-picker button:not(.on):hover {
    background: rgba(0,0,0,.05);
    color: rgba(0,0,0,.85);
  }
  .bg-picker-label {
    position: fixed; top: 64px; left: 50%; transform: translateX(-50%);
    z-index: 1000;
    font-size: 11px; font-family: monospace;
    color: rgba(0,0,0,.5);
    background: rgba(255,255,255,.85);
    padding: 5px 10px;
    border-radius: 6px;
    white-space: nowrap;
  }
`;

const LABELS: Record<Option, string> = {
  A: "A · subtle static bloom (no motion)",
  B: "B · drifting two-orb gradient (animated)",
  C: "C · diagonal warm gradient + corner accent (static)",
};

// ── Sample data mirroring the /claim landing page ──
const SAMPLE = {
  originatorName: "Jane Smith",
  originatorAgency: "Foster & Co",
  stubPropertyAddress: "47 Oak Road, Bristol, BS6 7TH",
  invitedDate: "21 May 2026",
  links: [
    { id: "1", position: 0, transactionId: "tx1", stubPropertyAddress: null, transaction: { propertyAddress: "12 Pine Lane, Bristol" }, claimedBy: { firmName: "Whitfield & Sons" } },
    { id: "2", position: 1, transactionId: "tx2", stubPropertyAddress: null, transaction: { propertyAddress: "47 Oak Road, Bristol" }, claimedBy: { firmName: "Foster & Co" } },
    { id: "stub", position: 2, transactionId: null, stubPropertyAddress: "Your sale", transaction: null, claimedBy: null },
    { id: "3", position: 3, transactionId: null, stubPropertyAddress: null, transaction: null, claimedBy: null },
  ],
};

export default function ClaimBgPreviewPage() {
  const [option, setOption] = useState<Option>("A");
  const total = SAMPLE.links.length;

  return (
    <>
      <style>{SCOPED_CSS}</style>

      <div className="bg-picker">
        {(["A", "B", "C"] as Option[]).map((opt) => (
          <button
            key={opt}
            type="button"
            className={option === opt ? "on" : ""}
            onClick={() => setOption(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="bg-picker-label">{LABELS[option]}</div>

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

            {/* Chain visual */}
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

            {/* Meta strip */}
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

          {/* CTA */}
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
