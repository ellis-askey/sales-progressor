import { P } from "@/components/portal/portal-ui";

export default function PortalHomeLoading() {
  return (
    <div className="pb-28 space-y-4 px-4 pt-4">
      {/* Hero strip skeleton */}
      <div
        className="rounded-b-3xl animate-pulse"
        style={{ height: 200, background: "rgba(255,138,101,0.15)" }}
      />

      {/* Stat row */}
      <div className="flex justify-around py-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-6 w-8 rounded animate-pulse" style={{ background: P.border }} />
            <div className="h-3 w-14 rounded animate-pulse" style={{ background: P.border }} />
          </div>
        ))}
      </div>

      {/* Next action card */}
      <div
        className="rounded-2xl animate-pulse"
        style={{ height: 160, background: "rgba(255,138,101,0.08)", border: `1px solid ${P.border}` }}
      />

      {/* Coming up / tips */}
      {[120, 80].map((h, i) => (
        <div
          key={i}
          className="rounded-2xl animate-pulse"
          style={{ height: h, background: P.cardBg, boxShadow: P.shadowSm }}
        />
      ))}
    </div>
  );
}
