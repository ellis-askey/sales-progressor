"use client";

// The Command Centre's canonical single-select radio. Mirrors the structure of
// the arc RadioGroup (a dot that fills on the chosen row) but renders in the CC
// visual system — dark surface, blue accent, hairline borders, no glass (Law 9),
// so it can't reuse the coral-gradient agent-app component. Vertical so longer
// labels ("Sales Prog Companies") read cleanly in the 220px sidebar.

export interface CommandRadioOption {
  value: string;
  label: string;
  /** Optional one-line clarifier under the label. */
  hint?: string;
}

export function CommandRadioGroup({
  label,
  options,
  value,
  onChange,
  name = "command-radio",
}: {
  label?: string;
  options: CommandRadioOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1" data-name={name}>
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className={`group flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 rounded-md border transition-colors ${
              checked
                ? "bg-[#1d2d50] border-[#2563eb]/40 text-[#93c5fd]"
                : "bg-[#1a1a1a] border-[#262626] text-[#737373] hover:text-[#d4d4d4] hover:border-[#333333]"
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                checked ? "border-[#2563eb]" : "border-[#404040] group-hover:border-[#525252]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full bg-[#2563eb] transition-transform duration-150 motion-reduce:transition-none ${
                  checked ? "scale-100" : "scale-0"
                }`}
              />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] font-medium leading-tight truncate">{o.label}</span>
              {o.hint && <span className="block text-[10px] text-[#525252] leading-tight mt-0.5 truncate">{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
