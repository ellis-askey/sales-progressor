"use client";

import { useRef, useState } from "react";
import { P } from "./portal-ui";
import { uploadDocumentDirect } from "@/lib/upload/direct-upload";
import { MAX_UPLOAD_FILES } from "@/lib/upload/document-upload";

type Props = { token: string };

type UploadState = "idle" | "uploading" | "done" | "error";

export function SearchesUpload({ token }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const list = Array.from(files).slice(0, MAX_UPLOAD_FILES);
    setState("uploading");
    setError(null);

    const done: string[] = [];
    for (const file of list) {
      const result = await uploadDocumentDirect({
        file,
        mintUrl: `/api/portal/documents/upload-url?token=${encodeURIComponent(token)}`,
        finalizeUrl: `/api/portal/documents?token=${encodeURIComponent(token)}`,
        docType: null,
      });
      if (!result.ok) {
        setState("error");
        setError(result.error);
        return;
      }
      done.push(file.name);
    }

    setState("done");
    setUploaded(done);
  }

  if (state === "done") {
    return (
      <div
        className="portal-reveal-fade mt-3 rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: P.successBg }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: P.success }}>
            Uploaded, thank you
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>
            {uploaded.join(", ")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>
        Got a copy of your survey report? Upload it here and we&apos;ll keep it on file.{" "}
        <span style={{ color: P.textMuted }}>(Optional, you don&apos;t have to.)</span>
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={state === "uploading"}
        className="pbtn pbtn-press flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-opacity disabled:opacity-50"
        style={{ background: P.accentBg, color: P.accent }}
      >
        {state === "uploading" ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Uploading…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Attach survey report
          </>
        )}
      </button>

      <p className="text-[11px]" style={{ color: P.textMuted }}>
        PDF, JPG, PNG or Word. Up to 3 files, 25 MB each
      </p>

      {error && (
        <p className="text-[12px]" style={{ color: P.warning }}>
          {error}
        </p>
      )}
    </div>
  );
}
