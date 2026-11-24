import type { CSSProperties, ReactNode } from "react";

// /dev/compare — a review surface for the invite + auth page audit.
// Each card shows what ships TODAY ("Now") next to the PROPOSED version
// ("After"), with a plain-English note. Nothing here is live — this page is
// only for sign-off. Approve a card and I'll build that change for real.
//
// Everything below is a faithful inline reproduction of the real values
// (exact colours, sizes, weights pulled from the pages), so the two panels
// read byte-for-byte without pulling in every page's stylesheet.

export const dynamic = "force-static";

/* ----------------------------------------------------------------- chrome */

const PAPER = "#F4F1EC";
const INK = "#2D2420";
const MUTED = "#8A8176";
const LINE = "#E7E2DA";
const CORAL = "#FF6B4A";

type Kind = "visual" | "copy" | "behind" | "tidy";

const KIND_META: Record<Kind, { label: string; fg: string; bg: string }> = {
  visual: { label: "Visual", fg: "#B23A1E", bg: "rgba(255,107,74,0.12)" },
  copy: { label: "Wording", fg: "#8A5A00", bg: "rgba(224,148,46,0.14)" },
  behind: { label: "Behind the scenes", fg: "#3E4C59", bg: "rgba(62,76,89,0.10)" },
  tidy: { label: "Tidy-up", fg: "#6B6358", bg: "rgba(107,99,88,0.10)" },
};

function Chip({ kind }: { kind: Kind }) {
  const m = KIND_META[kind];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: m.fg,
        background: m.bg,
        padding: "3px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {m.label}
    </span>
  );
}

function Panel({
  tone,
  label,
  children,
}: {
  tone: "now" | "after";
  label: string;
  children: ReactNode;
}) {
  const dot = tone === "now" ? MUTED : CORAL;
  return (
    <div
      style={{
        flex: "1 1 320px",
        minWidth: 300,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          borderBottom: `1px solid ${LINE}`,
          background: tone === "now" ? "#FBFAF8" : "rgba(255,107,74,0.04)",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: tone === "now" ? MUTED : "#B23A1E", letterSpacing: "0.02em" }}>
          {label}
        </span>
      </div>
      <div style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

function Card({
  n,
  area,
  title,
  kind,
  when,
  change,
  now,
  after,
}: {
  n: string;
  area: string;
  title: string;
  kind: Kind;
  when: string;
  change: string;
  now: ReactNode;
  after: ReactNode;
}) {
  return (
    <section
      style={{
        border: `1px solid ${LINE}`,
        borderRadius: 16,
        background: "#FEFDFB",
        padding: 22,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: CORAL, fontVariantNumeric: "tabular-nums" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: INK, letterSpacing: "-0.01em", flex: 1, minWidth: 220 }}>
          {title}
        </h3>
        <Chip kind={kind} />
      </div>

      <p style={{ margin: "10px 0 2px", fontSize: 13.5, lineHeight: 1.55, color: "#5C544B" }}>
        <strong style={{ color: INK, fontWeight: 600 }}>When you&apos;d see it: </strong>
        {when}
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.55, color: "#5C544B" }}>
        <strong style={{ color: INK, fontWeight: 600 }}>What we&apos;d change: </strong>
        {change}
      </p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Panel tone="now" label="Now (live today)">
          {now}
        </Panel>
        <Panel tone="after" label="Proposed">
          {after}
        </Panel>
      </div>
      <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: MUTED }}>{area}</p>
    </section>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ margin: "34px 0 14px" }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: CORAL }}>
        {title}
      </h2>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>{sub}</p>
    </div>
  );
}

/* ------------------------------------------------- small repro helpers */

function Heading({
  text,
  size = 28,
  weight = 600,
  color,
  dot,
  dotColor = CORAL,
}: {
  text: string;
  size?: number;
  weight?: number;
  color: string;
  dot?: boolean;
  dotColor?: string;
}) {
  return (
    <div style={{ fontSize: size, fontWeight: weight, color, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
      {text}
      {dot && <span style={{ color: dotColor }}>.</span>}
    </div>
  );
}

const subStyle = (color: string): CSSProperties => ({ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color });
const bodyStyle: CSSProperties = { margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "#3F3F46" };

function Tick({ color, bg }: { color: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 999,
        background: bg,
        marginBottom: 12,
      }}
    >
      <svg viewBox="0 0 20 20" width={22} height={22} fill="none">
        <path d="m4 10.5 3.5 3.5L16 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function TrustRow({ opacity }: { opacity: number }) {
  const c = `rgba(32,36,46,${opacity})`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: c, fontWeight: 500 }}>
      <span>SSL encrypted</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>GDPR compliant</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>UK data</span>
    </div>
  );
}

/* --------------------------------------------------------------- page */

export default function ComparePage() {
  return (
    <main style={{ minHeight: "100vh", background: PAPER, color: INK, padding: "40px 20px 80px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: CORAL }}>
            Review surface
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Invite &amp; sign-in pages — before and after
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "#5C544B", maxWidth: 680 }}>
            These are the states a normal page-load never shows: expired links, wrong passwords, broken chains,
            duplicate sales, empty results. Each card shows what a person sees <strong>today</strong> next to the{" "}
            <strong>proposed</strong> version. Nothing here is live yet. Tell me which cards to build and I&apos;ll make
            those changes for real.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            padding: "12px 0 6px",
            borderBottom: `1px solid ${LINE}`,
            marginBottom: 6,
          }}
        >
          <Chip kind="visual" />
          <span style={{ fontSize: 12, color: MUTED }}>looks different</span>
          <Chip kind="copy" />
          <span style={{ fontSize: 12, color: MUTED }}>wording</span>
          <Chip kind="behind" />
          <span style={{ fontSize: 12, color: MUTED }}>a missing state or logic, little/no visible change</span>
          <Chip kind="tidy" />
          <span style={{ fontSize: 12, color: MUTED }}>dead code, no user impact</span>
        </div>

        {/* ===================================================== CROSS-CUTTING */}
        <SectionHead
          title="Across all the invite pages"
          sub="One heading system that doesn't quite line up everywhere."
        />

        <Card
          n="01"
          area="Claim landing, signup, confirm, decline — all headings via PageTitle"
          title="Invite-page headings are a slightly warmer colour than the text under them"
          kind="visual"
          when="On every chain-invite page (the big heading at the top of an error, a decline, or the signup panel)."
          change="Make the heading the same cool near-black as the body text on those pages, so they match. The sign-in pages (login, register) keep their warm colour, which is correct for them."
          now={
            <>
              <Heading text="This invite has expired" color="#2D1810" dot />
              <p style={bodyStyle}>
                This invite link has expired. Ask the inviting agent to resend it.
              </p>
              <p style={{ margin: "14px 0 0", fontSize: 11, color: MUTED }}>Heading #2D1810 (warm) vs body #3F3F46 (cool)</p>
            </>
          }
          after={
            <>
              <Heading text="This invite has expired" color="#20242E" dot />
              <p style={bodyStyle}>
                This invite link has expired. Ask the inviting agent to resend it.
              </p>
              <p style={{ margin: "14px 0 0", fontSize: 11, color: MUTED }}>Heading #20242E (cool) matches the body</p>
            </>
          }
        />

        <Card
          n="02"
          area="app/claim/login — ClaimLoginForm heading + ClaimError"
          title="The claim login page uses a heavier, different heading than its sibling pages"
          kind="visual"
          when="When an invited agent already has an account and is asked to log in to claim, and on its error screens."
          change="Use the same heading style as the other invite pages (lighter weight, with the coral full stop), so the same screens don't change shape depending on which page you land on."
          now={
            <>
              <Heading text="Log in to claim" size={28} weight={800} color="#20242E" />
              <p style={subStyle("#3F3F46")}>Log in to your account and we&apos;ll link this sale to it.</p>
              <p style={{ margin: "14px 0 0", fontSize: 11, color: MUTED }}>28px, weight 800, no coral stop</p>
            </>
          }
          after={
            <>
              <Heading text="Log in to claim" size={28} weight={600} color="#20242E" dot />
              <p style={subStyle("#3F3F46")}>Log in to your account and we&apos;ll link this sale to it.</p>
              <p style={{ margin: "14px 0 0", fontSize: 11, color: MUTED }}>28px, weight 600, coral stop (matches the rest)</p>
            </>
          }
        />

        <Card
          n="03"
          area="Error titles across claim landing / confirm / decline / login"
          title="Some error headings end with a full stop (and get the coral dot), others don't"
          kind="copy"
          when="Across the invite error screens. Right now it's a coin toss which ones get the little coral dot."
          change="Pick one rule and apply it everywhere. Recommended: give every short error title a full stop, so they all get the coral dot and read as one family."
          now={
            <div style={{ display: "grid", gap: 8 }}>
              <Heading text="Invalid invite link" size={20} weight={700} color="#20242E" />
              <Heading text="Invite not found" size={20} weight={700} color="#20242E" />
              <Heading text="This invite has expired" size={20} weight={700} color="#20242E" dot />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED }}>Mixed: only some have the dot</p>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 8 }}>
              <Heading text="Invalid invite link" size={20} weight={700} color="#20242E" dot />
              <Heading text="Invite not found" size={20} weight={700} color="#20242E" dot />
              <Heading text="This invite has expired" size={20} weight={700} color="#20242E" dot />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED }}>Consistent: all end in a dot</p>
            </div>
          }
        />

        {/* ===================================================== AUTH */}
        <SectionHead title="Sign-in pages" sub="Login, register, forgot password, reset password." />

        <Card
          n="04"
          area="app/reset-password — missing/!broken token branch"
          title="The 'broken reset link' message is a one-off dark red, not the normal warning style"
          kind="visual"
          when="When someone opens a reset link that's incomplete or mangled by their email app."
          change="Show it in the same bordered warning box used everywhere else, instead of a bare line of unusual dark-red text."
          now={
            <p style={{ margin: 0, fontSize: 14, color: "#8B2500", lineHeight: 1.5 }}>
              Invalid reset link. Please request a new one.
            </p>
          }
          after={
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                border: "1px solid rgba(199,62,62,0.35)",
                background: "rgba(199,62,62,0.06)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <svg viewBox="0 0 20 20" width={16} height={16} fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="10" cy="10" r="8" stroke="#C73E3E" strokeWidth="1.6" />
                <path d="M10 6v5M10 13.5v.5" stroke="#C73E3E" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 12.5, color: "#C73E3E", lineHeight: 1.45 }}>
                Invalid reset link. Please request a new one.
              </span>
            </div>
          }
        />

        <Card
          n="05"
          area="app/forgot-password vs app/reset-password — success screens"
          title="The two 'done' screens don't match each other"
          kind="visual"
          when="After you ask for a reset link (warm, coral tick) versus after you actually set a new password (cooler greys, green tick)."
          change="Keep the green success tick on 'password updated' (green reads as done), but warm its greys to match the rest of the sign-in family, so the two screens feel like the same product."
          now={
            <div>
              <Tick color="#1F8A4A" bg="rgba(31,138,74,0.12)" />
              <Heading text="Password updated" size={20} weight={700} color="#20242E" />
              <p style={subStyle("#8A8A94")}>Redirecting you to sign in...</p>
              <p style={{ margin: "14px 0 0", fontSize: 11, color: MUTED }}>Cool greys #20242E / #8A8A94</p>
            </div>
          }
          after={
            <div>
              <Tick color="#1F8A4A" bg="rgba(31,138,74,0.12)" />
              <Heading text="Password updated" size={20} weight={700} color="#2D1810" />
              <p style={subStyle("rgba(45,24,16,0.55)")}>Redirecting you to sign in...</p>
              <p style={{ margin: "14px 0 0", fontSize: 11, color: MUTED }}>Warm greys, matches forgot-password</p>
            </div>
          }
        />

        <Card
          n="06"
          area="login + reset hardcode the row; forgot + register have none"
          title="The 'SSL · GDPR · UK data' reassurance row is slightly different on each page"
          kind="visual"
          when="At the bottom of the sign-in pages. Login and reset show this row at two different shades of grey; forgot-password and register don't show it at all."
          change="Use one shared row at one shade, and decide whether all four pages carry it or none do. (Reset also has a lone 'All systems operational' pill no other page has, which we'd drop.)"
          now={
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, color: MUTED }}>login</span>
                <TrustRow opacity={0.45} />
              </div>
              <div>
                <span style={{ fontSize: 11, color: MUTED }}>reset (+ status pill)</span>
                <TrustRow opacity={0.52} />
              </div>
              <div>
                <span style={{ fontSize: 11, color: MUTED }}>forgot / register</span>
                <span style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>(nothing)</span>
              </div>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, color: MUTED }}>all four, same row</span>
                <TrustRow opacity={0.48} />
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>One shared component, one shade</p>
            </div>
          }
        />

        <Card
          n="07"
          area="login WarmLoginForm vs register RegisterForm"
          title="The 'enter a valid email' hint is a hair bigger on login than on register"
          kind="visual"
          when="When you mistype your email and leave the field. Same message, same colour, just 12px on one page and 11px on the other."
          change="Settle on one size (11px, to match the password hints)."
          now={
            <div style={{ display: "grid", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#C73E3E" }}>Enter a valid email address (login, 12px)</span>
              <span style={{ fontSize: 11, color: "#C73E3E" }}>Enter a valid email address (register, 11px)</span>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 10 }}>
              <span style={{ fontSize: 11, color: "#C73E3E" }}>Enter a valid email address (login, 11px)</span>
              <span style={{ fontSize: 11, color: "#C73E3E" }}>Enter a valid email address (register, 11px)</span>
            </div>
          }
        />

        <Card
          n="08"
          area="app/login — OAuth error query param not handled"
          title="If you start 'Continue with Google' then cancel, nothing is said"
          kind="behind"
          when="You click Continue with Google or Microsoft, then back out or it fails. You land back on the login form with no explanation."
          change="Show a short message so you know the sign-in didn't complete. This one touches behaviour, so I'd confirm the exact wording with you before building."
          now={
            <p style={{ margin: 0, fontSize: 13, color: MUTED, fontStyle: "italic" }}>
              (silent — the form just reappears, no message)
            </p>
          }
          after={
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                border: "1px solid rgba(199,62,62,0.35)",
                background: "rgba(199,62,62,0.06)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <span style={{ fontSize: 12.5, color: "#C73E3E", lineHeight: 1.45 }}>
                We couldn&apos;t sign you in with that provider. Try again.
              </span>
            </div>
          }
        />

        <Card
          n="09"
          area="app/forgot-password — no inline email check"
          title="Forgot-password accepts an obviously-wrong email with no nudge"
          kind="behind"
          when="You type something that isn't an email (no @) and hit send. Login and register would flag it; forgot-password doesn't."
          change="Add the same gentle 'enter a valid email' check on blur. Optional — the page is deliberately vague about whether an account exists, and this doesn't break that."
          now={
            <p style={{ margin: 0, fontSize: 13, color: MUTED, fontStyle: "italic" }}>
              (no check — button sends anyway)
            </p>
          }
          after={<span style={{ fontSize: 11, color: "#C73E3E" }}>Enter a valid email address</span>}
        />

        {/* ===================================================== CLAIM LANDING/SIGNUP */}
        <SectionHead title="Invite landing &amp; signup" sub="The pages an invited agent sees first." />

        <Card
          n="10"
          area="ClaimChainLadder vs confirm page HousePlaceholder"
          title="A sale with no photo shows a 'SOLD' badge in the chain list, but a house on the next page"
          kind="visual"
          when="Any chain where a sale has no photo yet. The chain list draws a red SOLD ribbon; the confirm page draws a plain house. Same situation, two different pictures."
          change="Use the house everywhere. A SOLD board on a sale that's still in progress is misleading, and the house is calmer."
          now={
            <div
              style={{
                width: 72,
                height: 54,
                borderRadius: 8,
                background: "linear-gradient(135deg,#FF8365,#E85A35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              SOLD
            </div>
          }
          after={
            <div
              style={{
                width: 72,
                height: 54,
                borderRadius: 8,
                background: "#F1ECE6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg viewBox="0 0 24 24" width={30} height={30} fill="none">
                <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z" stroke="#B9AFA2" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M9.5 21v-5h5v5" stroke="#B9AFA2" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
          }
        />

        <Card
          n="11"
          area="ClaimInviteCard — .claim-b-login"
          title="The 'Log in' button top-right is still a little glossy"
          kind="visual"
          when="Top-right of the invite landing page, for people who already have an account. It's the one button left with the old shiny gradient after we flattened the rest."
          change="Flatten it to a clean white button with a hairline border, matching the flat look we've moved everything else to."
          now={
            <span
              style={{
                display: "inline-block",
                padding: "8px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                color: "#2D1810",
                background: "linear-gradient(180deg,#ffffff,#f6f4f1)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.08)",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              Log in
            </span>
          }
          after={
            <span
              style={{
                display: "inline-block",
                padding: "8px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                color: "#2D1810",
                background: "#fff",
                border: `1px solid ${LINE}`,
              }}
            >
              Log in
            </span>
          }
        />

        <Card
          n="12"
          area="ClaimSignupForm — password rule invisible"
          title="On signup, the 'Create account' button stays greyed out with no reason given"
          kind="copy"
          when="When you set a password shorter than 10 characters. The button simply won't enable, and nothing tells you why."
          change="Add a short hint under the password field so the requirement is visible before you get stuck."
          now={
            <div>
              <div style={{ height: 40, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }} />
              <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, fontStyle: "italic" }}>(no hint)</p>
            </div>
          }
          after={
            <div>
              <div style={{ height: 40, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }} />
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#C97D1A" }}>Use at least 10 characters.</p>
            </div>
          }
        />

        <Card
          n="13"
          area="app/claim/signup — no chain-withdrawn guard"
          title="If a chain falls through, the signup page still shows the form"
          kind="behind"
          when="A sale in the chain withdraws after you opened the invite but before you finished signing up. The landing page would stop you; the signup page doesn't, so you fill it all in before being told."
          change="Add the same 'this chain has changed' stop to the signup page that the landing page already has."
          now={
            <p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>
              Full signup form shown, even though the chain has broken. The problem only surfaces when you submit.
            </p>
          }
          after={
            <div>
              <Heading text="This chain has changed" size={18} weight={700} color="#20242E" dot />
              <p style={{ ...bodyStyle, margin: "8px 0 0" }}>
                A sale in this chain has withdrawn. Ask the inviting agent for a fresh invite.
              </p>
            </div>
          }
        />

        <Card
          n="14"
          area="app/claim landing vs app/claim/signup — inviter resolution"
          title="The inviter's name can change between the invite page and the signup page"
          kind="behind"
          when="On sales we run on an agency's behalf. The landing page shows the right person; the signup page can show a different name and agency for the same invite."
          change="Have the signup page work out the inviter the same way the landing page does, so the name stays put across the two steps."
          now={
            <div style={{ fontSize: 13, color: "#5C544B", lineHeight: 1.6 }}>
              Landing: <strong style={{ color: INK }}>Jane, Hamptons</strong>
              <br />
              Signup: <strong style={{ color: INK }}>The Sales Progressor</strong>
              <span style={{ color: MUTED }}> (same invite)</span>
            </div>
          }
          after={
            <div style={{ fontSize: 13, color: "#5C544B", lineHeight: 1.6 }}>
              Landing: <strong style={{ color: INK }}>Jane, Hamptons</strong>
              <br />
              Signup: <strong style={{ color: INK }}>Jane, Hamptons</strong>
              <span style={{ color: MUTED }}> (consistent)</span>
            </div>
          }
        />

        <Card
          n="15"
          area="ClaimCtaButton shine listener + .claim-error-h1 orphan CSS"
          title="Some leftover code that does nothing"
          kind="tidy"
          when="Never visible. A shine animation that can't paint anymore, and an old heading style no page uses now that headings moved to the shared component."
          change="Delete both. No visible change, just less dead weight."
          now={
            <p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>
              A pointer-move listener toggles a glint that is forced off, and <code style={{ fontSize: 12 }}>.claim-error-h1</code>{" "}
              is no longer referenced.
            </p>
          }
          after={<p style={{ margin: 0, fontSize: 13, color: "#5C544B" }}>Both removed.</p>}
        />

        {/* ===================================================== CONFIRM/DECLINE/LOGIN */}
        <SectionHead title="Confirm, decline &amp; claim login" sub="The steps after someone accepts or declines." />

        <Card
          n="16"
          area="ClaimConfirmForm — inline submit error"
          title="The confirm page's error message is a harsh red, not the warm family red"
          kind="visual"
          when="If claiming a sale fails (a dropped connection, a server hiccup). The message box is bright clinical red, unlike the softer warm-red used on the login and signup pages."
          change="Use the same warm error box as the rest of the claim flow."
          now={
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12.5,
                color: "#dc2626",
                lineHeight: 1.45,
              }}
            >
              Something didn&apos;t work. Try again, or contact support if it keeps happening.
            </div>
          }
          after={
            <div
              style={{
                background: "rgba(255,210,190,0.55)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12.5,
                color: "#8B2500",
                lineHeight: 1.45,
              }}
            >
              Something didn&apos;t work. Try again, or contact support if it keeps happening.
            </div>
          }
        />

        <Card
          n="17"
          area="app/claim/decline — eyebrow across branches"
          title="The small 'The Sales Progressor' label shows on some decline screens, not others"
          kind="visual"
          when="On the decline pages. The hard-error outcomes (invalid link, not found) carry the little brand label above the heading; the softer ones (expired, declined) don't."
          change="Show the brand label on all of them, so every decline outcome opens the same way."
          now={
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: CORAL, letterSpacing: "0.04em" }}>THE SALES PROGRESSOR</div>
                <Heading text="Invite not found" size={18} weight={700} color="#20242E" dot />
              </div>
              <div>
                <Heading text="Invitation declined" size={18} weight={700} color="#20242E" dot />
                <span style={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>(no label)</span>
              </div>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: CORAL, letterSpacing: "0.04em" }}>THE SALES PROGRESSOR</div>
                <Heading text="Invite not found" size={18} weight={700} color="#20242E" dot />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: CORAL, letterSpacing: "0.04em" }}>THE SALES PROGRESSOR</div>
                <Heading text="Invitation declined" size={18} weight={700} color="#20242E" dot />
              </div>
            </div>
          }
        />

        <Card
          n="18"
          area="app/claim/confirm — .claim-confirm-prop-addr"
          title="A long address on the confirm card can push the layout around"
          kind="visual"
          when="When the property address is long. The address line has no limit, so it can wrap awkwardly and shove the number badge and 'Your sale' label out of place."
          change="Keep the address to a tidy one or two lines so the card holds its shape."
          now={
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 26, height: 26, borderRadius: 999, background: CORAL, color: "#fff", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>04</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#20242E", lineHeight: 1.3 }}>
                Flat 12b, The Old Granary Warehouse Conversion, Mill Lane Wharfside
              </div>
            </div>
          }
          after={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 26, height: 26, borderRadius: 999, background: CORAL, color: "#fff", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>04</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#20242E", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Flat 12b, The Old Granary Warehouse Conversion, Mill Lane Wharfside
              </div>
            </div>
          }
        />

        <Card
          n="19"
          area="ClaimLoginForm — fields, button, heading, back link"
          title="The claim login page is still the old style throughout"
          kind="visual"
          when="When an invited agent who already has an account is asked to log in to claim. It never got the canonical pass, so its boxes and buttons differ from every page around it."
          change="Bring it in line: floating-label fields, the standard primary button (with a proper spinner), the shared heading, and the coral 'Back' link the other pages use."
          now={
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>Email</div>
                <div style={{ height: 38, border: "1px solid #d8d4cf", borderRadius: 8, background: "#fff" }} />
              </div>
              <span
                style={{
                  display: "inline-block",
                  textAlign: "center",
                  padding: "10px 0",
                  borderRadius: 10,
                  background: CORAL,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Log in &amp; claim
              </span>
              <span style={{ fontSize: 12, color: "#E85A35" }}>&larr; Back</span>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ position: "relative", height: 48, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }}>
                <span style={{ position: "absolute", top: 7, left: 12, fontSize: 10.5, color: MUTED }}>Email</span>
                <span style={{ position: "absolute", top: 22, left: 12, fontSize: 13, color: INK }}>jane@hamptons.co.uk</span>
              </div>
              <span
                style={{
                  display: "inline-block",
                  textAlign: "center",
                  padding: "11px 0",
                  borderRadius: 10,
                  background: CORAL,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Log in &amp; claim
              </span>
              <span style={{ fontSize: 12, color: CORAL }}>&larr; Back</span>
            </div>
          }
        />

        <Card
          n="20"
          area="confirm vs login — expired body copy"
          title="The same 'expired' screen is explained two different ways"
          kind="copy"
          when="When an invite has expired. The confirm page and the login page give different reasons for the same thing."
          change="Use one wording on both."
          now={
            <div style={{ display: "grid", gap: 12, fontSize: 13, lineHeight: 1.5, color: "#3F3F46" }}>
              <div>
                <span style={{ fontSize: 11, color: MUTED }}>confirm</span>
                <div>The link was valid for 7 days after it was sent. Ask the inviting agent to resend it.</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: MUTED }}>login</span>
                <div>This invite link has expired. Ask the inviting agent to resend it.</div>
              </div>
            </div>
          }
          after={
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "#3F3F46" }}>
              <span style={{ fontSize: 11, color: MUTED }}>both</span>
              <div>The link was valid for 7 days after it was sent. Ask the inviting agent to resend it.</div>
            </div>
          }
        />

        <Card
          n="21"
          area="ClaimLoginForm (live) vs ClaimConfirmForm (SHOW_RECONCILE=false)"
          title="One way into the claim asks 'where is this sale up to?', the other doesn't"
          kind="behind"
          when="Two agents claiming the same kind of sale can get a different experience: the one who has to log in is asked to tick off progress and back-date milestones; the one already signed in isn't asked at all."
          change="Make both entry points behave the same. You already chose to move this 'where is it up to' step to after the claim, so I'd switch it off on the login path too (this is the 'reconcile' step you asked about). Your call, since it changes the flow."
          now={
            <div style={{ fontSize: 13, color: "#5C544B", lineHeight: 1.6 }}>
              Already signed in: <strong style={{ color: INK }}>clean file, no questions</strong>
              <br />
              Has to log in: <strong style={{ color: INK }}>asked to set progress now</strong>
            </div>
          }
          after={
            <div style={{ fontSize: 13, color: "#5C544B", lineHeight: 1.6 }}>
              Both paths: <strong style={{ color: INK }}>clean file</strong>, progress set later from the file page.
            </div>
          }
        />

        <Card
          n="22"
          area="ClaimLoginForm — submit hidden on the vendor step"
          title="On the login page, the 'Log in' button disappears on one step"
          kind="behind"
          when="Only reachable while the 'where is it up to' step above is still switched on. On the seller-milestone step, the main login button isn't shown at all, so the way forward looks missing."
          change="If we switch that step off (card 21), this fixes itself. If it stays, keep the button visible so the action never vanishes."
          now={
            <p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>
              Primary button not rendered on the seller step. Only a small &quot;Next&quot; link moves you on.
            </p>
          }
          after={
            <p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>
              The main button is always present, so there&apos;s always an obvious way forward.
            </p>
          }
        />

        {/* ===================================================== MOVE-INVITE */}
        <SectionHead title="Move to a new agency" sub="The invite-to-move pages (currently off in your environment)." />

        <Card
          n="23"
          area="app/move-invite — MoveInviteClient + page cards"
          title="The 'move to a new agency' pages are a different style from everything else"
          kind="visual"
          when="When an agent is invited to move their account to another agency. These pages were built separately and use a cool-grey card, a smaller heavier heading, and plain buttons with no hover or pressed states."
          change="Re-skin them to match the family: the shared heading with the coral stop, warm card, and the standard button (hover, focus, pressed, spinner all included)."
          now={
            <div style={{ background: "#F4F4F6", borderRadius: 14, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#20242E", marginBottom: 8 }}>Join Hamptons?</div>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(32,36,46,0.62)", lineHeight: 1.5 }}>
                Jane has invited you to move your account into Hamptons.
              </p>
              <span style={{ display: "inline-block", padding: "9px 18px", borderRadius: 10, background: CORAL, color: "#fff", fontSize: 13, fontWeight: 600 }}>
                Join Hamptons
              </span>
            </div>
          }
          after={
            <div style={{ background: "#FFF9F4", borderRadius: 14, padding: 18, textAlign: "center", border: "1px solid rgba(255,107,74,0.12)" }}>
              <Heading text="Join Hamptons" size={22} weight={600} color="#2D1810" dot />
              <p style={{ margin: "8px 0 14px", fontSize: 13, color: "rgba(45,24,16,0.55)", lineHeight: 1.5 }}>
                Jane has invited you to move your account into Hamptons.
              </p>
              <span style={{ display: "inline-block", padding: "10px 20px", borderRadius: 10, background: CORAL, color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 1px 2px rgba(150,44,18,0.2)" }}>
                Join Hamptons
              </span>
            </div>
          }
        />

        {/* ===================================================== QUOTE */}
        <SectionHead title="Survey quote request" sub="The public quote flow for buyers." />

        <Card
          n="24"
          area="QuoteFlow — submit button, step badges, success tick"
          title="The quote page's buttons are glossy; the rest of the product is flat"
          kind="visual"
          when="On the quote request page: the main 'Request quote' button, the step number badges, and the success tick all use a shiny gradient with a glow."
          change="Flatten them to solid coral, matching the flat look used everywhere else."
          now={
            <span
              style={{
                display: "inline-block",
                padding: "11px 22px",
                borderRadius: 12,
                background: "linear-gradient(135deg,#FF8365,#FF6B4A)",
                boxShadow: "0 6px 22px -6px rgba(255,107,74,0.5)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Request quotes from 2 firms
            </span>
          }
          after={
            <span
              style={{
                display: "inline-block",
                padding: "11px 22px",
                borderRadius: 12,
                background: CORAL,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Request quotes from 2 firms
            </span>
          }
        />

        <Card
          n="25"
          area="QuoteFlow dead-ends (not-TSP, no onward address)"
          title="The quote 'dead-end' screens have weaker headings than the main flow"
          kind="visual"
          when="When the quote link doesn't apply (the sale isn't one we handle, or an onward address is missing). These screens drop to a smaller, plainer heading with no eyebrow, so they look lighter than the rest of the flow."
          change="Give them the same eyebrow and heading size as the main quote header."
          now={<Heading text="Arranging your survey" size={22} weight={700} color="#2D1810" />}
          after={
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: CORAL, letterSpacing: "0.06em" }}>YOUR SURVEY</div>
              <Heading text="Arranging your survey" size={26} weight={700} color="#2D1810" />
            </div>
          }
        />

        <Card
          n="26"
          area="QuoteFlow — kind select, notes textarea, onward price"
          title="The quote form mixes new and old input styles in the same card"
          kind="visual"
          when="In the quote form. The name, email and phone use the nice floating-label boxes, but the 'type of firm' dropdown, the notes box, and the onward-price box use the older plain style, sitting right next to them."
          change="Give the odd ones out the same treatment, so the whole form looks like one set of fields. The clearest offender is the price box directly under three floating-label fields."
          now={
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ position: "relative", height: 48, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }}>
                <span style={{ position: "absolute", top: 7, left: 12, fontSize: 10.5, color: MUTED }}>Email</span>
                <span style={{ position: "absolute", top: 22, left: 12, fontSize: 13, color: INK }}>buyer@email.com</span>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>Agreed purchase price (optional)</div>
                <div style={{ height: 38, border: "1px solid #d8d4cf", borderRadius: 8, background: "#fff" }} />
              </div>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ position: "relative", height: 48, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }}>
                <span style={{ position: "absolute", top: 7, left: 12, fontSize: 10.5, color: MUTED }}>Email</span>
                <span style={{ position: "absolute", top: 22, left: 12, fontSize: 13, color: INK }}>buyer@email.com</span>
              </div>
              <div style={{ position: "relative", height: 48, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }}>
                <span style={{ position: "absolute", top: 7, left: 12, fontSize: 10.5, color: MUTED }}>Agreed purchase price (optional)</span>
                <span style={{ position: "absolute", top: 22, left: 12, fontSize: 13, color: INK }}>450,000</span>
              </div>
            </div>
          }
        />

        <Card
          n="27"
          area="QuoteFlow — pending button + empty service-type step"
          title="The quote 'Send' button has no spinner, and one empty step can strand you"
          kind="behind"
          when="While a quote is sending, the button just says 'Sending...' with no spinner. And if a firm type has no services set up, that step shows an empty list with no message, so there's nowhere to go."
          change="Add a spinner while sending, and a short 'nothing available here yet' message on the empty step, matching how the 'choose firms' step already handles empty."
          now={
            <div style={{ display: "grid", gap: 10 }}>
              <span style={{ display: "inline-block", padding: "10px 18px", borderRadius: 10, background: "#EADED4", color: MUTED, fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                Sending...
              </span>
              <p style={{ margin: 0, fontSize: 12, color: MUTED, fontStyle: "italic" }}>Empty step: blank list, no message</p>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 10 }}>
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "10px 18px", borderRadius: 10, background: CORAL, color: "#fff", fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.5)", borderTopColor: "#fff", borderRadius: 999, display: "inline-block" }} />
                Sending...
              </span>
              <p style={{ margin: 0, fontSize: 12, color: "#5C544B" }}>
                Empty step: &quot;Nothing available here yet. Try a different option above.&quot;
              </p>
            </div>
          }
        />

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: `1px solid ${LINE}`, fontSize: 12.5, color: MUTED }}>
          27 proposals across 10 pages. Nothing on this page is live. Tell me which to build (by number), and whether to
          group them into one commit per page or ship individually.
        </footer>
      </div>
    </main>
  );
}
