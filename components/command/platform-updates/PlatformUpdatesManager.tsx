"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, ImagePlus, X, Check, Loader2, Sparkles, Archive,
} from "lucide-react";
import {
  savePlatformUpdateAction,
  setPlatformUpdateStatusAction,
  deletePlatformUpdateAction,
  dismissPlatformUpdateAction,
  requestPlatformUpdateImageUploadAction,
  attachPlatformUpdateImageAction,
  removePlatformUpdateImageAction,
} from "@/app/actions/platform-updates";

type Category = "new_feature" | "improvement" | "moved";
type Status = "draft" | "published";
type Audience = "everyone" | "agency_staff" | "progression_business" | "tsp_internal";

export type ManagedUpdate = {
  id: string;
  title: string;
  body: string;
  category: Category;
  status: Status;
  audience: Audience;
  origin: "manual" | "auto";
  sourceReleaseSha: string | null;
  publishedAt: string | null;
  createdAt: string;
  linkUrl: string | null;
  technicalSummary: string | null;
  hasImage: boolean;
  screenshotUrl: string | null;
};

const CATEGORY_LABEL: Record<Category, string> = {
  new_feature: "New feature",
  improvement: "Improvement",
  moved: "Moved",
};
const CATEGORY_CLASS: Record<Category, string> = {
  new_feature: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  improvement: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  moved: "text-amber-300 bg-amber-500/10 border-amber-500/30",
};
const AUDIENCE_LABEL: Record<Audience, string> = {
  everyone: "Everyone",
  agency_staff: "Agency staff",
  progression_business: "Progression businesses",
  tsp_internal: "TSP internal",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "No date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

const inputCls =
  "w-full rounded-md border border-[#2e2e2e] bg-[#0a0a0a] px-3 py-2 text-[13px] text-neutral-200 placeholder:text-neutral-600 focus:border-[#2563eb] focus:outline-none";
const labelCls = "block text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-1.5";

export function PlatformUpdatesManager({ updates }: { updates: ManagedUpdate[] }) {
  const router = useRouter();
  // null = nothing open, "new" = create form open, else the id being edited.
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {editing !== "new" && (
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 rounded-md bg-[#2563eb] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4ed8]"
        >
          <Plus size={15} /> New update
        </button>
      )}

      {editing === "new" && (
        <Editor
          key="new"
          update={null}
          onClose={() => setEditing(null)}
          onCreated={(id) => setEditing(id)}
          router={router}
        />
      )}

      {updates.length === 0 && editing !== "new" ? (
        <div className="rounded-lg border border-dashed border-[#2e2e2e] bg-[#0f0f0f] px-5 py-10 text-center">
          <p className="text-[13px] text-neutral-500">No updates yet. Create your first one above.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {updates.map((u) =>
            editing === u.id ? (
              <li key={u.id}>
                <Editor update={u} onClose={() => setEditing(null)} onCreated={() => {}} router={router} />
              </li>
            ) : (
              <li key={u.id}>
                <Row update={u} onEdit={() => setEditing(u.id)} router={router} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function Row({
  update,
  onEdit,
  router,
}: {
  update: ManagedUpdate;
  onEdit: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const published = update.status === "published";

  function toggleStatus() {
    const fd = new FormData();
    fd.set("id", update.id);
    fd.set("publish", published ? "false" : "true");
    start(async () => {
      await setPlatformUpdateStatusAction(fd);
      router.refresh();
    });
  }
  function doDelete() {
    const fd = new FormData();
    fd.set("id", update.id);
    start(async () => {
      await deletePlatformUpdateAction(fd);
      router.refresh();
    });
  }
  function doDismiss() {
    const fd = new FormData();
    fd.set("id", update.id);
    start(async () => {
      await dismissPlatformUpdateAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-[#262626] bg-[#121212] p-4">
      <div className="flex items-start gap-4">
        {update.screenshotUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={update.screenshotUrl}
            alt=""
            className="h-14 w-20 flex-shrink-0 rounded-md border border-[#2e2e2e] object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${CATEGORY_CLASS[update.category]}`}>
              {CATEGORY_LABEL[update.category]}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                published ? "bg-emerald-500/10 text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
              }`}
            >
              {published ? <Eye size={10} /> : <EyeOff size={10} />}
              {published ? "Published" : "Hidden"}
            </span>
            {update.origin === "auto" && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-violet-300"
                title={update.sourceReleaseSha ? `Auto-drafted from release ${update.sourceReleaseSha.slice(0, 8)}` : "Auto-drafted from a release"}
              >
                <Sparkles size={10} /> Auto
              </span>
            )}
            <span className="text-[11px] text-neutral-600">{AUDIENCE_LABEL[update.audience]}</span>
            <span className="text-[11px] text-neutral-600">· {fmtDate(update.publishedAt ?? update.createdAt)}</span>
          </div>
          <p className="truncate text-[14px] font-semibold text-neutral-100">{update.title}</p>
          {update.body && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-neutral-400">{update.body}</p>}
          {update.linkUrl && (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-400">
              <ExternalLink size={11} /> {update.linkUrl}
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            onClick={toggleStatus}
            disabled={pending}
            title={published ? "Hide from users" : "Publish to users"}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
              published
                ? "bg-[#1a1a1a] text-neutral-300 hover:bg-[#222]"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : published ? <EyeOff size={13} /> : <Eye size={13} />}
            {published ? "Hide" : "Publish"}
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="rounded-md bg-[#1a1a1a] p-1.5 text-neutral-400 transition-colors hover:bg-[#222] hover:text-neutral-200"
          >
            <Pencil size={14} />
          </button>
          {update.origin === "auto" && !published && (
            <button
              onClick={doDismiss}
              disabled={pending}
              title="Dismiss this auto-draft — removed from review, never regenerated"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-neutral-400 transition-colors hover:bg-[#222] hover:text-neutral-200 disabled:opacity-50"
            >
              <Archive size={13} /> Dismiss
            </button>
          )}
          {confirmDelete ? (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={doDelete}
                disabled={pending}
                title="Confirm delete"
                className="rounded-md bg-red-600 p-1.5 text-white hover:bg-red-500 disabled:opacity-50"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                title="Cancel"
                className="rounded-md bg-[#1a1a1a] p-1.5 text-neutral-400 hover:bg-[#222]"
              >
                <X size={14} />
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              className="rounded-md bg-[#1a1a1a] p-1.5 text-neutral-400 transition-colors hover:bg-red-600/20 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Editor({
  update,
  onClose,
  onCreated,
  router,
}: {
  update: ManagedUpdate | null;
  onClose: () => void;
  onCreated: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [title, setTitle] = useState(update?.title ?? "");
  const [body, setBody] = useState(update?.body ?? "");
  const [category, setCategory] = useState<Category>(update?.category ?? "improvement");
  const [audience, setAudience] = useState<Audience>(update?.audience ?? "everyone");
  const [linkUrl, setLinkUrl] = useState(update?.linkUrl ?? "");
  const [publishedAt, setPublishedAt] = useState(toDateInput(update?.publishedAt ?? null));
  const [technical, setTechnical] = useState(update?.technicalSummary ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(update?.screenshotUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const id = update?.id ?? null;

  function save() {
    setError(null);
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    const fd = new FormData();
    if (id) fd.set("id", id);
    fd.set("title", title);
    fd.set("body", body);
    fd.set("category", category);
    fd.set("audience", audience);
    fd.set("linkUrl", linkUrl);
    fd.set("publishedAt", publishedAt);
    fd.set("technicalSummary", technical);
    start(async () => {
      const res = await savePlatformUpdateAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Couldn't save.");
        return;
      }
      router.refresh();
      // New entry: keep it open in edit mode so the image can be attached.
      if (!id && res.id) onCreated(res.id);
    });
  }

  async function pickImage(file: File) {
    setError(null);
    if (!id) {
      setError("Save the update first, then add an image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Images are capped at 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const minted = await requestPlatformUpdateImageUploadAction(id, ext);
      if ("error" in minted) {
        setError(minted.error);
        return;
      }
      const put = await fetch(minted.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });
      if (!put.ok) {
        setError("Upload failed. Try again.");
        return;
      }
      const attached = await attachPlatformUpdateImageAction(id, minted.path);
      if (!attached.ok) {
        setError(attached.error ?? "Couldn't attach the image.");
        return;
      }
      setImageUrl(URL.createObjectURL(file));
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    if (!id) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      await removePlatformUpdateImageAction(fd);
      setImageUrl(null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-[#2563eb]/40 bg-[#121212] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-neutral-200">{id ? "Edit update" : "New update"}</h3>
        <button onClick={onClose} className="rounded p-1 text-neutral-500 hover:text-neutral-300" title="Close">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3.5">
        <div>
          <label className={labelCls}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chain overview"
            maxLength={200}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Description (what users will read)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="A friendly, plain-English explanation of what changed and why it matters."
            rows={3}
            maxLength={5000}
            className={`${inputCls} resize-y`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputCls}>
              <option value="new_feature">New feature</option>
              <option value="improvement">Improvement</option>
              <option value="moved">Moved</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Audience</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className={inputCls}>
              <option value="everyone">Everyone</option>
              <option value="agency_staff">Agency staff</option>
              <option value="progression_business">Progression businesses</option>
              <option value="tsp_internal">TSP internal</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Publication date</label>
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Link (optional) — “Take me there”</label>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="/agent/chains"
            maxLength={2000}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Screenshot (optional, private)</label>
          {imageUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-16 w-24 rounded-md border border-[#2e2e2e] object-cover" />
              <button
                onClick={removeImage}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-neutral-300 hover:bg-[#222] disabled:opacity-50"
              >
                <Trash2 size={13} /> Remove image
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !id}
                title={id ? undefined : "Save the update first, then add an image"}
                className="inline-flex items-center gap-2 rounded-md border border-dashed border-[#2e2e2e] bg-[#0a0a0a] px-3 py-2 text-[12.5px] text-neutral-400 hover:border-[#2563eb] hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {uploading ? "Uploading…" : id ? "Add screenshot" : "Save first, then add a screenshot"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void pickImage(f);
                }}
              />
            </div>
          )}
        </div>

        <details className="rounded-md border border-[#262626] bg-[#0f0f0f]">
          <summary className="cursor-pointer px-3 py-2 text-[12px] text-neutral-500 hover:text-neutral-300">
            Internal notes (never shown to users)
          </summary>
          <div className="px-3 pb-3">
            <textarea
              value={technical}
              onChange={(e) => setTechnical(e.target.value)}
              placeholder="Raw technical context for your reference while writing the real copy. Never served to users."
              rows={2}
              maxLength={5000}
              className={`${inputCls} resize-y`}
            />
          </div>
        </details>

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[#2563eb] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {id ? "Save changes" : "Save draft"}
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-[#1a1a1a] px-3.5 py-2 text-[13px] text-neutral-300 hover:bg-[#222]"
          >
            {id ? "Done" : "Cancel"}
          </button>
          {!id && <span className="text-[11.5px] text-neutral-600">Saves as Hidden. Publish from the list once it’s ready.</span>}
        </div>
      </div>
    </div>
  );
}
