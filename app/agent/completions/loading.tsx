import { PageHeader } from "@/components/layout/PageHeader";

export default function CompletionsLoading() {
  return (
    <>
      {/* OLD subtitle: "Files that have exchanged and are heading to completion." */}
      <PageHeader title="Completions" subtitle="Exchanged files, tracking to completion.">
        <div className="agent-skeleton" style={{ height: 22, width: 68, borderRadius: 99 }} />
        <div className="agent-skeleton" style={{ height: 22, width: 82, borderRadius: 99 }} />
        <div className="agent-skeleton" style={{ height: 22, width: 74, borderRadius: 99 }} />
      </PageHeader>

      {/* OLD: group headers were pill-shaped inline-flex containers with hardcoded hex dot colours.
              File rows were flat bordered divs with rgba(255,255,255,0.55) background.
              Now: agent-glass + agent-acc-hdr structure matching real group shape. */}
      <div className="px-4 md:px-8 py-2 md:py-4" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Pipeline summary line */}
        <div className="agent-skeleton" style={{ height: 13, width: 240, borderRadius: 6 }} />

        {/* Group skeletons — agent-glass + agent-acc-hdr, mirrors real group structure */}
        {[
          { labelW: 80,  valueW: 64,  open: true  },
          { labelW: 140, valueW: 80,  open: false },
          { labelW: 110, valueW: 56,  open: false },
        ].map(({ labelW, valueW, open }, i) => (
          <div key={i} className="agent-glass" style={{ overflow: "hidden" }}>
            <div className="agent-acc-hdr" style={{ pointerEvents: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <div className="agent-skeleton" style={{ width: 10, height: 10, borderRadius: "50%" }} />
                <div className="agent-skeleton" style={{ height: 11, width: labelW, borderRadius: 4 }} />
              </div>
              <div className="agent-skeleton" style={{ height: 11, width: valueW, borderRadius: 4 }} />
            </div>

            {open && (
              <div className="agent-acc open">
                <div className="agent-acc-in">
                  <div className="agent-acc-body">
                    <div className="space-y-2">
                      {[200, 240].map((addrW, ri) => (
                        <div key={ri} className="glass-card overflow-hidden">
                          <div className="px-5 py-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                            <div>
                              <div className="agent-skeleton" style={{ height: 13, width: addrW, borderRadius: 6, marginBottom: 5 }} />
                              <div className="agent-skeleton" style={{ height: 11, width: 130, borderRadius: 6 }} />
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                              <div className="agent-skeleton" style={{ height: 11, width: 60, borderRadius: 6 }} />
                              <div className="agent-skeleton" style={{ height: 22, width: 52, borderRadius: 99 }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

      </div>
    </>
  );
}
