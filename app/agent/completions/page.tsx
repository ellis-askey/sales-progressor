import { requireSession } from "@/lib/session";
import { getAgentCompletions } from "@/lib/services/agent";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }
function fmtDate(d: Date | string | null) {
  if (!d) return "No date set";
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export default async function AgentCompletionsPage() {
  const session = await requireSession();
  const files = await getAgentCompletions(session.user.id);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);

  function urgencyFor(date: Date | null) {
    if (!date) return "no_date";
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    if (d < today) return "overdue";
    if (d < in7) return "this_week";
    if (d < in14) return "next_week";
    return "later";
  }

  const groups = [
    { key: "overdue",    label: "Overdue",              color: "#dc2626", bg: "#fef2f2" },
    { key: "this_week",  label: "Completing this week",  color: "#d97706", bg: "#fffbeb" },
    { key: "next_week",  label: "Completing next week",  color: "#2563eb", bg: "#eff6ff" },
    { key: "later",      label: "Later",                 color: "#374151", bg: "#f9fafb" },
    { key: "no_date",    label: "No completion date set", color: "#9ca3af", bg: "#f9fafb" },
  ] as const;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Completions</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          Your files that have exchanged and are working towards completion.
        </p>
      </div>

      {files.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0", color: "#9ca3af" }}>
          <p style={{ fontSize: 16, marginBottom: 4 }}>No files awaiting completion</p>
          <p style={{ fontSize: 14 }}>Exchanged files will appear here.</p>
        </div>
      )}

      {groups.map(({ key, label, color, bg }) => {
        const group = files.filter((f) => urgencyFor(f.completionDate) === key);
        if (group.length === 0) return null;
        return (
          <div key={key} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color, margin: 0 }}>
                {label} ({group.length})
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.map((f) => (
                <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: `1px solid ${color}33`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{f.propertyAddress}</p>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {f.purchasePrice && <span style={{ fontSize: 13, color: "#6b7280" }}>{fmt(f.purchasePrice / 100)}</span>}
                        {f.purchasers.length > 0 && <span style={{ fontSize: 13, color: "#6b7280" }}>Purchaser: {f.purchasers.join(", ")}</span>}
                        {f.assignedUserName && <span style={{ fontSize: 13, color: "#6b7280" }}>Progressor: {f.assignedUserName}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color, margin: "0 0 2px" }}>{fmtDate(f.completionDate)}</p>
                      {f.completionDate && (
                        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                          {Math.round((new Date(f.completionDate).getTime() - Date.now()) / 86400000)} days
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
