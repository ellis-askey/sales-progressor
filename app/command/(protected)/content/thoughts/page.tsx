import Link from "next/link";
import { getThoughtsBoard } from "@/lib/command/content/thoughts";
import { ThoughtsPanel } from "@/components/command/content/ThoughtsPanel";

// Things Ellis thinks (docs/active/content-brand/SPEC.md, Phase 1.1). The raw
// idea capture that feeds the content engine. Superadmin gating is handled by
// app/command/(protected)/layout.tsx.

export const dynamic = "force-dynamic";

export default async function ThoughtsPage() {
  const board = await getThoughtsBoard();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Things you think</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            Save the half-formed opinions and observations you have during the day. They don&rsquo;t need to look
            like posts. We&rsquo;ll bring them back when there&rsquo;s a real reason to say them.
          </p>
        </div>
        <Link
          href="/command/content"
          className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
        >
          ← Content
        </Link>
      </div>

      <ThoughtsPanel
        board={{
          open: board.open.map(serialise),
          used: board.used.map(serialise),
          archived: board.archived.map(serialise),
          counts: board.counts,
        }}
      />
    </div>
  );
}

function serialise(t: {
  id: string;
  createdAt: Date;
  body: string;
  topic: string | null;
  source: string;
  status: string;
}) {
  return {
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    body: t.body,
    topic: t.topic,
    source: t.source,
    status: t.status,
  };
}
