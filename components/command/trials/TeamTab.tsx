import Link from "next/link";
import type { TrialTeam, TeamMemberRow } from "@/lib/command/trial-cockpit";
import { Section, FunnelBars, TableShell, Tr, Td, CardEmpty, fmtInt } from "@/components/command/ui/primitives";
import { fmtHoursShort, fmtRelative, initials, avColor } from "@/lib/command/format";

// Trial cockpit → Team tab. The invite funnel, the full staff league table
// (champions at the top, never-signed-in impossible to miss), and the invite
// log. Server component; data from getTrialTeam. Command-only (Law 8).

const STATUS_STYLE: Record<TeamMemberRow["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "text-emerald-400" },
  quiet: { label: "Quiet 7d+", cls: "text-amber-400" },
  dormant: { label: "Dormant 14d+", cls: "text-red-400" },
  never: { label: "Never signed in", cls: "text-red-400" },
};

function Avatar({ m }: { m: Pick<TeamMemberRow, "name" | "image" | "imageFocusX" | "imageFocusY"> }) {
  if (m.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.image} alt="" className="w-[26px] h-[26px] rounded-full object-cover shrink-0" style={{ objectPosition: `${m.imageFocusX}% ${m.imageFocusY}%` }} />;
  }
  return (
    <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-semibold text-neutral-950 shrink-0" style={{ background: avColor(m.name) }}>
      {initials(m.name)}
    </span>
  );
}

// 12 weekly file-session counts as a tiny bar strip.
function Spark({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <span className="inline-flex items-end gap-[2px] h-5 align-middle">
      {weeks.map((w, i) => (
        <span
          key={i}
          className="w-[5px] rounded-[1px] bg-blue-600/60"
          style={{ height: `${Math.max(w > 0 ? 18 : 6, Math.round((w / max) * 100))}%`, opacity: w > 0 ? 1 : 0.2 }}
        />
      ))}
    </span>
  );
}

const INVITE_STATUS_CLS: Record<string, string> = {
  accepted: "text-emerald-400",
  pending: "text-blue-300",
  expired: "text-amber-400",
  cancelled: "text-neutral-600",
};

export function TeamTab({ team, staffTarget }: { team: TrialTeam; staffTarget: number | null }) {
  return (
    <div className="space-y-8">
      <Section
        title="Activation funnel"
        subtitle={staffTarget ? `Target headcount ${staffTarget}.` : undefined}
        tip="Roster = live logins created for the agency. Signed in = ever. Active = tracked action or real file time in the last 7 days."
      >
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4 max-w-2xl">
          <FunnelBars
            stages={[
              { label: "On the roster", value: team.rosterCount },
              { label: "Signed in", value: team.signedInCount },
              { label: "Active 7d", value: team.active7dCount },
            ]}
          />
        </div>
      </Section>

      <Section
        title={`The team · ${team.members.length}`}
        subtitle="Champions at the top. Usage columns are the last 7 days; Steps, Chases and To-dos are trial-to-date."
        tip="Steps = milestones they confirmed. Chases = chase messages a human sent. To-dos = hand-made to-dos they created. The sparkline is 12 weeks of file sessions."
      >
        {team.members.length === 0 ? (
          <CardEmpty>No staff accounts exist yet.</CardEmpty>
        ) : (
          <TableShell head={["Agent", "Last active", "Logins", "Hours", "Files", "Steps", "Chases", "To-dos", "12 weeks", "Status"]}>
            {team.members.map((m) => (
              <Tr key={m.userId}>
                <Td first>
                  <Link href={`/command/agencies/${m.userId}`} className="flex items-center gap-2.5 group">
                    <Avatar m={m} />
                    <span className="min-w-0">
                      <span className="block truncate group-hover:text-blue-300 transition-colors">{m.name}</span>
                      <span className="block text-[10px] text-neutral-600 capitalize">
                        {m.role}
                        {m.isInHouseProgressor && <span className="text-blue-400"> · progressor</span>}
                      </span>
                    </span>
                  </Link>
                </Td>
                <Td muted>{m.lastActive ? fmtRelative(m.lastActive) : "never"}</Td>
                <Td>{m.logins7d > 0 ? fmtInt(m.logins7d) : <span className="text-neutral-700">0</span>}</Td>
                <Td>{m.seconds7d > 0 ? fmtHoursShort(m.seconds7d) : <span className="text-neutral-700">0</span>}</Td>
                <Td>{m.files7d > 0 ? fmtInt(m.files7d) : <span className="text-neutral-700">0</span>}</Td>
                <Td>{m.steps > 0 ? fmtInt(m.steps) : <span className="text-neutral-700">0</span>}</Td>
                <Td>{m.chases > 0 ? fmtInt(m.chases) : <span className="text-neutral-700">0</span>}</Td>
                <Td>{m.todos > 0 ? fmtInt(m.todos) : <span className="text-neutral-700">0</span>}</Td>
                <Td><Spark weeks={m.weeks} /></Td>
                <Td><span className={`text-[11px] font-medium ${STATUS_STYLE[m.status].cls}`}>{STATUS_STYLE[m.status].label}</span></Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </Section>

      <Section
        title={`Invites · ${team.invites.length}`}
        subtitle="Every team invite this agency has sent, newest first."
        tip="Staff accounts created directly (e.g. set up for them) have no invite row, which is why the roster can be bigger than this list."
      >
        {team.invites.length === 0 ? (
          <CardEmpty>No invites sent yet.</CardEmpty>
        ) : (
          <TableShell head={["Invitee", "Invited by", "Sent", "Accepted", "Status"]}>
            {team.invites.map((i) => (
              <Tr key={i.id}>
                <Td first>
                  <span className="block">{i.name}</span>
                  <span className="block text-[10px] text-neutral-600">{i.email} · {i.kind}</span>
                </Td>
                <Td muted>{i.invitedBy}</Td>
                <Td muted>{i.sentAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</Td>
                <Td muted>{i.acceptedAt ? i.acceptedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</Td>
                <Td><span className={`text-[11px] font-medium capitalize ${INVITE_STATUS_CLS[i.status]}`}>{i.status}</span></Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </Section>
    </div>
  );
}
