import type { ReactNode } from "react";

// /dev/compare-emails — before/after review for the account Emails settings page
// (/agent/account/emails). Audit-only, behaviour-preserving. Faithful inline
// reproductions so the two panels read byte-for-byte.

export const dynamic = "force-static";

const PAPER = "#F4F1EC";
const INK = "#2D2420";
const MUTED = "#8A8176";
const LINE = "#E7E2DA";
const CORAL = "#FF6B4A";

type Kind = "colour" | "message" | "badge" | "visual" | "new" | "wording" | "tidy" | "keep";
const KIND_META: Record<Kind, { label: string; fg: string; bg: string }> = {
  colour: { label: "Colour", fg: "#B23A1E", bg: "rgba(255,107,74,0.12)" },
  message: { label: "Message box", fg: "#2F6B49", bg: "rgba(47,158,107,0.12)" },
  badge: { label: "Badge", fg: "#5a4bbf", bg: "rgba(90,75,191,0.12)" },
  visual: { label: "Standard control", fg: "#8a3a1e", bg: "rgba(255,107,74,0.16)" },
  new: { label: "New canonical", fg: "#5a4bbf", bg: "rgba(90,75,191,0.12)" },
  wording: { label: "Wording", fg: "#8A5A00", bg: "rgba(224,148,46,0.14)" },
  tidy: { label: "Tidy-up", fg: "#6B6358", bg: "rgba(107,99,88,0.10)" },
  keep: { label: "Left as-is", fg: "#6B6358", bg: "rgba(107,99,88,0.10)" },
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

function Alert({ kind, children }: { kind: "danger" | "warning" | "info"; children: ReactNode }) {
  const c = kind === "danger" ? "#C73E3E" : kind === "warning" ? "#C97D1A" : "#2563eb";
  const b = kind === "danger" ? "rgba(199,62,62,0.30)" : kind === "warning" ? "rgba(201,125,26,0.30)" : "rgba(37,99,235,0.30)";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", borderRadius: 8, border: `1px solid ${b}`, background: "#fff" }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flex: "none", marginTop: 1 }}>
        <circle cx="8" cy="8" r="6.6" stroke={c} strokeWidth="1.3" />
        <path d="M8 4.7v4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.5" fill={c} stroke={c} strokeWidth="0.6" />
      </svg>
      <span style={{ fontSize: 12.5, color: c, fontWeight: 500, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}

function PillNow({ children, coral = false }: { children: ReactNode; coral?: boolean }) {
  return <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "3px 8px", borderRadius: 999, background: coral ? "rgba(255,107,74,0.10)" : "#f3f4f6", color: coral ? "#E2452A" : "#6b7280", border: coral ? "0.5px solid rgba(255,107,74,0.4)" : "none" }}>{children}</span>;
}
function BadgeAfter({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, padding: "3px 8px", borderRadius: 6, background: "transparent", border: `1px solid ${accent ? "rgba(255,107,74,0.45)" : LINE}`, color: accent ? "#B23A1E" : MUTED }}>{children}</span>;
}

function Seg({ options, active, dark = false }: { options: string[]; active: number; dark?: boolean }) {
  return (
    <div style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 10, background: "#f7f7f8", border: "0.5px solid rgba(0,0,0,0.10)" }}>
      {options.map((o, i) => (
        <span key={o} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, background: i === active ? (dark ? "#111827" : "#fff") : "transparent", color: i === active ? (dark ? "#fff" : CORAL) : "#6b7280", boxShadow: i === active && !dark ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>{o}</span>
      ))}
    </div>
  );
}

export default function CompareEmailsPage() {
  return (
    <main style={{ minHeight: "100vh", background: PAPER, color: INK, padding: "40px 20px 80px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: CORAL }}>Settings · page 3</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>Account · Emails - before and after</h1>
          <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "#5C544B", maxWidth: 720 }}>
            The Emails tab (<strong>/agent/account/emails</strong>): the client-email wording, the automated-emails list, and the branding/sender tabs. <strong>Nothing changes how anything works.</strong> Cards 01-06 are the same fixes you signed off on Profile + Team. 07-08 are two brand-new standard pieces (a toggle and the tabs). 09-10 are the big structural win: <strong>six email editors are currently near-identical copies</strong>, so one shared version fixes all six at once.
          </p>
        </header>

        <div style={{ margin: "14px 0 4px", padding: "12px 16px", borderRadius: 12, background: "rgba(47,158,107,0.08)", border: "1px solid rgba(47,158,107,0.25)", fontSize: 13, color: "#1F6B49", lineHeight: 1.5 }}>
          01-06: the familiar safe set (colour, message boxes, badges, buttons, fields, wording). 07-08: new standard pieces - your eye on the look. 09-10: structural tidy that makes all six editors consistent. 11: a few things I&apos;d deliberately leave alone.
        </div>

        <SectionHead title="The familiar safe set (Profile + Team parity)" sub="Same fixes, nothing new to decide." />

        <Card
          n="01"
          area="page + all email components - raw hex greys → --agent tokens"
          title="Cool grey text, not your brand colour"
          kind="colour"
          when="Across the whole Emails tab - headings, body, labels, help text, the editors."
          change="Same as before: swap the fixed cool greys for the warm theme text that follows the brand. No sizes change."
          now={<div><div style={{ fontSize: 13.5, fontWeight: 600, color: "#111827" }}>Step-by-step updates</div><div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>The email your client receives…</div></div>}
          after={<div><div style={{ fontSize: 13.5, fontWeight: 600, color: "#2D1810" }}>Step-by-step updates</div><div style={{ fontSize: 12, color: "rgba(45,24,16,0.55)", marginTop: 2 }}>The email your client receives…</div></div>}
        />

        <Card
          n="02"
          area="page info box (blue wash), editor warnings (amber wash), list banner (coral wash) → InlineAlert"
          title="Info/warning notes sit in filled colour boxes"
          kind="message"
          when="The blue 'your version is what clients see' note, every editor's amber warning, and the 'not sending yet' banner."
          change="All move to the standard bordered message box (info / warning), removing three different colour-washes that break the no-fill rule."
          now={
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(37,99,235,0.04)" }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: "#2563eb", flexShrink: 0 }} />
                <div><div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Your version is what clients see</div><div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Changes take effect from the next email.</div></div>
              </div>
              <div style={{ fontSize: 12, color: "#92610a", background: "rgba(251,191,36,0.10)", border: "0.5px solid rgba(217,119,6,0.35)", borderRadius: 8, padding: "8px 12px" }}>The completion date is added for you.</div>
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 10 }}>
              <Alert kind="info">Your version is what clients see. Changes take effect from the next email.</Alert>
              <Alert kind="warning">The completion date is added for you.</Alert>
            </div>
          }
        />

        <Card
          n="03"
          area="editor pills, milestone badges, list chips → canonical Badge"
          title="Status tags are filled colour pills"
          kind="badge"
          when="The 'Your version' / 'Sales Progressor default' / 'Not sending yet' tags, and the Buyer / Seller side chips."
          change="Use the bordered Badge we added on Team (no fill). One caveat: the Buyer/Seller chips are sentence-case today; the standard badge is UPPERCASE - so they'd read BUYER / SELLER. Happy with that, or keep those two as a plain bordered chip?"
          now={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <PillNow coral>Your version</PillNow>
              <PillNow>Sales Progressor default</PillNow>
              <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 7, background: "#f7f7f8", color: "#6b7280", border: "0.5px solid rgba(0,0,0,0.06)" }}>Buyer</span>
            </div>
          }
          after={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <BadgeAfter accent>Your version</BadgeAfter>
              <BadgeAfter>Sales Progressor default</BadgeAfter>
              <BadgeAfter>Buyer</BadgeAfter>
            </div>
          }
        />

        <Card
          n="04"
          area="editor Save/Cancel/Reset/Add, list 'Edit email' → arc Button"
          title="The buttons are the account/legacy style"
          kind="visual"
          when="Save / Cancel / Reset-to-default / Add-a-point in every editor, and 'Edit email' on the list."
          change="Swap to the app's standard button (same as Profile + Team). 'Edit email' becomes coral-outline; Reset/Cancel use the quiet style; Remove uses the danger style."
          now={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "8px 16px", borderRadius: 9, background: "linear-gradient(180deg,#FF8365,#FF6B4A)", color: "#fff", fontSize: 13, fontWeight: 500 }}>Save</span>
              <span style={{ padding: "7px 12px", borderRadius: 9, background: "#fff", border: "0.5px solid rgba(255,107,74,0.45)", color: "#E2452A", fontSize: 12.5, fontWeight: 500 }}>Edit email</span>
            </div>
          }
          after={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ padding: "8px 16px", borderRadius: 9, background: CORAL, color: "#fff", fontSize: 13, fontWeight: 600 }}>Save</span>
              <span style={{ padding: "7px 12px", borderRadius: 9, background: "transparent", border: `1px solid ${CORAL}`, color: "#B23A1E", fontSize: 12.5, fontWeight: 600 }}>Edit email</span>
            </div>
          }
        />

        <Card
          n="05"
          area="editor Subject / Headline / Button-label inputs → LabelInput"
          title="The single-line fields use an uppercase label above a box"
          kind="visual"
          when="The 'Subject', 'Headline' and 'Button label' fields in the email editors. (The big body boxes stay as they are - there's no floating-label for multi-line.)"
          change="Switch the single-line fields to the floating-label field, same as Profile + Team."
          now={
            <div>
              <div style={{ fontSize: 10.5, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, marginBottom: 5 }}>Subject</div>
              <div style={{ padding: "9px 11px", fontSize: 14, color: "#111827", background: "#fff", border: "1px solid rgba(0,0,0,0.14)", borderRadius: 9 }}>Your sale has exchanged</div>
            </div>
          }
          after={
            <div style={{ position: "relative", height: 48, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff" }}>
              <span style={{ position: "absolute", top: 7, left: 12, fontSize: 10.5, color: MUTED }}>Subject</span>
              <span style={{ position: "absolute", top: 22, left: 12, fontSize: 13, color: INK }}>Your sale has exchanged</span>
            </div>
          }
        />

        <Card
          n="06"
          area="AutomatedEmailsList + 5 editors - Law 21 'automatically'"
          title="Wording: &quot;added automatically&quot;"
          kind="wording"
          when="Five bits of help text say something is 'added automatically' (completion date, button, footer, link, etc.)."
          change="Your voice rules avoid 'automatically'. Reword to 'we add…' / 'we'll add…'. Same meaning."
          now={<div style={{ fontSize: 13, color: "#374151" }}>The completion date is added automatically when it&apos;s known.</div>}
          after={<div style={{ fontSize: 13, color: "rgba(45,24,16,0.7)" }}>We add the completion date once it&apos;s known.</div>}
        />

        <SectionHead title="Two new standard pieces" sub="Neither exists in the app yet - these propose them. Your eye on the look." />

        <Card
          n="07"
          area="3 bespoke segmented toggles (editor + milestone + studio) → one Segmented"
          title="The on/off toggles are built three different ways"
          kind="new"
          when="The 'Buyer / Seller' and similar toggles in the editors, the milestone editor, and the branding studio - each coded separately."
          change="Make one standard segmented toggle and use it everywhere. Clean white active pill, coral text. (One of the three is currently a dark-pill version - this unifies them.)"
          now={
            <div style={{ display: "grid", gap: 10 }}>
              <Seg options={["Buyer", "Seller"]} active={0} />
              <Seg options={["Logo", "Name", "None"]} active={0} dark />
            </div>
          }
          after={
            <div style={{ display: "grid", gap: 10 }}>
              <Seg options={["Buyer", "Seller"]} active={0} />
              <Seg options={["Logo", "Name", "None"]} active={0} />
            </div>
          }
        />

        <Card
          n="08"
          area="EmailsTabs - bespoke tab strip → canonical Tabs"
          title="The Style / Voice / Sender tabs are a one-off"
          kind="new"
          when="The tab strip at the top of the Emails page."
          change="It already looks right (coral underline). This just makes it a reusable standard component and fixes the inactive label to the theme grey - so other settings pages can use the same tabs. Barely any visible change."
          now={
            <div style={{ display: "flex", gap: 18, borderBottom: "0.5px solid rgba(0,0,0,0.08)", paddingBottom: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 650, color: "#E2452A", paddingBottom: 11, borderBottom: "2px solid #E2452A" }}>Style</span>
              <span style={{ fontSize: 14, fontWeight: 650, color: "#6b7280", paddingBottom: 11 }}>Voice</span>
              <span style={{ fontSize: 14, fontWeight: 650, color: "#6b7280", paddingBottom: 11 }}>Sender</span>
            </div>
          }
          after={
            <div style={{ display: "flex", gap: 18, borderBottom: `1px solid ${LINE}`, paddingBottom: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 650, color: "#B23A1E", paddingBottom: 11, borderBottom: "2px solid #FF6B4A" }}>Style</span>
              <span style={{ fontSize: 14, fontWeight: 650, color: MUTED, paddingBottom: 11 }}>Voice</span>
              <span style={{ fontSize: 14, fontWeight: 650, color: MUTED, paddingBottom: 11 }}>Sender</span>
            </div>
          }
        />

        <SectionHead title="The big structural win" sub="Mostly invisible, but it's what makes everything above consistent." />

        <Card
          n="09"
          area="6 editors (ClientChase / CompletionPack / ExchangeDay / OnwardNudge / PortalInvite / WeeklyUpdate)"
          title="Six email editors are near-identical copies"
          kind="tidy"
          when="Behind the 'Automated emails' list - each email opens an editor, and all six editors are copy-paste siblings (same scaffold, pills, buttons, inputs, warning box)."
          change="Fix the shared scaffold once instead of six times. No visible change beyond cards 01-06 landing consistently across all of them. This is the one that makes the whole tab coherent."
          now={<p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>Six separate copies of the same editor layout, each with its own greys, pills, buttons and warning box.</p>}
          after={<p style={{ margin: 0, fontSize: 13, color: "#5C544B" }}>One shared editor shell, so they stay identical and every fix above applies once.</p>}
        />

        <Card
          n="10"
          area="AutomatedEmailsList rows ↔ TeamMemberRow"
          title="The automated-emails rows are the same shape as the team rows"
          kind="tidy"
          when="Never visible. The list rows (icon + title + tags + action) are the same pattern as the team-member rows we just shared."
          change="Reuse the shared row so the list and the team roster can't drift. No visual change."
          now={<p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>A separate row layout, duplicating the team-row pattern.</p>}
          after={<p style={{ margin: 0, fontSize: 13, color: "#5C544B" }}>The same shared row, reused.</p>}
        />

        <SectionHead title="What I'd deliberately leave alone" sub="Flagging so it's a choice, not an oversight." />

        <Card
          n="11"
          area="Email Branding Studio, Email Studio, active-step highlight, dashed 'dynamic content' boxes"
          title="A few things stay as they are"
          kind="keep"
          when="The two branding studios (big self-contained tools), the selected-step highlight in the milestone editor, and the dashed boxes that stand in for AI/dynamic content."
          change="Leave these. The studios are complex islands (like the colour studio we grandfathered); the step highlight and dashed boxes are deliberate and de-tinting them risks breaking a working look. I'd only token their text colours, nothing structural."
          now={<p style={{ margin: 0, fontSize: 13, color: "#5C544B", lineHeight: 1.5 }}>Branding studios + selection highlight + dashed dynamic-content boxes.</p>}
          after={<p style={{ margin: 0, fontSize: 13, color: "#5C544B" }}>Kept as-is (text colours tidied only).</p>}
        />

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: `1px solid ${LINE}`, fontSize: 12.5, color: MUTED }}>
          Emails settings audit · nothing here is live. Tell me which to build - 01-06 are the safe set; 07-08 are the new pieces (your eye on the look + the BUYER/SELLER question on 03); 09-10 the structural tidy; 11 is what I&apos;d leave alone.
        </footer>
      </div>
    </main>
  );
}
