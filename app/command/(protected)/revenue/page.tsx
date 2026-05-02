export default function RevenuePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Revenue</h1>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-8 max-w-lg">
        <p className="text-sm font-semibold text-neutral-300 mb-2">Revenue tracking not yet wired</p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Required: billing system integration. When billing exists, this tab will show MRR (SP plan
          revenue + PM service revenue), new / expansion / churn / contraction, LTV per cohort,
          per-agency revenue, and outstanding invoices.
        </p>
        <p className="text-xs text-neutral-700 mt-4">See ADMIN_01 §4.13 and ROADMAP.</p>
      </div>
    </div>
  );
}
