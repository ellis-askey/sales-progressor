import { commandDb } from "@/lib/command/prisma";
import { getCritiqueSignedUrl } from "@/lib/command/critique-storage";
import { CritiqueReview } from "@/components/command/critique/CritiqueReview";

// System workspace → Critique tab. Verbatim from /command/critique
// (consolidation): the founder walk-the-app notes, each with a screenshot + a
// resolve toggle. The CritiqueReview component + its resolve action are
// unchanged. Queries ONLY CritiqueNote (never real user feedback). Loaders
// (incl. signed image URLs + the stable seq numbering) identical. The former
// page <h1> is dropped (shell + tab strip label it).

export async function CritiqueView() {
  const notes = await commandDb.critiqueNote.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  // Stable reference number per note: oldest = #1, ascending by creation. Since
  // `notes` is newest-first, seq = (count - index). New notes append higher
  // numbers, so an existing note keeps its number — safe to say "do #14".
  const rows = await Promise.all(
    notes.map(async (n, i) => ({
      id: n.id,
      seq: notes.length - i,
      createdAt: n.createdAt.toISOString(),
      body: n.body,
      pageUrl: n.pageUrl,
      viewportSize: n.viewportSize,
      userEmail: n.userEmail,
      resolvedAt: n.resolvedAt ? n.resolvedAt.toISOString() : null,
      resolvedBy: n.resolvedBy,
      folder: n.folder,
      screenshotUrl: n.screenshotPath ? await getCritiqueSignedUrl(n.screenshotPath) : null,
    })),
  );

  return (
    <div className="space-y-6">
      <p className="max-w-xl text-[13px] text-neutral-500">
        Your private walk-the-app notes, each with a screenshot of the screen it came from. Tick one done once
        it&rsquo;s handled. This is separate from real user feedback.
      </p>

      <CritiqueReview notes={rows} />
    </div>
  );
}
