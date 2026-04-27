import { HardHat } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/session";

export const metadata = {
  title: "Exchanges · Sales Progressor",
  description: "Files moving toward exchange — coming soon.",
};

export default async function AgentExchangesPage() {
  await requireSession();

  return (
    <>
      {/* Page header — matches Completions structure */}
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>Exchanges</h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>Files moving toward exchange.</p>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="px-4 md:px-8 py-16 flex flex-col items-center justify-center text-center">
        <HardHat size={44} weight="thin" style={{ color: "rgba(15,23,42,0.18)", marginBottom: 20 }} />
        <p className="text-base font-medium text-slate-900/50 mb-2">Exchanges page coming soon</p>
        <p className="text-sm text-slate-900/35 max-w-xs leading-relaxed">
          This is where you&apos;ll see your active files grouped by predicted exchange date — overdue, this week, next week, and beyond.
        </p>
        <p className="text-sm text-slate-900/30 mt-3">We&apos;re building this next.</p>
      </div>
    </>
  );
}
