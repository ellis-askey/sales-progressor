// components/account/chrome/AccountPageHeader.tsx
//
// Per-page header for the Account area: page title + subtitle on the left,
// "Back to Sales Progressor" on the right. The back link's background is
// transparent at rest AND on hover (no grey fill); on hover the arrow slides
// left and eases back on leave. Keyboard focus mirrors hover.

import { SettingsBackLink } from "@/components/agent/SettingsBackLink";

export function AccountPageHeader({
  title,
  subtitle,
  backLabel = "Back to Sales Progressor",
  backHref = "/agent/hub",
}: {
  title: string;
  subtitle?: string;
  // The external progression-business settings area passes "Back to progression"
  // so the link reads in the owner's own terms; the agency account area keeps
  // the default. Both point at the hub.
  backLabel?: string;
  backHref?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "#6b7280", maxWidth: 560 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Back goes to the page you came from (critique #187), falling back to the
          hub; label/href default to the agency wording, overridden by the business
          settings pages. */}
      <SettingsBackLink label={backLabel} className="account-back-link" arrowClassName="account-back-arrow" fallbackHref={backHref} />

      <style>{`
        .account-back-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          margin: 2px -10px 0 0;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          text-decoration: none;
          border-radius: 8px;
          background: transparent;
          flex-shrink: 0;
          transition: color 150ms ease;
        }
        .account-back-link:hover,
        .account-back-link:focus-visible { background: transparent; color: #111827; outline: none; }
        .account-back-arrow {
          transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .account-back-link:hover .account-back-arrow,
        .account-back-link:focus-visible .account-back-arrow {
          transform: translateX(-3px);
        }
      `}</style>
    </div>
  );
}
