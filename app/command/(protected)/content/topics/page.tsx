import Link from "next/link";
import { commandDb } from "@/lib/command/prisma";
import {
  addTopicAction,
  skipTopicAction,
  prioritiseTopicAction,
  deleteTopicAction,
  restoreTopicAction,
} from "@/app/actions/content-topics";

export default async function TopicsPage() {
  const [pending, skipped] = await Promise.all([
    commandDb.contentTopic.findMany({
      where: { status: "pending" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    commandDb.contentTopic.findMany({
      where: { status: "skipped" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-10 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Topic queue</h1>
        <Link
          href="/command/content"
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Back to content
        </Link>
      </div>

      {/* Add manual topic */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Add a topic
        </h2>
        <form action={addTopicAction} className="flex gap-2">
          <input
            type="text"
            name="text"
            placeholder="A specific topic idea — the more concrete the better"
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
            required
          />
          <button
            type="submit"
            className="text-sm px-4 py-2 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-white transition-colors shrink-0"
          >
            Add
          </button>
        </form>
      </section>

      {/* Pending topics */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Pending ({pending.length})
        </h2>

        {pending.length === 0 && (
          <p className="text-xs text-neutral-600">
            No topics queued. Add one above or wait for the overnight activity scan.
          </p>
        )}

        <div className="space-y-2">
          {pending.map((t) => (
            <div
              key={t.id}
              className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-200 leading-snug">{t.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold bg-neutral-800 text-neutral-600 px-1.5 py-0.5 rounded">
                    {t.source === "activity_derived" ? "from activity" : "manual"}
                  </span>
                  {t.priority > 0 && (
                    <span className="text-[10px] text-amber-500">
                      priority +{t.priority}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <form action={prioritiseTopicAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    title="Bump priority"
                    className="text-[11px] text-neutral-600 hover:text-amber-400 px-1.5 py-1 transition-colors"
                  >
                    ↑
                  </button>
                </form>
                <form action={skipTopicAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="text-[11px] text-neutral-600 hover:text-neutral-300 px-1.5 py-1 transition-colors"
                  >
                    Skip
                  </button>
                </form>
                <form action={deleteTopicAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="text-[11px] text-neutral-600 hover:text-red-400 px-1.5 py-1 transition-colors"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skipped */}
      {skipped.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Skipped ({skipped.length})
          </h2>
          <div className="space-y-2">
            {skipped.map((t) => (
              <div
                key={t.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-3 opacity-50"
              >
                <p className="text-sm text-neutral-400 flex-1 leading-snug line-clamp-1">
                  {t.text}
                </p>
                <div className="flex gap-1 shrink-0">
                  <form action={restoreTopicAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-neutral-600 hover:text-neutral-300 px-1.5 py-1 transition-colors"
                    >
                      Restore
                    </button>
                  </form>
                  <form action={deleteTopicAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-neutral-600 hover:text-red-400 px-1.5 py-1 transition-colors"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
