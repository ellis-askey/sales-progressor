"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeFileAction } from "@/app/actions/completions";
import { withFrom } from "@/lib/agent/back-nav";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  CompletionFileRowView,
  GROUP_STYLES,
  type CompletionFileRow,
} from "@/components/completions/CompletionFileRowView";
import { SectionDisclosure } from "@/components/ui/SectionDisclosure";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";

export type { CompletionFileRow };

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }

export type CompletionGroup = {
  key: "overdue" | "this_week" | "next_week" | "later" | "no_date";
  label: string;
  files: CompletionFileRow[];
  groupValue: number;
  groupFeeTotal: number;
  missingFeeCount: number;
};

export function CompletionsGroupList({ groups }: { groups: CompletionGroup[] }) {
  /* OLD: const [collapsed, setCollapsed] = useState(Object.fromEntries(groups.map(g => [g.key, true]))) */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openCompleteId, setOpenCompleteId] = useState<string | null>(null);
  const [completeDate, setCompleteDate] = useState("");
  // File cards open by default; a set of the ones the agent has collapsed.
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useAgentToast();
  const fileCardTag = useGlassTag("completions-file-card", "Completions · file card", { light: "cs-b7c9ec28", dark: "cs-053799eb" });
  const today = new Date().toISOString().split("T")[0];

  function toggle(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleCard(id: string) {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    // Free "section bar + free cards" — the work-queue pattern (SectionDisclosure).
    // Each urgency band is a slim bar; its file cards sit free at full width
    // below it, not nested inside an enclosing card. Status reads from the
    // label's urgency colour (s.label), not a bar wash.
    <div className="space-y-5">
      {groups.map(({ key, label, files, groupFeeTotal, missingFeeCount }) => {
        const s = GROUP_STYLES[key];
        const isOpen = !!openGroups[key];
        const feesRight =
          groupFeeTotal > 0 ? (
            <span className="agent-acc-summary">{fmt(groupFeeTotal / 100)} fees</span>
          ) : files.length > 0 ? (
            <span className="agent-acc-summary" style={{ opacity: 0.55 }}>Fees TBC</span>
          ) : null;

        return (
          <SectionDisclosure
            key={key}
            id={`section-${key}`}
            label={label}
            count={files.length}
            labelClassName={s.label}
            right={feesRight}
            open={isOpen}
            onToggle={() => toggle(key)}
            glassId="completions-section-bar"
            glassLabel="Completions · section bar"
          >
            {/* Missing-fee note */}
            {groupFeeTotal > 0 && missingFeeCount > 0 && (
              <p className="text-xs text-slate-900/30" style={{ margin: "0 0 2px 2px" }}>
                ({missingFeeCount} file{missingFeeCount !== 1 ? "s" : ""} with no fee set)
              </p>
            )}
            {files.map((f) => (
              <div key={f.id}>
                <div className={`glass-card block px-5 py-4 border ${s.border} ${fileCardTag.className}`} {...fileCardTag.props}>
                  <CompletionFileRowView
                    file={f}
                    groupKey={key}
                    href={withFrom(`/agent/transactions/${f.id}`, "/agent/completions")}
                    isOpen={!collapsedCards.has(f.id)}
                    onToggle={() => toggleCard(f.id)}
                    onComplete={() => { setOpenCompleteId(f.id); setCompleteDate(f.completionDateIso ? f.completionDateIso.split("T")[0] : today); }}
                  />
                </div>

                {/* Quick-confirm completion */}
                {openCompleteId === f.id && (
                  <div className="agent-reveal-in" style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>Mark completed as of</span>
                    <DateField className="agent-input agent-input-sm" style={{ width: "auto", fontSize: 13 }} wrapperStyle={{ display: "inline-block" }} value={completeDate} onChange={(e) => setCompleteDate(e.target.value)} autoFocus />
                    <Button
                      size="sm"
                      disabled={!completeDate || isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await completeFileAction(f.id, completeDate);
                          if (res.ok) { toast.success(`${f.propertyAddress} completed`); setOpenCompleteId(null); router.refresh(); }
                          else { toast.error(res.error); }
                        });
                      }}
                    >
                      {isPending ? "Completing…" : "Complete file"}
                    </Button>
                    <button className="agent-link agent-link-muted" style={{ fontSize: 11 }} onClick={() => setOpenCompleteId(null)}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </SectionDisclosure>
        );
      })}
    </div>
  );
}
