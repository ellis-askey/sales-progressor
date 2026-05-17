import { PageHeader } from "@/components/layout/PageHeader";

export default function CommsLoading() {
  return (
    <>
      {/* OLD subtitle: "Milestone activity across all your files." */}
      <PageHeader title="Updates" subtitle="What's happened across your files.">
        {/* Filter strip skeleton — comms-filter-bar provides token background */}
        <div className="comms-filter-bar">
          <div className="agent-skeleton" style={{ height: 30, width: 100, borderRadius: 7 }} />
          <div className="agent-skeleton" style={{ height: 30, width: 130, borderRadius: 7 }} />
        </div>
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-4">

        {/* Skeleton card 1 — open (Today) */}
        <div className="agent-glass" style={{ overflow: "hidden" }}>
          <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
            <div className="agent-skeleton" style={{ width: 48, height: 11, borderRadius: 4 }} />
            <div className="agent-skeleton" style={{ width: 72, height: 11, borderRadius: 4 }} />
          </div>
          <div className="agent-acc open">
            <div className="agent-acc-in">
              <div className="agent-acc-body">
                <div className="glass-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/20">
                    <div className="agent-skeleton" style={{ width: 200, height: 10, borderRadius: 4 }} />
                  </div>
                  <div className="divide-y divide-white/15">
                    {([180, 220, 150] as const).map((w, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3">
                        <div className="agent-skeleton mt-0.5 w-5 h-5 flex-shrink-0" style={{ borderRadius: "50%" }} />
                        <div className="flex-1 space-y-2">
                          <div className="agent-skeleton h-3" style={{ maxWidth: w, borderRadius: 4 }} />
                          <div className="agent-skeleton h-2.5" style={{ maxWidth: 72, borderRadius: 4 }} />
                        </div>
                        <div className="agent-skeleton h-2.5 w-10 flex-shrink-0" style={{ borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton card 2 — collapsed (Yesterday) */}
        <div className="agent-glass" style={{ overflow: "hidden" }}>
          <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
            <div className="agent-skeleton" style={{ width: 80, height: 11, borderRadius: 4 }} />
            <div className="agent-skeleton" style={{ width: 60, height: 11, borderRadius: 4 }} />
          </div>
        </div>

        {/* Skeleton card 3 — collapsed (older) */}
        <div className="agent-glass" style={{ overflow: "hidden" }}>
          <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
            <div className="agent-skeleton" style={{ width: 112, height: 11, borderRadius: 4 }} />
            <div className="agent-skeleton" style={{ width: 60, height: 11, borderRadius: 4 }} />
          </div>
        </div>

      </div>
    </>
  );
}
