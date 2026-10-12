"use client";

// Boardwalk forms dashboard. Each card carries a true miniature of the form's
// welcome screen (its real theme + copy). Creation routes to the full-page
// template gallery at /boardwalk/forms/new.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormListItem } from "@/lib/forms/types";
import { formsApi } from "@/lib/forms/client";
import { BwButton, BwField, BwMenu, BwModal, useBwToast } from "./ui";
import { FormMiniPreview } from "./FormMiniPreview";

type Filter = "all" | "draft" | "published" | "archived";
type Sort = "edited" | "created" | "responses" | "title";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
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
  return <span className="bw-chip bw-chip-blush">Draft</span>;
}

export function FormsDashboard({
  initialForms,
  firstName,
}: {
  initialForms: FormListItem[];
  firstName: string;
}) {
  const router = useRouter();
  const { toast } = useBwToast();
  const [forms, setForms] = useState(initialForms);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("edited");
  const [search, setSearch] = useState("");
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

  async function refresh() {
    const res = await formsApi<{ forms: FormListItem[] }>("/api/forms");
    setForms(res.forms);
  }

  async function act(form: FormListItem, action: string, label: string) {
    try {
      if (action === "duplicate") {
        const res = await formsApi<{ id: string }>(`/api/forms/${form.id}/duplicate`, { method: "POST" });
        toast("Copy created.");
        router.push(`/boardwalk/forms/${res.id}`);
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

  const activeForms = forms.filter((f) => f.status !== "archived");
  const isEmpty = activeForms.length === 0 && filter !== "archived";
  const liveCount = forms.filter((f) => f.status === "published").length;
  const totalResponses = forms.reduce((n, f) => n + f.responseCount, 0);

  return (
    <div style={{ maxWidth: 1180, width: "100%", margin: "0 auto", padding: "38px 24px 90px" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 26 }}>
        <div>
          <p className="bw-kicker" style={{ margin: "0 0 8px" }}>
            {isEmpty ? "Your form studio" : "Forms"}
          </p>
          <h1 className="bw-display" style={{ fontSize: 34, margin: 0, lineHeight: 1.1 }}>
            {isEmpty ? `Welcome, ${firstName}.` : "Your forms"}
          </h1>
          {!isEmpty && (
            <p style={{ color: "var(--bw-ink-soft)", fontSize: 13.5, margin: "8px 0 0", letterSpacing: "0.02em" }}>
              {liveCount} live · {totalResponses} response{totalResponses === 1 ? "" : "s"} collected
            </p>
          )}
        </div>
        {!isEmpty && (
          <BwButton variant="primary" onClick={() => router.push("/boardwalk/forms/new")}>
            + New form
          </BwButton>
        )}
      </div>

      {isEmpty ? (
        <EmptyState onCreate={() => router.push("/boardwalk/forms/new")} />
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
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
              style={{ maxWidth: 230, marginLeft: "auto" }}
            />
            <select className="bw-select bw-input-sm" style={{ width: 150 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="edited">Last edited</option>
              <option value="created">Newest first</option>
              <option value="responses">Most responses</option>
              <option value="title">A to Z</option>
            </select>
          </div>

          {/* ── Grid ── */}
          {visible.length === 0 ? (
            <div className="bw-card" style={{ padding: 48, textAlign: "center", color: "var(--bw-ink-soft)", fontSize: 14 }}>
              {filter === "archived" ? "Nothing archived." : "No forms match that search."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 20 }}>
              {visible.map((form) => (
                <div
                  key={form.id}
                  className="bw-card bw-card-hover bw-fade-up"
                  style={{ cursor: "pointer", overflow: "hidden", display: "flex", flexDirection: "column" }}
                  onClick={() => router.push(`/boardwalk/forms/${form.id}`)}
                >
                  {/* True miniature of the form's welcome screen */}
                  <div style={{ borderBottom: "1px solid var(--bw-line)", position: "relative" }}>
                    <FormMiniPreview preview={form.preview} height={148} />
                    <div style={{ position: "absolute", top: 10, left: 10 }}>
                      <StatusChip form={form} />
                    </div>
                  </div>

                  <div style={{ padding: "14px 16px 15px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 15.5, fontWeight: 650, margin: "0 0 3px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {form.title}
                        </h3>
                        <p className="bw-hint" style={{ margin: 0 }}>
                          {form.questionCount} question{form.questionCount === 1 ? "" : "s"} · edited {timeAgo(form.lastEditedAt)}
                        </p>
                      </div>
                      <BwMenu
                        trigger={
                          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Form actions" style={{ width: 28, padding: 0, flexShrink: 0 }}>
                            ⋯
                          </button>
                        }
                      >
                        <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); router.push(`/boardwalk/forms/${form.id}`); }}>Edit</button>
                        <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); window.open(`/f/${form.publicId}?preview=1`, "_blank"); }}>Preview</button>
                        <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); router.push(`/boardwalk/forms/${form.id}/responses`); }}>Responses</button>
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

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--bw-line)" }}>
                      <span style={{ fontSize: 13, fontWeight: 650, color: form.responseCount ? "var(--bw-ink-strong)" : "var(--bw-ink-faint)" }}>
                        {form.responseCount} response{form.responseCount === 1 ? "" : "s"}
                      </span>
                      <span className="bw-hint" style={{ letterSpacing: "0.04em" }}>Open →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Rename modal ── */}
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

      {/* ── Delete modal ── */}
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bw-fade-up">
      <div
        className="bw-card"
        style={{
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        }}
      >
        <div style={{ padding: "clamp(28px, 4vw, 52px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p className="bw-kicker" style={{ margin: "0 0 12px" }}>Boardwalk Forms</p>
          <h2 className="bw-display" style={{ fontSize: "clamp(26px, 3vw, 36px)", lineHeight: 1.15, margin: "0 0 14px" }}>
            Forms your clients will actually enjoy filling in.
          </h2>
          <p style={{ fontSize: 15, color: "var(--bw-ink-soft)", margin: "0 0 28px", lineHeight: 1.6, maxWidth: 440 }}>
            Valuation enquiries, buyer registration, viewing feedback, offers. One question at a
            time, on your branding, with smart routing based on each answer. Publish with a link or
            QR code and watch responses land here.
          </p>
          <div>
            <BwButton variant="primary" size="lg" onClick={onCreate}>
              Create your first form
            </BwButton>
          </div>
        </div>
        <div
          aria-hidden
          style={{
            minHeight: 280,
            background:
              "linear-gradient(to right, rgba(64,70,72,0.16), rgba(64,70,72,0) 40%), center/cover no-repeat url(/boardwalk/interior-2.jpg)",
          }}
        />
      </div>
    </div>
  );
}
