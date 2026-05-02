export default function FrictionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Friction</h1>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-8 max-w-lg">
        <p className="text-sm font-semibold text-neutral-300 mb-2">Friction analysis — coming soon</p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Session friction, rage-click heatmaps, and funnel abandonment will be displayed here
          once the PostHog Data Processing Agreement is signed and session recording is enabled
          in production.
        </p>
        <div className="mt-5 space-y-2">
          {["Rage-click hot spots", "Funnel abandonment by step", "Error-session rate trend", "High-friction user segments"].map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-700 shrink-0" />
              <span className="text-xs text-neutral-600">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
