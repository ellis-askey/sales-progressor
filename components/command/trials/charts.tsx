// Shared hand-rolled chart strips for the trial cockpit tabs (the Command
// Centre has no chart library — bars are divs, per the existing pulse/spark
// convention). Server-safe, command-only (Law 8).

export function LabelledBars({ items, fmt }: { items: Array<{ label: string; value: number }>; fmt: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
      <div className="flex items-end gap-2 h-28">
        {items.map((it, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
            <span className="text-[10px] text-neutral-400 tabular-nums">{it.value > 0 ? fmt(it.value) : ""}</span>
            <div
              className="w-full rounded-sm bg-blue-600/50 border-t border-blue-500/60"
              style={{ height: `${Math.max(it.value > 0 ? 5 : 2, Math.round((it.value / max) * 82))}%`, opacity: it.value > 0 ? 1 : 0.25 }}
            />
            <span className="text-[9px] text-neutral-600 truncate max-w-full">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
