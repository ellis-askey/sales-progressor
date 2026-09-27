"use client";

import { useRouter } from "next/navigation";

// Generic Command Centre filter dropdown. Each option carries its fully-built
// href so the navigation logic stays on the server page; this only fires the
// navigation on change. Used to replace rows of filter pills (Files, Agencies).
export function FilterSelect({
  label,
  options,
  current,
}: {
  label: string;
  options: { value: string; label: string; href: string }[];
  current: string;
}) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">{label}</span>
      <select
        value={current}
        aria-label={label}
        onChange={(e) => {
          const next = options.find((o) => o.value === e.target.value);
          if (next) router.push(next.href);
        }}
        className="text-[12.5px] font-medium bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-md pl-2.5 pr-7 py-1.5 cursor-pointer hover:border-neutral-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 appearance-none bg-no-repeat bg-[right_0.5rem_center] bg-[length:9px] bg-[image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 8%22 fill=%22none%22 stroke=%22%23a3a3a3%22 stroke-width=%221.6%22><path d=%22M1 1.5l5 5 5-5%22/></svg>')]"
      >
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
