export default function PortalNotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: "#F8F9FB",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="max-w-sm w-full text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(255,107,74,0.10)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <h1 className="text-[22px] font-bold mb-2" style={{ color: "#1A1D29" }}>
          Portal not found
        </h1>
        <p className="text-[14px] leading-relaxed" style={{ color: "#4A5162" }}>
          This link may have expired or the address is incorrect. Please check the link you were sent and try again, or contact your sales progressor.
        </p>
      </div>
    </div>
  );
}
