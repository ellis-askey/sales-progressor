"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { P } from "./portal-ui";
import { PortalInstallPrompt } from "./PortalInstallPrompt";
import { PortalPushPrompt } from "./PortalPushPrompt";
import { extractFirstName } from "@/lib/contacts/displayName";

type Props = {
  token: string;
  contactName: string;
  roleType: string;
  propertyAddress: string;
  agencyName: string;
  vapidPublicKey: string;
  // Optional signed URL for the property photo. When present renders as a
  // hero image below the header; when null the header sits on its own
  // (no dashed placeholder, no broken state).
  photoUrl?: string | null;
  children: React.ReactNode;
};

export function PortalShell({ token, contactName, roleType, propertyAddress, agencyName, vapidPublicKey, photoUrl, children }: Props) {
  const pathname = usePathname();
  const base = `/portal/${token}`;

  // Clear the home screen badge whenever the user opens the portal
  useEffect(() => {
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [pathname]);

  const isHome     = pathname === base || pathname === base + "/";
  const isProgress = pathname.startsWith(base + "/progress");
  const isUpdates  = pathname.startsWith(base + "/updates");
  // Hide install + push prompts on the chase respond page — the page is
  // a focused single-task UX reached from a chase email, and both prompts
  // (Add to Home Screen, Enable Notifications) compete for attention
  // with the chase items. Also: the browser's PWA install would capture
  // the chase deep-link URL (not the manifest's start_url), which would
  // create a stale home-screen icon. Both prompts still appear on the
  // overview / progress / updates pages where they belong.
  const isRespond  = pathname.startsWith(base + "/respond");

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
          <div className="flex items-center justify-between">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: P.primary }}
            >
              {agencyName}
            </p>
            <div
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{ background: P.primaryBg, color: P.primaryText }}
            >
              {extractFirstName(contactName)}
            </div>
          </div>
        </div>
      </div>

      {/* Property photo hero — rendered under the header on the home tab
          only. Absent when no photo has been uploaded; no dashed
          placeholder in that case. Kept off the respond page to preserve
          its single-task focus. */}
      {photoUrl && isHome && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={propertyAddress}
            style={{
              width: "100%",
              maxHeight: 220,
              objectFit: "cover",
              borderRadius: 14,
              boxShadow: P.shadowSm,
            }}
          />
        </div>
      )}

      {/* Page content */}
      <main className="max-w-lg mx-auto px-4 pt-5 pb-32">
        {!isRespond && (
          <div className="lg:hidden">
            <PortalInstallPrompt />
            <PortalPushPrompt token={token} vapidPublicKey={vapidPublicKey} />
          </div>
        )}
        {children}
      </main>

      {/* Bottom tab bar — Elevra-style (2026-08-09): blur backdrop
          instead of solid white, hairline top border instead of rounded
          shadow. Active tab shows a coral glow behind the icon + the
          icon scales up gently. Same 3 tabs, same icons, same labels. */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-20"
        style={{
          background: "rgba(255, 255, 255, 0.82)",
          borderTop: "0.5px solid rgba(15, 23, 42, 0.08)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        }}
      >
        <div className="max-w-lg mx-auto">
          <ul className="grid grid-cols-3 px-2 py-2 m-0 list-none">
            <li className="relative"><TabItem href={base}               active={isHome}     icon="home"     label="Overview" /></li>
            <li className="relative"><TabItem href={`${base}/progress`} active={isProgress} icon="progress" label="Progress" /></li>
            <li className="relative"><TabItem href={`${base}/updates`}  active={isUpdates}  icon="updates"  label="Updates" /></li>
          </ul>
          {/* iOS home-indicator inset */}
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      </nav>
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
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl"
    >
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{
          width: 32,
          height: 32,
          color: active ? P.primary : P.textMuted,
          // Elevra's "shadow-glowAccent" — accent-hued glow behind the
          // icon when active. Coral for the portal (P.primary).
          boxShadow: active
            ? "0 0 24px rgba(255, 107, 74, 0.35)"
            : "none",
          transform: active ? "scale(1.1)" : "scale(1)",
          transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), color 150ms ease, box-shadow 200ms ease",
        }}
      >
        {icon === "home"     && <HomeIcon     active={active} />}
        {icon === "progress" && <ProgressIcon active={active} />}
        {icon === "updates"  && <UpdatesIcon  active={active} />}
      </span>
      <span
        className="text-[10px] font-semibold"
        style={{
          color: active ? P.primary : P.textMuted,
          transition: "color 150ms ease",
        }}
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
