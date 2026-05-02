export default function RevenuePage() {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl px-6 py-8 max-w-lg">
        <p className="text-sm font-semibold text-white/70 mb-2">Revenue tracking not yet wired</p>
        <p className="text-xs text-white/40 leading-relaxed">
          Required: billing system integration. When billing exists, this tab will show MRR (SP plan
          revenue + PM service revenue), new / expansion / churn / contraction, LTV per cohort,
          per-agency revenue, and outstanding invoices.
        </p>
        <p className="text-xs text-white/25 mt-4">See ADMIN_01 §4.13 and ROADMAP.</p>
      </div>
    </div>
  );
}
