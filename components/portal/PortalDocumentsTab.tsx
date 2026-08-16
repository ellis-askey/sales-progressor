"use client";

// Documents tab (Batch 2, 2026-08-17). Lives inside the client menu's tabs.
// Shows the MOS (from the agent) pinned, the client's own uploads + anything the
// other side shared, a "ready to add" checklist for their side, and an "Add
// document" flow (Category -> Specific document -> file). Clients can share a
// doc with the other side (with a transparency note that we can always see it),
// download it, or remove their own via a 3-dot menu.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThree, DownloadSimple, Trash, Plus, FileText, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";
import { getMyPortalDocumentsAction, portalDeleteDocument, portalToggleDocumentShare } from "@/app/actions/portal";
import { categoriesFor, isDocShareable } from "@/lib/portal-documents";
import type { PortalDocumentsData, PortalDoc } from "@/lib/services/portal-documents";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PortalDocumentsTab({ token }: { token: string }) {
  const [data, setData] = useState<PortalDocumentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [preselect, setPreselect] = useState<string | null>(null);

  async function reload() {
    const d = await getMyPortalDocumentsAction(token);
    setData(d);
    setLoading(false);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const otherSide = data?.role === "seller" ? "buyer" : "seller";

  if (loading) {
    return <p className="text-[13px] py-6 text-center" style={{ color: P.textMuted }}>Loading your documents…</p>;
  }
  if (!data) {
    return <p className="text-[13px] py-6 text-center" style={{ color: P.textMuted }}>We couldn&apos;t load your documents.</p>;
  }

  const mos = data.documents.find((d) => d.isMos) ?? null;
  const rest = data.documents.filter((d) => !d.isMos);

  return (
    <div className="pb-4">
      {mos && (
        <>
          <Eyebrow>Memorandum of sale</Eyebrow>
          <DocRow doc={mos} token={token} otherSide={otherSide} onChanged={reload} />
        </>
      )}

      <div className="flex items-center justify-between mt-5 mb-2.5 px-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.09em]" style={{ color: P.textMuted }}>Your documents</p>
        <button
          type="button"
          onClick={() => { setPreselect(null); setAddOpen(true); }}
          className="pbtn-press inline-flex items-center gap-1.5 text-[13px] font-bold"
          style={{ color: P.primary }}
        >
          <Plus size={15} weight="bold" /> Add document
        </button>
      </div>

      {rest.length === 0 ? (
        <div className="rounded-2xl px-4 py-6 text-center" style={{ border: `1px dashed ${P.border}` }}>
          <p className="text-[13px]" style={{ color: P.textMuted }}>Nothing added yet. Use “Add document” to upload.</p>
        </div>
      ) : (
        rest.map((doc) => <DocRow key={doc.id} doc={doc} token={token} otherSide={otherSide} onChanged={reload} />)
      )}

      {data.readyToAdd.length > 0 && (
        <>
          <Eyebrow className="mt-5">Ready to add</Eyebrow>
          {data.readyToAdd.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => { setPreselect(r.key); setAddOpen(true); }}
              className="pbtn-press w-full flex items-center gap-3 mb-2.5 rounded-2xl px-4 py-3.5 text-left"
              style={{ background: P.cardBg, border: `1px dashed ${P.border}` }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: P.pageBg, color: P.textMuted }}>
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: P.textPrimary }}>{r.label}</p>
                {r.category && <p className="text-[11px]" style={{ color: P.textMuted }}>{r.category}</p>}
              </div>
              <Plus size={18} weight="bold" style={{ color: P.primary, flexShrink: 0 }} />
            </button>
          ))}
        </>
      )}

      {data.role === "buyer" && (
        <div className="mt-4 rounded-2xl px-4 py-3.5 flex items-start gap-2.5" style={{ background: P.accentBg }}>
          <ShieldCheck size={18} weight="fill" style={{ color: P.accent, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[12.5px] leading-relaxed" style={{ color: P.textSecondary }}>
            Your solicitor and agent will ask you for ID and proof of funds directly. For your security, please don&apos;t upload those here.
          </p>
        </div>
      )}

      {addOpen && typeof document !== "undefined" &&
        createPortal(<AddSheet token={token} data={data} preselect={preselect} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); reload(); }} />, document.body)}
    </div>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.09em] mb-2.5 px-1 ${className ?? ""}`} style={{ color: P.textMuted }}>
      {children}
    </p>
  );
}

function DocRow({ doc, token, otherSide, onChanged }: { doc: PortalDoc; token: string; otherSide: string; onChanged: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const canShare = doc.mine && isDocShareable(doc.docType);
  const actionCount = (doc.url ? 1 : 0) + (doc.mine ? 1 : 0);
  const meta = [doc.category, fmtDate(doc.createdAt), doc.fromOtherSide ? `Shared by the ${otherSide}` : null].filter(Boolean).join(" · ");
  const inner = (
    <>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: P.accentBg, color: P.accent }}>
        <FileText size={18} weight="fill" />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold truncate" style={{ color: P.textPrimary }}>{doc.label}</p>
        <p className="text-[11px]" style={{ color: P.textMuted }}>{meta}</p>
      </div>
    </>
  );

  function openMenu() {
    setConfirmRemove(false);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 176;
    const h = actionCount * 46 + 8;
    // Flip up when there isn't room below (the drawer sits at the bottom).
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ top, left: Math.max(8, r.right - width) });
    setMenuOpen(true);
  }

  async function toggleShare() {
    setBusy(true);
    try { await portalToggleDocumentShare({ token, docId: doc.id, shared: !doc.shared }); onChanged(); }
    finally { setBusy(false); }
  }
  async function remove() {
    setMenuOpen(false);
    setBusy(true);
    try { await portalDeleteDocument({ token, docId: doc.id }); onChanged(); }
    finally { setBusy(false); }
  }

  return (
    <div className="mb-2.5 rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        {doc.url ? (
          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 min-w-0" style={{ textDecoration: "none" }}>
            {inner}
          </a>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">{inner}</div>
        )}
        {actionCount > 0 && (
          <div className="flex-shrink-0">
            <button
              ref={btnRef}
              type="button"
              onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
              aria-label="Document options"
              className="pbtn-press w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ color: P.textMuted }}
            >
              <DotsThree size={22} weight="bold" />
            </button>
          </div>
        )}
        {menuOpen && pos && typeof document !== "undefined" && createPortal(
          <>
            <div className="fixed inset-0 z-[75]" onClick={() => setMenuOpen(false)} />
            <div
              className="fixed z-[76] rounded-xl overflow-hidden"
              style={{ top: pos.top, left: pos.left, background: "#fff", boxShadow: P.shadowXl, border: `1px solid ${P.border}`, minWidth: 176 }}
            >
              {confirmRemove ? (
                <div className="px-4 py-3.5" style={{ minWidth: 200 }}>
                  <p className="text-[13px] font-semibold mb-2.5" style={{ color: P.textPrimary }}>Remove this document?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="pbtn-press flex-1 py-2 rounded-lg text-[13px] font-semibold"
                      style={{ border: `1px solid ${P.border}`, color: P.textSecondary }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={remove}
                      disabled={busy}
                      className="pbtn-press flex-1 py-2 rounded-lg text-[13px] font-bold text-white disabled:opacity-50"
                      style={{ background: "#DC2626" }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={doc.filename}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-[14px] font-medium"
                      style={{ color: P.textPrimary, textDecoration: "none" }}
                    >
                      <DownloadSimple size={17} /> Download
                    </a>
                  )}
                  {doc.mine && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(true)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-[14px] font-medium text-left"
                      style={{ color: "#DC2626", borderTop: doc.url ? `1px solid ${P.border}` : undefined }}
                    >
                      <Trash size={17} /> Remove
                    </button>
                  )}
                </>
              )}
            </div>
          </>,
          document.body,
        )}
      </div>

      {canShare && (
        <button
          type="button"
          onClick={toggleShare}
          disabled={busy}
          className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
          style={{ borderTop: `1px solid ${P.border}`, background: doc.shared ? P.accentBg : "transparent" }}
        >
          <span
            className="relative inline-flex flex-shrink-0 rounded-full transition-colors"
            style={{ width: 38, height: 22, background: doc.shared ? P.primary : "rgba(15,23,42,0.18)" }}
          >
            <span
              className="absolute top-0.5 rounded-full bg-white transition-all"
              style={{ width: 18, height: 18, left: doc.shared ? 18 : 2, boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold" style={{ color: P.textPrimary }}>
              Share with the {otherSide}
            </span>
            <span className="block text-[11.5px] leading-snug" style={{ color: P.textMuted }}>
              Your team can always see this. Turn on to also share it with the {otherSide}.
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

function AddSheet({
  token,
  data,
  preselect,
  onClose,
  onDone,
}: {
  token: string;
  data: PortalDocumentsData;
  preselect: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const cats = categoriesFor(data.role, data.tenure);
  const preCat = preselect ? cats.find((c) => c.docs.some((d) => d.key === preselect)) : null;
  const [catKey, setCatKey] = useState<string>(preCat?.key ?? cats[0]?.key ?? "");
  const [docKey, setDocKey] = useState<string>(preselect ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCat = cats.find((c) => c.key === catKey) ?? cats[0];

  async function upload() {
    if (!file || !docKey) { setError("Pick a document type and a file."); return; }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("files", file);
      fd.append("docType", docKey);
      const res = await fetch(`/api/portal/documents?token=${encodeURIComponent(token)}`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Upload failed. Please try again.");
        return;
      }
      onDone();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end" onClick={onClose}>
      <div className="portal-sheet-backdrop absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
      <div
        className="portal-sheet relative w-full max-w-lg mx-auto"
        style={{ background: "#fff", borderRadius: `${P.radiusXl} ${P.radiusXl} 0 0`, boxShadow: P.shadowXl, paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(139,145,163,0.30)" }} />
        </div>
        <div className="px-6 pt-2 pb-6">
          <p className="text-[18px] font-bold mb-4" style={{ color: P.textPrimary }}>Add a document</p>

          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: P.textSecondary }}>Category</label>
          <select
            value={catKey}
            onChange={(e) => { setCatKey(e.target.value); setDocKey(""); }}
            className="w-full mb-4 rounded-xl px-3 py-3 text-[14px] font-medium"
            style={{ border: `1px solid ${P.border}`, background: P.pageBg, color: P.textPrimary }}
          >
            {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>

          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: P.textSecondary }}>Document</label>
          <select
            value={docKey}
            onChange={(e) => setDocKey(e.target.value)}
            className="w-full mb-4 rounded-xl px-3 py-3 text-[14px] font-medium"
            style={{ border: `1px solid ${P.border}`, background: P.pageBg, color: P.textPrimary }}
          >
            <option value="">Choose a document…</option>
            {activeCat?.docs.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>

          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: P.textSecondary }}>File</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full mb-2 text-[13px]"
            style={{ color: P.textSecondary }}
          />
          <p className="text-[11px] mb-4" style={{ color: P.textMuted }}>PDF, image or Word document, up to 10 MB.</p>

          {error && <p className="text-[12.5px] mb-3" style={{ color: "#DC2626" }}>{error}</p>}

          <button
            type="button"
            onClick={upload}
            disabled={uploading || !file || !docKey}
            className="pbtn pbtn-press w-full py-3.5 rounded-xl text-[15px] font-bold text-white disabled:opacity-50"
            style={{ background: P.heroGradient, boxShadow: "0 2px 8px rgba(255,107,74,0.35)" }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
