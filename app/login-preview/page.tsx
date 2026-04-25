import { SunriseBackground } from "@/components/login/SunriseBackground"
import { WarmLoginForm } from "@/components/login/WarmLoginForm"

// Custom brand mark — three milestone nodes in a chain, last one checked.
// Represents the product: structured progression from offer to keys.
function BrandMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="12" fill="url(#bm-grad)" />
      <defs>
        <linearGradient id="bm-grad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFAA7A" />
          <stop offset="100%" stopColor="#FF6B4A" />
        </linearGradient>
      </defs>
      {/* Node 1 */}
      <circle cx="10" cy="22" r="3" fill="white" fillOpacity="0.55" />
      {/* Connector */}
      <line x1="13" y1="22" x2="18" y2="22" stroke="white" strokeWidth="1.5" strokeOpacity="0.40" strokeLinecap="round" />
      {/* Node 2 */}
      <circle cx="21" cy="22" r="3" fill="white" fillOpacity="0.78" />
      {/* Connector */}
      <line x1="24" y1="22" x2="29" y2="22" stroke="white" strokeWidth="1.5" strokeOpacity="0.40" strokeLinecap="round" />
      {/* Node 3 — complete, with check */}
      <circle cx="34" cy="22" r="4" fill="white" />
      <path d="M32.2 22l1.5 1.5 2.8-2.8" stroke="#FF7A54" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function LoginPreviewPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      <SunriseBackground />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "380px" }}>

        {/* Brand mark + heading */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.25rem" }}>
            <BrandMark />
          </div>
          <h1 style={{
            margin: 0,
            fontSize: "1.625rem",
            fontWeight: 600,
            color: "#3D1F0E",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}>
            Welcome back.
          </h1>
          <p style={{ margin: "0.4rem 0 0", fontSize: "12px", color: "#7A4A2E", opacity: 0.85 }}>
            Sign in to Sales Progressor
          </p>
        </div>

        {/* Frosted glass card */}
        <div style={{
          background: "rgba(255,255,255,0.38)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: "16px",
          border: "0.5px solid rgba(255,255,255,0.60)",
          borderTop: "0.5px solid rgba(255,255,255,0.82)",
          padding: "1.75rem",
          boxShadow: "0 20px 60px rgba(200,80,30,0.16), inset 0 0 0 0.5px rgba(255,255,255,0.14)",
        }}>
          <WarmLoginForm />
        </div>

        {/* Trust strip */}
        <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            {["SSL encrypted", "GDPR compliant", "UK data"].map((item, i, arr) => (
              <span key={item} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.52)" }}>{item}</span>
                {i < arr.length - 1 && (
                  <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.25)" }}>·</span>
                )}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              display: "inline-block",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#4CAF50",
              animation: "pulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: "11px", color: "rgba(61,31,14,0.50)" }}>All systems operational</span>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }
        @media (max-width: 480px) {
          /* Card takes more width on small screens */
          div[style*="max-width: 380px"] {
            max-width: 92vw !important;
          }
        }
      `}</style>
    </div>
  )
}
