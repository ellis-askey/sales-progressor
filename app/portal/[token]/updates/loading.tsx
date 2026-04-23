import { P } from "@/components/portal/portal-ui";

export default function PortalUpdatesLoading() {
  return (
    <div className="pb-28 space-y-3 px-4 pt-4">
      {/* Header */}
      <div
        className="rounded-2xl animate-pulse"
        style={{ height: 72, background: P.cardBg, boxShadow: P.shadowSm }}
      />
      {/* Update cards */}
      {[90, 100, 80, 95, 85].map((h, i) => (
        <div
          key={i}
          className="rounded-2xl animate-pulse"
          style={{ height: h, background: P.cardBg, boxShadow: P.shadowSm }}
        />
      ))}
    </div>
  );
}
