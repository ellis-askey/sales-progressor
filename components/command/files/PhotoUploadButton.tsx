"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Inline "Add photo" for the Command Centre Files tab. Uploads straight to the
// file's hero photo (POST /api/command/files/photo → sets photoStoragePath), so
// it shows everywhere the file appears, including the client portal. On success
// it refreshes the server components in place (thumbnail appears, the file
// drops off the no-photo queue).
export function PhotoUploadButton({
  transactionId,
  label = "Add photo",
}: {
  transactionId: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("transactionId", transactionId);
      fd.append("file", file);
      const res = await fetch("/api/command/files/photo", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Upload failed");
      } else {
        router.refresh();
      }
    } catch {
      setErr("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="text-[11px] font-semibold text-neutral-950 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 rounded-md px-2.5 py-1.5"
      >
        {busy ? "Uploading…" : label}
      </button>
      {err && <span className="text-[10px] text-red-400 max-w-[120px] text-right">{err}</span>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </span>
  );
}
