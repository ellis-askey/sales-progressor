// THROWAWAY — Light variant A/B. Delete after review. No design-system changes here.

import { PropertyHero } from "@/components/transaction/PropertyHero";
import { PropertyFileTabs } from "@/components/transaction/PropertyFileTabs";

const MOCK_EXCHANGE = new Date(Date.now() + 12 * 86_400_000);

// Stable Unsplash photo: modern white minimalist living room
const LIGHT_BG = "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1920&q=80";

function PlaceholderCard({ label }: { label: string }) {
  return (
    <div className="glass-card rounded-[20px] p-5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-slate-900/40 mb-3">{label}</p>
      <div className="space-y-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-3 rounded-full bg-slate-900/06" style={{ width: `${85 - n * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

function MilestonesPlaceholder() {
  return (
    <div className="space-y-3">
      <PlaceholderCard label="Conveyancing" />
      <PlaceholderCard label="Searches & Enquiries" />
      <PlaceholderCard label="Exchange & Completion" />
    </div>
  );
}

function SidebarPlaceholder() {
  return (
    <div className="space-y-3">
      <div className="glass-card rounded-[20px] p-5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-slate-900/40 mb-3">Progress</p>
        <div className="flex items-center justify-center h-24">
          <div className="w-20 h-20 rounded-full border-4 border-blue-500/30 flex items-center justify-center">
            <span className="text-xl font-bold text-slate-900/70 tabular-nums">68%</span>
          </div>
        </div>
      </div>
      <div className="glass-card rounded-[20px] p-5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-slate-900/40 mb-2">Assigned to</p>
        <p className="text-sm font-medium text-slate-900/80">Sarah Mitchell</p>
      </div>
    </div>
  );
}

const TABS = [
  { key: "milestones", label: "Milestones", badge: 3 },
  { key: "contacts",   label: "Contacts" },
  { key: "comms",      label: "Comms" },
  { key: "notes",      label: "Notes" },
];

export default function PreviewHeroLightPage() {
  return (
    <>
      {/*
       * Scoped overrides for the light variant — all inside .light-variant.
       * Replaces glass-panel-dark with a light frosted equivalent.
       * Text colours inverted: white → near-black on the hero panel.
       * Tab bar switches to light glass (no .glass-page dark override since
       * we omit that class here).
       */}
      <style>{`
        /* ── Hero panel: light frosted glass ── */
        .light-variant .glass-panel-dark {
          background: rgba(255, 255, 255, 0.60) !important;
          backdrop-filter: blur(32px) saturate(200%) brightness(1.06) !important;
          -webkit-backdrop-filter: blur(32px) saturate(200%) brightness(1.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.55) !important;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.08),
            0 2px 8px rgba(0, 0, 0, 0.04),
            inset 2px 2px 12px rgba(255, 255, 255, 0.70),
            inset -1px -1px 3px rgba(0, 0, 0, 0.02) !important;
        }

        /* Hide dark decorative glows — wrong colour temperature for light panel */
        .light-variant .glass-panel-dark > div:nth-child(2),
        .light-variant .glass-panel-dark > div:nth-child(3) { opacity: 0 !important; }

        /* ── Text: white → dark on light glass ── */
        .light-variant .glass-panel-dark .text-white       { color: rgba(13, 17, 23, 0.92) !important; }
        .light-variant .glass-panel-dark .text-slate-100   { color: rgba(13, 17, 23, 0.88) !important; }
        .light-variant .glass-panel-dark .text-slate-200   { color: rgba(13, 17, 23, 0.72) !important; }
        .light-variant .glass-panel-dark .text-slate-400   { color: rgba(13, 17, 23, 0.55) !important; }
        .light-variant .glass-panel-dark .text-slate-500   { color: rgba(13, 17, 23, 0.45) !important; }
        .light-variant .glass-panel-dark .text-slate-600   { color: rgba(13, 17, 23, 0.30) !important; }
        .light-variant .glass-panel-dark a                 { color: rgba(13, 17, 23, 0.55) !important; }
        .light-variant .glass-panel-dark a:hover           { color: rgba(13, 17, 23, 0.90) !important; }

        /* Tenure / purchase-type pills */
        .light-variant .glass-panel-dark [class*="bg-white/12"]  { background: rgba(13, 17, 23, 0.07) !important; }
        .light-variant .glass-panel-dark [class*="ring-white/"]  { --tw-ring-color: rgba(13, 17, 23, 0.15) !important; }

        /* Progress bar track */
        .light-variant .glass-panel-dark [class*="bg-white/10"]  { background: rgba(13, 17, 23, 0.08) !important; }

        /* Exchange countdown: amber + red already have enough contrast; slate-100 → dark handled above */

        /* ── Tab bar: light glass (no .glass-page dark override) ── */
        .light-variant .glass-nav {
          background: rgba(255, 255, 255, 0.68) !important;
          backdrop-filter: blur(32px) saturate(200%) brightness(1.05) !important;
          -webkit-backdrop-filter: blur(32px) saturate(200%) brightness(1.05) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.50) !important;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.04) !important;
        }

        /* Inactive tabs: dark text on light nav */
        .light-variant .glass-nav button[data-active="false"] {
          color: rgba(13, 17, 23, 0.42) !important;
        }
        .light-variant .glass-nav button[data-active="false"]:hover {
          color: rgba(13, 17, 23, 0.80) !important;
          background: rgba(13, 17, 23, 0.06) !important;
        }

        /* Active pill: dark tint on light nav (white pill reads poorly on white nav) */
        .light-variant .glass-nav button[data-active="true"] {
          background: rgba(13, 17, 23, 0.10) !important;
          color: rgba(13, 17, 23, 0.92) !important;
        }
        .light-variant .glass-nav button[data-active="true"] span {
          background: rgba(234, 88, 12, 0.15) !important;
          color: rgb(194, 65, 12) !important;
        }
      `}</style>

      {/* Light backdrop — white scrim at 15% (vs dark's 52%) lets image breathe */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)), url('${LIGHT_BG}') center center / cover no-repeat`,
        }}
      />

      <div className="light-variant flex min-h-screen">
        <main className="flex-1 min-h-screen">
          <PropertyHero
            address="14 Grosvenor Square, London W1K 2HP"
            agencyName="Savills London"
            status="active"
            tenure="leasehold"
            purchaseType="mortgage"
            purchasePrice={75_000_000}
            exchangeDate={MOCK_EXCHANGE}
            percent={68}
            onTrack="on_track"
            backHref="/dashboard"
          />
          <PropertyFileTabs tabs={TABS} sidebar={<SidebarPlaceholder />}>
            {[
              <MilestonesPlaceholder key="milestones" />,
              <PlaceholderCard key="contacts" label="Contacts" />,
              <PlaceholderCard key="comms" label="Comms" />,
              <PlaceholderCard key="notes" label="Notes" />,
            ]}
          </PropertyFileTabs>
        </main>
      </div>
    </>
  );
}
