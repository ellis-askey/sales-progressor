"use client";

import { useRouter, useSearchParams } from "next/navigation";

type TeamMember = { id: string; name: string; role: string };

export function AnalyticsFilterClient({
  team,
  currentUserId,
  basePath = "/agent/analytics",
}: {
  team: TeamMember[];
  currentUserId: string | null;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const p = searchParams.get("period");
    const params = new URLSearchParams();
    if (val) params.set("user", val);
    if (p && p !== "month") params.set("period", p);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label style={{ fontSize: 12, color: "var(--agent-text-muted)", fontWeight: 500 }}>Viewing:</label>
      <select
        value={currentUserId ?? ""}
        onChange={handleChange}
        className="agent-input"
        style={{
          fontSize: 13, padding: "6px 28px 6px 10px", cursor: "pointer",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%237A4A2E' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "16px",
          appearance: "none",
        }}
      >
        <option value="">All team</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}{m.role === "director" ? " (Director)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
