"use client";

// Boardwalk forms dashboard — list, search, sort, create (blank or template),
// rename/duplicate/archive/restore/delete, with a designed first-run empty
// state that sells what the platform can do.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormListItem } from "@/lib/forms/types";
import { formsApi } from "@/lib/forms/client";
import { BwButton, BwField, BwMenu, BwModal, useBwToast } from "./ui";

interface TemplateCard {
  id: string;
  name: string;
  description: string;
  questionCount: number;
}

type Filter = "all" | "draft" | "published" | "archived";
type Sort = "edited" | "created" | "responses" | "title";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All forms" },
  { id: "draft", label: "Drafts" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StatusChip({ form }: { form: FormListItem }) {
  if (form.status === "published") {
    return (
      <span className="bw-chip bw-chip-green">
        <span style={{ width: 5, height: 5, borderRadius: 99, background: "currentColor" }} />
        Live{form.hasUnpublishedChanges ? " · edited" : ""}
      </span>
    );
  }
  if (form.status === "closed") return <span className="bw-chip bw-chip-amber">Closed</span>;
  if (form.status === "archived") return <span className="bw-chip bw-chip-grey">Archived</span>;
  return <span className="bw-chip bw-chip-grey">Draft</span>;
}

export function FormsDashboard({
  initialForms,
  templates,
  firstName,
}: {
  initialForms: FormListItem[];
  templates: TemplateCard[];
  firstName: string;
}) {
  const router = useRouter();
  const { toast } = useBwToast();
  const [forms, setForms] = useState(initialForms);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("edited");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FormListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FormListItem | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    let list = forms;
    if (filter === "archived") list = list.filter((f) => f.status === "archived");
    else {
      list = list.filter((f) => f.status !== "archived");
      if (filter === "draft") list = list.filter((f) => f.status === "draft");
      if (filter === "published") list = list.filter((f) => f.status === "published" || f.status === "closed");
    }
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter((f) => f.title.toLowerCase().includes(needle));
    }
    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "responses") return b.responseCount - a.responseCount;
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.lastEditedAt.localeCompare(a.lastEditedAt);
    });
  }, [forms, filter, search, sort]);

  async function createForm(templateId?: string) {
    setBusy(true);
    try {
      const res = await formsApi<{ id: string }>("/api/forms", {
        method: "POST",
        body: JSON.stringify({ templateId }),
      });
      router.push(`/boardwalk/typeform/${res.id}`);
    } catch (err) {
      toast((err as Error).message, "error");
      setBusy(false);
    }
  }

  async function refresh() {
    const res = await formsApi<{ forms: FormListItem[] }>("/api/forms");
    setForms(res.forms);
  }

  async function act(form: FormListItem, action: string, label: string) {
    try {
      if (action === "duplicate") {
        const res = await formsApi<{ id: string }>(`/api/forms/${form.id}/duplicate`, { method: "POST" });
        toast("Copy created.");
        router.push(`/boardwalk/typeform/${res.id}`);
        return;
      }
      await formsApi(`/api/forms/${form.id}/status`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast(label);
      await refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function submitRename() {
    if (!renameTarget) return;
    setBusy(true);
    try {
      await formsApi(`/api/forms/${renameTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: renameValue }),
      });
      setRenameTarget(null);
      toast("Renamed.");
      await refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await formsApi(`/api/forms/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      toast("Form removed for good.");
      await refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = forms.filter((f) => f.status !== "archived").length === 0 && filter !== "archived";

  return (
    <div style={{ maxWidth: 1060, width: "100%", margin: "0 auto", padding: "30px 20px 80px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 22 }}>
        <div>
          <h1 className="bw-display" style={{ fontSize: 28, margin: 0 }}>
            {isEmpty ? `Welcome, ${firstName}.` : "Your forms"}
          </h1>
          {!isEmpty && (
            <p style={{ color: "var(--bw-ink-soft)", fontSize: 13.5, margin: "4px 0 0" }}>
              {forms.filter((f) => f.status === "published").length} live ·{" "}
              {forms.reduce((n, f) => n + f.responseCount, 0)} responses collected
            </p>
          )}
        </div>
        {!isEmpty && (
          <BwButton variant="primary" onClick={() => setCreateOpen(true)}>
            + New form
          </BwButton>
        )}
      </div>

      {isEmpty ? (
        <EmptyState templates={templates} onBlank={() => createForm()} onTemplate={(id) => createForm(id)} busy={busy} />
      ) : (
        <>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
            <div className="bw-seg">
              {FILTERS.map((f) => (
                <button key={f.id} data-active={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <input
              className="bw-input bw-input-sm"
              placeholder="Search forms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 220, marginLeft: "auto" }}
            />
            <select className="bw-select bw-input-sm" style={{ width: 160 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="edited">Last edited</option>
              <option value="created">Newest first</option>
              <option value="responses">Most responses</option>
              <option value="title">A to Z</option>
            </select>
          </div>

          {/* Grid */}
          {visible.length === 0 ? (
            <div className="bw-card" style={{ padding: 40, textAlign: "center", color: "var(--bw-ink-soft)", fontSize: 14 }}>
              {filter === "archived" ? "Nothing archived." : "No forms match that search."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {visible.map((form) => (
                <div
                  key={form.id}
                  className="bw-card bw-card-hover bw-fade-up"
                  style={{ padding: 18, cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }}
                  onClick={() => router.push(`/boardwalk/typeform/${form.id}`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <StatusChip form={form} />
                    <BwMenu
                      trigger={
                        <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Form actions" style={{ width: 28, padding: 0 }}>
                          ⋯
                        </button>
                      }
                    >
                      <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); router.push(`/boardwalk/typeform/${form.id}`); }}>Edit</button>
                      <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); window.open(`/f/${form.publicId}?preview=1`, "_blank"); }}>Preview</button>
                      <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); router.push(`/boardwalk/typeform/${form.id}/responses`); }}>Responses</button>
                      <div className="bw-menu-sep" />
                      <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); setRenameTarget(form); setRenameValue(form.title); }}>Rename</button>
                      <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); void act(form, "duplicate", ""); }}>Duplicate</button>
                      <div className="bw-menu-sep" />
                      {form.status === "archived" ? (
                        <>
                          <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); void act(form, "restore", "Restored to drafts."); }}>Restore</button>
                          <button className="bw-menu-item bw-menu-danger" onClick={(e) => { e.stopPropagation(); setDeleteTarget(form); }}>Remove for good</button>
                        </>
                      ) : (
                        <button className="bw-menu-item bw-menu-danger" onClick={(e) => { e.stopPropagation(); void act(form, "archive", "Archived."); }}>Archive</button>
                      )}
                    </BwMenu>
                  </div>

                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 650, margin: "0 0 3px", lineHeight: 1.3 }}>{form.title}</h3>
                    <p className="bw-hint" style={{ margin: 0 }}>
                      {form.questionCount} question{form.questionCount === 1 ? "" : "s"} · edited {timeAgo(form.lastEditedAt)}
                    </p>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--bw-line)" }}>
                    <span style={{ fontSize: 13, fontWeight: 650, color: form.responseCount ? "var(--bw-green-deep)" : "var(--bw-ink-faint)" }}>
                      {form.responseCount} response{form.responseCount === 1 ? "" : "s"}
                    </span>
                    <span className="bw-hint">Open →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      <BwModal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a form" width={720}>
        <button
          className="bw-card bw-card-hover"
          style={{ width: "100%", padding: 18, textAlign: "left", cursor: "pointer", marginBottom: 18, display: "flex", gap: 14, alignItems: "center", border: "1px dashed var(--bw-line-strong)" }}
          onClick={() => createForm()}
          disabled={busy}
        >
          <span style={{ fontSize: 22 }}>✦</span>
          <span>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 650 }}>Start from scratch</span>
            <span className="bw-hint">A blank form. Add your own questions and logic.</span>
          </span>
        </button>
        <p className="bw-label" style={{ marginBottom: 10 }}>Or start from a template</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
          {templates.map((t) => (
            <button
              key={t.id}
              className="bw-card bw-card-hover"
              style={{ padding: 16, textAlign: "left", cursor: "pointer" }}
              onClick={() => createForm(t.id)}
              disabled={busy}
            >
              <span style={{ display: "block", fontSize: 14, fontWeight: 650, marginBottom: 4 }}>{t.name}</span>
              <span className="bw-hint" style={{ display: "block", marginBottom: 8, lineHeight: 1.45 }}>{t.description}</span>
              <span className="bw-chip bw-chip-grey">{t.questionCount} questions</span>
            </button>
          ))}
        </div>
      </BwModal>

      {/* Rename modal */}
      <BwModal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename form"
        footer={
          <>
            <BwButton onClick={() => setRenameTarget(null)}>Cancel</BwButton>
            <BwButton variant="primary" loading={busy} onClick={submitRename}>Save</BwButton>
          </>
        }
      >
        <BwField label="Form name">
          <input className="bw-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && submitRename()} />
        </BwField>
      </BwModal>

      {/* Delete modal */}
      <BwModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Remove for good?"
        footer={
          <>
            <BwButton onClick={() => setDeleteTarget(null)}>Keep it</BwButton>
            <BwButton variant="primary" style={{ background: "var(--bw-red)" }} loading={busy} onClick={submitDelete}>
              Remove for good
            </BwButton>
          </>
        }
      >
        <p style={{ fontSize: 14, margin: 0, lineHeight: 1.55 }}>
          <strong>{deleteTarget?.title}</strong> and its {deleteTarget?.responseCount ?? 0} response
          {(deleteTarget?.responseCount ?? 0) === 1 ? "" : "s"} will be removed permanently. This can&apos;t be undone.
        </p>
      </BwModal>
    </div>
  );
}

// ─── First-run empty state ────────────────────────────────────────────────────

function EmptyState({
  templates,
  onBlank,
  onTemplate,
  busy,
}: {
  templates: TemplateCard[];
  onBlank: () => void;
  onTemplate: (id: string) => void;
  busy: boolean;
}) {
  const featured = templates.slice(0, 4);
  const rest = templates.slice(4);
  return (
    <div className="bw-fade-up">
      <div
        className="bw-card"
        style={{
          padding: "40px 36px",
          marginBottom: 24,
          background:
            "radial-gradient(900px 400px at 85% -20%, rgba(26,95,74,0.1), transparent 60%), var(--bw-paper-raised)",
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bw-green)", margin: "0 0 10px" }}>
          Your form studio
        </p>
        <h2 className="bw-display" style={{ fontSize: 30, lineHeight: 1.15, margin: "0 0 10px", maxWidth: 560 }}>
          Build beautiful forms your clients will actually enjoy filling in.
        </h2>
        <p style={{ fontSize: 15, color: "var(--bw-ink-soft)", margin: "0 0 24px", maxWidth: 520, lineHeight: 1.55 }}>
          Valuation enquiries, buyer registration, viewing feedback, offers. One question at a
          time, on your branding, with smart routing based on each answer. Publish with a link or
          QR code and watch responses land here.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <BwButton variant="primary" size="lg" onClick={onBlank} loading={busy}>
            Create your first form
          </BwButton>
        </div>
      </div>

      <p className="bw-label" style={{ marginBottom: 12 }}>Or start from a template built for agencies</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {featured.map((t) => (
          <button key={t.id} className="bw-card bw-card-hover" style={{ padding: 18, textAlign: "left", cursor: "pointer" }} onClick={() => onTemplate(t.id)} disabled={busy}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 650, marginBottom: 5 }}>{t.name}</span>
            <span className="bw-hint" style={{ display: "block", lineHeight: 1.5, marginBottom: 10 }}>{t.description}</span>
            <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--bw-green)" }}>Use this template →</span>
          </button>
        ))}
      </div>
      {rest.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {rest.map((t) => (
            <button key={t.id} className="bw-btn bw-btn-secondary bw-btn-sm" onClick={() => onTemplate(t.id)} disabled={busy}>
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
