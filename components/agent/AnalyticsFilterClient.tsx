"use client";

import { useRouter } from "next/navigation";

type TeamMember = { id: string; name: string; role: string };

export function AnalyticsFilterClient({
  team,
  currentUserId,
}: {
  team: TeamMember[];
  currentUserId: string | null;
}) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === "") {
      router.push("/agent/analytics");
    } else {
      router.push(`/agent/analytics?user=${val}`);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 font-medium">Viewing:</label>
      <select
        value={currentUserId ?? ""}
        onChange={handleChange}
        className="text-sm bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/30"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "16px" }}
      >
        <option value="" style={{ background: "#1e293b" }}>All team</option>
        {team.map((m) => (
          <option key={m.id} value={m.id} style={{ background: "#1e293b" }}>
            {m.name}{m.role === "director" ? " (Director)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
