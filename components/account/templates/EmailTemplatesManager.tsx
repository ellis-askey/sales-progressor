"use client";

// Settings → Email templates. The library (search + list + row actions), the
// create/edit editor (fields + rich message + live preview against a real file),
// and duplicate/delete. Permissions are enforced server-side; the UI only hides
// controls the user can't use. Colour rule: hover = neutral shade, active =
// coral ring/text — never a washed-out orange fill.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Stack, MagnifyingGlass, Plus, Eye, CaretDown, X, Check, CircleNotch, Buildings, User as UserIcon, LockSimple,
} from "@phosphor-icons/react";
import { RowActionsMenu } from "@/components/account/chrome/RowActionsMenu";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { TemplateRichEditor } from "./TemplateRichEditor";
import { renderTemplateBody, type TemplateVarValues } from "@/lib/email/templates/variables";
import {
  listEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, duplicateEmailTemplate,
  getTemplatePreviewContext, getMyTemplateFooter, type EmailTemplateDTO, type TemplateScope,
} from "@/app/actions/email-templates";

type SigFooter = { signOff: string; signatureHtml: string };
import { searchComposeSales, type ComposeSaleResult } from "@/app/actions/compose";

function fmtDate(iso: string): string {
  try { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)); }
  catch { return ""; }
}

type Draft = { id: string | null; name: string; description: string; subject: string; body: string; scope: TemplateScope };
const EMPTY_DRAFT: Draft = { id: null, name: "", description: "", subject: "", body: "<p><br></p>", scope: "personal" };

export function EmailTemplatesManager({ canManageCompany }: { canManageCompany: boolean }) {
  const { toast } = useAgentToast();
  const [templates, setTemplates] = useState<EmailTemplateDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EmailTemplateDTO | null>(null);

  const load = useCallback(async () => {
    try { setTemplates(await listEmailTemplates()); }
    catch { toast.error("Couldn't load templates"); setTemplates([]); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const t = templates ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return t;
    return t.filter((x) => x.name.toLowerCase().includes(q) || (x.description ?? "").toLowerCase().includes(q));
  }, [templates, query]);

  const openNew = () => setDraft({ ...EMPTY_DRAFT, scope: "personal" });
  const openEdit = (t: EmailTemplateDTO) => setDraft({ id: t.id, name: t.name, description: t.description ?? "", subject: t.subject ?? "", body: t.body, scope: t.scope });

  const onDuplicate = async (t: EmailTemplateDTO) => {
    const r = await duplicateEmailTemplate(t.id);
    if (r.ok) { toast.success("Duplicated to a personal copy"); load(); }
    else toast.error(r.error);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const r = await deleteEmailTemplate(confirmDelete.id);
    if (r.ok) { toast.success("Template removed"); setConfirmDelete(null); load(); }
    else toast.error(r.error);
  };

  return (
    <div className="etm">
      <style>{ETM_CSS}</style>

      {/* Controls — hidden until there's at least one template, so the empty
          state's own "Create your first template" button isn't doubled up. They
          animate in once the first template exists. */}
      {templates !== null && templates.length > 0 && (
        <div className="etm-controls etm-controls-in">
          <div className="etm-search">
            <MagnifyingGlass size={16} weight="bold" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates…" aria-label="Search templates" />
          </div>
          <button type="button" className="etm-create" onClick={openNew}><Plus size={15} weight="bold" /> Create template</button>
        </div>
      )}

      {/* List */}
      {templates === null ? (
        <div className="etm-loading"><CircleNotch size={20} className="etm-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        templates.length === 0 ? (
          <div className="etm-empty">
            <div className="etm-empty-ic"><Stack size={26} weight="fill" /></div>
            <div className="etm-empty-h">No email templates yet</div>
            <p className="etm-empty-p">Create your first template to save time and keep your communication consistent.</p>
            <button type="button" className="etm-create" onClick={openNew}><Plus size={15} weight="bold" /> Create your first template</button>
          </div>
        ) : (
          <div className="etm-empty"><div className="etm-empty-h">No templates match &ldquo;{query}&rdquo;</div><p className="etm-empty-p">Try a different search.</p></div>
        )
      ) : (
        <div className="etm-list">
          <div className="etm-row etm-head">
            <span>Template name</span>
            <span className="etm-col-upd">Last updated</span>
            <span />
          </div>
          {filtered.map((t) => (
            <div key={t.id} className="etm-row" role="button" tabIndex={0}
              onClick={() => (t.canEdit ? openEdit(t) : onDuplicate(t))}
              onKeyDown={(e) => { if (e.key === "Enter") (t.canEdit ? openEdit(t) : onDuplicate(t)); }}>
              <span className="etm-name-cell">
                <span className="etm-doc"><Stack size={16} weight="fill" /></span>
                <span className="etm-name-text">
                  <span className="etm-name">
                    {t.name}
                    {t.scope === "company" ? <span className="etm-chip etm-chip-co"><Buildings size={11} weight="fill" /> Company</span>
                      : <span className="etm-chip etm-chip-me"><UserIcon size={11} weight="fill" /> Personal</span>}
                  </span>
                  {t.description && <span className="etm-desc">{t.description}</span>}
                </span>
              </span>
              <span className="etm-col-upd etm-upd">{fmtDate(t.updatedAt)}</span>
              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <RowActionsMenu items={[
                  ...(t.canEdit ? [{ label: "Edit template", onClick: () => openEdit(t) }] : []),
                  { label: "Duplicate", onClick: () => onDuplicate(t) },
                  ...(t.canEdit ? [{ label: "Delete template", onClick: () => setConfirmDelete(t), danger: true }] : []),
                ]} />
              </span>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <TemplateEditorModal
          draft={draft}
          canManageCompany={canManageCompany}
          onClose={() => setDraft(null)}
          onSaved={() => { setDraft(null); load(); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove this template?"
          body={`"${confirmDelete.name}" will be removed for everyone who can see it. This can't be undone.`}
          confirmLabel="Remove template"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

// ── Editor modal: fields + rich message (left) + live preview (right) ────────
function TemplateEditorModal({ draft: initial, canManageCompany, onClose, onSaved }: {
  draft: Draft; canManageCompany: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useAgentToast();
  const { theme, isNight } = usePortalTheme();
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [footer, setFooter] = useState<SigFooter | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  // Their own sign-off + signature, shown faded below the editor/preview so they
  // know it's appended automatically and shouldn't be typed into the template.
  useEffect(() => { getMyTemplateFooter().then(setFooter).catch(() => setFooter(null)); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    const input = { name: d.name, description: d.description || null, subject: d.subject || null, body: d.body, scope: d.scope };
    const r = d.id ? await updateEmailTemplate(d.id, input) : await createEmailTemplate(input);
    setSaving(false);
    if (r.ok) { toast.success(d.id ? "Template updated" : "Template created"); onSaved(); }
    else toast.error(r.error);
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="etm-ov" data-theme={theme} data-night={isNight ? "" : undefined} onMouseDown={onClose}>
      <div className="etm-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="etm-modal-hd">
          <span className="etm-modal-ic"><Stack size={18} weight="fill" /></span>
          <span className="etm-modal-title">{d.id ? "Edit email template" : "Create email template"}</span>
          <button type="button" className="etm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="etm-modal-body">
          <div className="etm-form">
            <Field label="Template name" required>
              <input className="etm-input" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Exchange readiness" autoFocus />
            </Field>
            <Field label="Description" hint="optional">
              <input className="etm-input" value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="A short note so you remember when to use it" />
            </Field>
            {canManageCompany && (
              <Field label="Visibility">
                <div className="etm-seg">
                  {(["personal", "company"] as TemplateScope[]).map((s) => (
                    <button key={s} type="button" className={`etm-seg-b ${d.scope === s ? "on" : ""}`} onClick={() => set("scope", s)}>
                      {s === "personal" ? <UserIcon size={14} weight="bold" /> : <Buildings size={14} weight="bold" />}
                      {s === "personal" ? "Only me" : "Whole company"}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Subject" hint="optional">
              <input className="etm-input" value={d.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Applied only when the email has no subject yet" />
            </Field>
            <Field label="Message" required>
              <TemplateRichEditor initialHtml={d.body} onChange={(html) => set("body", html)} />
            </Field>
            {footer && <SignOffSignatureHint footer={footer} labelled />}
          </div>

          <TemplatePreviewPane body={d.body} subject={d.subject} footer={footer} />
        </div>

        <div className="etm-modal-ft">
          <button type="button" className="etm-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="etm-btn-primary" onClick={save} disabled={saving}>
            {saving ? <><CircleNotch size={15} className="etm-spin" /> Saving…</> : <><Check size={15} weight="bold" /> Save template</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Live preview against a real file ─────────────────────────────────────────
export function TemplatePreviewPane({ body, subject, footer }: { body: string; subject: string; footer: SigFooter | null }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ComposeSaleResult[]>([]);
  const [file, setFile] = useState<ComposeSaleResult | null>(null);
  const [values, setValues] = useState<TemplateVarValues>({});
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      try { setResults(await searchComposeSales(q.trim())); } catch { setResults([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (r: ComposeSaleResult) => {
    setFile(r); setOpen(false); setQ("");
    try { const ctx = await getTemplatePreviewContext(r.id); setValues(ctx?.values ?? {}); } catch { setValues({}); }
  };

  const rendered = useMemo(() => renderTemplateBody(body, file ? values : {}, "preview"), [body, values, file]);
  const resolvedSubject = subject?.trim() || null;

  return (
    <div className="etm-prev">
      <div className="etm-prev-hd">
        <span className="etm-prev-ttl"><Eye size={15} weight="bold" /> Preview</span>
        <div className="etm-prev-file" ref={boxRef}>
          <button type="button" className="etm-prev-pick" onClick={() => setOpen((v) => !v)}>
            {file ? `Using file: ${file.line1}` : "Pick a file…"} <CaretDown size={12} weight="bold" />
          </button>
          {open && (
            <div className="etm-prev-pop">
              <input className="etm-input etm-input-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a property…" autoFocus />
              <div className="etm-prev-res">
                {results.map((r) => (
                  <button key={r.id} type="button" className="etm-prev-res-i" onClick={() => pick(r)}>
                    <span className="etm-prev-res-l1">{r.line1}</span>
                    <span className="etm-prev-res-l2">{r.location}</span>
                  </button>
                ))}
                {q.trim() && results.length === 0 && <div className="etm-prev-none">No files found</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="etm-prev-body">
        {!file && <div className="etm-prev-note">Pick a file to see this template with real details. Variables show as <span className="et-var-missing">not set</span> until a file is chosen.</div>}
        {resolvedSubject && <div className="etm-prev-subj"><span>Subject</span>{resolvedSubject}</div>}
        <div className="etm-prev-email" dangerouslySetInnerHTML={{ __html: rendered.html || "<p style='color:var(--agent-text-muted)'>Nothing to preview yet.</p>" }} />
        {footer && <SignOffSignatureHint footer={footer} />}
        {file && rendered.missing.length > 0 && (
          <div className="etm-prev-missing">{rendered.missing.length} variable{rendered.missing.length > 1 ? "s" : ""} not set on this file.</div>
        )}
      </div>
    </div>
  );
}

// The user's sign-off + signature, shown faded + non-interactive so they know
// it's appended automatically and isn't part of the editable template.
function SignOffSignatureHint({ footer, labelled }: { footer: SigFooter; labelled?: boolean }) {
  return (
    <div className="etm-sig-hint" aria-hidden>
      {labelled && <div className="etm-sig-hint-label"><LockSimple size={11} weight="fill" /> Your sign-off &amp; signature — added automatically</div>}
      <p className="etm-sig-hint-off">{footer.signOff}</p>
      <div className="etm-sig-hint-sig" dangerouslySetInnerHTML={{ __html: footer.signatureHtml }} />
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="etm-field">
      <span className="etm-label">{label}{required && <span className="etm-req"> *</span>}{hint && <span className="etm-hint"> ({hint})</span>}</span>
      {children}
    </label>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  const { theme } = usePortalTheme();
  const [busy, setBusy] = useState(false);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="etm-ov etm-ov-confirm" data-theme={theme} onMouseDown={onCancel}>
      <div className="etm-confirm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="etm-confirm-h">{title}</div>
        <p className="etm-confirm-b">{body}</p>
        <div className="etm-confirm-ft">
          <button type="button" className="etm-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="etm-btn-danger" onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ETM_CSS = `
.etm-spin { animation: etm-rot 0.8s linear infinite; }
@keyframes etm-rot { to { transform: rotate(360deg); } }
.etm-controls { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.etm-controls-in { animation: etm-slidein .24s ease; }
@keyframes etm-slidein { from { opacity: 0; transform: translateY(-5px); } }
/* Faded, non-editable sign-off + signature (auto-appended by the composer). */
.etm-sig-hint { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--agent-border-default, rgba(20,16,10,0.14)); opacity: 0.5; pointer-events: none; user-select: none; }
.etm-sig-hint-label { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--agent-text-muted, #9a8a7f); margin-bottom: 9px; }
.etm-sig-hint-off { font-size: 14px; color: var(--agent-text-primary, #2D1810); margin: 0 0 6px; }
.etm-sig-hint-sig { font-size: 13px; line-height: 1.5; color: var(--agent-text-secondary, #5A3A28); }
.etm-search { flex: 1; display: flex; align-items: center; gap: 9px; padding: 9px 13px; background: #fff; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 11px; color: var(--agent-text-muted, #9a8a7f); transition: border-color .14s; }
.etm-search:focus-within { border-color: var(--agent-coral-deep, #E2452A); }
.etm-search input { flex: 1; border: 0; outline: 0; background: none; font-size: 14px; color: var(--agent-text-primary, #2D1810); }
.etm-create { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 650; color: #fff; background: var(--agent-btn-bg, linear-gradient(180deg,#FF8A65,#E2452A)); border: 0; border-radius: 11px; padding: 10px 15px; cursor: pointer; box-shadow: var(--agent-btn-shadow, 0 4px 14px rgba(226,69,42,0.26)); white-space: nowrap; }
.etm-create:hover { filter: brightness(1.03); }
.etm-loading { display: flex; align-items: center; gap: 9px; color: var(--agent-text-muted); font-size: 14px; padding: 40px 0; justify-content: center; }
.etm-list { display: flex; flex-direction: column; }
.etm-row { display: grid; grid-template-columns: 1fr auto 40px; align-items: center; gap: 14px; padding: 13px 10px; border-bottom: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.07)); cursor: pointer; border-radius: 10px; transition: background .13s; }
.etm-row:not(.etm-head):hover { background: var(--agent-hover-shade, rgba(45,24,16,0.05)); }
.etm-head { cursor: default; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--agent-text-muted, #9a8a7f); }
.etm-head:hover { background: none; }
.etm-name-cell { display: flex; align-items: center; gap: 12px; min-width: 0; }
.etm-doc { width: 34px; height: 34px; flex-shrink: 0; display: grid; place-items: center; border-radius: 9px; background: var(--agent-hover-shade-strong, rgba(45,24,16,0.08)); color: var(--agent-text-tertiary, #7A4A2E); }
.etm-name-text { min-width: 0; }
.etm-name { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 650; color: var(--agent-text-primary, #2D1810); }
.etm-desc { display: block; font-size: 12.5px; color: var(--agent-text-muted, #9a8a7f); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 420px; }
.etm-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.1)); }
.etm-chip-co { color: var(--agent-text-secondary, #5A3A28); background: var(--agent-hover-shade-strong, rgba(45,24,16,0.08)); }
.etm-chip-me { color: var(--agent-text-muted, #9a8a7f); background: transparent; }
.etm-upd { font-size: 13px; color: var(--agent-text-muted, #9a8a7f); white-space: nowrap; }
.etm-empty { text-align: center; padding: 48px 20px; }
.etm-empty-ic { width: 58px; height: 58px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 16px; background: var(--agent-hover-shade-strong, rgba(45,24,16,0.08)); color: var(--agent-text-tertiary, #7A4A2E); }
.etm-empty-h { font-size: 17px; font-weight: 720; color: var(--agent-text-primary, #2D1810); }
.etm-empty-p { font-size: 13.5px; color: var(--agent-text-secondary, #5A3A28); max-width: 340px; margin: 6px auto 18px; line-height: 1.5; }

.etm-ov { position: fixed; inset: 0; z-index: 1400; background: rgba(20,14,10,0.42); backdrop-filter: blur(3px); display: grid; place-items: center; padding: 24px; animation: etm-fade .16s ease; }
@keyframes etm-fade { from { opacity: 0; } }
.etm-modal { width: min(940px, 100%); max-height: 92vh; display: flex; flex-direction: column; background: var(--agent-bg-paper, #FFFBF5); border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 18px; box-shadow: 0 30px 80px rgba(20,14,10,0.34); overflow: hidden; animation: etm-pop .18s cubic-bezier(.2,.8,.3,1); }
@keyframes etm-pop { from { opacity: 0; transform: scale(.97) translateY(6px); } }
.etm-modal-hd { display: flex; align-items: center; gap: 11px; padding: 16px 18px; border-bottom: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); }
.etm-modal-ic { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: var(--agent-hover-shade-strong, rgba(45,24,16,0.08)); color: var(--agent-coral-deep, #E2452A); }
.etm-modal-title { font-size: 16px; font-weight: 700; color: var(--agent-text-primary, #2D1810); }
.etm-x { margin-left: auto; width: 30px; height: 30px; display: grid; place-items: center; border: 0; background: none; border-radius: 8px; color: var(--agent-text-muted); cursor: pointer; transition: background .13s; }
.etm-x:hover { background: var(--agent-hover-shade); }
.etm-modal-body { display: grid; grid-template-columns: 1fr 0.82fr; gap: 0; overflow: hidden; flex: 1; min-height: 0; }
.etm-form { padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
.etm-field { display: block; }
.etm-label { display: block; font-size: 12px; font-weight: 700; color: var(--agent-text-secondary, #5A3A28); margin-bottom: 6px; }
.etm-req { color: var(--agent-coral-deep, #E2452A); }
.etm-hint { font-weight: 500; color: var(--agent-text-muted, #9a8a7f); }
.etm-input { width: 100%; box-sizing: border-box; font-size: 14px; padding: 10px 12px; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 10px; color: var(--agent-text-primary, #2D1810); outline: none; background: #fff; transition: border-color .14s; }
.etm-input:focus { border-color: var(--agent-coral-deep, #E2452A); }
.etm-input-sm { font-size: 13px; padding: 8px 10px; }
.etm-seg { display: inline-flex; gap: 5px; background: var(--agent-hover-shade, rgba(45,24,16,0.05)); padding: 4px; border-radius: 11px; }
.etm-seg-b { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--agent-text-secondary, #5A3A28); background: none; border: 1px solid transparent; border-radius: 8px; padding: 7px 13px; cursor: pointer; transition: all .14s; }
.etm-seg-b.on { background: #fff; border-color: var(--agent-coral-deep, #E2452A); color: var(--agent-coral-deep, #E2452A); box-shadow: 0 1px 4px rgba(20,14,10,0.08); }

.etm-prev { border-left: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); background: var(--agent-hover-shade, rgba(45,24,16,0.035)); display: flex; flex-direction: column; min-height: 0; }
.etm-prev-hd { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); }
.etm-prev-ttl { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--agent-text-muted, #9a8a7f); }
.etm-prev-file { position: relative; }
.etm-prev-pick { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--agent-text-secondary, #5A3A28); background: #fff; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 9px; padding: 6px 10px; cursor: pointer; max-width: 240px; }
.etm-prev-pick:hover { background: var(--agent-hover-shade); }
.etm-prev-pop { position: absolute; top: calc(100% + 6px); right: 0; width: 280px; background: #fff; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 12px; box-shadow: 0 14px 40px rgba(45,24,16,0.16); padding: 8px; z-index: 20; }
.etm-prev-res { max-height: 220px; overflow-y: auto; margin-top: 7px; }
.etm-prev-res-i { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; background: none; border-radius: 9px; cursor: pointer; }
.etm-prev-res-i:hover { background: var(--agent-hover-shade); }
.etm-prev-res-l1 { display: block; font-size: 13px; font-weight: 600; color: var(--agent-text-primary, #2D1810); }
.etm-prev-res-l2 { display: block; font-size: 11.5px; color: var(--agent-text-muted, #9a8a7f); }
.etm-prev-none { font-size: 12.5px; color: var(--agent-text-muted); padding: 10px; text-align: center; }
.etm-prev-body { padding: 18px; overflow-y: auto; flex: 1; }
.etm-prev-note { font-size: 12.5px; color: var(--agent-text-muted, #9a8a7f); line-height: 1.55; margin-bottom: 14px; }
.etm-prev-subj { font-size: 13px; color: var(--agent-text-primary, #2D1810); font-weight: 600; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); }
.etm-prev-subj span { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--agent-text-muted); margin-bottom: 3px; }
.etm-prev-email { font-size: 14px; line-height: 1.6; color: var(--agent-text-primary, #2D1810); }
.etm-prev-email p { margin: 0 0 11px; }
.etm-prev-email ul { padding-left: 20px; margin: 4px 0 11px; }
.etm-prev-missing { margin-top: 14px; font-size: 12px; color: #B45309; }

.etm-modal-ft { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); background: #fff; }
.etm-btn-ghost { font-size: 13.5px; font-weight: 600; color: var(--agent-text-secondary, #5A3A28); background: none; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 10px; padding: 9px 16px; cursor: pointer; transition: background .13s; }
.etm-btn-ghost:hover { background: var(--agent-hover-shade); }
.etm-btn-primary { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 650; color: #fff; background: var(--agent-btn-bg, linear-gradient(180deg,#FF8A65,#E2452A)); border: 0; border-radius: 10px; padding: 9px 18px; cursor: pointer; box-shadow: var(--agent-btn-shadow, 0 4px 14px rgba(226,69,42,0.26)); }
.etm-btn-primary:disabled { opacity: 0.7; cursor: default; }
.etm-btn-danger { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 650; color: #fff; background: #C0392B; border: 0; border-radius: 10px; padding: 9px 16px; cursor: pointer; }
.etm-btn-danger:disabled { opacity: 0.7; }

.etm-ov-confirm { z-index: 1600; }
.etm-confirm { width: min(420px, 100%); background: var(--agent-bg-paper, #FFFBF5); border-radius: 16px; padding: 22px; box-shadow: 0 30px 80px rgba(20,14,10,0.34); animation: etm-pop .18s cubic-bezier(.2,.8,.3,1); }
.etm-confirm-h { font-size: 16px; font-weight: 720; color: var(--agent-text-primary, #2D1810); }
.etm-confirm-b { font-size: 13.5px; color: var(--agent-text-secondary, #5A3A28); line-height: 1.55; margin: 8px 0 18px; }
.etm-confirm-ft { display: flex; justify-content: flex-end; gap: 10px; }

@media (max-width: 760px) {
  .etm-modal-body { grid-template-columns: 1fr; }
  .etm-prev { border-left: 0; border-top: 1px solid var(--agent-border-subtle); }
  .etm-desc { max-width: 200px; }
}
`;
