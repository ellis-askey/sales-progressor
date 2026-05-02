export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Automations</h1>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-8 max-w-lg">
        <p className="text-sm font-semibold text-neutral-300 mb-2">Automation Brain not yet built</p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          See ADMIN_09 for the IF/THEN rule engine. When built, this tab shows: rule list with
          fire counts, rule editor, per-rule fire log, and health view (suppression rate,
          bounce/spam trends).
        </p>
        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] text-neutral-600 font-semibold uppercase tracking-wider">Pending before build</p>
          {[
            "Codebase email collision discovery (ADMIN_09 §10) — run the discovery prompt first",
            "Channel decisions after conflict matrix is reviewed (ADMIN_09 §11)",
            "Approval of proposed default rule set (ADMIN_09 §9)",
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
