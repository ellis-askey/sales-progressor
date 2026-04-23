"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { P } from "./portal-ui";
import { PortalInstallPrompt } from "./PortalInstallPrompt";

type Props = {
  token: string;
  contactName: string;
  roleType: string;
  propertyAddress: string;
  agencyName: string;
  children: React.ReactNode;
};

export function PortalShell({ token, contactName, roleType, propertyAddress, agencyName, children }: Props) {
  const pathname = usePathname();
  const base = `/portal/${token}`;

  const isHome     = pathname === base || pathname === base + "/";
  const isProgress = pathname.startsWith(base + "/progress");
  const isUpdates  = pathname.startsWith(base + "/updates");

  return (
    <div
      className="min-h-screen"
      style={{
        background: P.pageBg,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Top header — solid white, real shadow */}
      <div
        className="sticky top-0 z-10"
        style={{ background: "#FFFFFF", boxShadow: P.shadowSm }}
      >
        <div className="max-w-lg mx-auto px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1"
                style={{ color: P.primary }}
              >
                {agencyName}
              </p>
              <h1
                className="text-[15px] font-semibold leading-snug truncate"
                style={{ color: P.textPrimary }}
              >
                {propertyAddress}
              </h1>
            </div>
            <div
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{ background: P.primaryBg, color: P.primaryText }}
            >
              {contactName.split(" ")[0]}
            </div>
          </div>
        </div>
      </div>

      {/* Page content */}
      <main className="max-w-lg mx-auto px-4 pt-5 pb-32">
        <PortalInstallPrompt />
        {children}
      </main>

      {/* Bottom tab bar — solid white, floating with upward shadow */}
      <div className="fixed bottom-0 inset-x-0 z-20">
        <div className="max-w-lg mx-auto">
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -4px 24px rgba(15,23,42,0.08), 0 -1px 4px rgba(15,23,42,0.04)",
            }}
          >
            <div className="grid grid-cols-3 px-2 py-2">
              <TabItem href={base}               active={isHome}     icon="home"     label="Overview" />
              <TabItem href={`${base}/progress`} active={isProgress} icon="progress" label="Progress" />
              <TabItem href={`${base}/updates`}  active={isUpdates}  icon="updates"  label="Updates" />
            </div>
            <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TabItem({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: "home" | "progress" | "updates";
  label: string;
}) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition-all">
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all"
        style={{
          background: active ? P.primaryBg : "transparent",
          color: active ? P.primary : P.textMuted,
        }}
      >
        {icon === "home"     && <HomeIcon     active={active} />}
        {icon === "progress" && <ProgressIcon active={active} />}
        {icon === "updates"  && <UpdatesIcon  active={active} />}
      </div>
      <span
        className="text-[10px] font-semibold transition-colors"
        style={{ color: active ? P.primary : P.textMuted }}
      >
        {label}
      </span>
    </Link>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <>
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15"/>
          <polyline points="12 6 12 12 16 14"/>
          <circle cx="12" cy="12" r="10"/>
        </>
      ) : (
        <>
          <polyline points="12 6 12 12 16 14"/>
          <circle cx="12" cy="12" r="10"/>
        </>
      )}
    </svg>
  );
}

function UpdatesIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill={active ? "currentColor" : "none"} opacity={active ? "0.15" : "1"}/>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}
