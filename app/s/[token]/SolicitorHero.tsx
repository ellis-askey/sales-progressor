import { S } from "./ui";

// The hero: the supplied blue image with content over it and a distinct frosted
// white CARD floating near the foot (a card, not a blend — per Ellis). The ring
// clones the client portal's HeroRing (SVG arc), recoloured for the blue image.

export type HeroProps = {
  matterTypeLabel: string; // "Seller matter" / "Buyer matter"
  address: string;
  addressLine2: string;
  price: string | null;
  tenure: string | null;
  purchaseType: string | null;
  actingForNames: string;
  actingForRole: string; // "Seller" / "Buyer"
  firmName: string | null;
  ringPercent: number; // 0-100
  ringStep: number; // 1-6
  lastUpdated: string | null;
  agencyName: string;
};

function HeroRing({ percent, step }: { percent: number; step: number }) {
  const size = 92;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = c * (1 - clamped / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: S.heroText }}>{step}</span>
        <span style={{ fontSize: 10, fontWeight: 500, color: S.heroTextSoft, marginTop: 2 }}>of 6</span>
      </div>
    </div>
  );
}

function HeroPill({ children, filled }: { children: React.ReactNode; filled?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 12,
        fontWeight: 600,
        color: S.heroText,
        padding: "5px 11px",
        borderRadius: 999,
        background: filled ? S.heroPill : "transparent",
        border: filled ? "none" : `1px solid ${S.heroPillBorder}`,
      }}
    >
      {children}
    </span>
  );
}

export function SolicitorHero(p: HeroProps) {
  return (
    <div
      className="portal-reveal-fade"
      style={{
        position: "relative",
        borderRadius: S.radiusLg,
        overflow: "hidden",
        backgroundColor: "#0f3aa0",
        backgroundImage: "url(/solicitor-hero.png)",
        backgroundSize: "cover",
        backgroundPosition: "center right",
        boxShadow: S.shadowCard,
      }}
    >
      <div style={{ position: "relative", padding: "18px 18px 18px" }}>
        {/* Top: matter type pill + address + price/tenure, with the ring right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <HeroPill filled>{p.matterTypeLabel}</HeroPill>
            <h1 style={{ margin: "14px 0 2px", fontSize: 24, fontWeight: 700, color: S.heroText, lineHeight: 1.15, letterSpacing: "-0.01em" }}>{p.address}</h1>
            <p style={{ margin: 0, fontSize: 14, color: S.heroTextSoft }}>{p.addressLine2}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
              {p.price && <HeroPill>{p.price}</HeroPill>}
              {p.tenure && <HeroPill>{p.tenure}</HeroPill>}
              {p.purchaseType && <HeroPill>{p.purchaseType}</HeroPill>}
            </div>
          </div>
          <HeroRing percent={p.ringPercent} step={p.ringStep} />
        </div>

        {/* Frosted white card */}
        <div
          style={{
            marginTop: 18,
            borderRadius: 14,
            background: S.heroGlassBg,
            backdropFilter: S.heroGlassBlur,
            WebkitBackdropFilter: S.heroGlassBlur,
            border: `1px solid ${S.heroGlassBorder}`,
            boxShadow: S.heroGlassShadow,
          }}
        >
          <div style={{ display: "flex", padding: "14px 16px" }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
              <p style={{ margin: "0 0 3px", fontSize: 12, color: S.muted }}>You are acting for</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.ink, lineHeight: 1.35 }}>
                {p.actingForNames || "your client"} <span style={{ fontWeight: 400, color: S.muted }}>({p.actingForRole})</span>
              </p>
            </div>
            <div style={{ width: 1, background: "rgba(15,39,64,0.10)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 14 }}>
              <p style={{ margin: "0 0 3px", fontSize: 12, color: S.muted }}>Your firm</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.ink, lineHeight: 1.35 }}>{p.firmName ?? "—"}</p>
            </div>
          </div>
          {p.lastUpdated && (
            <div style={{ borderTop: "1px solid rgba(15,39,64,0.08)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: S.inkSoft }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: S.successRing, flexShrink: 0 }} />
                Last updated <strong style={{ color: S.ink, fontWeight: 600 }}>{p.lastUpdated}</strong>
              </span>
              <span style={{ fontSize: 12, color: S.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>by {p.agencyName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
