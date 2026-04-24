"use client";

import { useRef, useState } from "react";
import { P } from "./portal-ui";

type Props = { token: string };

type UploadState = "idle" | "uploading" | "done" | "error";

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SearchesUpload({ token }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const list = Array.from(files).slice(0, 3);
    setState("uploading");
    setError(null);

    const body = new FormData();
    list.forEach((f) => body.append("files", f));

    const res = await fetch(`/api/portal/documents?token=${token}`, {
      method: "POST",
      body,
    });

    if (res.ok) {
      setState("done");
      setUploaded(list.map((f) => f.name));
    } else {
      const json = await res.json().catch(() => ({}));
      setState("error");
      setError(json.error ?? "Upload failed — please try again.");
    }
  }

  if (state === "done") {
    return (
      <div
        className="mt-3 rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: P.successBg }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: P.success }}>
            Uploaded — thank you
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
        Got a copy of your searches? Upload them here so your solicitor and agent have them on file.{" "}
        <span style={{ color: P.textMuted }}>(Optional — you don't have to do this.)</span>
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
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-opacity disabled:opacity-50"
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
            Attach search results
          </>
        )}
      </button>

      <p className="text-[11px]" style={{ color: P.textMuted }}>
        PDF, JPG, PNG or Word — up to 3 files, 10 MB each
      </p>

      {error && (
        <p className="text-[12px]" style={{ color: P.warning }}>
          {error}
        </p>
      )}
    </div>
  );
}
