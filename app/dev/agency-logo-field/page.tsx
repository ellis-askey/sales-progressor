"use client";

// app/dev/agency-logo-field/page.tsx
//
// PREVIEW ONLY — direction A (email-header preview) for the agency logo, the
// chosen direction. Shown at three card widths to prove the header no longer
// squishes: the title + Save button hold the top row and the subtitle drops to
// its own full-width row once the CARD (not the viewport) gets narrow, via a
// container query. When built for real this goes into AgencyNameForm against
// /api/agent/agency-logo; the same container-query reflow would be applied to
// the shared AccountCard header (a shared primitive — flagged before I touch it).
//
// The logo is the SAME Agency.logoPath the client emails use. Upload here is a
// local FileReader preview; it writes nothing.

import { useRef, useState } from "react";
import { Buildings, ImageSquare, PencilSimple } from "@phosphor-icons/react";

const CORAL = "#FF6B4A";
const CORAL_DEEP = "#E2452A";
const CORAL_TINT = "#FFF1EC";
const INK = "#111827";
const MUTE = "#6b7280";
const FAINT = "#9ca3af";
const HAIR = "rgba(0,0,0,0.10)";
const TILE = "#0f2742"; // Boardwalk's navy — a real detected tile colour

const SEED_LOGO =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80"><rect width="320" height="80" fill="${TILE}"/><g fill="#ffffff"><circle cx="40" cy="40" r="17" fill="none" stroke="#ffffff" stroke-width="3"/><path d="M33 40 L40 30 L47 40 L40 50 Z"/></g><text x="72" y="47" font-family="Georgia, serif" font-size="25" fill="#ffffff" letter-spacing="2">BOARDWALK</text></svg>`
  );

const NAME = "Boardwalk Property Co";

function useLocalPick(onPick: (dataUrl: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = () => onPick(String(r.result));
    r.readAsDataURL(file);
  }
  const input = <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" onChange={onFile} style={{ display: "none" }} />;
  return { open: () => ref.current?.click(), input };
}

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 13.5, color: INK,
  background: "#fff", border: `0.5px solid rgba(0,0,0,0.16)`, borderRadius: 8, outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, color: MUTE, textTransform: "uppercase",
  letterSpacing: 0.7, fontWeight: 600, marginBottom: 5,
};

// Card shell with a CONTAINER-QUERY header: subtitle drops to a full-width row
// once the card itself is under 430px, so the title/subtitle/button never squish
// regardless of viewport width.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="ad-card">
      <div className="ad-head">
        <span className="ad-ico"><Buildings size={20} weight="bold" /></span>
        <h2 className="ad-title">Agency details</h2>
        <p className="ad-sub">The name and logo shown across Sales Progressor and in client communications.</p>
        <button type="button" disabled className="ad-save">Save changes</button>
      </div>
      {children}
      <style>{`
        .ad-card {
          container-type: inline-size;
          background: rgba(255,255,255,0.92);
          border: 0.5px solid rgba(0,0,0,0.07);
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 6px 22px rgba(20,14,10,0.05);
          padding: 22px;
        }
        .ad-head {
          display: grid;
          grid-template-columns: auto 1fr auto;
          grid-template-areas: "ico title action" "ico sub action";
          column-gap: 12px;
          align-items: start;
          margin-bottom: 18px;
        }
        .ad-ico { grid-area: ico; color: ${CORAL_DEEP}; display: inline-flex; margin-top: 1px; }
        .ad-title { grid-area: title; margin: 0; font-size: 15.5px; font-weight: 700; color: ${INK}; letter-spacing: -0.01em; }
        .ad-sub { grid-area: sub; margin: 3px 0 0; font-size: 13px; line-height: 1.5; color: ${MUTE}; }
        .ad-save { grid-area: action; margin-left: 4px; padding: 9px 18px; font-size: 13px; font-weight: 500; border-radius: 9px; border: none; background: ${CORAL_DEEP}; color: #fff; opacity: 0.45; cursor: default; white-space: nowrap; }
        /* When the CARD (not the viewport) is narrow, the subtitle gets its own
           full-width row beneath the title + button, so nothing squishes. */
        @container (max-width: 430px) {
          .ad-head { grid-template-areas: "ico title action" "sub sub sub"; row-gap: 8px; }
        }
      `}</style>
    </section>
  );
}

function RemoveLink({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, fontWeight: 600, color: FAINT, cursor: "pointer", letterSpacing: 0.2 }}>Remove</button>;
}

// Direction A — logo shown as the email brand band.
function AgencyDetailsA({ seed }: { seed: string | null }) {
  const [logo, setLogo] = useState<string | null>(seed);
  const [hover, setHover] = useState(false);
  const { open, input } = useLocalPick(setLogo);
  return (
    <Shell>
      <label style={labelStyle}>Logo</label>
      <button
        type="button" onClick={open} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        aria-label={logo ? "Replace logo" : "Add logo"}
        style={{ position: "relative", width: "100%", height: 88, borderRadius: 12, overflow: "hidden", cursor: "pointer", padding: 0, display: "block",
          border: logo ? "none" : `1.5px dashed rgba(0,0,0,0.18)`, background: logo ? TILE : "#f7f5f3" }}
      >
        {logo ? (
          <>
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 24 }}>
              <img src={logo} alt="Agency logo" style={{ maxHeight: 48, maxWidth: "70%", objectFit: "contain" }} />
            </span>
            <span style={{ position: "absolute", inset: 0, background: "rgba(8,12,20,0.46)", opacity: hover ? 1 : 0, transition: "opacity 140ms", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: "#fff", fontSize: 12.5, fontWeight: 600 }}>
              <PencilSimple size={15} weight="bold" /> Replace logo
            </span>
          </>
        ) : (
          <span style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: MUTE }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: CORAL_TINT, color: CORAL_DEEP, marginBottom: 2 }}><ImageSquare size={16} weight="bold" /></span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>Add your logo</span>
            <span style={{ fontSize: 11, color: FAINT }}>Shown at the top of every client email</span>
          </span>
        )}
      </button>
      {input}
      {logo && <div style={{ marginTop: 8 }}><RemoveLink onClick={() => setLogo(null)} /></div>}
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Agency name</label>
        <input defaultValue={NAME} style={fieldStyle} />
      </div>
    </Shell>
  );
}

function Frame({ label, width, children }: { label: string; width: number; children: React.ReactNode }) {
  return (
    <div style={{ width, maxWidth: "100%" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 9 }}>{label}</div>
      <div style={{ background: "#f3eee9", border: `1px solid rgba(0,0,0,0.06)`, borderRadius: 18, padding: 18 }}>{children}</div>
    </div>
  );
}

export default function AgencyLogoFieldPreview() {
  const [empty, setEmpty] = useState(false);
  const seed = empty ? null : SEED_LOGO;
  const k = empty ? "e" : "f";
  return (
    <div style={{ minHeight: "100vh", background: "#ece6e0", padding: "40px 32px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, color: INK, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Agency details — logo (direction A)</h1>
        <p style={{ fontSize: 13.5, color: MUTE, margin: "0 0 4px", lineHeight: 1.55, maxWidth: 680 }}>
          The logo is shown as the brand band clients see at the top of your emails — same <code style={{ fontSize: 12 }}>logoPath</code>, one place to set it. Header now reflows by the card&apos;s own width (container query): the subtitle drops below once the card is narrow, so title + Save no longer squish it.
        </p>
        <p style={{ fontSize: 12.5, color: FAINT, margin: "0 0 18px" }}>Click the band to drop an image in — local preview, writes nothing.</p>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", marginBottom: 26, cursor: "pointer" }}>
          <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} /> Show empty state (no logo yet)
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-start" }}>
          <Frame label="Full width · ~720px" width={720}><AgencyDetailsA key={`w${k}`} seed={seed} /></Frame>
          <Frame label="Narrow column · ~420px" width={420}><AgencyDetailsA key={`n${k}`} seed={seed} /></Frame>
          <Frame label="Mobile · 375px" width={375}><AgencyDetailsA key={`m${k}`} seed={seed} /></Frame>
        </div>
      </div>
    </div>
  );
}
