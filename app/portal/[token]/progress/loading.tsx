import { P } from "@/components/portal/portal-ui";

export default function PortalProgressLoading() {
  return (
    <div className="pb-28 space-y-3 px-4 pt-4">
      {/* Progress header */}
      <div
        className="rounded-2xl animate-pulse"
        style={{ height: 64, background: P.cardBg, boxShadow: P.shadowSm }}
      />
      {/* Milestone group cards */}
      {[200, 160, 180, 140].map((h, i) => (
        <div
          key={i}
          className="rounded-2xl animate-pulse"
          style={{ height: h, background: P.cardBg, boxShadow: P.shadowSm }}
        />
      ))}
    </div>
  );
}
