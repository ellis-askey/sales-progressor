"use client";

import { useState, useTransition, useRef } from "react";
import { uploadProviderLogoAction, deleteProviderLogoAction } from "@/app/actions/provider-firms";
import { Upload, Trash2 } from "lucide-react";

export function LogoUploader({
  id,
  currentLogoUrl,
  currentLogoPath,
}: {
  id: string;
  currentLogoUrl: string | null;
  currentLogoPath: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("logo", file);
    startTransition(async () => {
      const r = await uploadProviderLogoAction(id, fd);
      if (!r.ok) setError(r.error);
      // Reset so re-picking the same file triggers change
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove() {
    if (!currentLogoPath) return;
    startTransition(async () => {
      const r = await deleteProviderLogoAction(id);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        {currentLogoUrl ? (
          <img
            src={currentLogoUrl}
            alt=""
            className="w-16 h-16 rounded-md object-cover bg-[#1a1a1a] border border-[#262626] flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-md bg-[#1a1a1a] border border-dashed border-[#404040] flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] text-[#525252] uppercase tracking-widest">None</span>
          </div>
        )}
        <div className="flex-1">
          <p className="text-[12px] text-[#a3a3a3] mb-1">
            {currentLogoUrl ? "Shown on the client picker" : "Add a logo (recommended)"}
          </p>
          <p className="text-[10px] text-[#525252]">PNG, JPEG, SVG, or WEBP. Max 500KB. Square works best.</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={pick}
              disabled={pending}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: pending ? "#404040" : "#2563eb" }}
            >
              <Upload className="w-3 h-3" />
              {pending ? "Uploading…" : currentLogoUrl ? "Replace" : "Upload logo"}
            </button>
            {currentLogoPath && (
              <button
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold text-[#a3a3a3] hover:text-[#fca5a5] transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={onFile}
        className="hidden"
      />
      {error && <p className="text-[11px] text-[#fca5a5] mt-2">{error}</p>}
    </div>
  );
}
