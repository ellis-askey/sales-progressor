"use client";

// Boardwalk form builder — the three-pane editing experience.
// Left: structure (welcome, questions, endings). Centre: live themed preview
// of the selected item. Right: inspector for the selected item (including the
// logic editor). Tabs swap the right-hand context: Create / Design / Share.
// Autosaves the draft (debounced), with client-side undo/redo history.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormDefinition, FormStatus, Question, QuestionType } from "@/lib/forms/types";
import { newQuestion } from "@/lib/forms/defaults";
import { newEntityId } from "@/lib/forms/ids";
import { validateLogic } from "@/lib/forms/logic";
import { formsApi } from "@/lib/forms/client";
import { useBwToast, BwButton } from "../ui";
import { QuestionRail } from "./QuestionRail";
import { CenterPreview } from "./CenterPreview";
import { Inspector } from "./Inspector";
import { DesignPanel } from "./DesignPanel";
import { ShareTab } from "./ShareTab";

export type Selection =
  | { kind: "welcome" }
  | { kind: "question"; id: string }
  | { kind: "ending"; id: string };

export type BuilderTab = "create" | "design" | "share";

const MAX_HISTORY = 60;

export function BuilderApp({
  formId,
  publicId,
  initialStatus,
  initialDefinition,
  hasUnpublishedChanges,
  responseCount,
}: {
  formId: string;
  publicId: string;
  initialStatus: FormStatus;
  initialDefinition: FormDefinition;
  hasUnpublishedChanges: boolean;
  responseCount: number;
}) {
  const router = useRouter();
  const { toast } = useBwToast();

  const [def, setDef] = useState(initialDefinition);
  const [status, setStatus] = useState<FormStatus>(initialStatus);
  const [dirtySincePublish, setDirtySincePublish] = useState(hasUnpublishedChanges);
  const [tab, setTab] = useState<BuilderTab>("create");
  const [selection, setSelection] = useState<Selection>(
    initialDefinition.questions.length
      ? { kind: "question", id: initialDefinition.questions[0].id }
      : { kind: "welcome" }
  );
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [publishBusy, setPublishBusy] = useState(false);
  const [mobilePane, setMobilePane] = useState<"structure" | "preview" | "settings">("preview");
  const [isNarrow, setIsNarrow] = useState(false);

  // Undo / redo
  const undoStack = useRef<FormDefinition[]>([]);
  const redoStack = useRef<FormDefinition[]>([]);
  const skipHistory = useRef(false);

  const update = useCallback((updater: (d: FormDefinition) => FormDefinition) => {
    setDef((prev) => {
      if (!skipHistory.current) {
        undoStack.current.push(prev);
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
        redoStack.current = [];
      }
      skipHistory.current = false;
      return updater(prev);
    });
    setSaveState("dirty");
    setDirtySincePublish(true);
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setDef((current) => {
      redoStack.current.push(current);
      return prev;
    });
    setSaveState("dirty");
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    setDef((current) => {
      undoStack.current.push(current);
      return next;
    });
    setSaveState("dirty");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Narrow-screen detection for the responsive pane switcher
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // ── Autosave (debounced) ────────────────────────────────────────────────────
  const defRef = useRef(def);
  defRef.current = def;
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        await formsApi(`/api/forms/${formId}/draft`, {
          method: "PUT",
          body: JSON.stringify({ definition: defRef.current }),
        });
        // Another edit may have landed while saving — stay dirty if so.
        setSaveState((s) => (s === "saving" ? "saved" : s));
      } catch {
        setSaveState("error");
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [def, saveState, formId]);

  // Warn before closing with unsaved work
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  // ── Question operations ─────────────────────────────────────────────────────

  const addQuestion = useCallback(
    (type: QuestionType) => {
      const q = newQuestion(type);
      update((d) => {
        const questions = [...d.questions];
        const afterIndex =
          selection.kind === "question"
            ? questions.findIndex((x) => x.id === selection.id)
            : questions.length - 1;
        questions.splice(afterIndex + 1, 0, q);
        return { ...d, questions };
      });
      setSelection({ kind: "question", id: q.id });
      if (isNarrow) setMobilePane("settings");
    },
    [selection, update, isNarrow]
  );

  const duplicateQuestion = useCallback(
    (id: string) => {
      update((d) => {
        const index = d.questions.findIndex((q) => q.id === id);
        if (index === -1) return d;
        const source = d.questions[index];
        const copy: Question = JSON.parse(JSON.stringify(source));
        copy.id = newEntityId("q");
        copy.title = source.title ? `${source.title} (copy)` : "";
        copy.jumps = undefined; // jumps referencing old ids would mislead
        copy.choices = copy.choices?.map((c) => ({ ...c, id: newEntityId("c") }));
        const questions = [...d.questions];
        questions.splice(index + 1, 0, copy);
        setSelection({ kind: "question", id: copy.id });
        return { ...d, questions };
      });
    },
    [update]
  );

  const removeQuestion = useCallback(
    (id: string) => {
      update((d) => {
        const index = d.questions.findIndex((q) => q.id === id);
        const questions = d.questions.filter((q) => q.id !== id);
        if (selection.kind === "question" && selection.id === id) {
          const neighbour = questions[Math.max(0, index - 1)];
          setSelection(neighbour ? { kind: "question", id: neighbour.id } : { kind: "welcome" });
        }
        return { ...d, questions };
      });
    },
    [selection, update]
  );

  const moveQuestion = useCallback(
    (fromIndex: number, toIndex: number) => {
      update((d) => {
        const questions = [...d.questions];
        const [moved] = questions.splice(fromIndex, 1);
        questions.splice(toIndex, 0, moved);
        return { ...d, questions };
      });
    },
    [update]
  );

  const updateQuestion = useCallback(
    (id: string, patch: Partial<Question>) => {
      update((d) => ({
        ...d,
        questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      }));
    },
    [update]
  );

  // ── Publish ─────────────────────────────────────────────────────────────────

  const logicIssues = useMemo(() => validateLogic(def), [def]);

  async function publishAction(action: "publish" | "unpublish" | "close" | "reopen") {
    setPublishBusy(true);
    try {
      // Flush any pending edits first so publish freezes what's on screen.
      if (saveState !== "saved") {
        await formsApi(`/api/forms/${formId}/draft`, {
          method: "PUT",
          body: JSON.stringify({ definition: defRef.current }),
        });
        setSaveState("saved");
      }
      const res = await formsApi<{ status: FormStatus }>(`/api/forms/${formId}/status`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setStatus(res.status);
      if (action === "publish") {
        setDirtySincePublish(false);
        toast("Published. Your form is live.");
        setTab("share");
      } else if (action === "unpublish") toast("Unpublished. Back to draft.");
      else if (action === "close") toast("Form closed to new responses.");
      else toast("Form reopened.");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setPublishBusy(false);
    }
  }

  const selectedQuestion =
    selection.kind === "question" ? def.questions.find((q) => q.id === selection.id) ?? null : null;

  const saveLabel =
    saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Saving…" : "Couldn't save, retrying";

  // Retry failed saves when the user keeps editing or after a pause
  useEffect(() => {
    if (saveState !== "error") return;
    const t = setTimeout(() => setSaveState("dirty"), 4000);
    return () => clearTimeout(t);
  }, [saveState]);

  const showStructure = !isNarrow || mobilePane === "structure";
  const showPreview = !isNarrow || mobilePane === "preview";
  const showSettings = !isNarrow || mobilePane === "settings";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 58px)", overflow: "hidden" }}>
      {/* ── Top bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: "1px solid var(--bw-line)",
          background: "var(--bw-paper-raised)",
          flexWrap: "wrap",
        }}
      >
        <Link href="/boardwalk/forms" className="bw-btn bw-btn-ghost bw-btn-sm" style={{ flexShrink: 0 }}>
          ← Forms
        </Link>

        <input
          aria-label="Form title"
          value={def.welcome.title}
          onChange={(e) => update((d) => ({ ...d, welcome: { ...d.welcome, title: e.target.value } }))}
          placeholder="Untitled form"
          style={{
            border: "none",
            background: "transparent",
            fontSize: 15,
            fontWeight: 650,
            fontFamily: "var(--bw-font-sans)",
            color: "var(--bw-ink)",
            outline: "none",
            minWidth: 120,
            maxWidth: 320,
            flex: "1 1 160px",
            padding: "4px 6px",
            borderRadius: 7,
          }}
          onFocus={(e) => (e.target.style.background = "var(--bw-paper-sunken)")}
          onBlur={(e) => (e.target.style.background = "transparent")}
        />

        <span className="bw-hint" style={{ flexShrink: 0, minWidth: 64, color: saveState === "error" ? "var(--bw-red)" : undefined }}>
          {saveLabel}
        </span>

        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" onClick={undo} title="Undo (Ctrl+Z)" aria-label="Undo" style={{ width: 30, padding: 0 }}>
            ↶
          </button>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" onClick={redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" style={{ width: 30, padding: 0 }}>
            ↷
          </button>
        </div>

        <div className="bw-seg" style={{ marginLeft: "auto", flexShrink: 0 }}>
          {(["create", "design", "share"] as const).map((t) => (
            <button key={t} data-active={tab === t} onClick={() => setTab(t)}>
              {t === "create" ? "Create" : t === "design" ? "Design" : "Share"}
            </button>
          ))}
        </div>

        <Link href={`/boardwalk/forms/${formId}/responses`} className="bw-btn bw-btn-secondary bw-btn-sm" style={{ flexShrink: 0 }}>
          Results{responseCount ? ` (${responseCount})` : ""}
        </Link>

        <a href={`/f/${publicId}?preview=1`} target="_blank" rel="noreferrer" className="bw-btn bw-btn-secondary bw-btn-sm" style={{ flexShrink: 0 }}>
          Preview
        </a>

        {status === "published" && !dirtySincePublish ? (
          <span className="bw-chip bw-chip-green" style={{ height: 30, padding: "0 12px", fontSize: 12 }}>
            ● Live
          </span>
        ) : (
          <BwButton
            variant="primary"
            size="sm"
            loading={publishBusy}
            onClick={() => publishAction("publish")}
            style={{ flexShrink: 0 }}
          >
            {status === "published" ? "Publish changes" : "Publish"}
          </BwButton>
        )}
      </div>

      {/* Logic problems banner */}
      {logicIssues.some((i) => i.severity === "error") && (
        <div
          style={{
            background: "var(--bw-red-tint)",
            color: "var(--bw-red)",
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 16px",
            borderBottom: "1px solid var(--bw-line)",
          }}
        >
          Some logic points at questions or options that no longer exist. Check the rules flagged in the editor before publishing.
        </div>
      )}

      {/* Mobile pane switcher */}
      {isNarrow && tab === "create" && (
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--bw-line)", background: "var(--bw-paper)" }}>
          <div className="bw-seg" style={{ width: "100%", display: "flex" }}>
            {(["structure", "preview", "settings"] as const).map((p) => (
              <button key={p} data-active={mobilePane === p} onClick={() => setMobilePane(p)} style={{ flex: 1 }}>
                {p === "structure" ? "Questions" : p === "preview" ? "Preview" : "Settings"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Panes ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {tab === "share" ? (
          <ShareTab
            formId={formId}
            publicId={publicId}
            status={status}
            def={def}
            update={update}
            publishBusy={publishBusy}
            onPublishAction={publishAction}
            dirtySincePublish={dirtySincePublish}
          />
        ) : (
          <>
            {tab === "create" && showStructure && (
              <QuestionRail
                def={def}
                selection={selection}
                onSelect={(sel) => {
                  setSelection(sel);
                  if (isNarrow) setMobilePane("settings");
                }}
                onAdd={addQuestion}
                onDuplicate={duplicateQuestion}
                onRemove={removeQuestion}
                onMove={moveQuestion}
                logicIssues={logicIssues}
              />
            )}

            {showPreview && (
              <CenterPreview def={def} selection={selection} onSelect={setSelection} />
            )}

            {tab === "create" && showSettings && (
              <Inspector
                def={def}
                selection={selection}
                question={selectedQuestion}
                update={update}
                updateQuestion={updateQuestion}
                logicIssues={logicIssues}
              />
            )}

            {tab === "design" && (!isNarrow || showSettings || true) && (
              <DesignPanel def={def} update={update} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
