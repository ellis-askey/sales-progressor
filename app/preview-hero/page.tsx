// TEMPORARY — Phase 1b screenshot preview. Delete after review.
// Renders PropertyHero + PropertyFileTabs with mock data, no auth required.

import { PropertyHero } from "@/components/transaction/PropertyHero";
import { PropertyFileTabs } from "@/components/transaction/PropertyFileTabs";

const MOCK_EXCHANGE = new Date(Date.now() + 12 * 86_400_000); // 12 days out

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
          <div className="w-20 h-20 rounded-full border-4 border-blue-400/30 flex items-center justify-center">
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

export default function PreviewHeroPage() {
  return (
    <>
      {/* Photo backdrop at root level — outside glass-page stacking context,
          same position as AppShell's backdrop. z-index: -10 in root context
          sits below glass-page (z-index: 0) so it shows through everywhere. */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(rgba(8,12,25,0.52), rgba(6,10,22,0.58)), url('/hero-bg.jpg') center center / cover no-repeat",
        }}
      />
      <div className="flex min-h-screen glass-page">
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
