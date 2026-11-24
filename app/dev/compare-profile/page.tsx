import type { ReactNode } from "react";

// /dev/compare-profile - before/after review for the account Profile settings
// page (/agent/account/profile). Audit-only: nothing here changes how anything
// works. Each card shows what ships TODAY ("Now") next to the PROPOSED version.
// Faithful inline reproductions of the real values so the two read byte-for-byte.

export const dynamic = "force-static";

const PAPER = "#F4F1EC";
const INK = "#2D2420";
const MUTED = "#8A8176";
const LINE = "#E7E2DA";
const CORAL = "#FF6B4A";

type Kind = "colour" | "message" | "fill" | "visual" | "wording" | "tidy";
const KIND_META: Record<Kind, { label: string; fg: string; bg: string }> = {
  colour: { label: "Colour", fg: "#B23A1E", bg: "rgba(255,107,74,0.12)" },
  message: { label: "Message box", fg: "#2F6B49", bg: "rgba(47,158,107,0.12)" },
  fill: { label: "Remove fill", fg: "#8A5A00", bg: "rgba(224,148,46,0.14)" },
  visual: { label: "Changes the look · needs your OK", fg: "#8a3a1e", bg: "rgba(255,107,74,0.16)" },
  wording: { label: "Wording", fg: "#5a4bbf", bg: "rgba(90,75,191,0.12)" },
  tidy: { label: "Tidy-up", fg: "#6B6358", bg: "rgba(107,99,88,0.10)" },
};

function Chip({ kind }: { kind: Kind }) {
  const m = KIND_META[kind];
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", color: m.fg, background: m.bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{m.label}</span>;
}

function Panel({ tone, label, children }: { tone: "now" | "after"; label: string; children: ReactNode }) {
  return (
    <div style={{ flex: "1 1 320px", minWidth: 300, border: `1px solid ${LINE}`, borderRadius: 12, background: "#fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: `1px solid ${LINE}`, background: tone === "now" ? "#FBFAF8" : "rgba(255,107,74,0.04)" }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tone === "now" ? MUTED : CORAL }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: tone === "now" ? MUTED : "#B23A1E", letterSpacing: "0.02em" }}>{label}</span>
      </div>
      <div style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

function Card({ n, area, title, kind, when, change, now, after }: { n: string; area: string; title: string; kind: Kind; when: string; change: string; now: ReactNode; after: ReactNode }) {
  return (
    <section style={{ border: `1px solid ${LINE}`, borderRadius: 16, background: "#FEFDFB", padding: 22, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: CORAL, fontVariantNumeric: "tabular-nums" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: INK, letterSpacing: "-0.01em", flex: 1, minWidth: 220 }}>{title}</h3>
        <Chip kind={kind} />
      </div>
      <p style={{ margin: "10px 0 2px", fontSize: 13.5, lineHeight: 1.55, color: "#5C544B" }}><strong style={{ color: INK, fontWeight: 600 }}>Where: </strong>{when}</p>
      <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.55, color: "#5C544B" }}><strong style={{ color: INK, fontWeight: 600 }}>What we'd change: </strong>{change}</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Panel tone="now" label="Now (live today)">{now}</Panel>
        <Panel tone="after" label="Proposed">{after}</Panel>
      </div>
      <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: MUTED }}>{area}</p>
    </section>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ margin: "34px 0 14px" }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: CORAL }}>{title}</h2>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>{sub}</p>
    </div>
  );
}

/* ---- reproductions ---- */

// Canonical InlineAlert look (bordered on white, glyph + text, no fill).
function Alert({ kind, children }: { kind: "danger" | "warning"; children: ReactNode }) {
  const c = kind === "danger" ? "#C73E3E" : "#C97D1A";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", borderRadius: 8, border: `1px solid ${kind === "danger" ? "rgba(199,62,62,0.30)" : "rgba(201,125,26,0.30)"}`, background: "#fff" }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flex: "none", marginTop: 1 }}>
        <circle cx="8" cy="8" r="6.6" stroke={c} strokeWidth="1.3" />
        <path d="M8 4.7v4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.5" fill={c} stroke={c} strokeWidth="0.6" />
      </svg>
      <span style={{ fontSize: 12.5, color: c, fontWeight: 500, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}

const field = (color: string, labelColor: string) => (
  <div>
    <div style={{ fontSize: 10, color: labelColor, textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 500, marginBottom: 5 }}>Full name</div>
    <div style={{ padding: "10px 12px", fontSize: 13.5, color, background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8 }}>Emma Green</div>
  </div>
);

export default function CompareProfilePage() {
  return (
    <main style={{ minHeight: "100vh", background: PAPER, color: INK, padding: "40px 20px 80px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: CORAL }}>Settings · page 1</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>Account · Profile - before and after</h1>
          <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "#5C544B", maxWidth: 680 }}>
            An audit of your first settings page (<strong>/agent/account/profile</strong>). <strong>Nothing here changes how anything works</strong> - it&apos;s colour, message boxes and matching the app&apos;s standard controls. The good news: the cards and page layout are already the right building blocks; the gaps are below. Two cards are marked <strong>&quot;Changes the look&quot;</strong> - those I won&apos;t touch without your yes.
          </p>
        </header>

        <div style={{ margin: "14px 0 4px", padding: "12px 16px", borderRadius: 12, background: "rgba(47,158,107,0.08)", border: "1px solid rgba(47,158,107,0.25)", fontSize: 13, color: "#1F6B49", lineHeight: 1.5 }}>
          Safe to just build: cards 01–05 and 08 (colour, message boxes, wording). Need your yes first: 06 and 07 (they change how the buttons / fields look). Card 09 is a wording decision. Card 10 is invisible tidy-up.
        </div>

        {/* ============ SAFE ============ */}
        <SectionHead title="Colour + message boxes (safe - no change to how it looks beyond this)" sub="These bring the page in line with the rest of the app without altering the layout." />

        <Card
          n="01"
          area="AccountPageHeader, AccountCard, ProfileForm - raw hex colours → --agent tokens"
          title="The text is a cool grey that ignores your brand colour"
          kind="colour"
          when="The page heading, every card title and subtitle, the field labels, and the small print - all over the Profile page."
          change="Swap the hard-coded cool greys for the app's warm text colours, which follow whatever brand theme the agency picks. No sizes or weights change - only the colour becomes correct."
          now={
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Profile</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Manage your personal details and app preferences.</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 14 }}>Cool Tailwind grey #111827 / #6b7280 - same on every theme</div>
            </div>
          }
          after={
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#2D1810", letterSpacing: "-0.02em" }}>Profile</div>
              <div style={{ fontSize: 13, color: "rgba(45,24,16,0.55)", marginTop: 4 }}>Manage your personal details and app preferences.</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 14 }}>Warm theme text - shifts with the agency&apos;s brand colour</div>
            </div>
          }
        />

        <Card
          n="02"
          area="ProfileFormPlain:359-362, EmailSignatureCard:341 - error text → InlineAlert"
          title="Form errors are a bare line of red text"
          kind="message"
          when="When a form can't save (e.g. your name is too short, or an email fails) on the profile form and the email-signature card."
          change="Show them in the app's one standard message box - a clean bordered box with a small warning icon - instead of a loose line of red text."
          now={<p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>Your name needs at least 2 characters.</p>}
          after={<Alert kind="danger">Your name needs at least 2 characters.</Alert>}
        />

        <Card
          n="03"
          area="ProfileFormPlain:364-378 - washed amber box → InlineAlert warning"
          title="The 'changing your email' note sits in a filled amber box"
          kind="fill"
          when="Under the email field, when you change your email address."
          change="Use the standard bordered message box instead of the amber-filled one. (Your design rules say not to put a colour wash behind a box - this is one of them.)"
          now={
            <p style={{ margin: 0, fontSize: 11.5, color: "#92400e", background: "#fef3c7", border: "0.5px solid #fde68a", borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 }}>
              Changing your email also changes your login. You&apos;ll need to sign out and back in for it to take effect.
            </p>
          }
          after={<Alert kind="warning">Changing your email also changes your login. You&apos;ll need to sign out and back in for it to take effect.</Alert>}
        />

        <Card
          n="04"
          area="AccountDangerZonePlain:288-302 - washed red box → InlineAlert danger"
          title="The delete-account error is a filled red box"
          kind="fill"
          when="In the 'delete account' pop-up, if the deletion fails."
          change="Same fix as above - the standard bordered message box, no red colour-wash behind it."
          now={
            <div style={{ padding: "9px 12px", fontSize: 12.5, color: "#b91c1c", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 8 }}>
              Something went wrong. Please try again.
            </div>
          }
          after={<Alert kind="danger">Something went wrong. Please try again.</Alert>}
        />

        <Card
          n="05"
          area="WritingStyleCard:72-81 - coral 5% wash → border only"
          title="The 'what we've learned' panel has a faint colour wash"
          kind="fill"
          when="On the writing-style card, the panel that summarises your tone."
          change="Keep the panel, but replace the faint coral background with a thin coral border - same no-colour-wash rule as the boxes above."
          now={
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(226,69,42,0.05)", border: "1px solid rgba(226,69,42,0.18)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#E2452A", textTransform: "uppercase", letterSpacing: 0.6 }}>What we&apos;ve learned</div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>You write warmly and keep updates short.</div>
            </div>
          }
          after={
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid rgba(255,107,74,0.35)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#B23A1E", textTransform: "uppercase", letterSpacing: 0.6 }}>What we&apos;ve learned</div>
              <div style={{ fontSize: 13, color: "rgba(45,24,16,0.7)", marginTop: 6, lineHeight: 1.5 }}>You write warmly and keep updates short.</div>
            </div>
          }
        />

        <Card
          n="08"
          area="EmailSignatureCard:43 - Law 21 voice"
          title="Wording: &quot;Created automatically&quot;"
          kind="wording"
          when="On the email-signature card, the label for the basic signature mode."
          change="Your voice rules avoid the word 'automatically'. Small reword, same meaning."
          now={<div style={{ fontSize: 13, color: "#374151" }}>Created automatically from your details.</div>}
          after={<div style={{ fontSize: 13, color: "rgba(45,24,16,0.7)" }}>We create it from your details.</div>}
        />

        {/* ============ NEEDS OK ============ */}
        <SectionHead title="Matching the app's standard controls (these change how things look - your call)" sub="Correct canonical-wise, but they alter the appearance, so I won't touch them without a yes." />

        <Card
          n="06"
          area="ProfileForm Save/Upload, Danger-zone Cancel/Delete - account-btn-* → arc Button"
          title="The buttons are a slightly different style from the app's standard button"
          kind="visual"
          when="The 'Save changes' and 'Upload photo' buttons on the form, and 'Cancel' / 'Delete permanently' in the delete pop-up."
          change="Swap the account-area buttons for the app's standard button (the same one used everywhere else). It adds the standard press animation. This is an account-wide change, so it's a yes/no decision, not just this page."
          now={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "9px 18px", borderRadius: 10, background: "linear-gradient(180deg,#FF8365,#FF6B4A)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)", color: "#fff", fontSize: 13, fontWeight: 500 }}>Save changes</span>
              <span style={{ padding: "7px 14px", borderRadius: 8, background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", color: "#374151", fontSize: 12.5, fontWeight: 500 }}>Upload photo</span>
            </div>
          }
          after={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "9px 18px", borderRadius: 10, background: CORAL, color: "#fff", fontSize: 13, fontWeight: 600 }}>Save changes</span>
              <span style={{ padding: "7px 14px", borderRadius: 8, background: "#fff", border: `1px solid ${LINE}`, color: INK, fontSize: 12.5, fontWeight: 600 }}>Upload photo</span>
            </div>
          }
        />

        <Card
          n="07"
          area="ProfileFormPlain fields - raw input + uppercase label → LabelInput"
          title="The form fields use an uppercase label above a box"
          kind="visual"
          when="Every field on the profile form - name, email, phone, job title, direct mobile."
          change="Switch to the app's standard field, where the label sits inside the box and floats up when you type (the same field used on sign-in, invites, quote). Cleaner and consistent - but it changes the look, so only if you want it."
          now={field("#111827", "#6b7280")}
          after={
            <div style={{ position: "relative", height: 48, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }}>
              <span style={{ position: "absolute", top: 7, left: 12, fontSize: 10.5, color: MUTED }}>Full name</span>
              <span style={{ position: "absolute", top: 22, left: 12, fontSize: 13, color: INK }}>Emma Green</span>
            </div>
          }
        />

        {/* ============ DECISION / TIDY ============ */}
        <SectionHead title="A wording decision + invisible tidy-up" sub="One needs your call; the other has no visible effect." />

        <Card
          n="09"
          area="AccountDangerZonePlain - 'delete' wording vs the voice rule"
          title="&quot;Delete account&quot; wording - your call"
          kind="wording"
          when="The delete-account row and its pop-up ('Delete my account', 'Delete permanently')."
          change="Your voice rules say use 'remove', not 'delete'. But account deletion is a legal data-erasure action where 'delete' is deliberately strong and clear. I'd leave it as 'delete' unless you'd rather it read 'remove' - this one's a judgement call, so I'm asking, not changing."
          now={
            <div style={{ display: "grid", gap: 8, fontSize: 13, color: INK }}>
              <div>Delete my account</div>
              <div style={{ color: "#b91c1c" }}>Delete permanently</div>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 8, fontSize: 13, color: INK }}>
              <div>Remove my account</div>
              <div style={{ color: "#b91c1c" }}>Remove permanently</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>…only if you prefer this. Default: keep &quot;delete&quot;.</div>
            </div>
          }
        />

        <Card
          n="10"
          area="Repeated eyebrow label + duplicated button style objects (WritingStyle + EmailSignature)"
          title="Behind the scenes: reuse two repeated bits of styling"
          kind="tidy"
          when="Never visible. The small uppercase label and the account button styling are copy-pasted in a few places."
          change="Pull them into one shared place so they can't drift apart. No visual change at all - pure housekeeping."
          now={<p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>The uppercase field label and the account button styles are written out separately in each card.</p>}
          after={<p style={{ margin: 0, fontSize: 13, color: "#5C544B" }}>One shared label + one shared button style, reused everywhere.</p>}
        />

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: `1px solid ${LINE}`, fontSize: 12.5, color: MUTED }}>
          Profile settings audit · nothing here is live. Tell me which cards to build. Safe set (01–05, 08) I can do now; 06 + 07 need your yes; 09 is your wording call.
        </footer>
      </div>
    </main>
  );
}
