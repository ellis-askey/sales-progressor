import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";

// Disposable mockup (/test convention — founder-gated by app/test/layout.tsx,
// delete after the decision): candidate replacements for the app-wide coral
// hover wash (--agent-hover-tint). Each option renders the same three mock
// surfaces — a list row, a popover menu, an accordion header — so the hovers
// can be FELT side by side. The winner becomes a one-line token swap in
// themes.css (plus a follow-up sweep of hardcoded coral hovers).

const OPTIONS: {
  key: string;
  name: string;
  blurb: string;
  css: string;
}[] = [
  {
    key: "current",
    name: "Current — coral wash (reference)",
    blurb: "rgba(255,138,101,0.10) — the watered-down primary you want gone.",
    css: `background: rgba(255, 138, 101, 0.10);`,
  },
  {
    key: "ink",
    name: "Option A — Ink shade",
    blurb:
      "A colourless darken using the app's warm shadow ink: rgba(45,24,16,0.05). Reads as shade falling on the row, like a macOS list. Quietest option.",
    css: `background: rgba(45, 24, 16, 0.05);`,
  },
  {
    key: "slate",
    name: "Option B — Cool slate shade",
    blurb:
      "rgba(100,116,139,0.08) — a cooler neutral darken. Slightly more visible than ink; zero warmth, so it never fights the coral accents.",
    css: `background: rgba(100, 116, 139, 0.08);`,
  },
  {
    key: "lift",
    name: "Option C — Lift bubble",
    blurb:
      "The row brightens to near-white and rises on a soft shadow — a bubble popping off the glass rather than a stain on it. Most alive; needs the shadow so it's slightly heavier to render.",
    css: `background: rgba(255, 255, 255, 0.72);
box-shadow: 0 2px 10px rgba(45, 24, 16, 0.08), inset 0 0 0 0.5px rgba(45, 24, 16, 0.05);`,
  },
  {
    key: "frost",
    name: "Option D — Frost bubble",
    blurb:
      "Milky glass: rgba(255,255,255,0.55) + an 8px backdrop blur, so the aurora frosts behind the hovered row. Fits the glass language; blur can shimmer on long lists.",
    css: `background: rgba(255, 255, 255, 0.55);
backdrop-filter: blur(8px) saturate(1.2);
-webkit-backdrop-filter: blur(8px) saturate(1.2);`,
  },
  {
    key: "ring",
    name: "Option E — Shade + hairline ring",
    blurb:
      "The ink shade at 0.045 plus a whisper of an inset outline, so the hovered row gets a defined edge without lifting. The most 'engineered' feel.",
    css: `background: rgba(45, 24, 16, 0.045);
box-shadow: inset 0 0 0 1px rgba(45, 24, 16, 0.07);`,
  },
];

function MockSurfaces({ optionKey }: { optionKey: string }) {
  const rows = [
    { addr: "14 Cedar Green", sub: "Exchange date passed", chip: "Overdue" },
    { addr: "22 Kingfisher Row", sub: "Searches ordered 4 days ago", chip: "Searches" },
    { addr: "40 Maple Mews", sub: "Enquiries in progress", chip: "Enquiries" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, alignItems: "start" }}>
      {/* List rows + accordion header */}
      <div style={{ border: "0.5px solid var(--agent-border-default)", borderRadius: 14, overflow: "hidden", background: "var(--agent-surface-elevated)" }}>
        <div className={`ho-${optionKey}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)", cursor: "pointer", transition: "background 150ms ease, box-shadow 150ms ease" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Accordion header — hover me</span>
          <span style={{ color: "var(--agent-text-muted)", fontSize: 12 }}>⌄</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.addr} className={`ho-${optionKey}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined, cursor: "pointer", transition: "background 150ms ease, box-shadow 150ms ease" }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background: "var(--agent-coral-bg-tint)", flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{r.addr}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-secondary)" }}>{r.sub}</p>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "rgba(100,116,139,0.10)", color: "var(--agent-text-secondary)", flexShrink: 0 }}>{r.chip}</span>
          </div>
        ))}
      </div>
      {/* Popover menu */}
      <div style={{ padding: 5, borderRadius: 14, background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-default)", boxShadow: "0 12px 32px rgba(45,24,16,0.14)" }}>
        {["83 Highfield Road", "40 Tresco Road", "2 The Courtyard", "View all in Files"].map((label, i) => (
          <div key={label} className={`ho-${optionKey}`} style={{ padding: "8px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: i === 3 ? 500 : 600, color: i === 3 ? "var(--agent-text-muted)" : "var(--agent-text-primary)", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined, cursor: "pointer", transition: "background 150ms ease, box-shadow 150ms ease" }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HoverOptionsPage() {
  return (
    <div data-theme="sunset" style={{ minHeight: "100vh", background: "var(--agent-bg-base, #FFF5EC)", fontFamily: "Inter, -apple-system, sans-serif", padding: "40px 48px 80px" }}>
      <style>{OPTIONS.map((o) => `.ho-${o.key}:hover { ${o.css} }`).join("\n")}</style>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(45,24,16,0.45)" }}>Disposable mockup — delete after decision</p>
        <h1 style={{ margin: "6px 0 4px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary, #2D1810)" }}>Hover treatment options</h1>
        <p style={{ margin: "0 0 36px", fontSize: 13.5, color: "var(--agent-text-secondary, #5A3A28)", maxWidth: 640, lineHeight: 1.6 }}>
          The same three surfaces under each candidate. Hover the rows, the accordion header, and the menu items.
          The winner replaces the --agent-hover-tint token in themes.css — one line re-skins every consumer at once.
        </p>
        {OPTIONS.map((o) => (
          <section key={o.key} style={{ marginBottom: 44 }}>
            <h2 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary, #2D1810)" }}>{o.name}</h2>
            <p style={{ margin: "0 0 6px", fontSize: 12.5, color: "var(--agent-text-secondary, #5A3A28)", maxWidth: 640, lineHeight: 1.55 }}>{o.blurb}</p>
            <pre style={{ margin: "0 0 14px", fontSize: 11, color: "rgba(45,24,16,0.55)", background: "rgba(45,24,16,0.04)", padding: "8px 12px", borderRadius: 8, overflowX: "auto" }}>{o.css}</pre>
            <MockSurfaces optionKey={o.key} />
          </section>
        ))}
      </div>
    </div>
  );
}
