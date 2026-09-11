"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAutopilotLevelAction } from "@/app/actions/content-settings";
import { AUTOPILOT_LEVELS, AUTOPILOT_GUARDRAILS } from "@/lib/command/content/autopilot";

// Autopilot settings (docs/active/content-brand/SPEC.md, Phase 5.2). Levels
// govern how much the system prepares and schedules. Nothing publishes on its
// own until a platform is connected (Phase 6), so this is an honest gate.

export function AutopilotSettings({ level }: { level: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(id: string) {
    if (id === level) return;
    const fd = new FormData();
    fd.set("level", id);
    startTransition(async () => {
      const res = await setAutopilotLevelAction(fd);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {AUTOPILOT_LEVELS.map((l) => {
          const on = l.id === level;
          return (
            <button
              key={l.id}
              onClick={() => choose(l.id)}
              disabled={pending}
              className={`rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-60 ${on ? "border-blue-600/50 bg-blue-950/20" : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"}`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${on ? "border-blue-500 bg-blue-600" : "border-neutral-600"}`}>
                  {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-[13px] font-semibold text-neutral-100">{l.label}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{l.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-4">
        <p className="text-[12px] font-medium text-amber-300">Nothing publishes on its own yet</p>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
          Even on Autopilot, posts are only prepared and scheduled. Nothing goes live until you connect a platform
          (Phase 6). And at every level, these never publish without your explicit approval:
        </p>
        <ul className="mt-2 space-y-1">
          {AUTOPILOT_GUARDRAILS.map((g) => (
            <li key={g} className="flex gap-2 text-[12px] leading-relaxed text-neutral-400">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500/70" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
