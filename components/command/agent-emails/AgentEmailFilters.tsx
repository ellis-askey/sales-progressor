"use client";

// Recipient search for the agent-emails list. Agency scoping is handled by the
// global sidebar scope (?agency), so this only adds a name/email search. Pushes
// ?rec= and clears any cursor so the search starts from the first page.

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export function AgentEmailFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("rec") ?? "";
  const [value, setValue] = useState(current);

  // Keep the box in step if the URL changes from elsewhere (e.g. tab switch).
  useEffect(() => {
    setValue(current);
  }, [current]);

  function apply(next: string) {
    const p = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) p.set("rec", trimmed);
    else p.delete("rec");
    p.delete("cursor");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply(value);
      }}
      className="relative w-full max-w-xs"
    >
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" strokeWidth={2} />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search recipient name or email"
        className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#2563eb]/50"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            apply("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      )}
    </form>
  );
}
