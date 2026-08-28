import { FileText, ArrowDown } from "@phosphor-icons/react/dist/ssr";
import { PortalCard, CardKicker } from "./portal-cards";
import { S } from "./ui";
import type { SolicitorFeedEntry } from "@/lib/services/solicitor-updates";

function fmtDateTime(d: Date): string {
  const dd = new Date(d);
  const date = dd.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = dd.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, "");
  return `${date} · ${time}`;
}
function fmtEvent(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function initials(name: string): string {
  const parts = name.trim().replace(/^(dr|mr|mrs|miss|ms)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

export function UpdatesFeed({ entries, otherSideTag }: { entries: SolicitorFeedEntry[]; otherSideTag: string }) {
  if (!entries.length) return null;
  return (
    <PortalCard>
      <CardKicker>Recent updates</CardKicker>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {entries.map((e, i) => (
          <Row key={e.id} entry={e} otherSideTag={otherSideTag} first={i === 0} />
        ))}
      </div>
    </PortalCard>
  );
}

function Row({ entry, otherSideTag, first }: { entry: SolicitorFeedEntry; otherSideTag: string; first: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: first ? "none" : `1px solid ${S.line}`, alignItems: "flex-start" }}>
      <Avatar entry={entry} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: entry.ownSide ? S.ink : S.inkSoft, lineHeight: 1.45 }}>{entry.title}</p>
        {entry.sub && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: S.muted, lineHeight: 1.4 }}>{entry.sub}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
          {entry.eventDate && <span style={{ fontSize: 12, fontWeight: 600, color: S.accent }}>{fmtEvent(entry.eventDate)}</span>}
          {entry.eventDate && entry.shownDate && <span style={{ color: S.faint, fontSize: 12 }}>|</span>}
          {entry.shownDate && <span style={{ fontSize: 12, color: S.muted }}>{fmtDateTime(entry.shownDate)}</span>}
          {!entry.ownSide && <span style={{ fontSize: 11, fontWeight: 600, color: S.muted, background: "rgba(15,39,64,0.05)", borderRadius: 999, padding: "1px 8px" }}>{otherSideTag}</span>}
          {entry.kind === "document" && entry.docUrl && (
            <a href={entry.docUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: S.accent, textDecoration: "none" }}>
              <ArrowDown size={12} weight="bold" /> Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ entry }: { entry: SolicitorFeedEntry }) {
  const box: React.CSSProperties = { width: 34, height: 34, borderRadius: 17, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };

  if (entry.kind === "document") {
    return <span style={{ ...box, borderRadius: 9, background: S.accentBg, color: S.accent }}><FileText size={17} weight="regular" /></span>;
  }
  if (!entry.ownSide) {
    // Other side — no photo (never share the counterparty's pictures).
    return <span style={{ ...box, background: "rgba(15,39,64,0.06)", color: S.muted, fontSize: 15 }}>•</span>;
  }
  if (entry.actorImage) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={entry.actorImage} alt="" style={{ ...box, objectFit: "cover" }} />;
  }
  // Own side, no photo (firm, or agent/client without an uploaded avatar) → initials.
  const bg = entry.actorRole === "firm" ? "rgba(15,39,64,0.08)" : entry.actorRole === "client" ? "rgba(47,125,79,0.12)" : S.accentBg;
  const fg = entry.actorRole === "firm" ? S.ink : entry.actorRole === "client" ? S.success : S.accent;
  return <span style={{ ...box, background: bg, color: fg, fontSize: 12, fontWeight: 700 }}>{entry.actorName ? initials(entry.actorName) : "•"}</span>;
}
