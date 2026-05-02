export default function ContentPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Content</h1>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-8 max-w-lg">
        <p className="text-sm font-semibold text-neutral-300 mb-2">LinkedIn automation not yet built</p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          See ADMIN_05 for the three-mode publishing system (draft only, draft + scheduled approval,
          fully automated). When built, this tab shows: stream control panel, approval queue, and
          post performance.
        </p>
        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] text-neutral-600 font-semibold uppercase tracking-wider">Pending decisions</p>
          {[
            "LinkedIn API path: official Marketing API vs third-party scheduler (ADMIN_05 §3)",
            "LinkedIn account(s): personal page, company page, or both",
            "Initial content streams (2–4 names + cadences)",
            "Voice samples: 5–10 existing posts for style reference",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span className="mt-1 w-1 h-1 rounded-full bg-neutral-700 shrink-0" />
              <span className="text-xs text-neutral-600">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
