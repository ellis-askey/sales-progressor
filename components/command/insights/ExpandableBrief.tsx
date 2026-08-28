"use client";

import { useState } from "react";

export function ExpandableBrief({
  title,
  subject,
  content,
  sentAt,
  empty,
}: {
  title: string;
  subject?: string | null;
  content?: string | null;
  sentAt?: string | null;
  empty: string;
}) {
  const [open, setOpen] = useState(false);
  const long = !!content && content.length > 420;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 flex flex-col gap-2 min-h-[160px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">{title}</p>
        {sentAt && <p className="text-[10px] text-neutral-600">{sentAt}</p>}
      </div>
      {subject && <p className="text-xs font-medium text-neutral-200">{subject}</p>}
      {content ? (
        <>
          <p
            className={`text-xs text-neutral-400 leading-relaxed whitespace-pre-line flex-1 ${
              open ? "" : "line-clamp-8"
            }`}
          >
            {content}
          </p>
          {long && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="self-start text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              {open ? "Show less" : "Read full"}
            </button>
          )}
        </>
      ) : (
        <p className="text-xs text-neutral-600 italic flex-1">{empty}</p>
      )}
    </div>
  );
}
