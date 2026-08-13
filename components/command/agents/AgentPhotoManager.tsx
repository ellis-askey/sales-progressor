"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Founder control to set + re-centre an agent's photo (Command Centre → agent
// drill-down). Upload replaces User.image everywhere; the focal point is
// click-to-set on the full image with a live circular preview, saved as
// imageFocusX/Y and applied via object-position wherever the avatar renders.
export function AgentPhotoManager({
  userId,
  name,
  image,
  focusX,
  focusY,
}: {
  userId: string;
  name: string;
  image: string | null;
  focusX: number;
  focusY: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const [img, setImg] = useState<string | null>(image);
  const [fx, setFx] = useState(focusX);
  const [fy, setFy] = useState(focusY);
  const [savedFx, setSavedFx] = useState(focusX);
  const [savedFy, setSavedFy] = useState(focusY);
  const [uploading, setUploading] = useState(false);
  const [savingPos, setSavingPos] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = fx !== savedFx || fy !== savedFy;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/command/agents/${userId}/photo`, { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Upload failed");
      } else {
        const d = await res.json();
        setImg(d.url ?? null);
        setFx(50); setFy(50); setSavedFx(50); setSavedFy(50);
        router.refresh();
      }
    } catch {
      setErr("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function pointToFocus(clientX: number, clientY: number) {
    const el = imgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, Math.round(((clientX - r.left) / r.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - r.top) / r.height) * 100)));
    setFx(x); setFy(y);
  }

  async function savePosition() {
    setSavingPos(true);
    setErr(null);
    try {
      const res = await fetch(`/api/command/agents/${userId}/focus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusX: fx, focusY: fy }),
      });
      if (!res.ok) {
        setErr("Couldn't save the position");
      } else {
        setSavedFx(fx); setSavedFy(fy);
        router.refresh();
      }
    } catch {
      setErr("Couldn't save the position");
    } finally {
      setSavingPos(false);
    }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-start gap-5 flex-wrap">
        {/* live circular preview — exactly how it renders everywhere */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-[88px] h-[88px] rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 flex items-center justify-center">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${fx}% ${fy}%` }} />
            ) : (
              <span className="text-lg font-bold text-neutral-500">{initials(name)}</span>
            )}
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-600">Preview</span>
        </div>

        {/* editor */}
        <div className="flex-1 min-w-[220px]">
          {img ? (
            <>
              <p className="text-[12px] text-neutral-400 mb-2">Click or drag on the photo to centre the face.</p>
              <div
                ref={imgRef}
                onPointerDown={(e) => { setDragging(true); (e.target as HTMLElement).setPointerCapture(e.pointerId); pointToFocus(e.clientX, e.clientY); }}
                onPointerMove={(e) => { if (dragging) pointToFocus(e.clientX, e.clientY); }}
                onPointerUp={() => setDragging(false)}
                className="relative inline-block max-w-full rounded-lg overflow-hidden border border-neutral-800 cursor-crosshair select-none touch-none"
                style={{ maxHeight: 260 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="block max-h-[260px] w-auto max-w-full pointer-events-none" draggable={false} />
                <span
                  className="absolute w-6 h-6 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.5)] pointer-events-none -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${fx}%`, top: `${fy}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500 mb-3">No photo yet.</p>
          )}

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="text-xs font-semibold text-neutral-950 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 rounded-md px-3 py-1.5"
            >
              {uploading ? "Uploading…" : img ? "Replace photo" : "Upload photo"}
            </button>
            {img && (
              <button
                type="button"
                disabled={!dirty || savingPos}
                onClick={() => { void savePosition(); }}
                className="text-xs font-semibold rounded-md px-3 py-1.5 disabled:opacity-40 border border-neutral-700 text-neutral-200 enabled:hover:bg-neutral-800 disabled:cursor-default"
              >
                {savingPos ? "Saving…" : dirty ? "Save position" : "Position saved"}
              </button>
            )}
            {err && <span className="text-[11px] text-red-400">{err}</span>}
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </div>
      </div>
    </div>
  );
}
