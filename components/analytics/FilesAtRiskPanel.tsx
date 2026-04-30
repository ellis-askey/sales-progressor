import Link from "next/link";
import type { FilesAtRiskData } from "@/lib/services/analytics";

interface RiskRowProps {
  label: string;
  sublabel: string;
  count: number;
  href: string;
  first?: boolean;
}

function RiskRow({ label, sublabel, count, href, first }: RiskRowProps) {
  const hasRisk = count > 0;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "11px 20px",
      borderTop: first ? undefined : "0.5px solid var(--agent-border-subtle)",
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>
          {label}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
          {sublabel}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {hasRisk ? (
          <>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: "var(--agent-danger)", background: "var(--agent-danger-bg)",
              padding: "2px 9px", borderRadius: 99,
              fontVariantNumeric: "tabular-nums",
            }}>
              {count}
            </span>
            <Link
              href={href}
              style={{
                fontSize: 12, fontWeight: 600,
                color: "var(--agent-coral-deep)",
                textDecoration: "none",
              }}
            >
              View →
            </Link>
          </>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: "var(--agent-success)",
            background: "var(--agent-success-bg)",
            padding: "2px 9px", borderRadius: 99,
          }}>
            ✓ Clear
          </span>
        )}
      </div>
    </div>
  );
}

export function FilesAtRiskPanel({ data }: { data: FilesAtRiskData }) {
  const totalAtRisk =
    data.overdueChases.count + data.stalled.count + data.missingEventDate.count;

  return (
    <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>
            Files at risk
          </p>
          {totalAtRisk > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: "var(--agent-danger)", background: "var(--agent-danger-bg)",
              padding: "2px 9px", borderRadius: 99,
            }}>
              {totalAtRisk} issue{totalAtRisk !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
          Active files with signals that need attention
        </p>
      </div>

      <RiskRow
        label="Overdue chases"
        sublabel="Pending chase tasks past their due date"
        count={data.overdueChases.count}
        href="/agent/hub"
        first
      />
      <RiskRow
        label="Stalled files"
        sublabel="No milestone activity in the last 14 days"
        count={data.stalled.count}
        href="/agent/hub"
      />
      <RiskRow
        label="Missing event dates"
        sublabel="Completed milestones without a required date"
        count={data.missingEventDate.count}
        href="/agent/hub"
      />
    </div>
  );
}
