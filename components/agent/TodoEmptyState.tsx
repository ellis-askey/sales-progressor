"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ListChecks, BookOpen, ArrowSquareOut } from "@phosphor-icons/react";
import { AddManualTaskForm } from "@/components/todos/AddManualTaskForm";
import { SetupCard } from "@/components/agent/SetupCard";
import { HeroArt } from "@/components/agent/HeroArt";
import { Pill } from "@/components/ui/Pill";

// The "Learn more about to-dos" guide card is built below but hidden until its
// "View guide" target exists (logged in docs/active/TODO.md).
const SHOW_TODO_GUIDE = false;

type AddInput = {
  title: string;
  notes?: string;
  dueDate?: string;
  transactionId?: string;
  isAgentRequest?: boolean;
  isInternalSelfAssigned?: boolean;
};

// To-Do onboarding empty state (agency users, no tasks). Mirrors the Completions
// empty state. The CTAs reveal the add form inline; adding refreshes the page so
// the real list renders. The "Send to your progressor" card only shows when the
// agency has an outsourced file (there's a progressor to send to).
export function TodoEmptyState({ canUseProgressor }: { canUseProgressor: boolean }) {
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  async function handleAdd(input: AddInput) {
    const res = await fetch("/api/manual-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) router.refresh();
  }

  if (adding) {
    return (
      <div style={{ maxWidth: 680 }}>
        <AddManualTaskForm showOwnership={canUseProgressor} onAdd={handleAdd} />
      </div>
    );
  }

  return (
    <div className="agent-stagger" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 210, padding: "28px 30px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        <HeroArt light="/todo-hero.png" dark="/todo-hero-dark.png" maxWidth="46%" maskStart="42%" />
        <div style={{ position: "relative", maxWidth: 480 }}>
          <Pill tone="brand" size="sm" glass style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            Nothing here yet
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
            Nothing on your list yet
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 380 }}>
            Your to-dos, reminders and requests will appear here.
          </p>
          <button type="button" onClick={() => setAdding(true)} className="agent-btn agent-btn-primary agent-btn-md" style={{ width: "fit-content" }}>
            <Plus size={16} weight="bold" />
            Add a to-do
          </button>
        </div>
      </div>

      {/* What you can do */}
      <div>
        <p className="agent-eyebrow" style={{ marginBottom: 12 }}>What you can do</p>
        <div className={canUseProgressor ? "setup-cards-3" : "setup-cards-2"}>
          <SetupCard
            glassId="empty-todo-notes"
            label="To-Do empty · Own notes"
            iconSrc="/todo-notes.png"
            tint="coral"
            title="Keep your own notes"
            desc="Add quick notes and reminders for anything you need to come back to."
            cta="Add a to-do"
            onClick={() => setAdding(true)}
          />
          <SetupCard
            glassId="empty-todo-sale"
            label="To-Do empty · Tie to a sale"
            iconSrc="/todo-sale.png"
            tint="blue"
            title="Tie tasks to a sale"
            desc="Attach a to-do to a property and add a due date. We'll flag it when it needs your attention."
            cta="Choose a sale"
            onClick={() => setAdding(true)}
          />
          {canUseProgressor && (
            <SetupCard
              glassId="empty-todo-progressor"
              label="To-Do empty · Send to progressor"
              iconSrc="/todo-progressor.png"
              tint="green"
              title="Send a task to your progressor"
              desc="For sales you're sending to TSP, add a task directly for your sales progressor to pick up."
              cta="Add a request"
              onClick={() => setAdding(true)}
            />
          )}
        </div>
      </div>

      {/* Guide card — built, hidden until its "View guide" target exists. */}
      {SHOW_TODO_GUIDE && (
        <div className="agent-glass" style={{ padding: "18px 20px", borderRadius: "var(--agent-radius-lg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(var(--agent-coral-rgb), 0.12)", color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ListChecks size={20} weight="regular" />
            </span>
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Learn more about to-dos</p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>See how to-dos, reminders and requests help you and your team stay on top of every sale.</p>
            </div>
          </div>
          <button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 8, flexShrink: 0 }}>
            <BookOpen size={14} weight="bold" />
            View guide
            <ArrowSquareOut size={13} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
