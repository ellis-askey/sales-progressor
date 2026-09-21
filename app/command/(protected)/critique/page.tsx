import { commandDb } from "@/lib/command/prisma";
import { getCritiqueSignedUrl } from "@/lib/command/critique-storage";
import { CritiqueReview } from "@/components/command/critique/CritiqueReview";

// Founder Critique review. Every critique note, newest-first, with its
// screenshot + a resolve toggle. Superadmin gating is handled by
// app/command/(protected)/layout.tsx. Queries ONLY CritiqueNote — it never
// touches, and is never touched by, real user feedback (FeedbackSubmission).

export const dynamic = "force-dynamic";

export default async function CritiquePage() {
  const notes = await commandDb.critiqueNote.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const rows = await Promise.all(
    notes.map(async (n) => ({
      id: n.id,
      createdAt: n.createdAt.toISOString(),
      body: n.body,
      pageUrl: n.pageUrl,
      viewportSize: n.viewportSize,
      userEmail: n.userEmail,
      resolvedAt: n.resolvedAt ? n.resolvedAt.toISOString() : null,
      resolvedBy: n.resolvedBy,
      screenshotUrl: n.screenshotPath ? await getCritiqueSignedUrl(n.screenshotPath) : null,
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Critique</h1>
        <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
          Your private walk-the-app notes, each with a screenshot of the screen it came from. Tick one done once
          it&rsquo;s handled. This is separate from real user feedback.
        </p>
      </div>

      <CritiqueReview notes={rows} />
    </div>
  );
}
