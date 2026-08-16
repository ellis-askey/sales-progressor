"use client";

// Agent-side document upload (Batch 2 follow-up, 2026-08-17). An "Add document"
// button opens a modal where the agent picks Category -> Specific document (the
// full taxonomy, both sides) and a file. The chosen type is stored as docType,
// so the client's Documents tab shows "Contract", "Searches", etc. instead of a
// generic "Document".

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DOCUMENT_CATEGORIES } from "@/lib/portal-documents";

export function AgentDocumentUpload({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [catKey, setCatKey] = useState(DOCUMENT_CATEGORIES[0].key);
  const [docKey, setDocKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cat = DOCUMENT_CATEGORIES.find((c) => c.key === catKey) ?? DOCUMENT_CATEGORIES[0];

  function reset() {
    setCatKey(DOCUMENT_CATEGORIES[0].key);
    setDocKey("");
    setFile(null);
    setError(null);
  }

  async function upload() {
    if (!file || !docKey) { setError("Pick a document type and a file."); return; }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("files", file);
      fd.append("docType", docKey);
      const res = await fetch(`/api/transactions/${transactionId}/documents`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Upload failed. Please try again.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    width: "100%", borderRadius: 10, padding: "10px 12px", fontSize: 14,
    border: "1px solid rgba(15,23,42,0.14)", background: "#fff", color: "#0f172a",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-semibold agent-link-primary"
      >
        + Add document
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.40)" }} />
          <div
            className="relative w-full max-w-md rounded-2xl p-5"
            style={{ background: "#fff", boxShadow: "0 24px 60px rgba(15,23,42,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-bold mb-4" style={{ color: "#0f172a" }}>Add a document</p>

            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(15,23,42,0.55)" }}>Category</label>
            <select value={catKey} onChange={(e) => { setCatKey(e.target.value); setDocKey(""); }} style={{ ...selectStyle, marginBottom: 14 }}>
              {DOCUMENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>

            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(15,23,42,0.55)" }}>Document</label>
            <select value={docKey} onChange={(e) => setDocKey(e.target.value)} style={{ ...selectStyle, marginBottom: 14 }}>
              <option value="">Choose a document…</option>
              {cat.docs.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>

            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(15,23,42,0.55)" }}>File</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-[13px] mb-1"
              style={{ color: "rgba(15,23,42,0.7)" }}
            />
            <p className="text-[11px] mb-4" style={{ color: "rgba(15,23,42,0.45)" }}>PDF, image or Word document, up to 10 MB.</p>

            {error && <p className="text-[12.5px] mb-3" style={{ color: "#DC2626" }}>{error}</p>}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold"
                style={{ border: "1px solid rgba(15,23,42,0.14)", color: "rgba(15,23,42,0.65)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={upload}
                disabled={uploading || !file || !docKey}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-bold text-white disabled:opacity-50"
                style={{ background: "var(--agent-coral, #FF6B4A)" }}
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
