// Command Centre > System > Solicitor chasing. The home for the PLATFORM-WIDE
// solicitor chase cadence (SolicitorChaseSettings singleton) after the settings
// consolidation retired its old, wrongly-agency-facing page. Agencies keep an
// on/off switch for their own files; the timing below is global and set here.

import { prisma } from "@/lib/prisma";
import { SolicitorCadencePanel } from "@/components/command/SolicitorCadencePanel";

export default async function SolicitorChasePage() {
  const s = await prisma.solicitorChaseSettings.findUnique({ where: { id: "singleton" } });
  const initial = {
    enabled: s?.enabledByDefault ?? false,
    graceWorkingDays: s?.graceWorkingDays ?? 5,
    repeatDays: s?.repeatDays ?? 7,
    maxChases: s?.maxChases ?? 2,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Solicitor chasing</h1>
        <p className="text-sm text-neutral-500 mt-1 max-w-2xl leading-relaxed">
          The platform-wide timing for chasing solicitors to confirm steps and reply to enquiries. It applies to every
          agency; agencies can only turn solicitor chasing on or off for their own files, not retime it. (Moved here in
          the settings consolidation, where it was wrongly editable per agency.)
        </p>
      </div>
      <SolicitorCadencePanel initial={initial} />
    </div>
  );
}
