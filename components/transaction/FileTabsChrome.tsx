"use client";

// FileTabsChrome — the client shell for the file-detail surface.
//
// 2026-09-20 perf (Layer 1): replaces PropertyFileTabs. The old component held
// EVERY tab's server-rendered panel as children and toggled visibility with
// opacity, which meant opening a file rendered (and DB-fetched) all ~9 tabs at
// once. Tabs are now real route segments under the file's layout, so only the
// active tab's panel is ever rendered. This component is just the chrome: the
// sticky tab bar (now links to the tab segments), the responsive sidebar, and
// the providers the panels expect.
//
// TabContext.setActiveTab is re-implemented here as a route navigation, so the
// ~10 existing call sites that switch tabs programmatically (Overview widgets,
// the milestone strip, the file-setup checklist, the demo tour, ...) keep
// working unchanged — they just drive the URL now.

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { House, ListChecks, Bell, CheckSquare, Pulse, FileText, PaperPlaneTilt, WhatsappLogo, LinkSimple, ClipboardText } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { TabContext } from "./TabContext";
import { TabBadgeContext, type TabBadgeUpdater } from "./TabBadgeContext";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";

const TAB_ICONS: Record<string, Icon> = {
  house: House,
  setup: ClipboardText,
  steps: ListChecks,
  chain: LinkSimple,
  bell: Bell,
  todo: CheckSquare,
  activity: Pulse,
  documents: FileText,
  chase: PaperPlaneTilt,
  whatsapp: WhatsappLogo,
};

type Tab = { key: string; label: string; badge?: number; icon?: string };

type Props = {
  tabs: Tab[];
  children: React.ReactNode;
  sidebar: React.ReactNode;
  // Base path of the file, e.g. /agent/transactions/abc123. The Overview tab is
  // the base itself; every other tab is `${basePath}/${key}`.
  basePath: string;
  heroConnected?: boolean;
  rightSlot?: React.ReactNode;
  beforeContent?: React.ReactNode;
  tourSlot?: React.ReactNode;
};

// The tab key that corresponds to the base (index) route.
const OVERVIEW_KEY = "overview";

// Tab-switch timing (ij13f6, Ellis-only badge). Stamp the click moment; the
// destination's TabEnter reads it on mount to report click→content-painted ms.
function markNavStart() {
  if (typeof window !== "undefined") {
    (window as unknown as { __tspTabNavStart?: number }).__tspTabNavStart = performance.now();
  }
}

function hrefFor(basePath: string, key: string) {
  return key === OVERVIEW_KEY ? basePath : `${basePath}/${key}`;
}

// Module-scoped: persists across SPA navigations for the browser session
let _sessionSidebarOpen = false;

export function FileTabsChrome({ tabs, children, sidebar, basePath, heroConnected, rightSlot, beforeContent, tourSlot }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Active tab from the URL: the trailing segment after basePath, or Overview
  // when we're at the base itself.
  const active = (() => {
    if (!pathname || pathname === basePath) return OVERVIEW_KEY;
    const rest = pathname.startsWith(basePath + "/") ? pathname.slice(basePath.length + 1) : "";
    const seg = rest.split("/")[0];
    return tabs.some((t) => t.key === seg) ? seg : OVERVIEW_KEY;
  })();

  // setActiveTab now drives the URL. Kept on the same context key so every
  // existing caller (widgets, strip, demo tour) works without changes.
  const setActiveTab = useCallback(
    (key: string) => {
      const target = tabs.find((t) => t.key === key) ? key : OVERVIEW_KEY;
      markNavStart();
      router.push(hrefFor(basePath, target), { scroll: false });
    },
    [router, basePath, tabs],
  );

  // ── Tab prefetch (perf: instant, skeleton-free tab switches) ───────────────
  // The tab links use prefetch={true} (below). Each tab is a dynamic route
  // segment with a 300s client-cache window (unstable_dynamicStaleTime), so
  // Next prefetches the full payload — DATA included, not just the loading
  // skeleton — when a link is in the viewport, and reuses it instantly for 5
  // minutes. This replaces the old prefetch={false} + manual router.prefetch
  // warm sweep: that only warmed the loading boundary (measured: tab switches
  // still cost 2.6-5.9s server round-trips on prod), because router.prefetch
  // doesn't fetch dynamic content. The original "9 queries on open" worry no
  // longer applies — the route-split made each tab its own light request and
  // the trunk/tab queries are single-digit-ms co-located (Contact is 339 rows,
  // its scan 2ms), so prefetching all tabs on open is cheap and warms the
  // serverless functions too.

  // Live badge overrides — a mounted panel can still bump its own count after an
  // action (e.g. dismissing a reminder). Seeded from the server-provided counts.
  const [badgeOverrides, setBadgeOverrides] = useState<Record<string, number>>({});
  const updateBadge = useCallback<TabBadgeUpdater>((key, count) => {
    setBadgeOverrides((prev) => (prev[key] === count ? prev : { ...prev, [key]: count }));
  }, []);
  const badgeFor = (t: Tab) => badgeOverrides[t.key] ?? t.badge ?? 0;

  const [sidebarOpen, setSidebarOpen] = useState(_sessionSidebarOpen);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeIdx = tabs.findIndex((t) => t.key === active);
  const { btnRefs, ind } = useTabIndicator(activeIdx);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Tab-bar overflow affordance (fades + chevrons when tabs overflow).
  const [tabFade, setTabFade] = useState<"none" | "left" | "right" | "both">("none");
  const updateTabFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setTabFade(left && right ? "both" : left ? "left" : right ? "right" : "none");
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateTabFade();
    el.addEventListener("scroll", updateTabFade, { passive: true });
    const ro = new ResizeObserver(updateTabFade);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateTabFade);
      ro.disconnect();
    };
  }, [updateTabFade]);

  function toggleSidebar() {
    const next = !sidebarOpen;
    _sessionSidebarOpen = next;
    setSidebarOpen(next);
  }

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const t = Math.min(scrollY / 40, 1);
      const blur = 20 + t * 12;
      const el = tabBarRef.current;
      if (!el) return;
      el.style.setProperty("--tab-bar-blur", `${blur}px`);

      if (heroConnected) {
        const stuck = el.getBoundingClientRect().top <= 0;
        if (!stuck) {
          el.classList.remove("glass-nav");
          el.style.background = "transparent";
          el.style.backdropFilter = "";
          el.style.setProperty("-webkit-backdrop-filter", "");
          el.style.border = "none";
          el.style.borderRadius = "0";
          el.style.overflow = "visible";
          el.style.boxShadow = "none";
        } else {
          el.classList.add("glass-nav");
          el.style.background = "";
          el.style.backdropFilter = "";
          el.style.setProperty("-webkit-backdrop-filter", "");
          el.style.border = "";
          el.style.borderRadius = "";
          el.style.overflow = "";
          el.style.boxShadow = "";
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [heroConnected]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <TabContext.Provider value={{ setActiveTab }}>
      <TabBadgeContext.Provider value={updateBadge}>
        <div ref={tabBarRef} className={`sticky top-0 z-20${heroConnected ? "" : " glass-nav"}`}>
          <div
            className={heroConnected ? "" : "px-4 md:px-8"}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            {(tabFade === "left" || tabFade === "both") && (
              <button
                type="button"
                onClick={() => scrollRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
                className="agent-tab-scroll-btn agent-tab-scroll-left"
                aria-label="Scroll tabs left"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            {(tabFade === "right" || tabFade === "both") && (
              <button
                type="button"
                onClick={() => scrollRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
                className="agent-tab-scroll-btn agent-tab-scroll-right"
                aria-label="Scroll tabs right"
              >
                <ChevronRight size={14} />
              </button>
            )}
            <div
              ref={scrollRef}
              data-fade={tabFade === "none" ? undefined : tabFade}
              className="agent-tab-bar overflow-x-auto scrollbar-hide"
            >
              {/* Sliding underline indicator */}
              {ind && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: ind.left,
                    width: ind.width,
                    height: 2,
                    background: "var(--agent-coral)",
                    borderRadius: "1px 1px 0 0",
                    transition: prefersReducedMotion ? "none" : "left 200ms ease, width 200ms ease",
                    pointerEvents: "none",
                  }}
                />
              )}
              {tabs.map((tab, i) => {
                const isActive = active === tab.key;
                const badgeCount = badgeFor(tab);
                const TabIcon = tab.icon ? TAB_ICONS[tab.icon] : undefined;
                return (
                  <Link
                    key={tab.key}
                    href={hrefFor(basePath, tab.key)}
                    prefetch={true}
                    scroll={false}
                    onClick={markNavStart}
                    ref={(el) => { btnRefs.current[i] = el as unknown as HTMLButtonElement | null; }}
                    data-active={isActive ? "true" : undefined}
                    aria-selected={isActive}
                    aria-current={isActive ? "page" : undefined}
                    className="agent-tab flex-shrink-0"
                  >
                    {TabIcon && <TabIcon size={15} weight={isActive ? "fill" : "regular"} aria-hidden />}
                    {tab.label}
                    {badgeCount > 0 && (
                      <span
                        className="text-xs rounded-full px-1.5 py-0.5 font-medium leading-none"
                        style={isActive
                          ? { background: "var(--agent-coral)", color: "var(--agent-text-on-coral)" }
                          : { background: "rgba(var(--agent-coral-base-rgb),0.12)", color: "var(--agent-coral-deep)" }
                        }
                      >
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            </div>
            {rightSlot && (
              <div style={{ flexShrink: 0, paddingRight: heroConnected ? 12 : 0 }}>
                {rightSlot}
              </div>
            )}
          </div>
        </div>

        {/* Zone 4 - always-visible full-width slot (milestone journey strip). */}
        {beforeContent && (
          <div style={{ marginTop: 12, marginBottom: 4 }}>
            {beforeContent}
          </div>
        )}

        {/* Mobile/tablet collapsible sidebar — hidden once the fixed sidebar
            takes over at xl. */}
        <div className="xl:hidden border-b border-white/20">
          <button
            onClick={toggleSidebar}
            aria-expanded={sidebarOpen}
            className={`agent-hover-ctl flex w-full items-center justify-between ${heroConnected ? "" : "px-4 "}py-3 text-sm font-medium text-slate-900/60 hover:text-slate-900/80 transition-colors`}
          >
            <span>File details</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${sidebarOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div className={[
            !heroConnected ? "px-4" : "",
            "pt-3 pb-3 md:pb-5 file-acc-body",
            sidebarOpen ? "" : "hidden",
          ].filter(Boolean).join(" ")}>
            {sidebar}
          </div>
        </div>

        {/* Tab content (the active route segment) + desktop sidebar */}
        <div className={`${heroConnected ? "" : "px-4 lg:px-8 "}pt-3 pb-5 lg:pb-7 flex flex-col xl:flex-row gap-4 xl:gap-5 xl:items-start`}>
          <div className="flex-1 min-w-0 relative">
            {children}
          </div>

          <div id="file-sidebar" style={{ scrollMarginTop: 100 }} className="hidden xl:block w-72 flex-shrink-0 sticky top-[53px]">
            {sidebar}
          </div>
        </div>
        {tourSlot}
      </TabBadgeContext.Provider>
    </TabContext.Provider>
  );
}
