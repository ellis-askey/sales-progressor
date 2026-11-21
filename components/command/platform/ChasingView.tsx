import { prisma } from "@/lib/prisma";
import { SolicitorCadencePanel } from "@/components/command/SolicitorCadencePanel";

// Platform workspace → Chasing tab ("Solicitor chasing"). Verbatim from
// /command/solicitor-chase (consolidation): the PLATFORM-WIDE solicitor chase
// cadence (SolicitorChaseSettings singleton). The SolicitorCadencePanel + its
// save action are unchanged — the chase timing/behaviour is NOT altered, only
// relocated. The former page <h1> is dropped (shell + tab strip label it).

export async function ChasingView() {
  const s = await prisma.solicitorChaseSettings.findUnique({ where: { id: "singleton" } });
  const initial = {
    enabled: s?.enabledByDefault ?? false,
    graceWorkingDays: s?.graceWorkingDays ?? 5,
    repeatDays: s?.repeatDays ?? 7,
    maxChases: s?.maxChases ?? 2,
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500 max-w-2xl leading-relaxed">
        The platform-wide timing for chasing solicitors to confirm steps and reply to enquiries. It applies to every
        agency; agencies can only turn solicitor chasing on or off for their own files, not retime it. (Moved here in
        the settings consolidation, where it was wrongly editable per agency.)
      </p>
      <SolicitorCadencePanel initial={initial} />
    </div>
  );
}
