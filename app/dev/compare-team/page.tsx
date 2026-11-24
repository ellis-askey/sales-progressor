import type { ReactNode } from "react";

// /dev/compare-team — before/after review for the account Team settings page
// (/agent/account/team). Audit-only, behaviour-preserving. Faithful inline
// reproductions of the real values so the two panels read byte-for-byte.

export const dynamic = "force-static";

const PAPER = "#F4F1EC";
const INK = "#2D2420";
const MUTED = "#8A8176";
const LINE = "#E7E2DA";
const CORAL = "#FF6B4A";

type Kind = "colour" | "message" | "fill" | "visual" | "new" | "tidy";
const KIND_META: Record<Kind, { label: string; fg: string; bg: string }> = {
  colour: { label: "Colour", fg: "#B23A1E", bg: "rgba(255,107,74,0.12)" },
  message: { label: "Message box", fg: "#2F6B49", bg: "rgba(47,158,107,0.12)" },
  fill: { label: "Remove fill", fg: "#8A5A00", bg: "rgba(224,148,46,0.14)" },
  visual: { label: "Standard control", fg: "#8a3a1e", bg: "rgba(255,107,74,0.16)" },
  new: { label: "New canonical", fg: "#5a4bbf", bg: "rgba(90,75,191,0.12)" },
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

// A member row (shared pattern), rendered with a given badge, for the badge card.
function MemberRow({ name, sub, badge }: { name: string; sub: string; badge: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 34, height: 34, borderRadius: 999, background: "#EDE8E1", flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: INK }}>{name}</span>
        <span style={{ display: "block", fontSize: 12, color: MUTED }}>{sub}</span>
      </span>
      {badge}
    </div>
  );
}

export default function CompareTeamPage() {
  return (
    <main style={{ minHeight: "100vh", background: PAPER, color: INK, padding: "40px 20px 80px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: CORAL }}>Settings · page 2</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>Account · Team - before and after</h1>
          <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "#5C544B", maxWidth: 700 }}>
            The Team tab (<strong>/agent/account/team</strong>): the agency name + logo, the team roster, inviting team members / your director, and join requests. <strong>Nothing changes how anything works.</strong> Most of this is the <em>same</em> set of fixes you already approved on Profile (grey-to-theme colour, errors in the standard box, washes to borders, standard buttons + fields) - so if you were happy there, you&apos;ll be happy here. The one genuinely new thing is card 05, the role badges.
          </p>
        </header>

        <div style={{ margin: "14px 0 4px", padding: "12px 16px", borderRadius: 12, background: "rgba(47,158,107,0.08)", border: "1px solid rgba(47,158,107,0.25)", fontSize: 13, color: "#1F6B49", lineHeight: 1.5 }}>
          01-04 are the same safe fixes as Profile. 05 is a new bordered badge (your call on the look). 06-07 are the standard buttons + fields (same as Profile). 08 is invisible tidy-up.
        </div>

        <SectionHead title="Same safe fixes as Profile" sub="Colour, message boxes and removing colour-washes - no change to the layout." />

        <Card
          n="01"
          area="All team components - raw hex greys → --agent tokens"
          title="The text is cool grey, not your brand colour"
          kind="colour"
          when="Across the whole Team tab - member names, emails, role labels, the invite forms, help text."
          change="Same as Profile: swap the fixed cool greys for the warm theme text that follows the agency's brand colour. Sizes and weights unchanged."
          now={
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#111827" }}>Sarah Collins</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>sarah@youragency.co.uk</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>Cool grey #111827 / #6b7280</div>
            </div>
          }
          after={
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2D1810" }}>Sarah Collins</div>
              <div style={{ fontSize: 12, color: "rgba(45,24,16,0.55)", marginTop: 2 }}>sarah@youragency.co.uk</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>Warm theme text, follows the brand</div>
            </div>
          }
        />

        <Card
          n="02"
          area="TeamManagement / AgencyNameForm / InviteDirector - error <p> → InlineAlert"
          title="Form errors are a bare line of red text"
          kind="message"
          when="When an invite or the agency-name save fails (bad email, name taken, etc.)."
          change="Use the one standard bordered message box, like everywhere else."
          now={<p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>That email is already on your team.</p>}
          after={<Alert kind="danger">That email is already on your team.</Alert>}
        />

        <Card
          n="03"
          area="InviteDirectorPlain:124-139 - washed amber box → InlineAlert warning"
          title="The 'invitation expired' note sits in a filled amber box"
          kind="fill"
          when="On the 'invite your director' screen, when a previous invite has expired."
          change="Standard bordered message box instead of the amber-filled one (no colour wash)."
          now={
            <p style={{ margin: 0, fontSize: 12.5, color: "#92400e", background: "#fef3c7", border: "0.5px solid #fde68a", borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 }}>
              Your previous invitation to James expired. You can send a new one below.
            </p>
          }
          after={<Alert kind="warning">Your previous invitation to James expired. You can send a new one below.</Alert>}
        />

        <Card
          n="04"
          area="TeamManagementPlain:403-430 - coral 5% wash → border"
          title="The 'file access' info box has a faint coral wash"
          kind="fill"
          when="In the invite form, the box explaining what files a new member can see."
          change="Keep the box, swap the faint coral background for a thin coral border (same no-wash rule as the message boxes)."
          now={
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,107,74,0.05)", border: "0.5px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>File access</div>
              <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>Negotiators see <strong style={{ color: "#374151" }}>their own files</strong> by default.</div>
            </div>
          }
          after={
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,107,74,0.35)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2D1810" }}>File access</div>
              <div style={{ fontSize: 12.5, color: "rgba(45,24,16,0.6)", marginTop: 4, lineHeight: 1.5 }}>Negotiators see <strong style={{ color: "rgba(45,24,16,0.8)" }}>their own files</strong> by default.</div>
            </div>
          }
        />

        <SectionHead title="The one new thing" sub="There's no standard badge in the app yet - this proposes one." />

        <Card
          n="05"
          area="TeamListViewPlain:67-88 - washed role pills → bordered Badge (new canonical)"
          title="Role badges are filled colour pills"
          kind="new"
          when="Next to each team member and each pending invite - the DIRECTOR / NEGOTIATOR tags."
          change="Replace the filled amber/grey pills with a clean bordered badge (outline + coloured text, no fill). Same no-wash rule. This becomes the app's standard badge, reusable on other pages."
          now={
            <div style={{ display: "grid", gap: 10 }}>
              <MemberRow name="Sarah Collins" sub="Director" badge={<span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, padding: "3px 8px", borderRadius: 5, background: "#fef3c7", color: "#92400e" }}>Director</span>} />
              <MemberRow name="Tom Reeves" sub="Negotiator" badge={<span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, padding: "3px 8px", borderRadius: 5, background: "#f3f4f6", color: "#6b7280" }}>Negotiator</span>} />
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 10 }}>
              <MemberRow name="Sarah Collins" sub="Director" badge={<span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, padding: "3px 8px", borderRadius: 6, background: "transparent", border: "1px solid rgba(201,125,26,0.45)", color: "#B07A1A" }}>Director</span>} />
              <MemberRow name="Tom Reeves" sub="Negotiator" badge={<span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, padding: "3px 8px", borderRadius: 6, background: "transparent", border: `1px solid ${LINE}`, color: MUTED }}>Negotiator</span>} />
            </div>
          }
        />

        <SectionHead title="Standard buttons + fields (same as Profile)" sub="You approved these on Profile; shown here so you can see them in the Team context." />

        <Card
          n="06"
          area="AgencyName Save, invite Send/Cancel/Reinstate/Resend - → arc Button"
          title="The buttons are the account-area style, not the standard button"
          kind="visual"
          when="Save agency name; Send invitation / Cancel; Reinstate a removed member; Resend to your director."
          change="Swap to the app's standard button (same decision as Profile). Reinstate becomes the coral-outline variant; remove/cancel actions use the quiet ghost style."
          now={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "9px 16px", borderRadius: 10, background: "linear-gradient(180deg,#FF8365,#FF6B4A)", color: "#fff", fontSize: 13, fontWeight: 500 }}>Send invitation</span>
              <span style={{ padding: "7px 12px", borderRadius: 9, background: "#fff", border: "0.5px solid rgba(255,107,74,0.5)", color: "#E2452A", fontSize: 12.5, fontWeight: 500 }}>Reinstate</span>
            </div>
          }
          after={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "9px 16px", borderRadius: 10, background: CORAL, color: "#fff", fontSize: 13, fontWeight: 600 }}>Send invitation</span>
              <span style={{ padding: "7px 12px", borderRadius: 9, background: "transparent", border: `1px solid ${CORAL}`, color: "#B23A1E", fontSize: 12.5, fontWeight: 600 }}>Reinstate</span>
            </div>
          }
        />

        <Card
          n="07"
          area="Invite name+email, Agency name, Director name+email - raw input → LabelInput"
          title="The invite/name fields use an uppercase label above a box"
          kind="visual"
          when="The 'invite a team member' name + email, the agency-name field, and the 'invite your director' name + email."
          change="Switch to the app's floating-label field (same as Profile), with the same 16px row spacing. Behaviour, validation and auto-formatting unchanged."
          now={
            <div>
              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 500, marginBottom: 5 }}>Agency name</div>
              <div style={{ padding: "10px 12px", fontSize: 13.5, color: "#111827", background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8 }}>Hamptons</div>
            </div>
          }
          after={
            <div style={{ position: "relative", height: 48, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }}>
              <span style={{ position: "absolute", top: 7, left: 12, fontSize: 10.5, color: MUTED }}>Agency name</span>
              <span style={{ position: "absolute", top: 22, left: 12, fontSize: 13, color: INK }}>Hamptons</span>
            </div>
          }
        />

        <SectionHead title="Invisible tidy-up" sub="No visible effect." />

        <Card
          n="08"
          area="TeamListView / TeamManagement / InviteDirector / JoinRequests - repeated row anatomy"
          title="Behind the scenes: one shared 'team member row'"
          kind="tidy"
          when="Never visible. The same row (avatar + name + detail + badge/control) is written out separately in four places."
          change="Pull it into one shared row component so they stay identical. No visual change. Like Profile's card 10, I'd treat this as an optional follow-up rather than risk touching four files at once - your call."
          now={<p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>Four near-identical copies of the member-row layout.</p>}
          after={<p style={{ margin: 0, fontSize: 13, color: "#5C544B" }}>One shared row, reused everywhere.</p>}
        />

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: `1px solid ${LINE}`, fontSize: 12.5, color: MUTED }}>
          Team settings audit · nothing here is live. Tell me which to build - 01-04 are the safe Profile-parity set; 05 is the new badge; 06-07 the standard controls; 08 optional tidy.
        </footer>
      </div>
    </main>
  );
}
