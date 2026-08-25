import { commandDb } from "@/lib/command/prisma";
import { EmailSendersView, type AgencyOption } from "@/components/command/email-senders/EmailSendersView";
import { AgencyDomainAuth } from "@/components/command/email-senders/AgencyDomainAuth";
import type { SerializedDomain } from "./actions";

// Command Centre → Email senders. How every outbound email resolves its From,
// Reply-to and fallback, live per agency, with an in-house / outsourced toggle.

export const dynamic = "force-dynamic";

function modeLabel(m: string): string {
  if (m === "self_progressed") return "Self-progressed";
  if (m === "progressor_managed") return "Outsourced";
  if (m === "mixed") return "Mixed";
  return m;
}

export default async function EmailSendersPage() {
  const agencies = await commandDb.agency.findMany({
    where: { isInternal: false },
    select: { id: true, name: true, quoteSenderEmail: true, modeProfile: true },
    orderBy: { name: "asc" },
  });

  const options: AgencyOption[] = agencies.map((a) => ({
    id: a.id,
    name: a.name,
    quoteSenderEmail: a.quoteSenderEmail,
    modeProfile: a.modeProfile,
  }));

  const configured = agencies.filter((a) => a.quoteSenderEmail).length;

  // Domain-authentication state per agency (self-serve VerifiedDomain rows).
  // Prefer the domain matching the sender email; else the most recent.
  const domains = await commandDb.verifiedDomain.findMany({
    where: { agencyId: { in: agencies.map((a) => a.id) } },
    orderBy: { createdAt: "desc" },
  });
  const senderDomainOf = (email: string | null) => email?.split("@")[1]?.toLowerCase() ?? "";
  const domainByAgency = new Map<string, SerializedDomain>();
  for (const a of agencies) {
    const mine = domains.filter((d) => d.agencyId === a.id);
    const chosen = mine.find((d) => d.domain === senderDomainOf(a.quoteSenderEmail)) ?? mine[0];
    if (chosen) {
      domainByAgency.set(a.id, {
        id: chosen.id,
        domain: chosen.domain,
        status: chosen.status,
        dkimValid: chosen.dkimValid,
        spfValid: chosen.spfValid,
        cnameRecords: (chosen.cnameRecords as { host: string; data: string; type: string }[]) ?? [],
        verifiedAt: chosen.verifiedAt ? chosen.verifiedAt.toISOString() : null,
        lastCheckedAt: chosen.lastCheckedAt ? chosen.lastCheckedAt.toISOString() : null,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Email senders</h1>
        <p className="mt-1 text-sm text-neutral-400">
          How every outbound email resolves its sender. Each agency sends from its own verified address; when it
          has none, the fallback depends on how the file is run.
        </p>
      </div>

      {/* Agency setup */}
      <div>
        <h2 className="text-[12px] uppercase tracking-widest text-neutral-500 mb-2">
          Agency setup
          <span className="ml-2 font-mono text-neutral-600 normal-case tracking-normal">
            {configured}/{agencies.length} configured
          </span>
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                  <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Agency</th>
                  <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Mode</th>
                  <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Progressor address</th>
                  <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Status</th>
                  <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Domain auth</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 border-b border-neutral-800/70 text-[13px] text-neutral-200 font-medium">{a.name}</td>
                    <td className="px-4 py-3 border-b border-neutral-800/70 text-[12px] text-neutral-400">{modeLabel(a.modeProfile)}</td>
                    <td className="px-4 py-3 border-b border-neutral-800/70 font-mono text-[12px] text-neutral-300 break-all">
                      {a.quoteSenderEmail ?? <span className="text-neutral-600">— none —</span>}
                    </td>
                    <td className="px-4 py-3 border-b border-neutral-800/70 whitespace-nowrap">
                      {a.quoteSenderEmail ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]">
                          Configured
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#3a2a12] text-[#fbbf24] border-[#5a4426]">
                          On fallback
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-b border-neutral-800/70 whitespace-nowrap">
                      <AgencyDomainAuth
                        agency={{ id: a.id, name: a.name, quoteSenderEmail: a.quoteSenderEmail }}
                        initial={domainByAgency.get(a.id) ?? null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sender behaviour */}
      <div>
        <h2 className="text-[12px] uppercase tracking-widest text-neutral-500 mb-3">Sender behaviour</h2>
        <EmailSendersView agencies={options} />
      </div>
    </div>
  );
}
