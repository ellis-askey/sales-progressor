import { FileText, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { PortalCard, CardKicker } from "./portal-cards";
import { S } from "./ui";

// Documents shared with this matter (the MOS + anything shared cross-side).
// View/download only — the solicitor receives what we've shared.
export type SolDoc = { id: string; filename: string; url: string | null; label: string };

export function DocumentsCard({ docs }: { docs: SolDoc[] }) {
  if (!docs.length) return null;
  return (
    <PortalCard glassId="sol-documents" label="Documents">
      <CardKicker>Documents</CardKicker>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map((d) => (
          <a
            key={d.id}
            href={d.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", background: "rgba(15,39,64,0.04)", border: `1px solid ${S.nestedBorder}`, borderRadius: 12, padding: "12px 14px" }}
          >
            <span style={{ width: 36, height: 36, borderRadius: 9, background: S.accentBg, color: S.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={18} weight="regular" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: S.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.filename}</span>
              <span style={{ display: "block", fontSize: 12, color: S.muted }}>{d.label}</span>
            </span>
            <span style={{ color: S.accent, flexShrink: 0 }}><DownloadSimple size={18} weight="regular" /></span>
          </a>
        ))}
      </div>
    </PortalCard>
  );
}
